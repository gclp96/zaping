import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  cutoverAssert,
  cutoverHash,
  cutoverId,
  cutoverInt,
  ProjectionEvidence,
  ReviewedManifest,
  validateReviewedManifest,
} from './inventory-cutover.contract';

export type Evidence = {
  reference: string;
  contentHash: string;
  evidenceType: string;
};
export type Pool = {
  batchId: string | null;
  state: 'AVAILABLE' | 'CUSTODY';
  contextType: string | null;
  contextId: string | null;
  quantity: number;
  evidenceRefs: string[];
};
export type Discrepancy = {
  code: string;
  classification:
    | 'RECONCILED'
    | 'DISCREPANCY'
    | 'MANUAL_RESOLUTION_REQUIRED'
    | 'BLOCKING_DISCREPANCY';
  companyId: string;
  productId: string;
  batchId: string | null;
  poolKey: string | null;
  expected: string;
  observed: string;
  evidenceRefs: string[];
  blocksApproval: boolean;
  blocksApply: boolean;
  requiredResolution: string;
};
export type OpeningBatch = {
  batchId: string;
  lotNumber: string;
  expirationDate: string | null;
  receivedAt: string;
  isActive: boolean;
  initialQuantityBefore: number;
  availableQuantityBefore: number;
  availableQuantityExpected: number;
};
export type Accessibility = {
  legacyStock: number;
  reconciledOwned: number;
  availableStateQuantity: number;
  eligibleUnbatched: number;
  physicalBatched: number;
  eligibleBatched: number;
  custody: number;
  commercialAccessibilityClassification:
    'ACCESSIBLE' | 'NOT_HISTORICALLY_SELLABLE' | 'BLOCKED' | 'UNKNOWN';
  commercialAccessibilityEvidence: string[];
};
export type OpeningProduct = {
  productId: string;
  inventoryTracking: 'QUANTITY';
  lotTracking: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  isActive: boolean;
  legacyStock: number;
  batches: OpeningBatch[];
  pools: Pool[];
  expectedOwned: number;
  expectedAvailableState: number;
  expectedAvailable: number;
  expectedCustody: number;
  optionalAccessibility: Accessibility | null;
  projectionEvidence: ProjectionEvidence;
  sourceEvidence: Evidence[];
  discrepancies: Discrepancy[];
  manifestProductFingerprint: string;
};
export type OpeningManifest = {
  formatVersion: 1;
  companyId: string;
  cutoverId: string;
  baselineBuild: string;
  frozenAsOf: string;
  freezeEvidenceRef: string;
  freezeEvidenceHash: string;
  snapshotFingerprint: string;
  products: OpeningProduct[];
  legacySales: ReviewedManifest['legacySales'];
  evidenceCatalog: Evidence[];
  manifestDigest: string;
};

// All hashes share this serializer. Dates must already be explicit UTC strings.
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    cutoverAssert(Number.isSafeInteger(value));
    return String(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  cutoverAssert(
    typeof value === 'object' &&
      value !== null &&
      Object.prototype.toString.call(value) === '[object Object]',
  );
  const object = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(object)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(object[k]))
      .join(',') +
    '}'
  );
}
export const openingHash = (value: unknown): string =>
  createHash('sha256').update(canonical(value), 'utf8').digest('hex');
export function productFingerprint(
  p: Omit<OpeningProduct, 'manifestProductFingerprint'> | OpeningProduct,
): string {
  const copy = { ...p } as Partial<OpeningProduct>;
  delete copy.manifestProductFingerprint;
  return openingHash(copy);
}
export function manifestHash(
  m: Omit<OpeningManifest, 'manifestDigest'> | OpeningManifest,
): string {
  const copy = { ...m } as Partial<OpeningManifest>;
  delete copy.manifestDigest;
  return openingHash(copy);
}
export function keys(value: object, fields: string): void {
  cutoverAssert(
    value &&
      Object.keys(value).sort().join(' ') ===
        fields.split(' ').sort().join(' '),
  );
}
export function ordered<T>(items: T[], key: (v: T) => string): void {
  cutoverAssert(Array.isArray(items));
  let previous = '';
  for (const item of items) {
    const current = key(item);
    cutoverAssert(current > previous);
    previous = current;
  }
}
export const poolKey = (p: Pool): string =>
  canonical([p.batchId, p.state, p.contextType, p.contextId]);
