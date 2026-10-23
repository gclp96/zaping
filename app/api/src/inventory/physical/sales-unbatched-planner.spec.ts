import { BadRequestException } from '@nestjs/common';
import { InventoryPosition, Prisma } from '@prisma/client';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { SalesPhysicalSourceResolver } from './sales-physical-source-resolver';

describe('S3b-S internal locked unbatched planner', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const item = { id: 'sale-item', productId, quantity: 12 };
  function pool(
    n: number,
    expirationDate: string | null,
    quantity: number,
    revision = n,
  ): InventoryPosition {
    return {
      id: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`,
      companyId,
      productId,
      inventoryBatchId: null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      state: 'AVAILABLE',
      contextType: null,
      contextId: null,
      quantity,
      revision,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  function arrange() {
    const a = pool(1, '2028-08-15', 2, 2),
      b = pool(2, '2028-08-16', 3, 4),
      c = pool(3, '2028-08-17', 4, 6),
      unknown = pool(4, null, 5, 8);
    const expired = pool(5, '2028-08-14', 99),
      empty = pool(6, '2028-08-18', 0);
    const batched = { ...pool(7, null, 99), inventoryBatchId: 'batch' };
    const custody = {
      ...pool(8, null, 99),
      state: 'CUSTODY' as const,
      contextType: 'CASE',
      contextId: 'case',
    };
    const rows = [unknown, c, expired, batched, b, empty, a, custody];
    const order: string[] = [];
    const product = {
      id: productId,
      companyId,
      isActive: true,
      name: 'Material',
      inventoryTracking: 'QUANTITY',
      lotTracking: 'OPTIONAL',
    };
    const repository = {
      lockProducts: jest.fn(() => {
        order.push('Product');
        return Promise.resolve([product]);
      }),
      lockBatches: jest.fn(() => {
        order.push('Batch');
        return Promise.resolve([]);
      }),
      lockPositions: jest.fn(() => {
        order.push('Position');
        return Promise.resolve(rows);
      }),
    };
    const writes = jest.fn();
    const client = {
      company: {
        findUnique: jest.fn(() => {
          order.push('Company-read');
          return Promise.resolve({ timezone: 'America/Hermosillo' });
        }),
      },
      inventoryPosition: {
        findMany: jest.fn(() => {
          order.push('discovery');
          return Promise.resolve(
            rows.map((p) => ({ id: p.id, quantity: 999, revision: 999 })),
          );
        }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        updateMany: writes,
      },
      inventoryPhysicalEffect: { create: writes },
      sale: { updateMany: writes },
      product: { updateMany: writes },
    };
    const tx = client as unknown as Prisma.TransactionClient;
    const resolver = new SalesPhysicalSourceResolver(
      repository as unknown as PhysicalInventoryRepository,
    );
    return {
      a,
      b,
      c,
      unknown,
      rows,
      order,
      product,
      repository,
      client,
      tx,
      resolver,
      writes,
    };
  }
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2028-08-16T06:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('plans FEFO across three dates then unknown, excludes expired/empty/Batch/CUSTODY and never writes', async () => {
    const f = arrange();
    const result = await f.resolver.planUnbatchedSources(f.tx, companyId, [
      item,
    ]);
    expect(result.plan).toEqual([
      {
        saleItemId: item.id,
        productId,
        requestedQuantity: 12,
        sources: [
          { positionId: f.a.id, quantity: 2, expectedRevision: 2 },
          { positionId: f.b.id, quantity: 3, expectedRevision: 4 },
          { positionId: f.c.id, quantity: 4, expectedRevision: 6 },
          { positionId: f.unknown.id, quantity: 3, expectedRevision: 8 },
        ],
      },
    ]);
    expect(f.order).toEqual([
      'Product',
      'discovery',
      'Batch',
      'Position',
      'Company-read',
    ]);
    expect(f.client.inventoryPosition.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
        productId: { in: [productId] },
        state: 'AVAILABLE',
        inventoryBatchId: null,
      },
      select: { id: true },
    });
    expect(f.repository.lockBatches).toHaveBeenCalledWith(f.tx, companyId, []);
    expect(f.client.company.findUnique).toHaveBeenCalledWith({
      where: { id: companyId },
      select: { timezone: true },
    });
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.client.inventoryPosition.aggregate).not.toHaveBeenCalled();
  });
  it('allocates only the requested partial quantity from the last selected pool', async () => {
    const f = arrange();
    const { plan } = await f.resolver.planUnbatchedSources(f.tx, companyId, [
      { ...item, quantity: 4 },
    ]);
    expect(plan[0].sources).toEqual([
      { positionId: f.a.id, quantity: 2, expectedRevision: 2 },
      { positionId: f.b.id, quantity: 2, expectedRevision: 4 },
    ]);
  });
  it('does not count expired, empty, real Batch or custody stock toward a shortfall', async () => {
    const f = arrange();
    await expect(
      f.resolver.planUnbatchedSources(f.tx, companyId, [
        { ...item, quantity: 15 },
      ]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
    expect(f.writes).not.toHaveBeenCalled();
  });
  it('uses locked quantities/revisions rather than discovery values', async () => {
    const f = arrange();
    f.rows.splice(0, f.rows.length, {
      ...f.unknown,
      quantity: 1,
      revision: 17,
    });
    await expect(
      f.resolver.planUnbatchedSources(f.tx, companyId, [
        { ...item, quantity: 2 },
      ]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
    const { plan } = await f.resolver.planUnbatchedSources(f.tx, companyId, [
      { ...item, quantity: 1 },
    ]);
    expect(plan[0].sources).toEqual([
      { positionId: f.unknown.id, quantity: 1, expectedRevision: 17 },
    ]);
  });
  it('breaks hypothetical equal-date and unknown-date ties by Position ID regardless of row order', async () => {
    // Equal-date pools per Product cannot coexist under S1 UNIQUE indexes.
    // Synthetic locked rows test only the defensive comparator, not SQL coverage.
    const f = arrange();
    f.rows.splice(
      0,
      f.rows.length,
      pool(9, null, 2),
      pool(3, '2028-08-15', 2),
      pool(8, null, 2),
      pool(1, '2028-08-15', 2),
    );
    const first = await f.resolver.planUnbatchedSources(f.tx, companyId, [
      { ...item, quantity: 7 },
    ]);
    f.rows.reverse();
    const second = await f.resolver.planUnbatchedSources(f.tx, companyId, [
      { ...item, quantity: 7 },
    ]);
    expect(first.plan).toEqual(second.plan);
    expect(first.plan[0].sources.map((p) => p.positionId)).toEqual(
      [1, 3, 8, 9].map((n) => pool(n, null, 1).id),
    );
  });
  it('evaluates time after locks, using persisted Company timezone through midnight', async () => {
    const f = arrange();
    f.rows.splice(0, f.rows.length, f.a);
    f.repository.lockPositions.mockImplementation(() => {
      f.order.push('Position');
      jest.setSystemTime(new Date('2028-08-16T07:00:00Z'));
      return Promise.resolve(f.rows);
    });
    await expect(
      f.resolver.planUnbatchedSources(f.tx, companyId, [
        { ...item, quantity: 1 },
      ]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
    expect(f.writes).not.toHaveBeenCalled();
  });
  it.each(['resolve', 'planUnbatchedSources'] as const)(
    'keeps REQUIRED protected in %s before discovery',
    async (method) => {
      const f = arrange();
      f.product.lotTracking = 'REQUIRED';
      await expect(f.resolver[method](f.tx, companyId, [item])).rejects.toThrow(
        BadRequestException,
      );
      expect(f.client.inventoryPosition.findMany).not.toHaveBeenCalled();
    },
  );
  it('keeps the historical resolver undated-only and rejects a dated row returned after locking', async () => {
    const f = arrange();
    f.rows.splice(0, f.rows.length, f.a);
    await expect(
      f.resolver.resolve(f.tx, companyId, [{ ...item, quantity: 1 }]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
    expect(f.client.inventoryPosition.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
        productId: { in: [productId] },
        state: 'AVAILABLE',
        inventoryBatchId: null,
        expirationDate: null,
      },
      select: { id: true },
    });
    expect(f.client.company.findUnique).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
  });
  it('preserves OPTIONAL Batch shortfall diagnosis using local D, without allocating Batch', async () => {
    const f = arrange();
    f.rows.splice(0, f.rows.length);
    f.client.inventoryPosition.aggregate.mockResolvedValue({
      _sum: { quantity: 2 },
    });
    await expect(
      f.resolver.planUnbatchedSources(f.tx, companyId, [
        { ...item, quantity: 1 },
      ]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
    expect(f.client.inventoryPosition.aggregate).not.toHaveBeenCalled();
    await expect(
      f.resolver.planConfirmedSaleSources(f.tx, companyId, [
        { ...item, quantity: 1 },
      ]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_REQUIRED' });
    expect(f.client.inventoryPosition.aggregate).toHaveBeenCalledWith({
      where: {
        companyId,
        productId,
        state: 'AVAILABLE',
        inventoryBatchId: { not: null },
        batch: {
          isActive: true,
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: new Date('2028-08-15T00:00:00.000Z') } },
          ],
        },
      },
      _sum: { quantity: true },
    });
    expect(f.writes).not.toHaveBeenCalled();
  });
  it('does not allocate stock whose revision cannot be incremented', async () => {
    const f = arrange();
    f.rows.splice(0, f.rows.length, { ...f.unknown, revision: 2147483647 });
    await expect(
      f.resolver.planUnbatchedSources(f.tx, companyId, [
        { ...item, quantity: 1 },
      ]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
    expect(f.writes).not.toHaveBeenCalled();
  });
  it('allocates independently per Product and returns deterministic Product order', async () => {
    const f = arrange();
    const other = '99999999-9999-4999-8999-999999999999';
    const second = { ...pool(99, null, 10), productId: other };
    f.rows.push(second);
    f.repository.lockProducts.mockResolvedValue([
      f.product,
      { ...f.product, id: other },
    ]);
    const { plan } = await f.resolver.planUnbatchedSources(f.tx, companyId, [
      { id: 'second-item', productId: other, quantity: 1 },
      { ...item, quantity: 2 },
    ]);
    expect(plan.map((p) => p.productId)).toEqual([productId, other]);
    expect(plan[0].sources).toEqual([
      { positionId: f.a.id, quantity: 2, expectedRevision: 2 },
    ]);
    expect(plan[1].sources).toEqual([
      { positionId: second.id, quantity: 1, expectedRevision: 99 },
    ]);
  });
  it.each([
    'foreign',
    'duplicate',
    'invalid-revision',
    'inactive-product',
  ] as const)('fails closed for %s evidence', async (scenario) => {
    const f = arrange();
    if (scenario === 'foreign') f.rows[0].companyId = 'foreign';
    if (scenario === 'duplicate') f.rows.push(f.rows[0]);
    if (scenario === 'invalid-revision') f.rows[0].revision = -1;
    if (scenario === 'inactive-product') f.product.isActive = false;
    await expect(
      f.resolver.planUnbatchedSources(f.tx, companyId, [item]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
    expect(f.writes).not.toHaveBeenCalled();
  });
});
