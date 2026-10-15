import { inventoryAuthorityFence } from './inventory-authority-fence';
import { Injectable } from '@nestjs/common';
import { InventoryCutover, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import {
  assertCutoverControl,
  assertCutoverTransaction,
  CutoverExpected,
  CutoverTransition,
  cutoverAssert,
  cutoverId,
  InventoryCutoverError,
  ReviewedManifest,
  transitionTarget,
} from './inventory-cutover.contract';
import { InventoryCutoverRepository } from './inventory-cutover.repository';
import {
  legacySaleFingerprint,
  legacySaleInclude,
} from './sales-physical-evidence';

@Injectable()
// Internal control bookkeeping; exclusive authority fence precedes all roots.
// Caller must supply an already-owned transaction and roll it back on any error.
export class InventoryCutoverService {
  constructor(private readonly repository: InventoryCutoverRepository) {}
  private async authorize(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
  ) {
    cutoverId(actorId);
    cutoverAssert(
      await tx.user.findFirst({
        where: { id: actorId, companyId, isActive: true, role: 'ADMIN' },
        select: { id: true },
      }),
      'ACTOR_FORBIDDEN',
    );
  }
  async create(
    tx: Prisma.TransactionClient,
    input: { id: string; companyId: string; actorId: string },
  ) {
    assertCutoverTransaction(tx);
    cutoverId(input.id);
    cutoverId(input.companyId);
    await inventoryAuthorityFence(tx, input.companyId, 'exclusive');
    await this.authorize(tx, input.companyId, input.actorId);
    // Ordinary INSERT: uniqueness errors abort the caller's transaction. Never retry here.
    return tx.inventoryCutover.create({
      data: {
        id: input.id,
        companyId: input.companyId,
        initiatedBy: input.actorId,
      },
    });
  }
  async transition(
    tx: Prisma.TransactionClient,
    e: CutoverExpected,
    actorId: string,
    op: CutoverTransition,
  ): Promise<{
    outcome: 'APPLIED' | 'ALREADY_TRANSITIONED';
    control: InventoryCutover;
  }> {
    assertCutoverTransaction(tx);
    await inventoryAuthorityFence(tx, e.companyId, 'exclusive');
    const target = transitionTarget(e, op);
    await this.authorize(tx, e.companyId, actorId);
    const row = await this.repository.lock(tx, e.companyId, e.cutoverId);
    cutoverAssert(row, 'NOT_FOUND');
    assertCutoverControl(row);
    if (row.revision !== e.expectedRevision || row.status !== e.expectedStatus)
      return this.readback(tx, e, actorId, op);
    cutoverAssert(row.manifestDigest === e.manifestDigest, 'MISMATCH');
    const data: Parameters<InventoryCutoverRepository['cas']>[3] = {
      status: target,
    };
    if (op.kind === 'REVIEW') {
      cutoverAssert(
        row.manifestLockedAt === null &&
          row.manifestDigest === null &&
          row.approvedBy === null,
        'MISMATCH',
      );
      await this.validateSet(tx, e, op.manifest);
      data.manifestDigest = op.manifest.manifestDigest;
      data.snapshotFingerprint = op.manifest.snapshotFingerprint;
      data.baselineBuild = op.manifest.baselineBuild;
      data.approvedBy = actorId;
    } else if (op.kind === 'LOCK_MANIFEST') {
      cutoverAssert(row.manifestLockedAt === null, 'MISMATCH');
      data.manifestLockedAt = new Date();
    } else if (op.kind === 'RECOVERY') {
      data.recoveryFromStatus = row.status;
    } else if (op.kind === 'RESUME') {
      cutoverAssert(row.recoveryFromStatus === op.target, 'INVALID_TRANSITION');
      data.recoveryFromStatus = null;
    }
    const result = await this.repository.cas(tx, e, op, data);
    if (result.count !== 1) return this.readback(tx, e, actorId, op);
    if (op.kind === 'REVIEW') {
      const common = { companyId: e.companyId, cutoverId: e.cutoverId };
      if (op.manifest.products.length)
        await tx.inventoryCutoverProduct.createMany({
          data: op.manifest.products.map((p) => ({
            ...common,
            ...p,
            projectionEvidence: p.projectionEvidence,
          })),
        });
      if (op.manifest.legacySales.length)
        await tx.inventoryCutoverLegacySale.createMany({
          data: op.manifest.legacySales.map((s) => ({
            ...common,
            ...s,
            statusAtFreeze: 'CONFIRMED' as const,
          })),
        });
    }
    const control = await this.repository.find(tx, e.companyId, e.cutoverId);
    cutoverAssert(control, 'NOT_FOUND');
    assertCutoverControl(control);
    return { outcome: 'APPLIED', control };
  }
  private async readback(
    tx: Prisma.TransactionClient,
    e: CutoverExpected,
    actorId: string,
    op: CutoverTransition,
  ): Promise<{ outcome: 'ALREADY_TRANSITIONED'; control: InventoryCutover }> {
    const row = await this.repository.find(tx, e.companyId, e.cutoverId);
    cutoverAssert(row, 'NOT_FOUND');
    assertCutoverControl(row);
    const digest =
      op.kind === 'REVIEW' ? op.manifest.manifestDigest : e.manifestDigest;
    cutoverAssert(
      row.id === e.cutoverId &&
        row.companyId === e.companyId &&
        row.manifestDigest === digest,
      'MISMATCH',
    );
    if (
      row.revision !== e.expectedRevision + 1 ||
      row.status !== transitionTarget(e, op)
    )
      throw new InventoryCutoverError('STALE_STATE');
    if (op.kind === 'REVIEW') {
      cutoverAssert(
        row.approvedBy === actorId &&
          row.snapshotFingerprint === op.manifest.snapshotFingerprint &&
          row.baselineBuild === op.manifest.baselineBuild,
        'MISMATCH',
      );
      const [products, sales] = await Promise.all([
        tx.inventoryCutoverProduct.findMany({
          where: { companyId: e.companyId, cutoverId: e.cutoverId },
        }),
        tx.inventoryCutoverLegacySale.findMany({
          where: { companyId: e.companyId, cutoverId: e.cutoverId },
        }),
      ]);
      cutoverAssert(
        products.length === op.manifest.products.length &&
          sales.length === op.manifest.legacySales.length,
        'MISMATCH',
      );
      for (const p of op.manifest.products) {
        const stored = products.find((s) => s.productId === p.productId);
        cutoverAssert(
          stored &&
            stored.status === 'PLANNED' &&
            stored.openingEffectId === null &&
            stored.appliedAt === null &&
            stored.verifiedAt === null &&
            stored.manifestProductFingerprint ===
              p.manifestProductFingerprint &&
            stored.expectedOwned === p.expectedOwned &&
            stored.expectedAvailable === p.expectedAvailable &&
            stored.expectedCustody === p.expectedCustody &&
            isDeepStrictEqual(stored.projectionEvidence, p.projectionEvidence),
          'MISMATCH',
        );
      }
      for (const s of op.manifest.legacySales) {
        const stored = sales.find((m) => m.saleId === s.saleId);
        cutoverAssert(
          stored &&
            stored.saleFingerprint === s.saleFingerprint &&
            stored.quoteId === s.quoteId &&
            stored.statusAtFreeze === 'CONFIRMED',
          'MISMATCH',
        );
      }
    }
    if (op.kind === 'RECOVERY')
      cutoverAssert(row.recoveryFromStatus === e.expectedStatus, 'MISMATCH');
    return { outcome: 'ALREADY_TRANSITIONED', control: row };
  }
  private async validateSet(
    tx: Prisma.TransactionClient,
    e: CutoverExpected,
    m: ReviewedManifest,
  ) {
    const where = { companyId: e.companyId, cutoverId: e.cutoverId };
    cutoverAssert(
      (await tx.inventoryCutoverProduct.count({ where })) === 0 &&
        (await tx.inventoryCutoverLegacySale.count({ where })) === 0,
      'MISMATCH',
    );
    const products = await tx.product.findMany({
      where: { companyId: e.companyId, inventoryTracking: 'QUANTITY' },
      select: { id: true, stock: true },
    });
    cutoverAssert(products.length === m.products.length, 'MISMATCH');
    for (const p of m.products) {
      cutoverAssert(
        products.some(
          (actual) =>
            actual.id === p.productId && actual.stock === p.expectedOwned,
        ),
        'MISMATCH',
      );
      const batches = await tx.inventoryBatch.findMany({
        where: { companyId: e.companyId, productId: p.productId },
        select: { id: true, availableQuantity: true, initialQuantity: true },
      });
      cutoverAssert(
        batches.length === p.projectionEvidence.batches.length,
        'MISMATCH',
      );
      for (const b of p.projectionEvidence.batches)
        cutoverAssert(
          batches.some(
            (actual) =>
              actual.id === b.batchId &&
              actual.availableQuantity === b.availableQuantityBefore &&
              actual.initialQuantity === b.initialQuantityBefore,
          ),
          'MISMATCH',
        );
    }
    const confirmed = await tx.sale.findMany({
      where: { companyId: e.companyId, status: 'CONFIRMED' },
      select: { id: true },
    });
    const effects = await tx.inventoryPhysicalEffect.findMany({
      where: {
        companyId: e.companyId,
        originType: 'SALE',
        originOperation: 'CONFIRM',
      },
      select: { originId: true },
    });
    const physicalIds = new Set(effects.map((x) => x.originId));
    const legacyIds = confirmed.filter((s) => !physicalIds.has(s.id));
    cutoverAssert(legacyIds.length === m.legacySales.length, 'MISMATCH');
    for (const member of m.legacySales) {
      cutoverAssert(
        legacyIds.some((s) => s.id === member.saleId),
        'MISMATCH',
      );
      const sale = await tx.sale.findFirst({
        where: { companyId: e.companyId, id: member.saleId },
        include: legacySaleInclude,
      });
      cutoverAssert(
        sale &&
          sale.quoteId === member.quoteId &&
          legacySaleFingerprint(e.companyId, sale) === member.saleFingerprint,
        'MISMATCH',
      );
    }
  }
}