export function iso(value: string): void {
  cutoverAssert(
    typeof value === 'string' &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  );
}
export function validateEvidence(e: Evidence): void {
  keys(e, 'reference contentHash evidenceType');
  cutoverHash(e.contentHash);
  cutoverAssert(
    typeof e.reference === 'string' &&
      e.reference.trim().length > 0 &&
      typeof e.evidenceType === 'string' &&
      e.evidenceType.length > 0,
  );
}
export function eligible(
  p: Pick<OpeningProduct, 'isActive' | 'batches'>,
  pool: Pool,
  asOf: string,
): boolean {
  const b = p.batches.find((x) => x.batchId === pool.batchId);
  return (
    p.isActive &&
    pool.state === 'AVAILABLE' &&
    (pool.batchId === null ||
      (!!b &&
        b.isActive &&
        (b.expirationDate === null || b.expirationDate > asOf)))
  );
}
export function totals(
  p: Pick<OpeningProduct, 'isActive' | 'batches' | 'pools'>,
  asOf: string,
) {
  const sum = (f: (pool: Pool) => boolean) =>
    p.pools.filter(f).reduce((n, pool) => n + pool.quantity, 0);
  return {
    owned: sum(() => true),
    availableState: sum((x) => x.state === 'AVAILABLE'),
    available: sum((x) => eligible(p, x, asOf)),
    custody: sum((x) => x.state === 'CUSTODY'),
  };
}
export function reviewed(m: OpeningManifest): ReviewedManifest {
  return {
    manifestDigest: m.manifestDigest,
    snapshotFingerprint: m.snapshotFingerprint,
    baselineBuild: m.baselineBuild,
    legacySales: m.legacySales,
    products: m.products.map((p) => ({
      productId: p.productId,
      manifestProductFingerprint: p.manifestProductFingerprint,
      expectedOwned: p.expectedOwned,
      expectedAvailable: p.expectedAvailable,
      expectedCustody: p.expectedCustody,
      projectionEvidence: p.projectionEvidence,
    })),
  };
}
export function validateManifest(m: OpeningManifest): void {
  keys(
    m,
    'formatVersion companyId cutoverId baselineBuild frozenAsOf freezeEvidenceRef freezeEvidenceHash snapshotFingerprint products legacySales evidenceCatalog manifestDigest',
  );
  cutoverAssert(m.formatVersion === 1);
  cutoverId(m.companyId);
  cutoverId(m.cutoverId);
  iso(m.frozenAsOf);
  cutoverHash(m.freezeEvidenceHash);
  cutoverAssert(
    typeof m.freezeEvidenceRef === 'string' && m.freezeEvidenceRef.length > 0,
  );
  ordered(m.evidenceCatalog, (e) => e.reference);
  m.evidenceCatalog.forEach(validateEvidence);
  const refs = new Set(m.evidenceCatalog.map((e) => e.reference));
  const references = (values: string[]) => {
    ordered(values, (x) => x);
    values.forEach((x) => cutoverAssert(refs.has(x)));
  };
  ordered(m.products, (p) => p.productId);
  ordered(m.legacySales, (s) => s.saleId);
  for (const s of m.legacySales) keys(s, 'saleId saleFingerprint quoteId');
  for (const p of m.products) {
    keys(
      p,
      'productId inventoryTracking lotTracking isActive legacyStock batches pools expectedOwned expectedAvailableState expectedAvailable expectedCustody optionalAccessibility projectionEvidence sourceEvidence discrepancies manifestProductFingerprint',
    );
    cutoverAssert(
      p.inventoryTracking === 'QUANTITY' &&
        ['NONE', 'OPTIONAL', 'REQUIRED'].includes(p.lotTracking) &&
        typeof p.isActive === 'boolean',
    );
    cutoverInt(p.legacyStock);
    cutoverInt(p.expectedAvailableState);
    ordered(p.batches, (b) => b.batchId);
    ordered(p.pools, poolKey);
    cutoverAssert(p.pools.length <= 1000);
    for (const b of p.batches) {
      keys(
        b,
        'batchId lotNumber expirationDate receivedAt isActive initialQuantityBefore availableQuantityBefore availableQuantityExpected',
      );
      cutoverId(b.batchId);
      iso(b.receivedAt);
      if (b.expirationDate !== null) iso(b.expirationDate);
      cutoverAssert(
        typeof b.isActive === 'boolean' && typeof b.lotNumber === 'string',
      );
      const projection = p.projectionEvidence.batches.find(
        (x) => x.batchId === b.batchId,
      );
      cutoverAssert(
        projection &&
          projection.availableQuantityBefore === b.availableQuantityBefore &&
          projection.availableQuantityExpected ===
            b.availableQuantityExpected &&
          projection.initialQuantityBefore === b.initialQuantityBefore,
      );
      cutoverAssert(
        b.availableQuantityExpected ===
          p.pools
            .filter((x) => x.batchId === b.batchId && x.state === 'AVAILABLE')
            .reduce((n, x) => n + x.quantity, 0),
      );
    }
    cutoverAssert(
      p.batches.length === p.projectionEvidence.batches.length &&
        p.projectionEvidence.asOf === m.frozenAsOf,
    );
    for (const pool of p.pools) {
      keys(pool, 'batchId state contextType contextId quantity evidenceRefs');
      cutoverInt(pool.quantity);
      cutoverAssert(pool.quantity > 0);
      cutoverAssert(
        pool.batchId === null ||
          p.batches.some((b) => b.batchId === pool.batchId),
      );
      cutoverAssert(p.lotTracking !== 'REQUIRED' || pool.batchId !== null);
      cutoverAssert(p.lotTracking !== 'NONE' || pool.batchId === null);
      cutoverAssert(
        pool.state === 'AVAILABLE'
          ? pool.contextType === null && pool.contextId === null
          : pool.state === 'CUSTODY' &&
              typeof pool.contextType === 'string' &&
              /^[A-Z][A-Z0-9_]{0,63}$/.test(pool.contextType) &&
              typeof pool.contextId === 'string' &&
              pool.contextId.length > 0 &&
              pool.contextId.length <= 128 &&
              pool.contextId.trim() === pool.contextId,
      );
      cutoverAssert(pool.evidenceRefs.length > 0);
      references(pool.evidenceRefs);
    }
    const t = totals(p, m.frozenAsOf);
    cutoverAssert(
      t.owned === p.expectedOwned &&
        t.owned === p.legacyStock &&
        t.availableState === p.expectedAvailableState &&
        t.available === p.expectedAvailable &&
        t.custody === p.expectedCustody,
    );
    ordered(p.sourceEvidence, (e) => e.reference);
    p.sourceEvidence.forEach((e) => {
      validateEvidence(e);
      cutoverAssert(
        m.evidenceCatalog.some((x) => canonical(x) === canonical(e)),
      );
    });
    for (const d of p.discrepancies) {
      keys(
        d,
        'code classification companyId productId batchId poolKey expected observed evidenceRefs blocksApproval blocksApply requiredResolution',
      );
      cutoverAssert(
        d.companyId === m.companyId &&
          d.productId === p.productId &&
          d.classification === 'RECONCILED' &&
          d.blocksApproval === false &&
          d.blocksApply === false,
      );
      references(d.evidenceRefs);
    }
    if (p.lotTracking === 'OPTIONAL') {
      const a = p.optionalAccessibility;
      cutoverAssert(a);
      keys(
        a,
        'legacyStock reconciledOwned availableStateQuantity eligibleUnbatched physicalBatched eligibleBatched custody commercialAccessibilityClassification commercialAccessibilityEvidence',
      );
      cutoverAssert(
        a.legacyStock === p.legacyStock &&
          a.reconciledOwned === t.owned &&
          a.availableStateQuantity === t.availableState &&
          a.custody === t.custody,
      );
      const sum = (f: (x: Pool) => boolean) =>
        p.pools.filter(f).reduce((n, x) => n + x.quantity, 0);
      cutoverAssert(
        a.eligibleUnbatched ===
          sum((x) => x.batchId === null && eligible(p, x, m.frozenAsOf)) &&
          a.eligibleBatched ===
            sum((x) => x.batchId !== null && eligible(p, x, m.frozenAsOf)) &&
          a.physicalBatched === sum((x) => x.batchId !== null),
      );
      cutoverAssert(
        a.commercialAccessibilityClassification ===
          'NOT_HISTORICALLY_SELLABLE' ||
          (a.commercialAccessibilityClassification === 'ACCESSIBLE' &&
            a.physicalBatched === 0),
      );
      references(a.commercialAccessibilityEvidence);
      cutoverAssert(
        a.physicalBatched === 0 || a.commercialAccessibilityEvidence.length > 0,
      );
    } else cutoverAssert(p.optionalAccessibility === null);
    cutoverAssert(productFingerprint(p) === p.manifestProductFingerprint);
  }
  validateReviewedManifest(reviewed(m));
  cutoverAssert(manifestHash(m) === m.manifestDigest);
}

