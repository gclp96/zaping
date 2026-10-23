import { randomUUID } from 'node:crypto';
import { InventoryPosition, Prisma } from '@prisma/client';
import {
  authorizeSaleConsumption,
  assertSaleConsumptionSources,
} from './sale-consumption.authorization';

describe('W2a durable confirmed Sale consumption', () => {
  function fixture() {
    const companyId = randomUUID(),
      actorId = randomUUID(),
      saleId = randomUUID(),
      productId = randomUUID();
    const positions = [2, 3].map(
      (quantity) =>
        ({
          id: randomUUID(),
          companyId,
          productId,
          quantity,
          revision: 1,
          state: 'AVAILABLE',
          inventoryBatchId: null,
          contextType: null,
          contextId: null,
        }) as InventoryPosition,
    );
    const product = {
      companyId,
      isActive: true,
      inventoryTracking: 'QUANTITY',
      lotTracking: 'OPTIONAL',
    };
    const sale = {
      id: saleId,
      companyId,
      status: 'CONFIRMED',
      quoteId: null as string | null,
      quote: null as null | {
        companyId: string;
        status: string;
        convertedToSale: boolean;
      },
      items: [{ id: randomUUID(), productId, quantity: 5, product }],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ current: true }]),
      user: { findFirst: jest.fn().mockResolvedValue({ role: 'SALES' }) },
      sale: { findFirst: jest.fn().mockResolvedValue(sale) },
      inventoryCutoverLegacySale: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const input = {
      companyId,
      actorId,
      saleId,
      sources: positions.map((p) => ({
        sourceId: p.id,
        quantity: p.quantity,
        expectedSourceRevision: p.revision,
      })),
    };
    const authorize = () =>
      authorizeSaleConsumption(
        tx as unknown as Prisma.TransactionClient,
        input,
      );
    return { tx, sale, product, input, authorize, positions };
  }
  it.each(['NONE', 'OPTIONAL'])(
    'reconstructs %s intent from Sale and verifies multiple sources',
    async (lotTracking) => {
      const f = fixture();
      f.product.lotTracking = lotTracking;
      const c = await f.authorize();
      expect(c.request).toMatchObject({
        origin: { type: 'SALE', id: f.input.saleId, operation: 'CONFIRM' },
        operation: {
          kind: 'DEFINITIVE_OUT',
          debits: [...f.input.sources].sort((a, b) =>
            a.sourceId.localeCompare(b.sourceId),
          ),
        },
      });
      expect(() => assertSaleConsumptionSources(c, f.positions)).not.toThrow();
      const changed = f.positions.map((p) => ({ ...p }));
      changed[0].productId = randomUUID();
      expect(() => assertSaleConsumptionSources(c, changed)).toThrow(
        'SALE_PHYSICAL_SOURCE_INVALID',
      );
    },
  );
  it.each([
    'missing',
    'committed',
    'draft',
    'REQUIRED',
    'ASSET',
    'SERIALIZED',
    'foreign-product',
    'inactive-product',
    'role',
    'inactive-actor',
    'legacy',
    'revision',
    'duplicate',
    'quote',
  ] as const)('rejects %s evidence', async (kind) => {
    const f = fixture();
    if (kind === 'missing') f.tx.$queryRaw.mockResolvedValue([]);
    if (kind === 'committed')
      f.tx.$queryRaw.mockResolvedValue([{ current: false }]);
    if (kind === 'draft') f.sale.status = 'DRAFT';
    if (kind === 'REQUIRED') f.product.lotTracking = 'REQUIRED';
    if (kind === 'ASSET' || kind === 'SERIALIZED')
      f.product.inventoryTracking = kind;
    if (kind === 'foreign-product') f.product.companyId = randomUUID();
    if (kind === 'inactive-product') f.product.isActive = false;
    if (kind === 'role')
      f.tx.user.findFirst.mockResolvedValue({ role: 'WAREHOUSE' });
    if (kind === 'inactive-actor') f.tx.user.findFirst.mockResolvedValue(null);
    if (kind === 'legacy')
      f.tx.inventoryCutoverLegacySale.findFirst.mockResolvedValue({
        saleId: f.sale.id,
      });
    if (kind === 'revision') f.input.sources[0].expectedSourceRevision = -1;
    if (kind === 'duplicate')
      f.input.sources[1].sourceId = f.input.sources[0].sourceId;
    if (kind === 'quote') f.sale.quoteId = randomUUID();
    await expect(f.authorize()).rejects.toThrow();
  });
  it.each(['quantity', 'batch', 'custody', 'tenant', 'missing'] as const)(
    'rejects locked %s mismatch',
    async (kind) => {
      const f = fixture();
      const c = await f.authorize();
      if (kind === 'quantity') c.items[0].quantity++;
      if (kind === 'batch') f.positions[0].inventoryBatchId = randomUUID();
      if (kind === 'custody') f.positions[0].state = 'CUSTODY';
      if (kind === 'tenant') f.positions[0].companyId = randomUUID();
      if (kind === 'missing') f.positions.pop();
      expect(() => assertSaleConsumptionSources(c, f.positions)).toThrow(
        'SALE_PHYSICAL_SOURCE_INVALID',
      );
    },
  );
});
