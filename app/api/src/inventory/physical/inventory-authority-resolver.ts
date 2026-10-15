import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertCutoverControl,
  assertCutoverTransaction,
  cutoverAssert,
  cutoverId,
} from './inventory-cutover.contract';

export type InventoryAuthority = 'LEGACY' | 'CUTOVER' | 'PHYSICAL';
@Injectable()
// The productive transaction boundary acquires the shared authority fence first.
export class InventoryAuthorityResolver {
  async resolve(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<InventoryAuthority> {
    assertCutoverTransaction(tx);
    cutoverId(companyId);
    cutoverAssert(
      await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      }),
      'NOT_FOUND',
    );
    const row = await tx.inventoryCutover.findUnique({ where: { companyId } });
    if (row) {
      assertCutoverControl(row);
      cutoverAssert(row.companyId === companyId, 'MISMATCH');
      return row.status === 'PHYSICAL_ACTIVE' ? 'PHYSICAL' : 'CUTOVER';
    }
    const effect = await tx.inventoryPhysicalEffect.findFirst({
      where: { companyId },
      select: { id: true },
    });
    const position = await tx.inventoryPosition.findFirst({
      where: { companyId },
      select: { id: true },
    });
    cutoverAssert(!effect && !position, 'MISMATCH');
    // Under READ COMMITTED a control may have committed after the first read.
    const fresh = await tx.inventoryCutover.findUnique({
      where: { companyId },
    });
    if (fresh) {
      assertCutoverControl(fresh);
      return fresh.status === 'PHYSICAL_ACTIVE' ? 'PHYSICAL' : 'CUTOVER';
    }
    return 'LEGACY';
  }
}