// Internal trusted adapters only; no controller, configuration bypass or default namespace.
export type EvidenceContext = {
  companyId: string;
  cutoverId: string;
  frozenAsOf: string;
};
export interface OpeningEvidenceProvider {
  freeze(
    tx: Prisma.TransactionClient,
    context: EvidenceContext,
    evidence: Evidence,
  ): Promise<boolean>;
  product(
    tx: Prisma.TransactionClient,
    context: EvidenceContext,
    productId: string,
  ): Promise<{
    pools: Pool[];
    evidence: Evidence[];
    historicallySellableBatched: boolean | null;
  }>;
  verify(
    tx: Prisma.TransactionClient,
    context: EvidenceContext,
    product: OpeningProduct,
  ): Promise<boolean>;
}
export type CustodyResolver = (
  tx: Prisma.TransactionClient,
  context: EvidenceContext,
  productId: string,
  pool: Pool,
  evidence: Evidence[],
) => Promise<boolean>;
export class OpeningCustodyRegistry {
  constructor(
    private readonly resolvers: ReadonlyMap<
      string,
      CustodyResolver
    > = new Map(),
  ) {}
  async validate(
    tx: Prisma.TransactionClient,
    context: EvidenceContext,
    p: Pick<OpeningProduct, 'productId' | 'pools' | 'sourceEvidence'>,
  ): Promise<void> {
    for (const pool of p.pools.filter((x) => x.state === 'CUSTODY')) {
      const resolver = this.resolvers.get(pool.contextType ?? '');
      cutoverAssert(
        resolver &&
          (await resolver(tx, context, p.productId, pool, p.sourceEvidence)),
        'MISMATCH',
      );
    }
  }
}
