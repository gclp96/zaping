import {
  InventoryCutover,
  InventoryCutoverStatus,
  Prisma,
} from '@prisma/client';
import { isUUID } from 'class-validator';

export class InventoryCutoverError extends Error {
  constructor(
    readonly code:
      | 'INVALID_CUTOVER'
      | 'NOT_FOUND'
      | 'STALE_STATE'
      | 'MISMATCH'
      | 'INVALID_TRANSITION'
      | 'ACTOR_FORBIDDEN',
  ) {
    super(code);
    this.name = 'InventoryCutoverError';
  }
}
export function cutoverAssert(
  value: unknown,
  code: InventoryCutoverError['code'] = 'INVALID_CUTOVER',
): asserts value {
  if (!value) throw new InventoryCutoverError(code);
}
export function cutoverId(value: string): void {
  cutoverAssert(typeof value === 'string' && isUUID(value));
}
export function cutoverHash(value: string): void {
  cutoverAssert(typeof value === 'string' && /^[0-9a-f]{64}$/.test(value));
}
export function cutoverInt(value: number): void {
  cutoverAssert(Number.isInteger(value) && value >= 0 && value <= 2147483647);
}
export function assertCutoverTransaction(tx: Prisma.TransactionClient): void {
  cutoverAssert(tx && !('$transaction' in tx));
}
const reviewed: InventoryCutoverStatus[] = [
  'DRY_RUN_REVIEWED',
  'OPENING_APPLYING',
  'OPENING_APPLIED',
  'VERIFIED',
  'PHYSICAL_ACTIVE',
];
const locked: InventoryCutoverStatus[] = [
  'OPENING_APPLYING',
  'OPENING_APPLIED',
  'VERIFIED',
  'PHYSICAL_ACTIVE',
];
export function effectiveStatus(row: InventoryCutover): InventoryCutoverStatus {
  return row.recoveryFromStatus ?? row.status;
}
export function isReviewed(row: InventoryCutover): boolean {
  return reviewed.includes(effectiveStatus(row));
}
export function assertCutoverControl(row: InventoryCutover): void {
  cutoverId(row.id);
  cutoverId(row.companyId);
  cutoverId(row.initiatedBy);
  cutoverInt(row.revision);
  cutoverAssert(
    Object.values(InventoryCutoverStatus).includes(row.status),
    'MISMATCH',
  );
  cutoverAssert(
    row.status === 'RECOVERY_REQUIRED'
      ? row.recoveryFromStatus !== null &&
          row.recoveryFromStatus !== 'RECOVERY_REQUIRED' &&
          Object.values(InventoryCutoverStatus).includes(row.recoveryFromStatus)
      : row.recoveryFromStatus === null,
    'MISMATCH',
  );
  const hasManifest = row.manifestDigest !== null;
  cutoverAssert(
    hasManifest === (row.snapshotFingerprint !== null) &&
      hasManifest === (row.baselineBuild !== null),
    'MISMATCH',
  );
  if (hasManifest) {
    cutoverHash(row.manifestDigest!);
    cutoverHash(row.snapshotFingerprint!);
    cutoverAssert(
      row.baselineBuild!.trim().length > 0 && row.baselineBuild!.length <= 128,
      'MISMATCH',
    );
  }
  if (row.approvedBy !== null) cutoverId(row.approvedBy);
  if (row.activatedBy !== null) cutoverId(row.activatedBy);
  cutoverAssert(
    !isReviewed(row) || (hasManifest && row.approvedBy !== null),
    'MISMATCH',
  );
  cutoverAssert(
    locked.includes(effectiveStatus(row)) === (row.manifestLockedAt !== null),
    'MISMATCH',
  );
  cutoverAssert(
    (row.activatedBy !== null) === (row.activatedAt !== null),
    'MISMATCH',
  );
  cutoverAssert(
    (effectiveStatus(row) === 'PHYSICAL_ACTIVE') === (row.activatedBy !== null),
    'MISMATCH',
  );
}

