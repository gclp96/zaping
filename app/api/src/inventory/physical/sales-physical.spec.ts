/* Jest assertions inspect mock method references; they do not call unbound methods. */
/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { SalesPhysicalSourceResolver } from './sales-physical-source-resolver';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { SalesPhysicalIntegrationService } from './sales-physical-integration.service';
import { PhysicalInventoryService } from './physical-inventory.service';
import { InventoryCompatibilityHistoryService } from './inventory-compatibility-history.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesFolioService } from '../../sales/sales-folio.service';
import { PhysicalInventoryError } from './physical-inventory.contract';

describe('Sales Candidate C resolver', () => {
  const companyId = randomUUID();
  const productId = randomUUID();
  const positionId = randomUUID();
  let repository: PhysicalInventoryRepository;
  let product: Product;
  let pool: {
    id: string;
    companyId: string;
    productId: string;
    state: string;
    inventoryBatchId: null;
    contextType: null;
    contextId: null;
    quantity: number;
    revision: number;
  };
  let tx: Prisma.TransactionClient;
  let batchQuantity: number;
  let events: string[];
  beforeEach(() => {
    events = [];
    batchQuantity = 0;
    product = {
      id: productId,
      companyId,
      name: 'Material',
      inventoryTracking: 'QUANTITY',
      lotTracking: 'NONE',
      isActive: true,
      cost: 5,
    } as Product;
    pool = {
      id: positionId,
      companyId,
      productId,
      state: 'AVAILABLE',
      inventoryBatchId: null,
      contextType: null,
      contextId: null,
      quantity: 5,
      revision: 8,
    };
    repository = {
      lockProducts: jest.fn(() => {
        events.push('products');
        return Promise.resolve([product]);
      }),
      lockBatches: jest.fn(() => {
        events.push('batches');
        return Promise.resolve([]);
      }),
      lockPositions: jest.fn(() => {
        events.push('positions');
        return Promise.resolve([pool]);
      }),
    } as unknown as PhysicalInventoryRepository;
    tx = {
      inventoryPosition: {
        findMany: jest.fn(() => {
          events.push('discovery');
          return Promise.resolve([pool]);
        }),
        aggregate: jest.fn(() =>
          Promise.resolve({ _sum: { quantity: batchQuantity } }),
        ),
      },
    } as unknown as Prisma.TransactionClient;
  });
  const item = () => ({ id: randomUUID(), productId, quantity: 3 });
  it.each(['NONE', 'OPTIONAL'] as const)(
    '%s spends only the unbatched pool after roots',
    async (lot) => {
      product.lotTracking = lot;
      batchQuantity = 100;
      const result = await new SalesPhysicalSourceResolver(repository).resolve(
        tx,
        companyId,
        [item()],
      );
      expect(events).toEqual(['products', 'discovery', 'batches', 'positions']);
      expect(result.plan[0].sources).toEqual([
        { positionId, quantity: 3, expectedRevision: 8 },
      ]);
      expect(tx.inventoryPosition.aggregate).not.toHaveBeenCalled();
      expect(tx.inventoryPosition.findMany).toHaveBeenCalledWith({
        where: {
          companyId,
          productId: { in: [productId] },
          state: 'AVAILABLE',
          inventoryBatchId: null,
        },
      });
    },
  );
  it.each(['ASSET', 'SERIALIZED'] as const)('rejects %s', async (tracking) => {
    product.inventoryTracking = tracking;
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(tx.inventoryPosition.findMany).not.toHaveBeenCalled();
  });
  it('preserves REQUIRED text', async () => {
    product.lotTracking = 'REQUIRED';
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toThrow(
      'El producto Material requiere selección de lote para completar la venta',
    );
  });
  it('rejects inactive and foreign Products', async () => {
    product.isActive = false;
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
    product.isActive = true;
    product.companyId = randomUUID();
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
  });
  it('does not spend custody even if a repository returns it', async () => {
    pool.state = 'CUSTODY';
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
  });
  it.each([0, 2])('rejects insufficient unbatched %i', async (q) => {
    pool.quantity = q;
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
  });
  it('classifies batched OPTIONAL shortfall without allocation', async () => {
    product.lotTracking = 'OPTIONAL';
    pool.quantity = 0;
    batchQuantity = 10;
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
      ]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_REQUIRED' });
    expect(repository.lockBatches).toHaveBeenCalledWith(tx, companyId, []);
  });
  it.each([0, -1, 1.2])(
    'rejects quantity %i before locks',
    async (quantity) => {
      await expect(
        new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
          { ...item(), quantity },
        ]),
      ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
      expect(repository.lockProducts).not.toHaveBeenCalled();
    },
  );
  it('rejects duplicate Products before locks', async () => {
    await expect(
      new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
        item(),
        item(),
      ]),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
  });
});

