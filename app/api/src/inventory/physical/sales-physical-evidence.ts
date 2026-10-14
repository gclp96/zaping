import { createHash } from 'node:crypto';
import { Prisma, DocumentStatus } from '@prisma/client';
import { requirePhysical } from './physical-inventory.contract';

export const legacySaleInclude = {
  items: { include: { product: { select: { companyId: true } } } },
  quote: {
    include: {
      items: { include: { product: { select: { companyId: true } } } },
    },
  },
} as const;
export type LegacySaleEvidence = Prisma.SaleGetPayload<{
  include: typeof legacySaleInclude;
}>;
export type SaleEffectEvidence = Prisma.InventoryPhysicalEffectGetPayload<{
  include: { lines: { include: { position: true } } };
}>;
type ConfirmationEvidence = {
  id: string;
  companyId: string;
  status: DocumentStatus;
  quoteId: string | null;
  quote: {
    companyId: string;
    status: DocumentStatus;
    convertedToSale: boolean;
  } | null;
  items: { productId: string; quantity: number }[];
};
export function assertSalesPhysicalEvidence(
  companyId: string,
  sale: ConfirmationEvidence,
  effect: SaleEffectEvidence,
): void {
  requirePhysical(
    sale.companyId === companyId,
    'SALE_PHYSICAL_STATE_INCONSISTENT',
  );
  requirePhysical(
    sale.status === 'CONFIRMED',
    'SALE_PHYSICAL_STATE_INCONSISTENT',
  );
  if (sale.quoteId)
    requirePhysical(
      sale.quote?.companyId === companyId &&
        sale.quote.status === 'CONFIRMED' &&
        sale.quote.convertedToSale,
      'SALE_PHYSICAL_STATE_INCONSISTENT',
    );
  const mismatch = 'SALE_PHYSICAL_EFFECT_MISMATCH' as const;
  requirePhysical(
    effect.kind === 'DEFINITIVE_OUT' &&
      effect.companyId === companyId &&
      effect.originType === 'SALE' &&
      effect.originId === sale.id &&
      effect.originOperation === 'CONFIRM' &&
      effect.lines.length > 0 &&
      effect.lines.length === effect.lineCount,
    mismatch,
  );
  const totals = new Map<string, number>();
  const positions = new Set<string>();
  effect.lines.forEach((line, index) => {
    const p = line.position;
    requirePhysical(
      line.companyId === companyId &&
        line.effectId === effect.id &&
        p.companyId === companyId &&
        p.state === 'AVAILABLE' &&
        p.inventoryBatchId === null &&
        p.contextType === null &&
        p.contextId === null &&
        !positions.has(p.id) &&
        line.sequence === index + 1 &&
        line.delta < 0 &&
        line.quantityAfter === line.quantityBefore + line.delta &&
        line.quantityAfter >= 0 &&
        line.revisionAfter === line.revisionBefore + 1,
      mismatch,
    );
    positions.add(p.id);
    totals.set(p.productId, (totals.get(p.productId) ?? 0) - line.delta);
  });
  requirePhysical(
    sale.items.length > 0 &&
      new Set(sale.items.map((i) => i.productId)).size === sale.items.length &&
      totals.size === sale.items.length &&
      sale.items.every(
        (i) =>
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          totals.get(i.productId) === i.quantity,
      ),
    mismatch,
  );
}

export function legacySaleFingerprint(
  companyId: string,
  sale: LegacySaleEvidence,
): string {
  const error = 'SALE_PHYSICAL_STATE_INCONSISTENT' as const;
  requirePhysical(
    sale.companyId === companyId && sale.status === 'CONFIRMED',
    error,
  );
  const number = (n: number) => {
    requirePhysical(Number.isFinite(n), error);
    return Object.is(n, -0) ? 0 : n;
  };
  const items = (
    rows: ReadonlyArray<{
      id: string;
      productId: string;
      quantity: number;
      price: number;
      subtotal: number;
      product: { companyId: string };
    }>,
  ) => {
    requirePhysical(
      rows.length > 0 && new Set(rows.map((r) => r.id)).size === rows.length,
      error,
    );
    return [...rows]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((r) => {
        requirePhysical(
          r.product.companyId === companyId &&
            Number.isInteger(r.quantity) &&
            r.quantity > 0 &&
            r.quantity <= 2147483647,
          error,
        );
        return {
          id: r.id,
          productId: r.productId,
          quantity: r.quantity,
          price: number(r.price),
          subtotal: number(r.subtotal),
        };
      });
  };
  const q = sale.quote;
  requirePhysical(
    sale.quoteId === null
      ? q === null
      : !!q &&
          q.id === sale.quoteId &&
          q.companyId === companyId &&
          q.status === 'CONFIRMED' &&
          q.convertedToSale,
    error,
  );
  const preimage = {
    version: 1,
    companyId,
    sale: {
      id: sale.id,
      customerId: sale.customerId,
      folio: sale.folio,
      quoteId: sale.quoteId,
      status: sale.status,
      subtotal: number(sale.subtotal),
      iva: number(sale.iva),
      total: number(sale.total),
      items: items(sale.items),
    },
    quote: q
      ? {
          id: q.id,
          companyId: q.companyId,
          customerId: q.customerId,
          folio: q.folio,
          status: q.status,
          convertedToSale: q.convertedToSale,
          subtotal: number(q.subtotal),
          iva: number(q.iva),
          total: number(q.total),
          items: items(q.items),
        }
      : null,
  };
  return createHash('sha256')
    .update(JSON.stringify(preimage), 'utf8')
    .digest('hex');
}
