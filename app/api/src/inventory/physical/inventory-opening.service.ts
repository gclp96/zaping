import { InventoryCutover, Prisma, PrismaClient } from '@prisma/client';
import { cutoverAssert, CutoverExpected } from './inventory-cutover.contract';
import { InventoryCutoverRepository } from './inventory-cutover.repository';
import { InventoryCutoverService } from './inventory-cutover.service';
import {
  OpeningManifest,
  OpeningProduct,
  reviewed,
  validateManifest,
} from './inventory-opening-manifest';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { isPhysicalUniqueViolation } from './physical-inventory.contract';
import { InventoryOpeningProjectionService } from './inventory-opening-projection.service';
import {
  assertCheckpointSet,
  assertNoExtraPhysical,
  assertOpeningProduct,
  openingRequestHash,
} from './inventory-opening-evidence';

// Deliberately not registered in a productive Nest module. Explicit internal callers only.
export class InventoryOpeningService {
  readonly controlRepo = new InventoryCutoverRepository();
  readonly controlService = new InventoryCutoverService(this.controlRepo);
  constructor(
    readonly reconciliation: InventoryReconciliationService,
    readonly physical = new PhysicalInventoryRepository(),
    readonly projection = new InventoryOpeningProjectionService(),
  ) {}
  async authorize(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
  ) {
    cutoverAssert(
      await tx.user.findFirst({
        where: { id: actorId, companyId, isActive: true, role: 'ADMIN' },
      }),
      'ACTOR_FORBIDDEN',
    );
  }
  async reviewImport(
    db: PrismaClient,
    m: OpeningManifest,
    actorId: string,
    expected: CutoverExpected,
    replace = false,
  ) {
    validateManifest(m);
    cutoverAssert(
      expected.companyId === m.companyId && expected.cutoverId === m.cutoverId,
      'MISMATCH',
    );
    return db.$transaction(
      async (tx) => {
        await this.authorize(tx, m.companyId, actorId);
        const c = await this.controlRepo.lock(tx, m.companyId, m.cutoverId);
        cutoverAssert(c, 'NOT_FOUND');
        cutoverAssert(
          c.revision === expected.expectedRevision &&
            c.status === expected.expectedStatus &&
            c.manifestDigest === expected.manifestDigest &&
            c.manifestLockedAt === null,
          'STALE_STATE',
        );
        await this.reconciliation.revalidate(tx, m);
        cutoverAssert(
          (await tx.inventoryPosition.count({
            where: { companyId: m.companyId },
          })) === 0 &&
            (await tx.inventoryPhysicalEffect.count({
              where: { companyId: m.companyId },
            })) === 0,
          'MISMATCH',
        );
        if (!replace)
          return this.controlService.transition(tx, expected, actorId, {
            kind: 'REVIEW',
            manifest: reviewed(m),
          });
        cutoverAssert(c.status === 'DRY_RUN_REVIEWED', 'INVALID_TRANSITION');
        const checkpoints = await tx.inventoryCutoverProduct.findMany({
          where: { companyId: m.companyId, cutoverId: m.cutoverId },
        });
        cutoverAssert(
          checkpoints.every(
            (x) =>
              x.status === 'PLANNED' &&
              x.openingEffectId === null &&
              x.appliedAt === null &&
              x.verifiedAt === null,
          ),
          'MISMATCH',
        );
        // Full-set replacement is one transaction; no public child mutation seam.
        const where = { companyId: m.companyId, cutoverId: m.cutoverId };
        await tx.inventoryCutoverProduct.deleteMany({ where });
        await tx.inventoryCutoverLegacySale.deleteMany({ where });
        const changed = await tx.inventoryCutover.updateMany({
          where: {
            id: c.id,
            companyId: c.companyId,
            status: 'DRY_RUN_REVIEWED',
            revision: c.revision,
            manifestDigest: c.manifestDigest,
            manifestLockedAt: null,
          },
          data: {
            manifestDigest: m.manifestDigest,
            snapshotFingerprint: m.snapshotFingerprint,
            baselineBuild: m.baselineBuild,
            approvedBy: actorId,
            revision: { increment: 1 },
          },
        });
        cutoverAssert(changed.count === 1, 'STALE_STATE');
        await tx.inventoryCutoverProduct.createMany({
          data: reviewed(m).products.map((p) => ({
            ...where,
            ...p,
            projectionEvidence: p.projectionEvidence,
          })),
        });
        await tx.inventoryCutoverLegacySale.createMany({
          data: m.legacySales.map((s) => ({
            ...where,
            ...s,
            statusAtFreeze: 'CONFIRMED' as const,
          })),
        });
        await assertCheckpointSet(tx, m);
        return {
          outcome: 'APPLIED' as const,
          control: await this.controlRepo.find(tx, m.companyId, m.cutoverId),
        };
      },
      { timeout: 60000 },
    );
  }
  async lockProduct(
    tx: Prisma.TransactionClient,
    m: OpeningManifest,
    p: OpeningProduct,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "productId" FROM "InventoryCutoverProduct" WHERE "cutoverId"=${m.cutoverId} AND "companyId"=${m.companyId} AND "productId"=${p.productId} FOR UPDATE`,
    );
    await this.physical.lockProducts(tx, m.companyId, [p.productId]);
    const batches = await tx.inventoryBatch.findMany({
      where: { companyId: m.companyId, productId: p.productId },
      select: { id: true },
    });
    await this.physical.lockBatches(
      tx,
      m.companyId,
      batches.map((x) => x.id).sort(),
    );
    const positions = await tx.inventoryPosition.findMany({
      where: { companyId: m.companyId, productId: p.productId },
      select: { id: true },
    });
    await this.physical.lockPositions(
      tx,
      m.companyId,
      positions.map((x) => x.id).sort(),
      [],
    );
  }
  assertControl(c: InventoryCutover | null, m: OpeningManifest) {
    cutoverAssert(
      c &&
        c.manifestLockedAt !== null &&
        c.manifestDigest === m.manifestDigest &&
        c.snapshotFingerprint === m.snapshotFingerprint &&
        c.baselineBuild === m.baselineBuild &&
        c.recoveryFromStatus === null,
      'MISMATCH',
    );
    return c;
  }
  async applyProduct(
    db: PrismaClient,
    m: OpeningManifest,
    productId: string,
    actorId: string,
  ) {
    try {
      return await this.applyProductTransaction(db, m, productId, actorId);
    } catch (error) {
      if (!isPhysicalUniqueViolation(error)) throw error;
      // The failed transaction has ended. A uniqueness error alone never means success.
      return this.reconciliation.readOnly(db, async (tx) => {
        validateManifest(m);
        const c = this.assertControl(
          await this.controlRepo.find(tx, m.companyId, m.cutoverId),
          m,
        );
        cutoverAssert(
          ['OPENING_APPLYING', 'OPENING_APPLIED', 'VERIFIED'].includes(
            c.status,
          ),
          'INVALID_TRANSITION',
        );
        await this.authorize(tx, m.companyId, actorId);
        await this.reconciliation.revalidate(tx, m);
        await assertCheckpointSet(tx, m);
        await assertNoExtraPhysical(tx, m);
        const p = m.products.find((x) => x.productId === productId);
        cutoverAssert(p, 'NOT_FOUND');
        await assertOpeningProduct(tx, m, p, true);
        return 'REPLAY' as const;
      });
    }
  }
  private async applyProductTransaction(
    db: PrismaClient,
    m: OpeningManifest,
    productId: string,
    actorId: string,
  ) {
    validateManifest(m);
    const p = m.products.find((x) => x.productId === productId);
    cutoverAssert(p, 'NOT_FOUND');
    return db.$transaction(
      async (tx) => {
        const c = this.assertControl(
          await this.controlRepo.lock(tx, m.companyId, m.cutoverId),
          m,
        );
        await this.authorize(tx, m.companyId, actorId);
        cutoverAssert(
          ['OPENING_APPLYING', 'OPENING_APPLIED', 'VERIFIED'].includes(
            c.status,
          ),
          'INVALID_TRANSITION',
        );
        await this.lockProduct(tx, m, p);
        const cps = await assertCheckpointSet(tx, m);
        const cp = cps.find((x) => x.productId === productId)!;
        await this.reconciliation.revalidate(tx, m);
        await assertNoExtraPhysical(tx, m);
        if (cp.status !== 'PLANNED') {
          await assertOpeningProduct(tx, m, p, true);
          return 'REPLAY' as const;
        }
        cutoverAssert(c.status === 'OPENING_APPLYING', 'INVALID_TRANSITION');
        cutoverAssert(
          cps
            .filter((x) => x.productId < productId)
            .every((x) => x.status !== 'PLANNED'),
          'INVALID_TRANSITION',
        );
        await assertOpeningProduct(tx, m, p, false);
        let openingEffectId: string | null = null;
        if (p.expectedOwned > 0) {
          const effect = await this.physical.claimOpeningEffect(tx, {
            companyId: m.companyId,
            cutoverId: m.cutoverId,
            productId,
            actorId,
            requestHash: openingRequestHash(m, p),
            lineCount: p.pools.length,
          });
          openingEffectId = effect.id;
          for (const [i, pool] of p.pools.entries()) {
            const position = await this.physical.createPosition(
              tx,
              m.companyId,
              {
                productId,
                inventoryBatchId: pool.batchId,
                ...(pool.state === 'AVAILABLE'
                  ? {
                      state: 'AVAILABLE' as const,
                      contextType: null,
                      contextId: null,
                    }
                  : {
                      state: 'CUSTODY' as const,
                      contextType: pool.contextType!,
                      contextId: pool.contextId!,
                    }),
              },
            );
            cutoverAssert(
              (await this.physical.mutatePosition(tx, position, pool.quantity))
                .count === 1,
              'MISMATCH',
            );
            await this.physical.appendLine(tx, {
              companyId: m.companyId,
              effectId: effect.id,
              positionId: position.id,
              sequence: i + 1,
              delta: pool.quantity,
              quantityBefore: 0,
              quantityAfter: pool.quantity,
              revisionBefore: 0,
              revisionAfter: 1,
            });
          }
        }
        await this.projection.apply(tx, m.companyId, p);
        cutoverAssert(
          (
            await tx.inventoryCutoverProduct.updateMany({
              where: {
                companyId: m.companyId,
                cutoverId: m.cutoverId,
                productId,
                status: 'PLANNED',
                manifestProductFingerprint: p.manifestProductFingerprint,
                openingEffectId: null,
              },
              data: {
                status: 'APPLIED',
                openingEffectId,
                appliedAt: new Date(),
              },
            })
          ).count === 1,
          'STALE_STATE',
        );
        await assertOpeningProduct(tx, m, p, true);
        return 'APPLIED' as const;
      },
      { timeout: 60000 },
    );
  }
  async apply(db: PrismaClient, m: OpeningManifest, actorId: string) {
    const results: { productId: string; outcome: string }[] = [];
    for (const p of m.products)
      results.push({
        productId: p.productId,
        outcome: await this.applyProduct(db, m, p.productId, actorId),
      });
    await this.complete(db, m, actorId);
    return results;
  }
  async complete(db: PrismaClient, m: OpeningManifest, actorId: string) {
    validateManifest(m);
    return db.$transaction(
      async (tx) => {
        const c = this.assertControl(
          await this.controlRepo.lock(tx, m.companyId, m.cutoverId),
          m,
        );
        await this.authorize(tx, m.companyId, actorId);
        cutoverAssert(
          ['OPENING_APPLYING', 'OPENING_APPLIED', 'VERIFIED'].includes(
            c.status,
          ),
          'INVALID_TRANSITION',
        );
        await this.reconciliation.revalidate(tx, m);
        const cps = await assertCheckpointSet(tx, m);
        cutoverAssert(
          cps.every((x) => x.status !== 'PLANNED'),
          'MISMATCH',
        );
        for (const p of m.products) await assertOpeningProduct(tx, m, p, true);
        await assertNoExtraPhysical(tx, m);
        if (c.status !== 'OPENING_APPLYING') return 'REPLAY';
        cutoverAssert(
          cps.every((x) => x.status === 'APPLIED'),
          'MISMATCH',
        );
        cutoverAssert(
          (
            await tx.inventoryCutover.updateMany({
              where: {
                id: c.id,
                companyId: c.companyId,
                status: 'OPENING_APPLYING',
                revision: c.revision,
                manifestDigest: m.manifestDigest,
              },
              data: { status: 'OPENING_APPLIED', revision: { increment: 1 } },
            })
          ).count === 1,
          'STALE_STATE',
        );
        return 'APPLIED';
      },
      { timeout: 60000 },
    );
  }
}
