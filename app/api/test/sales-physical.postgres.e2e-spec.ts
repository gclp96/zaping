import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, ProductLotTracking } from '@prisma/client';
import { SalesPhysicalIntegrationService } from '../src/inventory/physical/sales-physical-integration.service';
import { SalesPhysicalSourceResolver } from '../src/inventory/physical/sales-physical-source-resolver';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { ManualPhysicalInventoryService } from '../src/inventory/physical/manual-physical-inventory.service';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { SalesFolioService } from '../src/sales/sales-folio.service';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SalesService } from '../src/sales/sales.service';
import { SalesController } from '../src/sales/sales.controller';

const suite =
  process.env.RUN_SALES_PHYSICAL_POSTGRES === '1' ? describe : describe.skip;
function gate() {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  return { wait, release };
}
suite('Sales01C isolated PostgreSQL acceptance', () => {
  let db: PrismaClient, other: PrismaClient;
  let companyId: string,
    foreignId: string,
    actorId: string,
    otherActor: string,
    customerId: string;
  const repo = new PhysicalInventoryRepository();
  const core = new PhysicalInventoryService(repo);
  const projection = new InventoryCompatibilityProjectionService();
  const history = new InventoryCompatibilityHistoryService();
  const manual = new ManualPhysicalInventoryService(core, projection, history);
  const folios = new SalesFolioService(new CompanySequenceAllocatorService());
  const receipts = new ReceiptPhysicalIntegrationService(
    repo,
    core,
    projection,
    history,
    new EquipmentProvisioningService(
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
    ),
  );
  const tx = <T>(fn: (c: Prisma.TransactionClient) => Promise<T>) =>
    db.$transaction(fn, { isolationLevel: 'ReadCommitted', timeout: 15000 });
  const integration = (
    client: PrismaClient | PrismaService = db,
    hist = new InventoryCompatibilityHistoryService(),
    phys = core,
    proj = projection,
  ) =>
    new SalesPhysicalIntegrationService(
      client as PrismaService,
      folios,
      new SalesPhysicalSourceResolver(repo),
      phys,
      proj,
      hist,
      // Historical 01C algorithm-only fixtures pin PHYSICAL explicitly. Full
      // DB-backed routing is covered by the new isolated 01D-C acceptance suite.
      new InventoryAuthorityTransactionService(
        client as PrismaService,
        {
          resolve: () => Promise.resolve('PHYSICAL'),
        } as unknown as InventoryAuthorityResolver,
        {
          identity: () => ({
            protocol: 'inventory-authority-v1',
            build: '01c-fixture',
            environment: 'isolated-test',
          }),
        },
      ),
    );
  beforeAll(async () => {
    const raw = process.env.INVENTORY_PHYSICAL_TEST_DATABASE_URL;
    if (!raw) throw new Error('Dedicated runner URL required');
    const url = new URL(raw);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '5434' ||
      url.pathname !== '/zaping_spike_test' ||
      !/^zaping_inv01c_[0-9a-f]{12}$/.test(url.username)
    )
      throw new Error('Unsafe test database');
    companyId = process.env.INVENTORY_PHYSICAL_TEST_COMPANY!;
    foreignId = process.env.INVENTORY_PHYSICAL_TEST_FOREIGN!;
    if (!companyId || !foreignId)
      throw new Error('Runner fixture ownership required');
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    other = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRaw<
      { database: string; role: string; superuser: boolean }[]
    >`SELECT current_database() AS database,current_user AS role,rolsuper AS superuser FROM pg_roles WHERE rolname=current_user`;
    expect(identity).toEqual({
      database: 'zaping_spike_test',
      role: url.username,
      superuser: false,
    });
    await db.company.createMany({
      data: [companyId, foreignId].map((id) => ({
        id,
        name: `INV01C ${companyId}`,
        rfc: `I${id.replaceAll('-', '').slice(0, 12)}`,
      })),
    });
    for (const index of [0, 1]) {
      const user = await db.user.create({
        data: {
          companyId,
          firstName: 'Test',
          lastName: 'INV01C',
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'not-a-login',
          role: 'ADMIN',
        },
      });
      if (index === 0) actorId = user.id;
      else otherActor = user.id;
    }
    customerId = (
      await db.customer.create({ data: { companyId, name: 'INV01C fixture' } })
    ).id;
  }, 20000);
  afterAll(async () => {
    await db?.$disconnect();
    await other?.$disconnect();
  });
  async function product(lotTracking: ProductLotTracking = 'NONE') {
    return (
      await db.product.create({
        data: {
          companyId,
          sku: randomUUID(),
          name: 'INV01C material',
          cost: 7,
          price: 15,
          lotTracking,
        },
      })
    ).id;
  }
  async function credit(
    productId: string,
    q: number,
    batchId: string | null = null,
  ) {
    return tx((c) =>
      manual.execute(c, {
        companyId,
        actorId,
        key: randomUUID(),
        operation: { kind: 'IN', productId, batchId, quantity: q },
      }),
    );
  }
  async function opening(q = 10, lot: ProductLotTracking = 'NONE') {
    const id = await product(lot);
    const r = await credit(id, q);
    return { id, positionId: r.effect.lines[0].positionId };
  }
  async function sale(ids: string[], quantity = 7) {
    return db.sale.create({
      data: {
        companyId,
        customerId,
        folio: randomUUID(),
        subtotal: 100,
        iva: 16,
        total: 116,
        items: {
          create: ids.map((productId) => ({
            productId,
            quantity,
            price: 15,
            subtotal: quantity * 15,
          })),
        },
      },
      include: { items: true },
    });
  }
  async function quote(ids: string[], quantity = 3) {
    return db.quote.create({
      data: {
        companyId,
        customerId,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 100,
        iva: 16,
        total: 116,
        items: {
          create: ids.map((productId) => ({
            productId,
            quantity,
            price: 15,
            subtotal: quantity * 15,
          })),
        },
      },
      include: { items: true },
    });
  }
  async function facts(saleId: string) {
    return {
      effects: await db.inventoryPhysicalEffect.findMany({
        where: { companyId, originType: 'SALE', originId: saleId },
        include: { lines: true },
      }),
      movements: await db.inventoryMovement.findMany({
        where: { companyId, referenceType: 'SALE', referenceId: saleId },
      }),
    };
  }
  async function assertOut(saleId: string, quantity: number, count = 1) {
    const f = await facts(saleId);
    expect(f.effects).toHaveLength(1);
    expect(f.effects[0].actorId).toBe(actorId);
    expect(f.movements).toHaveLength(count);
    expect(
      f.movements.every(
        (m) =>
          m.quantity === quantity &&
          m.createdBy === actorId &&
          m.batchId === null &&
          m.unitCost === 7,
      ),
    ).toBe(true);
  }
  async function waitForBlock(pid: number) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const [row] = await db.$queryRaw<
        { blocked: boolean }[]
      >`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`;
      if (row.blocked) return;
      await new Promise((r) => setTimeout(r, 15));
    }
    throw new Error('No material PostgreSQL lock wait observed');
  }
  // First transaction holds real row locks. Independent connection enters second;
  // pg_blocking_pids proves actual serialization before the first is released.
  async function race<T, U>(
    first: (
      held: ReturnType<typeof gate>,
      release: ReturnType<typeof gate>,
    ) => Promise<T>,
    second: (observed: PrismaService) => Promise<U>,
  ) {
    const held = gate(),
      release = gate(),
      started = gate();
    let pid = 0;
    const observed = {
      $transaction: <V>(
        fn: (c: Prisma.TransactionClient) => Promise<V>,
        opts: object,
      ) =>
        other.$transaction(async (c) => {
          pid = (
            await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
          )[0].pid;
          started.release();
          return fn(c);
        }, opts),
    } as PrismaService;
    const a = first(held, release);
    const aHandled = a.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason: reason as unknown }),
    );
    await held.wait;
    const b = second(observed);
    const bHandled = b.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason: reason as unknown }),
    );
    try {
      await started.wait;
      await waitForBlock(pid);
    } finally {
      release.release();
    }
    return Promise.all([aHandled, bHandled]);
  }
  function holdSale(saleId: string, mode: 'approve' | 'quote' = 'approve') {
    return async (
      held: ReturnType<typeof gate>,
      release: ReturnType<typeof gate>,
    ) => {
      const h = new InventoryCompatibilityHistoryService();
      const original = new InventoryCompatibilityHistoryService();
      const write = (
        ...args: Parameters<InventoryCompatibilityHistoryService['writeSale']>
      ) => original.writeSale(...args);
      jest.spyOn(h, 'writeSale').mockImplementation(async (...args) => {
        await write(...args);
        held.release();
        await release.wait;
      });
      return mode === 'approve'
        ? integration(db, h).approve(companyId, actorId, saleId)
        : integration(db, h).createFromQuote(companyId, actorId, saleId);
    };
  }
  it('01 Sale vs Sale final AVAILABLE serializes without oversell', async () => {
    const p = await opening();
    const a = await sale([p.id]),
      b = await sale([p.id]);
    const result = await race(holdSale(a.id), (c) =>
      integration(c).approve(companyId, actorId, b.id),
    );
    expect(result[0].status).toBe('fulfilled');
    expect(result[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' },
    });
    expect(
      await db.inventoryPosition.findUnique({ where: { id: p.positionId } }),
    ).toMatchObject({ quantity: 3 });
    expect(await db.sale.findUnique({ where: { id: b.id } })).toMatchObject({
      status: 'DRAFT',
    });
    await assertOut(a.id, 7);
    expect((await facts(b.id)).effects).toHaveLength(0);
  }, 20000);
  it('02 physical Manual OUT vs Sale shares Product roots', async () => {
    const p = await opening();
    const s = await sale([p.id]);
    const result = await race(
      (held, release) =>
        tx(async (c) => {
          await manual.execute(c, {
            companyId,
            actorId,
            key: randomUUID(),
            operation: {
              kind: 'OUT',
              sources: [
                { positionId: p.positionId, quantity: 7, expectedRevision: 1 },
              ],
            },
          });
          held.release();
          await release.wait;
        }),
      (c) => integration(c).approve(companyId, actorId, s.id),
    );
    expect(result[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' },
    });
    expect((await facts(s.id)).movements).toHaveLength(0);
  }, 20000);
  it('03 COUNT_CORRECTION vs Sale revalidates availability under roots', async () => {
    const p = await opening();
    const s = await sale([p.id]);
    const result = await race(
      (held, release) =>
        tx(async (c) => {
          await manual.execute(c, {
            companyId,
            actorId,
            key: randomUUID(),
            reason: 'count',
            operation: {
              kind: 'COUNT_CORRECTION',
              positionId: p.positionId,
              countedQuantity: 5,
              expectedRevision: 1,
            },
          });
          held.release();
          await release.wait;
        }),
      (c) => integration(c).approve(companyId, actorId, s.id),
    );
    expect(result[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' },
    });
    expect(await db.product.findUnique({ where: { id: p.id } })).toMatchObject({
      stock: 5,
    });
  }, 20000);
  it('04 Receipt creates a new Position before waiting Sale discovery', async () => {
    const id = await product();
    const s = await sale([id], 3);
    const supplier = await db.supplier.create({
      data: { companyId, name: randomUUID() },
    });
    const p = await db.purchase.create({
      data: {
        companyId,
        supplierId: supplier.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 70,
        iva: 0,
        total: 70,
        items: {
          create: { productId: id, quantity: 10, price: 7, subtotal: 70 },
        },
      },
      include: { items: true },
    });
    const result = await race(
      (held, release) =>
        tx(async (c) => {
          await receipts.execute(c, companyId, actorId, randomUUID(), {
            purchaseId: p.id,
            items: [{ purchaseItemId: p.items[0].id, quantityReceived: 10 }],
          });
          held.release();
          await release.wait;
        }),
      (c) => integration(c).approve(companyId, actorId, s.id),
    );
    expect(result.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await db.product.findUnique({ where: { id } })).toMatchObject({
      stock: 7,
    });
    await assertOut(s.id, 3);
  }, 20000);
  it('05 duplicate approve concurrent/sequential obeys actor replay and zero writes', async () => {
    const p = await opening();
    const s = await sale([p.id], 3);
    const result = await race(holdSale(s.id), (c) =>
      integration(c).approve(companyId, actorId, s.id),
    );
    expect(result.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const before = await facts(s.id);
    expect(await integration().approve(companyId, actorId, s.id)).toMatchObject(
      { id: s.id },
    );
    await expect(
      integration().approve(companyId, otherActor, s.id),
    ).rejects.toThrow('La venta ya fue aprobada');
    expect(await facts(s.id)).toEqual(before);
    await assertOut(s.id, 3);
    await db.user.update({ where: { id: actorId }, data: { isActive: false } });
    try {
      await expect(
        integration().approve(companyId, otherActor, s.id),
      ).rejects.toThrow('La venta ya fue aprobada');
      await expect(
        integration().approve(companyId, actorId, s.id),
      ).rejects.toThrow('No autorizado');
    } finally {
      await db.user.update({
        where: { id: actorId },
        data: { isActive: true },
      });
    }
  }, 20000);
  it('06 cancel vs approve has one winner and no reversal', async () => {
    const p = await opening();
    const s = await sale([p.id]);
    const result = await race(
      (held, release) =>
        tx(async (c) => {
          await c.sale.updateMany({
            where: { id: s.id, companyId, status: 'DRAFT' },
            data: { status: 'CANCELLED' },
          });
          held.release();
          await release.wait;
        }),
      (c) => integration(c).approve(companyId, actorId, s.id),
    );
    expect(result[1].status).toBe('rejected');
    expect((await facts(s.id)).effects).toHaveLength(0);
    const approved = await sale([p.id], 3);
    await integration().approve(companyId, actorId, approved.id);
    await expect(
      new SalesService(db as PrismaService, folios, integration()).cancel(
        companyId,
        approved.id,
      ),
    ).rejects.toThrow('No se puede cancelar una venta aprobada');
  }, 20000);
  it('07 Quote concurrent/sequential conversion resolves one Sale and one folio', async () => {
    const p = await opening();
    const q = await quote([p.id]);
    const results = await race(holdSale(q.id, 'quote'), (c) =>
      integration(c).createFromQuote(companyId, actorId, q.id),
    );
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const s = await db.sale.findUniqueOrThrow({ where: { quoteId: q.id } });
    const seq = await db.companySequence.findUnique({
      where: { companyId_key: { companyId, key: 'SALE_FOLIO' } },
    });
    expect(
      await integration().createFromQuote(companyId, actorId, q.id),
    ).toMatchObject({ id: s.id });
    await expect(
      integration().createFromQuote(companyId, otherActor, q.id),
    ).rejects.toThrow('La cotización ya fue convertida a venta');
    expect(
      await db.companySequence.findUnique({
        where: { companyId_key: { companyId, key: 'SALE_FOLIO' } },
      }),
    ).toEqual(seq);
    await assertOut(s.id, 3);
  }, 20000);
  it('08 DB origin UNIQUE arbitrates even when both observed absence', async () => {
    const p = await opening();
    const s = await sale([p.id], 3);
    const held = gate(),
      release = gate(),
      started = gate();
    let pid = 0;
    const command = {
      companyId,
      actorId,
      origin: { type: 'SALE', id: s.id, operation: 'CONFIRM' },
    };
    const request = {
      ...command,
      operation: {
        kind: 'DEFINITIVE_OUT' as const,
        debits: [{ sourceId: p.positionId, quantity: 3 }],
      },
    };
    const first = tx(async (c) => {
      const r = await core.apply(c, request);
      held.release();
      await release.wait;
      return r;
    });
    await held.wait;
    const second = other.$transaction(
      async (c) => {
        pid = (
          await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
        )[0].pid;
        expect(await repo.findEffect(c, request)).toBeNull();
        started.release();
        return repo.claimEffect(c, request, 'a'.repeat(64), 1);
      },
      { timeout: 15000 },
    );
    const rejected = expect(second).rejects.toMatchObject({
      code: 'PHYSICAL_EFFECT_CLAIM_CONFLICT',
    });
    try {
      await started.wait;
      await waitForBlock(pid);
    } finally {
      release.release();
    }
    await first;
    await rejected;
    expect(
      await tx((c) => core.classifyCommittedEffect(c, request)),
    ).toMatchObject({ replay: true });
    await expect(
      tx((c) =>
        core.classifyCommittedEffect(c, { ...request, reason: 'mismatch' }),
      ),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
  }, 20000);
  it('09 structural split6+4 and full business rollback on history failure', async () => {
    const id = await product('OPTIONAL');
    const a = await credit(id, 6);
    const batch = await db.inventoryBatch.create({
      data: {
        companyId,
        productId: id,
        lotNumber: randomUUID(),
        initialQuantity: 0,
        availableQuantity: 0,
      },
    });
    const b = await credit(id, 4, batch.id);
    const split = await tx((c) =>
      core.definitiveOut(
        c,
        {
          companyId,
          actorId,
          origin: {
            type: 'STRUCTURAL_TEST',
            id: randomUUID(),
            operation: 'OUT',
          },
        },
        [
          { sourceId: a.effect.lines[0].positionId, quantity: 6 },
          { sourceId: b.effect.lines[0].positionId, quantity: 4 },
        ],
      ),
    );
    expect(
      split.effect.lines.map((l) => l.delta).sort((a, b) => a - b),
    ).toEqual([-6, -4]);
    const p = await opening();
    const p2 = await opening();
    const s = await sale([p.id, p2.id], 3);
    const h = new InventoryCompatibilityHistoryService();
    const original = new InventoryCompatibilityHistoryService();
    const write = (
      ...args: Parameters<InventoryCompatibilityHistoryService['writeSale']>
    ) => original.writeSale(...args);
    jest.spyOn(h, 'writeSale').mockImplementation(async (...args) => {
      await write(...args);
      throw new Error('injected after history');
    });
    await expect(
      integration(db, h).approve(companyId, actorId, s.id),
    ).rejects.toMatchObject({ code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR' });
    expect(await db.sale.findUnique({ where: { id: s.id } })).toMatchObject({
      status: 'DRAFT',
    });
    expect((await facts(s.id)).effects).toHaveLength(0);
    expect((await facts(s.id)).movements).toHaveLength(0);
    expect(await db.product.findUnique({ where: { id: p.id } })).toMatchObject({
      stock: 10,
    });
    expect(
      await db.inventoryPosition.findUnique({ where: { id: p2.positionId } }),
    ).toMatchObject({ quantity: 10, revision: 1 });
    const q = await quote([p.id]);
    await expect(
      integration(db, h).createFromQuote(companyId, actorId, q.id),
    ).rejects.toBeDefined();
    expect(await db.quote.findUnique({ where: { id: q.id } })).toMatchObject({
      convertedToSale: false,
    });
    expect(await db.sale.findUnique({ where: { quoteId: q.id } })).toBeNull();
    // Faults before all debits complete and after projection must also undo
    // business state, immutable evidence, revisions and compatibility balances.
    for (const stage of ['first debit', 'projection']) {
      const x = await opening(),
        y = await opening();
      const pending = await sale([x.id, y.id], 3);
      const failingRepo = new PhysicalInventoryRepository();
      const realRepo = new PhysicalInventoryRepository();
      const failingProjection = new InventoryCompatibilityProjectionService();
      if (stage === 'first debit') {
        jest
          .spyOn(failingRepo, 'mutatePosition')
          .mockImplementation(async (...args) => {
            await realRepo.mutatePosition(...args);
            throw new Error('injected after first debit');
          });
      } else {
        jest
          .spyOn(failingProjection, 'apply')
          .mockImplementation(async (...args) => {
            await projection.apply(...args);
            throw new Error('injected after projection');
          });
      }
      await expect(
        integration(
          db,
          history,
          new PhysicalInventoryService(failingRepo),
          failingProjection,
        ).approve(companyId, actorId, pending.id),
      ).rejects.toMatchObject({ code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR' });
      expect(
        await db.sale.findUnique({ where: { id: pending.id } }),
      ).toMatchObject({ status: 'DRAFT' });
      expect((await facts(pending.id)).effects).toHaveLength(0);
      expect((await facts(pending.id)).movements).toHaveLength(0);
      for (const p of [x, y]) {
        expect(
          await db.product.findUnique({ where: { id: p.id } }),
        ).toMatchObject({ stock: 10 });
        expect(
          await db.inventoryPosition.findUnique({
            where: { id: p.positionId },
          }),
        ).toMatchObject({ quantity: 10, revision: 1 });
      }
    }
  });
  it('10 CUSTODY cannot satisfy Sale despite sufficient owned stock', async () => {
    const p = await opening();
    await tx((c) =>
      core.transfer(
        c,
        {
          companyId,
          actorId,
          origin: { type: 'FIXTURE', id: randomUUID(), operation: 'CUSTODY' },
        },
        [
          {
            sourceId: p.positionId,
            quantity: 10,
            target: {
              productId: p.id,
              inventoryBatchId: null,
              state: 'CUSTODY',
              contextType: 'TEST',
              contextId: randomUUID(),
            },
          },
        ],
      ),
    );
    const s = await sale([p.id], 3);
    await expect(
      integration().approve(companyId, actorId, s.id),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
    expect(await db.product.findUnique({ where: { id: p.id } })).toMatchObject({
      stock: 10,
    });
  });
  it('11 Candidate C OPTIONAL and REQUIRED policy preserves batch eligibility', async () => {
    const id = await product('OPTIONAL');
    const b = await db.inventoryBatch.create({
      data: {
        companyId,
        productId: id,
        lotNumber: randomUUID(),
        initialQuantity: 0,
        availableQuantity: 0,
      },
    });
    await credit(id, 10, b.id);
    const s = await sale([id], 3);
    await expect(
      integration().approve(companyId, actorId, s.id),
    ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_REQUIRED' });
    await credit(id, 5);
    await integration().approve(companyId, actorId, s.id);
    expect(
      await db.inventoryBatch.findUnique({ where: { id: b.id } }),
    ).toMatchObject({ availableQuantity: 10 });
    expect(
      await db.inventoryPosition.findFirst({
        where: { productId: id, inventoryBatchId: null },
      }),
    ).toMatchObject({ quantity: 2 });
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { expirationDate: new Date(0) },
    });
    await expect(credit(id, 1, b.id)).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { expirationDate: null, isActive: false },
    });
    await expect(credit(id, 1, b.id)).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    const required = await product('REQUIRED'),
      r = await sale([required], 1);
    await expect(
      integration().approve(companyId, actorId, r.id),
    ).rejects.toThrow('requiere selección de lote');
    await assertOut(s.id, 3);
  });
  it('12 controllers with explicit PHYSICAL fixture authority; create/cancel no physical effects', async () => {
    const p = await opening();
    const controller = new SalesController(
      new SalesService(db as PrismaService, folios, integration()),
    );
    const req = {
      user: {
        id: actorId,
        companyId,
        email: 'fixture@example.invalid',
        role: 'ADMIN',
      },
    } as Parameters<SalesController['approve']>[0];
    const draft = await controller.create(req, {
      customerId,
      items: [{ productId: p.id, quantity: 2 }],
    });
    expect((await facts(draft.id)).effects).toHaveLength(0);
    await controller.cancel(req, draft.id);
    expect((await facts(draft.id)).effects).toHaveLength(0);
    const s = await sale([p.id], 3);
    await controller.approve(req, s.id);
    const q = await quote([p.id], 2);
    const converted = await controller.createFromQuote(req, q.id);
    expect((await facts(s.id)).effects).toHaveLength(1);
    expect((await facts(converted.id)).effects).toHaveLength(1);
    expect(
      await db.inventoryPosition.findUnique({ where: { id: p.positionId } }),
    ).toMatchObject({ quantity: 5, revision: 3 });
    expect(await db.product.findUnique({ where: { id: p.id } })).toMatchObject({
      stock: 5,
    });
  });
});
