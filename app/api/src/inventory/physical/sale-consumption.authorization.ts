import { InventoryPosition, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { requireTransaction } from './inventory-compatibility-projection.service';
import {
  Debit,
  normalizePhysicalRequest,
  PhysicalRequest,
  requirePhysical,
} from './physical-inventory.contract';
import { SalesLegacyClassifier } from './sales-legacy-classifier';
import { validateSalesItems } from './sales-physical-source-resolver';

export type SaleConsumptionInput = {
  companyId: string;
  actorId: string;
  saleId: string;
  sources: Debit[];
};
export type SaleConsumptionContext = {
  request: PhysicalRequest;
  items: { productId: string; quantity: number }[];
};

// Called only after the integration holds Sale/Quote and the planner's business
// locks. No new lock root, caller override, timezone or authorization flag.
export async function authorizeSaleConsumption(
  tx: Prisma.TransactionClient,
  input: SaleConsumptionInput,
): Promise<SaleConsumptionContext> {
  requireTransaction(tx);
  requirePhysical(
    isUUID(input.companyId) && isUUID(input.actorId) && isUUID(input.saleId),
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
  const actor = await tx.user.findFirst({
    where: { id: input.actorId, companyId: input.companyId, isActive: true },
  });
  requirePhysical(
    actor && ['ADMIN', 'MANAGER', 'SALES'].includes(actor.role),
    'INVENTORY_TENANT_MISMATCH',
  );
  // A newly converted Sale or this transaction's DRAFT -> CONFIRMED version.
  // A previously committed confirmation cannot be reused as a new debit permit.
  const [proof] = await tx.$queryRaw<{ current: boolean }[]>(Prisma.sql`
    SELECT xmin=pg_current_xact_id()::xid AS current FROM "Sale"
    WHERE id=${input.saleId} AND "companyId"=${input.companyId} AND status='CONFIRMED'
  `);
  requirePhysical(proof?.current, 'SALE_PHYSICAL_STATE_INCONSISTENT');
  const sale = await tx.sale.findFirst({
    where: { id: input.saleId, companyId: input.companyId },
    include: { items: { include: { product: true } }, quote: true },
  });
  requirePhysical(
    sale?.status === 'CONFIRMED',
    'SALE_PHYSICAL_STATE_INCONSISTENT',
  );
  if (sale.quoteId)
    requirePhysical(
      sale.quote?.companyId === input.companyId &&
        sale.quote.status === 'CONFIRMED' &&
        sale.quote.convertedToSale,
      'SALE_PHYSICAL_STATE_INCONSISTENT',
    );
  await new SalesLegacyClassifier().assertNoMembership(
    tx,
    input.companyId,
    sale.id,
  );
  validateSalesItems(sale.items);
  requirePhysical(
    sale.items.every(
      (i) =>
        i.product.companyId === input.companyId &&
        i.product.inventoryTracking === 'QUANTITY' &&
        ['NONE', 'OPTIONAL'].includes(i.product.lotTracking) &&
        i.product.isActive,
    ),
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
  requirePhysical(
    input.sources.length > 0 &&
      new Set(input.sources.map((s) => s.sourceId)).size ===
        input.sources.length &&
      input.sources.every(
        (s) =>
          Number.isInteger(s.expectedSourceRevision) &&
          s.expectedSourceRevision! >= 0,
      ),
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
  return {
    items: sale.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    })),
    request: normalizePhysicalRequest({
      companyId: input.companyId,
      actorId: input.actorId,
      origin: { type: 'SALE', id: sale.id, operation: 'CONFIRM' },
      operation: { kind: 'DEFINITIVE_OUT', debits: input.sources },
    }),
  };
}

// Repeat against locked rows: a preview or discovery read cannot authorize a
// different physical identity/quantity. CAS and temporal checks stay in core.
export function assertSaleConsumptionSources(
  context: SaleConsumptionContext,
  positions: InventoryPosition[],
) {
  const op = context.request.operation;
  requirePhysical(op.kind === 'DEFINITIVE_OUT', 'SALE_PHYSICAL_SOURCE_INVALID');
  requirePhysical(
    positions.length === op.debits.length &&
      new Set(positions.map((p) => p.id)).size === positions.length,
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
  const totals = new Map<string, number>();
  for (const d of op.debits) {
    const p = positions.find((p) => p.id === d.sourceId);
    requirePhysical(
      p &&
        p.companyId === context.request.companyId &&
        p.state === 'AVAILABLE' &&
        p.inventoryBatchId === null &&
        p.contextType === null &&
        p.contextId === null,
      'SALE_PHYSICAL_SOURCE_INVALID',
    );
    totals.set(p.productId, (totals.get(p.productId) ?? 0) + d.quantity);
  }
  requirePhysical(
    totals.size === context.items.length &&
      context.items.every((i) => totals.get(i.productId) === i.quantity),
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
}