describe('Sales physical replay and outer retry', () => {
  const companyId = randomUUID(),
    actorId = randomUUID(),
    saleId = randomUUID(),
    productId = randomUUID();
  const effectId = randomUUID(),
    positionId = randomUUID();
  const sale = () => ({
    id: saleId,
    companyId,
    status: 'CONFIRMED',
    quoteId: null,
    quote: null,
    items: [{ id: randomUUID(), productId, quantity: 3 }],
    customer: {},
  });
  const effect = () => ({
    id: effectId,
    companyId,
    originType: 'SALE',
    originId: saleId,
    originOperation: 'CONFIRM',
    kind: 'DEFINITIVE_OUT',
    actorId,
    lineCount: 1,
    lines: [
      {
        companyId,
        effectId,
        positionId,
        sequence: 1,
        delta: -3,
        quantityBefore: 5,
        quantityAfter: 2,
        revisionBefore: 1,
        revisionAfter: 2,
        position: {
          id: positionId,
          companyId,
          productId,
          state: 'AVAILABLE',
          inventoryBatchId: null,
          contextType: null,
          contextId: null,
        },
      },
    ],
  });
  function setup() {
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: actorId, role: 'SALES', isActive: true }),
      },
      sale: {
        findFirst: jest.fn().mockResolvedValue(sale()),
        updateMany: jest.fn(),
      },
      inventoryPhysicalEffect: {
        findUnique: jest.fn().mockResolvedValue(effect()),
      },
      $queryRaw: jest.fn(),
    };
    const transaction = jest.fn((fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    );
    const resolver = { resolve: jest.fn() };
    const physical = { definitiveOut: jest.fn() };
    const projections = { apply: jest.fn() };
    const history = { writeSale: jest.fn() };
    const folios = { allocateNextAvailableFolio: jest.fn() };
    const service = new SalesPhysicalIntegrationService(
      { $transaction: transaction } as unknown as PrismaService,
      folios as unknown as SalesFolioService,
      resolver as unknown as SalesPhysicalSourceResolver,
      physical as unknown as PhysicalInventoryService,
      projections,
      history as unknown as InventoryCompatibilityHistoryService,
    );
    return {
      service,
      tx,
      transaction,
      resolver,
      physical,
      projections,
      history,
      folios,
    };
  }
  it('same actor replays with zero mutation, no source discovery or folio', async () => {
    const f = setup();
    expect(await f.service.approve(companyId, actorId, saleId)).toMatchObject({
      id: saleId,
      status: 'CONFIRMED',
    });
    for (const spy of [
      f.tx.sale.updateMany,
      f.resolver.resolve,
      f.physical.definitiveOut,
      f.projections.apply,
      f.history.writeSale,
      f.folios.allocateNextAvailableFolio,
    ])
      expect(spy).not.toHaveBeenCalled();
    expect(f.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
  });
  it('different actor preserves business rejection without checking historical activity', async () => {
    const f = setup();
    await expect(
      f.service.approve(companyId, randomUUID(), saleId),
    ).rejects.toThrow('La venta ya fue aprobada');
    expect(f.tx.user.findFirst).toHaveBeenCalledTimes(1);
    expect(f.physical.definitiveOut).not.toHaveBeenCalled();
  });
  it('requires current authorization even for replay', async () => {
    const f = setup();
    f.tx.user.findFirst.mockResolvedValue(null);
    await expect(f.service.approve(companyId, actorId, saleId)).rejects.toThrow(
      'No autorizado',
    );
    expect(f.tx.sale.findFirst).not.toHaveBeenCalled();
  });
  it('unknown legacy classification fails closed without timestamps', async () => {
    const f = setup();
    f.tx.inventoryPhysicalEffect.findUnique.mockResolvedValue(null);
    await expect(
      f.service.approve(companyId, actorId, saleId),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_STATE_INCONSISTENT' });
  });
  it('checks immutable allocations rather than current revision', async () => {
    const f = setup();
    const e = effect();
    e.lines[0].delta = -2;
    f.tx.inventoryPhysicalEffect.findUnique.mockResolvedValue(e);
    await expect(
      f.service.approve(companyId, actorId, saleId),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_EFFECT_MISMATCH' });
  });
  it('effect with CANCELLED Sale is inconsistent', async () => {
    const f = setup();
    f.tx.sale.findFirst.mockResolvedValue({ ...sale(), status: 'CANCELLED' });
    await expect(
      f.service.approve(companyId, actorId, saleId),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_STATE_INCONSISTENT' });
  });
  it.each(['40001', '40P01'])(
    'retries confirmed abort %s at most three times',
    async (code) => {
      const f = setup();
      f.transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('redacted', {
          code: 'P2010',
          clientVersion: 'test',
          meta: { code },
        }),
      );
      await expect(
        f.service.approve(companyId, actorId, saleId),
      ).rejects.toMatchObject({ code: 'PHYSICAL_CONCURRENCY_TIMEOUT' });
      expect(f.transaction).toHaveBeenCalledTimes(3);
    },
  );
  it.each([
    'INSUFFICIENT_PHYSICAL_AVAILABILITY',
    'STALE_INVENTORY_REVISION',
    'SALE_PHYSICAL_SOURCE_INVALID',
  ] as const)('does not retry %s', async (code) => {
    const f = setup();
    f.transaction.mockRejectedValue(new PhysicalInventoryError(code));
    await expect(
      f.service.approve(companyId, actorId, saleId),
    ).rejects.toMatchObject({ code });
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it('uncertain commit uses fresh readback without new mutation', async () => {
    const f = setup();
    f.transaction.mockRejectedValueOnce(new Error('socket after commit'));
    expect(await f.service.approve(companyId, actorId, saleId)).toMatchObject({
      id: saleId,
    });
    expect(f.transaction).toHaveBeenCalledTimes(2);
    expect(f.physical.definitiveOut).not.toHaveBeenCalled();
  });
  it('Quote replay uses canonical identity without allocating a folio', async () => {
    const f = setup();
    const quoteId = randomUUID();
    f.tx.$queryRaw.mockResolvedValue([
      { status: 'CONFIRMED', convertedToSale: true, saleId },
    ]);
    f.tx.sale.findFirst.mockResolvedValue({
      ...sale(),
      quoteId,
      quote: { companyId, status: 'CONFIRMED', convertedToSale: true },
    });
    expect(
      await f.service.createFromQuote(companyId, actorId, quoteId),
    ).toMatchObject({ id: saleId });
    expect(f.folios.allocateNextAvailableFolio).not.toHaveBeenCalled();
    expect(f.physical.definitiveOut).not.toHaveBeenCalled();
  });
  it('Quote flag and canonical identity mismatch fails closed', async () => {
    const f = setup();
    f.tx.$queryRaw.mockResolvedValue([
      { status: 'CONFIRMED', convertedToSale: false, saleId },
    ]);
    await expect(
      f.service.createFromQuote(companyId, actorId, randomUUID()),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_STATE_INCONSISTENT' });
    expect(f.folios.allocateNextAvailableFolio).not.toHaveBeenCalled();
  });
  it('does not turn arbitrary UNIQUE failures into replay', async () => {
    const f = setup();
    f.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('redacted', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['unrelated'] },
      }),
    );
    await expect(
      f.service.approve(companyId, actorId, saleId),
    ).rejects.toMatchObject({
      code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR',
    });
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
});