export type ProjectionEvidence = {
  version: 1;
  asOf: string;
  productStockBefore: number;
  productStockExpected: number;
  batches: {
    batchId: string;
    availableQuantityBefore: number;
    availableQuantityExpected: number;
    initialQuantityBefore: number;
    initialQuantityExpected: number;
  }[];
};
export type ReviewedProduct = {
  productId: string;
  manifestProductFingerprint: string;
  expectedOwned: number;
  expectedAvailable: number;
  expectedCustody: number;
  projectionEvidence: ProjectionEvidence;
};
export type ReviewedManifest = {
  manifestDigest: string;
  snapshotFingerprint: string;
  baselineBuild: string;
  products: ReviewedProduct[];
  legacySales: {
    saleId: string;
    saleFingerprint: string;
    quoteId: string | null;
  }[];
};
function exactKeys(value: object, keys: string[]): void {
  cutoverAssert(
    Object.keys(value).sort().join('|') === [...keys].sort().join('|'),
  );
}
export function validateReviewedProduct(p: ReviewedProduct): void {
  cutoverId(p.productId);
  cutoverHash(p.manifestProductFingerprint);
  [p.expectedOwned, p.expectedAvailable, p.expectedCustody].forEach(cutoverInt);
  cutoverAssert(
    p.expectedCustody <= p.expectedOwned &&
      p.expectedAvailable <= p.expectedOwned - p.expectedCustody,
  );
  const e = p.projectionEvidence;
  cutoverAssert(e && typeof e === 'object');
  exactKeys(e, [
    'version',
    'asOf',
    'productStockBefore',
    'productStockExpected',
    'batches',
  ]);
  cutoverAssert(
    e.version === 1 &&
      typeof e.asOf === 'string' &&
      Number.isFinite(Date.parse(e.asOf)) &&
      new Date(e.asOf).toISOString() === e.asOf,
  );
  cutoverInt(e.productStockBefore);
  cutoverInt(e.productStockExpected);
  cutoverAssert(
    e.productStockBefore === p.expectedOwned &&
      e.productStockExpected === p.expectedOwned &&
      Array.isArray(e.batches),
  );
  let previous = '';
  for (const b of e.batches) {
    exactKeys(b, [
      'batchId',
      'availableQuantityBefore',
      'availableQuantityExpected',
      'initialQuantityBefore',
      'initialQuantityExpected',
    ]);
    cutoverId(b.batchId);
    cutoverAssert(previous < b.batchId);
    previous = b.batchId;
    // Historical before-images may be negative. Preserve them, never repair here.
    for (const n of [
      b.availableQuantityBefore,
      b.initialQuantityBefore,
      b.initialQuantityExpected,
    ])
      cutoverAssert(Number.isInteger(n) && n >= -2147483648 && n <= 2147483647);
    cutoverInt(b.availableQuantityExpected);
    cutoverAssert(b.initialQuantityBefore === b.initialQuantityExpected);
  }
}
export function validateReviewedManifest(m: ReviewedManifest): void {
  cutoverHash(m.manifestDigest);
  cutoverHash(m.snapshotFingerprint);
  cutoverAssert(
    typeof m.baselineBuild === 'string' &&
      m.baselineBuild.trim() === m.baselineBuild &&
      m.baselineBuild.length > 0 &&
      m.baselineBuild.length <= 128,
  );
  cutoverAssert(Array.isArray(m.products) && Array.isArray(m.legacySales));
  cutoverAssert(
    new Set(m.products.map((p) => p.productId)).size === m.products.length,
  );
  cutoverAssert(
    new Set(m.legacySales.map((s) => s.saleId)).size === m.legacySales.length,
  );
  m.products.forEach(validateReviewedProduct);
  m.legacySales.forEach((s) => {
    cutoverId(s.saleId);
    cutoverHash(s.saleFingerprint);
    if (s.quoteId !== null) cutoverId(s.quoteId);
  });
}

export type CutoverExpected = {
  companyId: string;
  cutoverId: string;
  expectedRevision: number;
  expectedStatus: InventoryCutoverStatus;
  // Required comparison, including null. Prevents stale or wrong-plan transitions.
  manifestDigest: string | null;
};
export type CutoverTransition =
  | { kind: 'FROZEN' }
  | { kind: 'REVIEW'; manifest: ReviewedManifest }
  | { kind: 'LOCK_MANIFEST' }
  | { kind: 'RECOVERY' }
  | {
      kind: 'RESUME';
      target:
        'PRECHECK' | 'WRITERS_FROZEN' | 'DRY_RUN_REVIEWED' | 'OPENING_APPLYING';
    };

export function transitionTarget(
  expected: CutoverExpected,
  op: CutoverTransition,
): InventoryCutoverStatus {
  cutoverId(expected.companyId);
  cutoverId(expected.cutoverId);
  cutoverInt(expected.expectedRevision);
  if (expected.manifestDigest !== null) cutoverHash(expected.manifestDigest);
  const from = expected.expectedStatus;
  if (op.kind === 'FROZEN' && from === 'PRECHECK') return 'WRITERS_FROZEN';
  if (op.kind === 'REVIEW' && from === 'WRITERS_FROZEN') {
    validateReviewedManifest(op.manifest);
    return 'DRY_RUN_REVIEWED';
  }
  if (op.kind === 'LOCK_MANIFEST' && from === 'DRY_RUN_REVIEWED')
    return 'OPENING_APPLYING';
  if (
    op.kind === 'RECOVERY' &&
    Object.values(InventoryCutoverStatus).includes(from) &&
    from !== 'RECOVERY_REQUIRED'
  )
    return 'RECOVERY_REQUIRED';
  if (
    op.kind === 'RESUME' &&
    from === 'RECOVERY_REQUIRED' &&
    [
      'PRECHECK',
      'WRITERS_FROZEN',
      'DRY_RUN_REVIEWED',
      'OPENING_APPLYING',
    ].includes(op.target)
  )
    return op.target;
  throw new InventoryCutoverError('INVALID_TRANSITION');
}
