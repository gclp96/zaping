import { Prisma } from '@prisma/client';
import { cutoverAssert } from './inventory-cutover.contract';
import {
  canonical,
  OpeningManifest,
  OpeningProduct,
  openingHash,
} from './inventory-opening-manifest';

export const openingRequestHash = (m: OpeningManifest, p: OpeningProduct) =>
  openingHash({
    version: 1,
    companyId: m.companyId,
    cutoverId: m.cutoverId,
    manifestDigest: m.manifestDigest,
    manifestProductFingerprint: p.manifestProductFingerprint,
  });
export async function assertCheckpointSet(
  tx: Prisma.TransactionClient,
  m: OpeningManifest,
) {
  const rows = await tx.inventoryCutoverProduct.findMany({
    where: { companyId: m.companyId, cutoverId: m.cutoverId },
    orderBy: { productId: 'asc' },
  });
  cutoverAssert(rows.length === m.products.length, 'MISMATCH');
  for (const [i, p] of m.products.entries()) {
    const cp = rows[i];
    cutoverAssert(
      cp.productId === p.productId &&
        cp.manifestProductFingerprint === p.manifestProductFingerprint &&
        cp.expectedOwned === p.expectedOwned &&
        cp.expectedAvailable === p.expectedAvailable &&
        cp.expectedCustody === p.expectedCustody &&
        canonical(cp.projectionEvidence) === canonical(p.projectionEvidence),
      'MISMATCH',
    );
  }
  const sales = await tx.inventoryCutoverLegacySale.findMany({
    where: { companyId: m.companyId, cutoverId: m.cutoverId },
    orderBy: { saleId: 'asc' },
  });
  cutoverAssert(
    canonical(
      sales.map((s) => ({
        saleId: s.saleId,
        quoteId: s.quoteId,
        saleFingerprint: s.saleFingerprint,
      })),
    ) === canonical(m.legacySales) &&
      sales.every((s) => s.statusAtFreeze === 'CONFIRMED'),
    'MISMATCH',
  );
  return rows;
}
export async function assertOpeningProduct(
  tx: Prisma.TransactionClient,
  m: OpeningManifest,
  p: OpeningProduct,
  applied: boolean,
) {
  const cp = await tx.inventoryCutoverProduct.findUnique({
    where: {
      cutoverId_productId: { cutoverId: m.cutoverId, productId: p.productId },
    },
  });
  cutoverAssert(
    cp &&
      cp.companyId === m.companyId &&
      cp.manifestProductFingerprint === p.manifestProductFingerprint,
    'MISMATCH',
  );
  const product = await tx.product.findFirst({
    where: { id: p.productId, companyId: m.companyId },
  });
  cutoverAssert(
    product &&
      product.stock === p.expectedOwned &&
      product.isActive === p.isActive &&
      product.lotTracking === p.lotTracking &&
      product.inventoryTracking === 'QUANTITY',
    'MISMATCH',
  );
  const batches = await tx.inventoryBatch.findMany({
    where: { companyId: m.companyId, productId: p.productId },
    orderBy: { id: 'asc' },
  });
  cutoverAssert(batches.length === p.batches.length, 'MISMATCH');
  for (const [i, b] of p.batches.entries()) {
    const actual = batches[i];
    cutoverAssert(
      actual.id === b.batchId &&
        actual.isActive === b.isActive &&
        actual.lotNumber === b.lotNumber &&
        (actual.expirationDate?.toISOString() ?? null) === b.expirationDate &&
        actual.receivedAt.toISOString() === b.receivedAt &&
        actual.initialQuantity === b.initialQuantityBefore &&
        actual.availableQuantity ===
          (applied ? b.availableQuantityExpected : b.availableQuantityBefore),
      'MISMATCH',
    );
  }
  const positions = await tx.inventoryPosition.findMany({
    where: { companyId: m.companyId, productId: p.productId },
    include: { lines: true },
  });
  const effects = await tx.inventoryPhysicalEffect.findMany({
    where: {
      companyId: m.companyId,
      OR: [
        {
          originType: 'INVENTORY_OPENING',
          originId: m.cutoverId,
          originOperation: `OPEN_${p.productId}`,
        },
        { lines: { some: { position: { productId: p.productId } } } },
      ],
    },
    include: { lines: { orderBy: { sequence: 'asc' } } },
  });
  if (!applied) {
    cutoverAssert(
      cp.status === 'PLANNED' &&
        cp.openingEffectId === null &&
        cp.appliedAt === null &&
        cp.verifiedAt === null &&
        positions.length === 0 &&
        effects.length === 0,
      'MISMATCH',
    );
    return;
  }
  cutoverAssert(
    cp.status !== 'PLANNED' &&
      cp.appliedAt !== null &&
      (cp.status === 'VERIFIED') === (cp.verifiedAt !== null),
    'MISMATCH',
  );
  if (!p.expectedOwned) {
    cutoverAssert(
      cp.openingEffectId === null &&
        positions.length === 0 &&
        effects.length === 0,
      'MISMATCH',
    );
    return;
  }
  cutoverAssert(
    effects.length === 1 && positions.length === p.pools.length,
    'MISMATCH',
  );
  const effect = effects[0];
  cutoverAssert(
    effect.id === cp.openingEffectId &&
      effect.kind === 'OPENING' &&
      effect.originType === 'INVENTORY_OPENING' &&
      effect.originId === m.cutoverId &&
      effect.originOperation === `OPEN_${p.productId}` &&
      effect.requestHash === openingRequestHash(m, p) &&
      effect.lineCount === p.pools.length &&
      effect.lines.length === p.pools.length,
    'MISMATCH',
  );
  for (const [i, pool] of p.pools.entries()) {
    const line = effect.lines[i];
    const pos = positions.find((x) => x.id === line.positionId);
    cutoverAssert(
      pos &&
        pos.inventoryBatchId === pool.batchId &&
        pos.state === pool.state &&
        pos.contextType === pool.contextType &&
        pos.contextId === pool.contextId &&
        pos.quantity === pool.quantity &&
        pos.revision === 1 &&
        pos.lines.length === 1 &&
        line.companyId === m.companyId &&
        line.sequence === i + 1 &&
        line.delta === pool.quantity &&
        line.quantityBefore === 0 &&
        line.quantityAfter === pool.quantity &&
        line.revisionBefore === 0 &&
        line.revisionAfter === 1,
      'MISMATCH',
    );
  }
}
export async function assertNoExtraPhysical(
  tx: Prisma.TransactionClient,
  m: OpeningManifest,
) {
  const cps = await tx.inventoryCutoverProduct.findMany({
    where: { companyId: m.companyId, cutoverId: m.cutoverId },
  });
  const ids = cps.flatMap((cp) =>
    cp.openingEffectId ? [cp.openingEffectId] : [],
  );
  cutoverAssert(
    (await tx.inventoryPhysicalEffect.count({
      where: { companyId: m.companyId, id: { notIn: ids } },
    })) === 0,
    'MISMATCH',
  );
  cutoverAssert(
    (await tx.inventoryPosition.count({
      where: {
        companyId: m.companyId,
        productId: { notIn: m.products.map((p) => p.productId) },
      },
    })) === 0,
    'MISMATCH',
  );
}
