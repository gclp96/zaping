import { Prisma, PrismaClient } from '@prisma/client';
import { cutoverAssert } from './inventory-cutover.contract';
import {
  legacySaleFingerprint,
  legacySaleInclude,
} from './sales-physical-evidence';
import {
  Discrepancy,
  Evidence,
  EvidenceContext,
  OpeningCustodyRegistry,
  OpeningEvidenceProvider,
  OpeningManifest,
  OpeningProduct,
  canonical,
  eligible,
  manifestHash,
  openingHash,
  poolKey,
  productFingerprint,
  totals,
  validateManifest,
} from './inventory-opening-manifest';

export type DryRunInput = EvidenceContext & {
  baselineBuild: string;
  freezeEvidence: Evidence;
};
export function movementBalance(
  before: number,
  movement: { movementType: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number },
): number {
  return movement.movementType === 'ADJUSTMENT'
    ? movement.quantity
    : before +
        (movement.movementType === 'IN'
          ? movement.quantity
          : -movement.quantity);
}
// Selected source facts only. DB timestamps/cost floats unrelated to physical identity are not hash inputs.
export async function readOpeningSources(
  tx: Prisma.TransactionClient,
  companyId: string,
  manifest?: OpeningManifest,
) {
  const products = await tx.product.findMany({
    where: { companyId, inventoryTracking: 'QUANTITY' },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      companyId: true,
      inventoryTracking: true,
      lotTracking: true,
      isActive: true,
      stock: true,
    },
  });
  const batches = await tx.inventoryBatch.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      companyId: true,
      productId: true,
      lotNumber: true,
      expirationDate: true,
      receivedAt: true,
      isActive: true,
      initialQuantity: true,
      availableQuantity: true,
    },
  });
  const movements = await tx.inventoryMovement.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      productId: true,
      batchId: true,
      movementType: true,
      quantity: true,
      balance: true,
      referenceType: true,
      referenceId: true,
      createdAt: true,
    },
  });
  const receipts = await tx.purchaseReceiptItem.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      productId: true,
      batchId: true,
      receiptId: true,
      purchaseItemId: true,
      quantityReceived: true,
      lotNumber: true,
      expirationDate: true,
      receipt: {
        select: { companyId: true, purchaseId: true, receivedAt: true },
      },
    },
  });
  const sales = await tx.sale.findMany({
    where: { companyId, status: 'CONFIRMED' },
    orderBy: { id: 'asc' },
    include: legacySaleInclude,
  });
  const legacySales = sales.map((s) => ({
    saleId: s.id,
    quoteId: s.quoteId,
    saleFingerprint: legacySaleFingerprint(companyId, s),
  }));
  // Opening deliberately changes only batch available counters. Normalize the hash
  // back to the approved before-image only after validating the persisted checkpoint.
  const checkpoints = manifest
    ? await tx.inventoryCutoverProduct.findMany({
        where: { companyId, cutoverId: manifest.cutoverId },
      })
    : [];
  const normalized = batches.map((b) => {
    const plan = manifest?.products
      .find((p) => p.productId === b.productId)
      ?.batches.find((x) => x.batchId === b.id);
    const cp = checkpoints.find((x) => x.productId === b.productId);
    if (plan && cp && cp.status !== 'PLANNED') {
      cutoverAssert(
        b.availableQuantity === plan.availableQuantityExpected,
        'MISMATCH',
      );
      return { ...b, availableQuantity: plan.availableQuantityBefore };
    }
    return b;
  });
  const json: unknown = JSON.parse(
    JSON.stringify({
      products,
      batches: normalized,
      movements,
      receipts,
      legacySales,
    }),
  );
  return {
    products,
    batches,
    movements,
    receipts,
    legacySales,
    snapshotFingerprint: openingHash(json),
  };
}
export class InventoryReconciliationService {
  constructor(
    readonly evidence: OpeningEvidenceProvider,
    readonly custody = new OpeningCustodyRegistry(),
  ) {}
  preview(db: PrismaClient, input: DryRunInput) {
    return this.readOnly(db, (tx) => this.generate(tx, input, false));
  }
  finalDryRun(db: PrismaClient, input: DryRunInput) {
    return this.readOnly(db, (tx) => this.generate(tx, input, true));
  }
  readOnly<T>(
    db: PrismaClient,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return action(tx);
      },
      { isolationLevel: 'RepeatableRead', timeout: 60000 },
    );
  }
  async assertFreeze(tx: Prisma.TransactionClient, input: DryRunInput) {
    cutoverAssert(
      await this.evidence.freeze(tx, input, input.freezeEvidence),
      'MISMATCH',
    );
  }
  async generate(
    tx: Prisma.TransactionClient,
    input: DryRunInput,
    final: boolean,
  ): Promise<{
    manifest: OpeningManifest | null;
    discrepancies: Discrepancy[];
  }> {
    const { companyId, cutoverId, frozenAsOf } = input;
    if (final) {
      const c = await tx.inventoryCutover.findFirst({
        where: { companyId, id: cutoverId, status: 'WRITERS_FROZEN' },
      });
      cutoverAssert(c, 'INVALID_TRANSITION');
      await this.assertFreeze(tx, input);
    }
    const source = await readOpeningSources(tx, companyId);
    const discrepancies: Discrepancy[] = [];
    const products: OpeningProduct[] = [];
    const catalog = new Map<string, Evidence>();
    const addEvidence = (e: Evidence) => {
      const prior = catalog.get(e.reference);
      cutoverAssert(!prior || canonical(prior) === canonical(e), 'MISMATCH');
      catalog.set(e.reference, e);
    };
    addEvidence(input.freezeEvidence);
    const unexpected =
      (await tx.inventoryPosition.count({ where: { companyId } })) +
      (await tx.inventoryPhysicalEffect.count({ where: { companyId } }));
    for (const product of source.products) {
      const issue = (code: string, observed: string) =>
        discrepancies.push({
          code,
          classification: 'BLOCKING_DISCREPANCY',
          companyId,
          productId: product.id,
          batchId: null,
          poolKey: null,
          expected: 'Certified coherent physical baseline',
          observed,
          evidenceRefs: [],
          blocksApproval: true,
          blocksApply: true,
          requiredResolution:
            'Correct evidence/source externally; generate and review a new final dry-run',
        });
      if (unexpected) issue('UNEXPECTED_PHYSICAL_EVIDENCE', String(unexpected));
      let proof: Awaited<ReturnType<OpeningEvidenceProvider['product']>>;
      try {
        proof = await this.evidence.product(tx, input, product.id);
      } catch {
        issue('PHYSICAL_EVIDENCE_REQUIRED', 'Resolver failed');
        continue;
      }
      proof.evidence.forEach(addEvidence);
      const batches = source.batches
        .filter((b) => b.productId === product.id)
        .map((b) => ({
          batchId: b.id,
          lotNumber: b.lotNumber,
          expirationDate: b.expirationDate?.toISOString() ?? null,
          receivedAt: b.receivedAt.toISOString(),
          isActive: b.isActive,
          initialQuantityBefore: b.initialQuantity,
          availableQuantityBefore: b.availableQuantity,
          availableQuantityExpected: proof.pools
            .filter((p) => p.batchId === b.id && p.state === 'AVAILABLE')
            .reduce((n, p) => n + p.quantity, 0),
        }));
      const pools = [...proof.pools].sort((a, b) =>
        poolKey(a) < poolKey(b) ? -1 : 1,
      );
      const t = totals(
        { isActive: product.isActive, batches, pools },
        frozenAsOf,
      );
      if (t.owned !== product.stock)
        issue('OWNED_STOCK_MISMATCH', `${t.owned}/${product.stock}`);
      const sum = (f: (p: (typeof pools)[number]) => boolean) =>
        pools.filter(f).reduce((n, p) => n + p.quantity, 0);
      const p: OpeningProduct = {
        productId: product.id,
        inventoryTracking: 'QUANTITY',
        lotTracking: product.lotTracking,
        isActive: product.isActive,
        legacyStock: product.stock,
        batches,
        pools,
        expectedOwned: t.owned,
        expectedAvailableState: t.availableState,
        expectedAvailable: t.available,
        expectedCustody: t.custody,
        optionalAccessibility:
          product.lotTracking === 'OPTIONAL'
            ? {
                legacyStock: product.stock,
                reconciledOwned: t.owned,
                availableStateQuantity: t.availableState,
                eligibleUnbatched: sum(
                  (p) =>
                    p.batchId === null &&
                    eligible(
                      { isActive: product.isActive, batches },
                      p,
                      frozenAsOf,
                    ),
                ),
                physicalBatched: sum((p) => p.batchId !== null),
                eligibleBatched: sum(
                  (p) =>
                    p.batchId !== null &&
                    eligible(
                      { isActive: product.isActive, batches },
                      p,
                      frozenAsOf,
                    ),
                ),
                custody: t.custody,
                commercialAccessibilityClassification:
                  sum((p) => p.batchId !== null) === 0
                    ? 'ACCESSIBLE'
                    : proof.historicallySellableBatched === false
                      ? 'NOT_HISTORICALLY_SELLABLE'
                      : proof.historicallySellableBatched === true
                        ? 'BLOCKED'
                        : 'UNKNOWN',
                commercialAccessibilityEvidence: proof.evidence
                  .map((e) => e.reference)
                  .sort(),
              }
            : null,
        projectionEvidence: {
          version: 1,
          asOf: frozenAsOf,
          productStockBefore: product.stock,
          productStockExpected: t.owned,
          batches: batches.map((b) => ({
            batchId: b.batchId,
            availableQuantityBefore: b.availableQuantityBefore,
            availableQuantityExpected: b.availableQuantityExpected,
            initialQuantityBefore: b.initialQuantityBefore,
            initialQuantityExpected: b.initialQuantityBefore,
          })),
        },
        sourceEvidence: [...proof.evidence].sort((a, b) =>
          a.reference < b.reference ? -1 : 1,
        ),
        discrepancies: [],
        manifestProductFingerprint: '',
      };
      if (
        p.optionalAccessibility &&
        ['BLOCKED', 'UNKNOWN'].includes(
          p.optionalAccessibility.commercialAccessibilityClassification,
        )
      )
        issue(
          'OPTIONAL_ACCESSIBILITY',
          p.optionalAccessibility.commercialAccessibilityClassification,
        );
      try {
        await this.custody.validate(tx, input, p);
      } catch {
        issue(
          'CUSTODY_CONTEXT_UNPROVEN',
          'Missing or rejected registered resolver',
        );
      }
      p.manifestProductFingerprint = productFingerprint(p);
      products.push(p);
    }
    if (unexpected && !source.products.length) cutoverAssert(false, 'MISMATCH');
    if (discrepancies.length) return { manifest: null, discrepancies };
    const m: OpeningManifest = {
      formatVersion: 1,
      companyId,
      cutoverId,
      baselineBuild: input.baselineBuild,
      frozenAsOf,
      freezeEvidenceRef: input.freezeEvidence.reference,
      freezeEvidenceHash: input.freezeEvidence.contentHash,
      snapshotFingerprint: source.snapshotFingerprint,
      products,
      legacySales: source.legacySales,
      evidenceCatalog: [...catalog.values()].sort((a, b) =>
        a.reference < b.reference ? -1 : 1,
      ),
      manifestDigest: '',
    };
    m.manifestDigest = manifestHash(m);
    try {
      validateManifest(m);
    } catch {
      return {
        manifest: null,
        discrepancies: [
          {
            code: 'INVALID_BASELINE',
            classification: 'BLOCKING_DISCREPANCY',
            companyId,
            productId: products[0]?.productId ?? '',
            batchId: null,
            poolKey: null,
            expected: 'Valid complete manifest',
            observed: 'Invalid identity/quantity/evidence/lot contract',
            evidenceRefs: [],
            blocksApproval: true,
            blocksApply: true,
            requiredResolution: 'Correct source/evidence and repeat dry-run',
          },
        ],
      };
    }
    return { manifest: m, discrepancies };
  }
  input(m: OpeningManifest): DryRunInput {
    const freezeEvidence = m.evidenceCatalog.find(
      (e) =>
        e.reference === m.freezeEvidenceRef &&
        e.contentHash === m.freezeEvidenceHash,
    );
    cutoverAssert(freezeEvidence);
    return {
      companyId: m.companyId,
      cutoverId: m.cutoverId,
      frozenAsOf: m.frozenAsOf,
      baselineBuild: m.baselineBuild,
      freezeEvidence,
    };
  }
  async revalidate(tx: Prisma.TransactionClient, m: OpeningManifest) {
    validateManifest(m);
    await this.assertFreeze(tx, this.input(m));
    const current = await readOpeningSources(tx, m.companyId, m);
    cutoverAssert(
      canonical(current.products.map((p) => p.id)) ===
        canonical(m.products.map((p) => p.productId)),
      'MISMATCH',
    );
    cutoverAssert(
      current.snapshotFingerprint === m.snapshotFingerprint &&
        canonical(current.legacySales) === canonical(m.legacySales),
      'MISMATCH',
    );
    for (const p of m.products) {
      const source = current.products.find((x) => x.id === p.productId)!;
      cutoverAssert(
        source.stock === p.legacyStock &&
          source.lotTracking === p.lotTracking &&
          source.isActive === p.isActive,
        'MISMATCH',
      );
      cutoverAssert(
        canonical(
          current.batches
            .filter((b) => b.productId === p.productId)
            .map((b) => b.id),
        ) === canonical(p.batches.map((b) => b.batchId)),
        'MISMATCH',
      );
      const evidence = await this.evidence.product(tx, m, p.productId);
      const pools = [...evidence.pools].sort((a, b) =>
        poolKey(a) < poolKey(b) ? -1 : 1,
      );
      const sources = [...evidence.evidence].sort((a, b) =>
        a.reference < b.reference ? -1 : 1,
      );
      cutoverAssert(
        canonical(pools) === canonical(p.pools) &&
          canonical(sources) === canonical(p.sourceEvidence),
        'MISMATCH',
      );
      if (
        p.optionalAccessibility &&
        p.optionalAccessibility.physicalBatched > 0
      )
        cutoverAssert(
          evidence.historicallySellableBatched === false,
          'MISMATCH',
        );
      cutoverAssert(await this.evidence.verify(tx, m, p), 'MISMATCH');
      await this.custody.validate(tx, m, p);
    }
    return current;
  }
}
