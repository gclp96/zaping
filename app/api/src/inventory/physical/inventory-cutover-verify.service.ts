import { inventoryAuthorityFence } from './inventory-authority-fence';
import { Prisma, PrismaClient } from '@prisma/client';
import { cutoverAssert } from './inventory-cutover.contract';
import {
  OpeningManifest,
  openingHash,
  totals,
  validateManifest,
} from './inventory-opening-manifest';
import { InventoryOpeningService } from './inventory-opening.service';
import {
  assertCheckpointSet,
  assertNoExtraPhysical,
  assertOpeningProduct,
} from './inventory-opening-evidence';

export interface OpeningManifestStore {
  load(digest: string): Promise<OpeningManifest>;
}
export type Verification = {
  companyId: string;
  cutoverId: string;
  manifestDigest: string;
  controlRevision: number;
  verifiedAt: string;
  evidenceHash: string;
};
export class InventoryCutoverVerifyService {
  constructor(
    readonly opening: InventoryOpeningService,
    readonly store: OpeningManifestStore,
  ) {}
  async load(companyId: string, cutoverId: string, digest: string) {
    const m = await this.store.load(digest);
    validateManifest(m);
    cutoverAssert(
      m.companyId === companyId &&
        m.cutoverId === cutoverId &&
        m.manifestDigest === digest,
      'MISMATCH',
    );
    return m;
  }
  // Internal transactional verification reused by the dedicated activation service.
  async inspect(
    tx: Prisma.TransactionClient,
    m: OpeningManifest,
    asOf: string,
  ) {
    const c = this.opening.assertControl(
      await this.opening.controlRepo.find(tx, m.companyId, m.cutoverId),
      m,
    );
    cutoverAssert(
      ['OPENING_APPLIED', 'VERIFIED'].includes(c.status),
      'INVALID_TRANSITION',
    );
    await this.opening.reconciliation.revalidate(tx, m);
    const cps = await assertCheckpointSet(tx, m);
    cutoverAssert(
      cps.every((x) => x.status !== 'PLANNED'),
      'MISMATCH',
    );
    for (const p of m.products) {
      await assertOpeningProduct(tx, m, p, true);
      // Natural expiration is visible and fails closed if approval expectations changed.
      cutoverAssert(
        totals(p, asOf).available === p.expectedAvailable,
        'MISMATCH',
      );
    }
    await assertNoExtraPhysical(tx, m);
    return {
      c,
      cps,
      evidenceHash: openingHash({
        manifestDigest: m.manifestDigest,
        revision: c.revision,
        checkpoints: cps.map((x) => ({
          productId: x.productId,
          openingEffectId: x.openingEffectId,
          fingerprint: x.manifestProductFingerprint,
        })),
      }),
    };
  }
  async verify(
    db: PrismaClient,
    companyId: string,
    cutoverId: string,
    digest: string,
  ): Promise<Verification> {
    const m = await this.load(companyId, cutoverId, digest);
    const verifiedAt = new Date().toISOString();
    return this.opening.reconciliation.readOnly(db, async (tx) => {
      const result = await this.inspect(tx, m, verifiedAt);
      return {
        companyId,
        cutoverId,
        manifestDigest: digest,
        controlRevision: result.c.revision,
        verifiedAt,
        evidenceHash: result.evidenceHash,
      };
    });
  }
  async certifyProduct(
    db: PrismaClient,
    proof: Verification,
    productId: string,
    actorId: string,
  ) {
    const m = await this.load(
      proof.companyId,
      proof.cutoverId,
      proof.manifestDigest,
    );
    const p = m.products.find((x) => x.productId === productId);
    cutoverAssert(p, 'NOT_FOUND');
    return db.$transaction(
      async (tx) => {
        await inventoryAuthorityFence(tx, m.companyId, 'exclusive');
        const c = this.opening.assertControl(
          await this.opening.controlRepo.lock(tx, m.companyId, m.cutoverId),
          m,
        );
        await this.opening.authorize(tx, m.companyId, actorId);
        await this.opening.lockProduct(tx, m, p);
        cutoverAssert(c.revision === proof.controlRevision, 'STALE_STATE');
        // Recompute; a caller-supplied certificate never authorizes an unchecked CAS.
        const result = await this.inspect(tx, m, new Date().toISOString());
        cutoverAssert(
          result.evidenceHash === proof.evidenceHash,
          'STALE_STATE',
        );
        const cp = result.cps.find((x) => x.productId === productId)!;
        if (cp.status === 'VERIFIED') return 'REPLAY';
        cutoverAssert(
          (
            await tx.inventoryCutoverProduct.updateMany({
              where: {
                companyId: m.companyId,
                cutoverId: m.cutoverId,
                productId,
                status: 'APPLIED',
                openingEffectId: cp.openingEffectId,
                manifestProductFingerprint: p.manifestProductFingerprint,
              },
              data: { status: 'VERIFIED', verifiedAt: new Date() },
            })
          ).count === 1,
          'STALE_STATE',
        );
        return 'VERIFIED';
      },
      { isolationLevel: 'ReadCommitted', timeout: 60000 },
    );
  }
  async certifyCompany(db: PrismaClient, proof: Verification, actorId: string) {
    const m = await this.load(
      proof.companyId,
      proof.cutoverId,
      proof.manifestDigest,
    );
    return db.$transaction(
      async (tx) => {
        await inventoryAuthorityFence(tx, m.companyId, 'exclusive');
        const c = this.opening.assertControl(
          await this.opening.controlRepo.lock(tx, m.companyId, m.cutoverId),
          m,
        );
        await this.opening.authorize(tx, m.companyId, actorId);
        const result = await this.inspect(tx, m, new Date().toISOString());
        cutoverAssert(
          result.cps.every((x) => x.status === 'VERIFIED'),
          'MISMATCH',
        );
        if (c.status === 'VERIFIED') return 'REPLAY';
        cutoverAssert(
          c.revision === proof.controlRevision &&
            result.evidenceHash === proof.evidenceHash,
          'STALE_STATE',
        );
        cutoverAssert(
          (
            await tx.inventoryCutover.updateMany({
              where: {
                id: c.id,
                companyId: c.companyId,
                status: 'OPENING_APPLIED',
                revision: c.revision,
                manifestDigest: m.manifestDigest,
              },
              data: { status: 'VERIFIED', revision: { increment: 1 } },
            })
          ).count === 1,
          'STALE_STATE',
        );
        return 'VERIFIED';
      },
      { isolationLevel: 'ReadCommitted', timeout: 60000 },
    );
  }
}
