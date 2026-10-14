import { Injectable } from '@nestjs/common';
import { InventoryCutover, Prisma } from '@prisma/client';
import {
  CutoverExpected,
  CutoverTransition,
  cutoverAssert,
  transitionTarget,
  assertCutoverTransaction,
  cutoverId,
} from './inventory-cutover.contract';

@Injectable()
// Internal persistence; callers own the transaction and must roll back errors.
export class InventoryCutoverRepository {
  find(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.inventoryCutover.findFirst({ where: { id, companyId } });
  }
  async lock(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const rows = await tx.$queryRaw<InventoryCutover[]>(
      Prisma.sql`SELECT * FROM "InventoryCutover" WHERE id=${id} AND "companyId"=${companyId} FOR UPDATE`,
    );
    return rows[0] ?? null;
  }
  cas(
    tx: Prisma.TransactionClient,
    e: CutoverExpected,
    op: CutoverTransition,
    data: Pick<
      Prisma.InventoryCutoverUncheckedUpdateManyInput,
      | 'status'
      | 'manifestDigest'
      | 'snapshotFingerprint'
      | 'baselineBuild'
      | 'manifestLockedAt'
      | 'recoveryFromStatus'
      | 'approvedBy'
    >,
  ) {
    assertCutoverTransaction(tx);
    cutoverAssert(
      data.status === transitionTarget(e, op),
      'INVALID_TRANSITION',
    );
    // Even the persistence seam cannot smuggle plan edits into recovery/CAS.
    const fields: Record<CutoverTransition['kind'], string[]> = {
      FROZEN: ['status'],
      REVIEW: [
        'status',
        'manifestDigest',
        'snapshotFingerprint',
        'baselineBuild',
        'approvedBy',
      ],
      LOCK_MANIFEST: ['status', 'manifestLockedAt'],
      RECOVERY: ['status', 'recoveryFromStatus'],
      RESUME: ['status', 'recoveryFromStatus'],
    };
    cutoverAssert(
      Object.keys(data).sort().join('|') === fields[op.kind].sort().join('|'),
      'INVALID_TRANSITION',
    );
    if (op.kind === 'REVIEW') {
      cutoverAssert(
        e.manifestDigest === null &&
          data.manifestDigest === op.manifest.manifestDigest &&
          data.snapshotFingerprint === op.manifest.snapshotFingerprint &&
          data.baselineBuild === op.manifest.baselineBuild &&
          typeof data.approvedBy === 'string',
        'MISMATCH',
      );
      cutoverId(data.approvedBy);
    }
    if (op.kind === 'LOCK_MANIFEST')
      cutoverAssert(
        e.manifestDigest !== null &&
          data.manifestLockedAt instanceof Date &&
          Number.isFinite(data.manifestLockedAt.getTime()),
        'MISMATCH',
      );
    if (op.kind === 'RECOVERY')
      cutoverAssert(data.recoveryFromStatus === e.expectedStatus, 'MISMATCH');
    if (op.kind === 'RESUME')
      cutoverAssert(data.recoveryFromStatus === null, 'MISMATCH');
    return tx.inventoryCutover.updateMany({
      where: {
        id: e.cutoverId,
        companyId: e.companyId,
        revision: e.expectedRevision,
        status: e.expectedStatus,
        manifestDigest: e.manifestDigest,
        ...(op.kind === 'RESUME' ? { recoveryFromStatus: op.target } : {}),
      },
      data: { ...data, revision: { increment: 1 } },
    });
  }
}
