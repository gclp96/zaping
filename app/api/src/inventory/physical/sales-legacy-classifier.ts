import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { requirePhysical } from './physical-inventory.contract';
import { assertCutoverControl, isReviewed } from './inventory-cutover.contract';
import {
  assertSalesPhysicalEvidence,
  legacySaleFingerprint,
  legacySaleInclude,
} from './sales-physical-evidence';

@Injectable()
// DORMANT: exact durable evidence only. No historical writes or time heuristics.
export class SalesLegacyClassifier {
  private membership(
    tx: Prisma.TransactionClient,
    companyId: string,
    saleId: string,
  ) {
    return tx.inventoryCutoverLegacySale.findFirst({
      where: { companyId, saleId },
      include: { cutover: true },
    });
  }
  async assertNoMembership(
    tx: Prisma.TransactionClient,
    companyId: string,
    saleId: string,
  ): Promise<void> {
    requirePhysical(
      !(await this.membership(tx, companyId, saleId)),
      'SALE_PHYSICAL_STATE_INCONSISTENT',
    );
  }
  async classify(
    tx: Prisma.TransactionClient,
    companyId: string,
    saleId: string,
  ): Promise<'LEGACY' | 'PHYSICAL' | 'UNKNOWN'> {
    const member = await this.membership(tx, companyId, saleId);
    let sale = await tx.sale.findFirst({
      where: { id: saleId, companyId },
      include: legacySaleInclude,
    });
    requirePhysical(sale, 'SALE_PHYSICAL_STATE_INCONSISTENT');
    const effect = await tx.inventoryPhysicalEffect.findUnique({
      where: {
        companyId_originType_originId_originOperation: {
          companyId,
          originType: 'SALE',
          originId: saleId,
          originOperation: 'CONFIRM',
        },
      },
      include: {
        lines: { include: { position: true }, orderBy: { sequence: 'asc' } },
      },
    });
    requirePhysical(!(member && effect), 'SALE_PHYSICAL_STATE_INCONSISTENT');
    if (effect) {
      if (sale.status !== 'CONFIRMED') {
        sale = await tx.sale.findFirst({
          where: { id: saleId, companyId },
          include: legacySaleInclude,
        });
        requirePhysical(sale, 'SALE_PHYSICAL_STATE_INCONSISTENT');
      }
      assertSalesPhysicalEvidence(companyId, sale, effect);
      return 'PHYSICAL';
    }
    if (!member) return 'UNKNOWN';
    assertCutoverControl(member.cutover);
    requirePhysical(
      member.companyId === companyId &&
        member.cutover.companyId === companyId &&
        isReviewed(member.cutover) &&
        member.statusAtFreeze === 'CONFIRMED' &&
        member.quoteId === sale.quoteId &&
        member.saleFingerprint === legacySaleFingerprint(companyId, sale),
      'SALE_PHYSICAL_STATE_INCONSISTENT',
    );
    return 'LEGACY';
  }
}
