import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { PhysicalInventoryReadService } from '../src/inventory/physical/physical-inventory-read.service';
import {
  PhysicalRequest,
  PositionKey,
  physicalRequestHash,
  PhysicalInventoryError,
} from '../src/inventory/physical/physical-inventory.contract';

const enabled = process.env.RUN_INVENTORY_PHYSICAL_POSTGRES === '1';
const describeDb = enabled ? describe : describe.skip;
function gate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

describeDb('Inventory physical authority isolated PostgreSQL', () => {
  let db: PrismaClient;
  let companyId: string;
  let foreignId: string;
  let actorId: string;
  let foreignProduct: string;
  const repo = new PhysicalInventoryRepository();
  const service = new PhysicalInventoryService(repo);
  const reads = new PhysicalInventoryReadService();
  const products: string[] = [];
  const legacyStock = 37;

  const tx = <T>(fn: (client: Prisma.TransactionClient) => Promise<T>) =>
    db.$transaction(fn, {
      isolationLevel: 'ReadCommitted',
      timeout: 15000,
      maxWait: 5000,
    });
  const apply = (request: PhysicalRequest, core = service) =>
    tx((client) => core.apply(client, request));
  const available = (
    productId: string,
    inventoryBatchId: string | null = null,
  ): PositionKey => ({
    productId,
    inventoryBatchId,
    state: 'AVAILABLE',
    contextType: null,
    contextId: null,
  });
  function credit(
    productId: string,
    quantity = 5,
    batchId: string | null = null,
  ): PhysicalRequest {
    return {
      companyId,
      actorId,
      origin: { type: 'INV01A_TEST', id: randomUUID(), operation: 'CREDIT' },
      operation: {
        kind: 'CREDIT',
        credits: [{ target: available(productId, batchId), quantity }],
      },
    };
  }
  async function product() {
    const id = randomUUID();
    await db.product.create({
      data: {
        id,
        companyId,
        name: 'INV01A fixture',
        sku: id,
        stock: legacyStock,
        lotTracking: 'OPTIONAL',
      },
    });
    products.push(id);
    return id;
  }
  const batch = (productId: string) =>
    db.inventoryBatch.create({
      data: {
        companyId,
        productId,
        lotNumber: randomUUID(),
        initialQuantity: 11,
        availableQuantity: 11,
      },
    });
  async function seed(quantity = 5) {
    const productId = await product();
    const request = credit(productId, quantity);
    const result = await apply(request);
    return {
      productId,
      request,
      result,
      positionId: result.effect.lines[0].positionId,
    };
  }
  function out(sourceId: string, quantity: number): PhysicalRequest {
    return {
      companyId,
      actorId,
      origin: { type: 'INV01A_TEST', id: randomUUID(), operation: 'OUT' },
      operation: { kind: 'DEFINITIVE_OUT', debits: [{ sourceId, quantity }] },
    };
  }
  async function waitForBlock(pid: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [row] = await db.$queryRaw<
        { blocked: boolean }[]
      >`SELECT cardinality(pg_blocking_pids(${pid}::integer))>0 AS blocked`;
      if (row.blocked) return;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    throw new Error('Expected material PostgreSQL lock wait was not observed');
  }

  beforeAll(async () => {
    const raw = process.env.INVENTORY_PHYSICAL_TEST_DATABASE_URL;
    if (!raw) throw new Error('Dedicated test URL required');
    const url = new URL(raw);
    if (
      url.hostname !== '127.0.0.1' ||
      (process.env.INVENTORY_PHYSICAL_TEST_RUN
        ? !/^[0-9]+$/.test(url.port)
        : url.port !== '5434') ||
      url.pathname !== '/zaping_spike_test' ||
      !/^zaping_inv01a_[0-9a-f]{12}$/.test(url.username)
    )
      throw new Error('Unsafe PostgreSQL test target');
    companyId = process.env.INVENTORY_PHYSICAL_TEST_COMPANY!;
    foreignId = process.env.INVENTORY_PHYSICAL_TEST_FOREIGN!;
    if (!companyId || !foreignId)
      throw new Error('Runner-owned fixture identities required');
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRaw<
      { database: string; role: string; superuser: boolean }[]
    >`
      SELECT current_database() AS database,current_user AS role,rolsuper AS superuser FROM pg_roles WHERE rolname=current_user`;
    expect(identity).toEqual({
      database: 'zaping_spike_test',
      role: url.username,
      superuser: false,
    });
    console.log(
      `Verified test DB: 127.0.0.1:${url.port}/${identity.database}; user=${identity.role}; superuser=false`,
    );
    await db.company.createMany({
      data: [companyId, foreignId].map((id) => ({
        id,
        name: `INV01A ${companyId}`,
        rfc: `I${id.replaceAll('-', '').slice(0, 12)}`,
      })),
    });
    actorId = randomUUID();
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Fixture',
        lastName: 'INV01A',
        email: `${actorId}@example.invalid`,
        passwordHash: 'not-a-login',
        role: 'ADMIN',
      },
    });
    foreignProduct = randomUUID();
    await db.product.create({
      data: {
        id: foreignProduct,
        companyId: foreignId,
        sku: foreignProduct,
        name: 'Foreign fixture',
      },
    });
  }, 20000);
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('returns explicit zeroes without falling back to legacy stock', async () => {
    const id = await product();
    expect(await reads.product(db, companyId, id)).toEqual({
      authority: 'PHYSICAL_POSITIONS',
      owned: 0,
      available: 0,
      inCustody: 0,
      hasPositions: false,
    });
  });
  it('credits AVAILABLE, persists evidence and reuses retained zero positions', async () => {
    const s = await seed(4);
    expect(s.result.effect.lines[0]).toMatchObject({
      quantityBefore: 0,
      quantityAfter: 4,
      revisionBefore: 0,
      revisionAfter: 1,
    });
    await apply(out(s.positionId, 4));
    const again = await apply(credit(s.productId, 2));
    expect(again.effect.lines[0]).toMatchObject({
      positionId: s.positionId,
      quantityBefore: 0,
      quantityAfter: 2,
      revisionBefore: 2,
      revisionAfter: 3,
    });
    expect(
      await db.inventoryPosition.count({
        where: { companyId, productId: s.productId },
      }),
    ).toBe(1);
  });
  it('keeps batched/unbatched identities separate and normalizes one line per position', async () => {
    const id = await product();
    const b = await batch(id);
    const request = credit(id);
    request.operation = {
      kind: 'CREDIT',
      credits: [
        { target: available(id), quantity: 2 },
        { target: available(id), quantity: 3 },
        { target: available(id, b.id), quantity: 7 },
      ],
    };
    const result = await apply(request);
    expect(result.effect.lines).toHaveLength(2);
    expect(result.effect.lines.map((v) => v.delta).sort()).toEqual([5, 7]);
    expect(await reads.product(db, companyId, id)).toMatchObject({
      owned: 12,
      available: 12,
    });
    expect(await reads.batch(db, companyId, id, b.id)).toMatchObject({
      owned: 7,
      available: 7,
    });
  });
  it('transfers atomically to exact custody context and definitive OUT reduces owned', async () => {
    const s = await seed(10);
    const request: PhysicalRequest = {
      ...out(s.positionId, 4),
      operation: {
        kind: 'TRANSFER',
        transfers: [
          {
            sourceId: s.positionId,
            target: {
              ...available(s.productId),
              state: 'CUSTODY',
              contextType: 'TEST_HANDOFF',
              contextId: 'delivery-1',
            },
            quantity: 4,
          },
        ],
      },
    };
    const result = await apply(request);
    expect(
      result.effect.lines.map((l) => l.delta).sort((a, b) => a - b),
    ).toEqual([-4, 4]);
    expect(
      result.effect.lines.every(
        (l) => l.revisionAfter === l.revisionBefore + 1,
      ),
    ).toBe(true);
    expect(result.projectionDeltas).toEqual([
      { productId: s.productId, ownedDelta: 0 },
    ]);
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 10,
      available: 6,
      inCustody: 4,
    });
    const custody = result.effect.lines.find((l) => l.delta > 0)!;
    await apply(out(custody.positionId, 2));
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 8,
      available: 6,
      inCustody: 2,
    });
  });
  it('rejects insufficient debit and stale revision without durable claims', async () => {
    const s = await seed(3);
    const request = out(s.positionId, 4);
    await expect(apply(request)).rejects.toMatchObject({
      code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY',
    });
    request.operation = {
      kind: 'DEFINITIVE_OUT',
      debits: [
        { sourceId: s.positionId, quantity: 1, expectedSourceRevision: 0 },
      ],
    };
    await expect(apply(request)).rejects.toMatchObject({
      code: 'STALE_INVENTORY_REVISION',
    });
    expect(await repo.findEffect(db, request)).toBeNull();
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 3,
    });
  });
  it('replays original evidence after balances change and rejects mismatched intent', async () => {
    const s = await seed(5);
    await apply(out(s.positionId, 2));
    const replay = await apply(s.request);
    expect(replay).toMatchObject({
      replay: true,
      effect: { id: s.result.effect.id },
      projectionDeltas: [],
    });
    expect(replay.effect.createdAt).toEqual(s.result.effect.createdAt);
    const mismatch = { ...s.request, reason: 'different intent' };
    await expect(apply(mismatch)).rejects.toMatchObject({
      code: 'PHYSICAL_EFFECT_MISMATCH',
    });
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 3,
    });
  });
  it('enforces tenant and batch coherence through the service', async () => {
    await expect(apply(credit(foreignProduct))).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    });
    const id = await product();
    const other = await product();
    const b = await batch(other);
    await expect(apply(credit(id, 2, b.id))).rejects.toMatchObject({
      code: 'INVENTORY_BATCH_PRODUCT_MISMATCH',
    });
    await expect(
      reads.product(db, companyId, foreignProduct),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });
  it.each([
    'quantity',
    'revision',
    'available-context',
    'custody-context',
    'product-tenant',
    'batch-product',
  ])('PostgreSQL rejects %s constraint violations', async (fault) => {
    const id = await product();
    const other = await product();
    const b = await batch(other);
    const data: Prisma.InventoryPositionUncheckedCreateInput = {
      companyId,
      productId: id,
      state: 'AVAILABLE',
      quantity: 0,
      revision: 0,
    };
    if (fault === 'quantity') data.quantity = -1;
    if (fault === 'revision') data.revision = -1;
    if (fault === 'available-context') data.contextType = 'TEST';
    if (fault === 'custody-context') data.state = 'CUSTODY';
    if (fault === 'product-tenant') data.productId = foreignProduct;
    if (fault === 'batch-product') data.inventoryBatchId = b.id;
    const creation = tx((client) => client.inventoryPosition.create({ data }));
    if (fault === 'product-tenant' || fault === 'batch-product') {
      await expect(creation).rejects.toMatchObject({ code: 'P2003' });
    } else {
      await expect(creation).rejects.toThrow(
        fault === 'quantity' || fault === 'revision'
          ? 'InventoryPosition_quantity_revision_check'
          : 'InventoryPosition_context_check',
      );
    }
  });
  it('enforces all four partial unique indexes and historical Restrict FKs', async () => {
    const id = await product();
    const b = await batch(id);
    for (const inventoryBatchId of [null, b.id]) {
      for (const state of ['AVAILABLE', 'CUSTODY'] as const) {
        const data = {
          companyId,
          productId: id,
          inventoryBatchId,
          state,
          contextType: state === 'CUSTODY' ? 'TEST' : null,
          contextId: state === 'CUSTODY' ? 'context-1' : null,
        };
        await db.inventoryPosition.create({ data });
        await expect(
          db.inventoryPosition.create({ data }),
        ).rejects.toMatchObject({ code: 'P2002' });
      }
    }
    const s = await seed();
    await expect(
      db.inventoryPosition.delete({ where: { id: s.positionId } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('enforces immutable line facts and deferred effect completeness', async () => {
    const s = await seed();
    const req = credit(s.productId);
    await expect(
      tx((client) =>
        repo.claimEffect(client, req, physicalRequestHash(req), 1),
      ),
    ).rejects.toThrow('Physical effect is incomplete');
    await expect(
      tx(async (client) => {
        const header = await repo.claimEffect(
          client,
          req,
          physicalRequestHash(req),
          1,
        );
        await repo.appendLine(client, {
          companyId,
          effectId: header.id,
          positionId: s.positionId,
          sequence: 1,
          delta: 1,
          quantityBefore: 5,
          quantityAfter: 9,
          revisionBefore: 1,
          revisionAfter: 2,
        });
      }),
    ).rejects.toThrow('InventoryPhysicalEffectLine_facts_check');
    const latePosition = await db.inventoryPosition.create({
      data: {
        companyId,
        productId: s.productId,
        state: 'CUSTODY',
        contextType: 'TEST',
        contextId: 'late-line',
      },
    });
    await expect(
      tx((client) =>
        repo.appendLine(client, {
          companyId,
          effectId: s.result.effect.id,
          positionId: latePosition.id,
          sequence: 2,
          delta: 1,
          quantityBefore: 5,
          quantityAfter: 6,
          revisionBefore: 1,
          revisionAfter: 2,
        }),
      ),
    ).rejects.toThrow('Physical effect is incomplete');
  });
  it('rolls back caller business state and all physical evidence after source-side work', async () => {
    const s = await seed(5);
    const request: PhysicalRequest = {
      ...out(s.positionId, 2),
      operation: {
        kind: 'TRANSFER',
        transfers: [
          {
            sourceId: s.positionId,
            quantity: 2,
            target: {
              ...available(s.productId),
              state: 'CUSTODY',
              contextType: 'TEST',
              contextId: 'rollback',
            },
          },
        ],
      },
    };
    const failing = new PhysicalInventoryRepository();
    jest
      .spyOn(failing, 'mutatePosition')
      .mockImplementation(async (client, position, delta) => {
        const result = await repo.mutatePosition(client, position, delta);
        if (delta < 0) throw new Error('injected after debit');
        return result;
      });
    await expect(
      tx(async (client) => {
        await client.product.update({
          where: { id: s.productId },
          data: { name: 'must roll back' },
        });
        await new PhysicalInventoryService(failing).apply(client, request);
      }),
    ).rejects.toMatchObject({ code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR' });
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 5,
      available: 5,
      inCustody: 0,
    });
    expect(
      await db.inventoryPosition.count({
        where: { companyId, productId: s.productId },
      }),
    ).toBe(1);
    expect(await repo.findEffect(db, request)).toBeNull();
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: s.productId } })).name,
    ).toBe('INV01A fixture');
  });

  async function rootRace(first: PhysicalRequest, second: PhysicalRequest) {
    const entered = gate();
    const release = gate();
    const secondStarted = gate();
    const controlled = new PhysicalInventoryRepository();
    jest
      .spyOn(controlled, 'lockProducts')
      .mockImplementation(async (...args) => {
        const rows = await repo.lockProducts(...args);
        entered.release();
        await release.wait;
        return rows;
      });
    let firstPid = 0;
    let secondPid = 0;
    const a = tx(async (client) => {
      const [row] = await client.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      firstPid = row.pid;
      return new PhysicalInventoryService(controlled).apply(client, first);
    });
    await entered.wait;
    const b = tx(async (client) => {
      const [row] = await client.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      secondPid = row.pid;
      secondStarted.release();
      return service.apply(client, second);
    });
    const all = Promise.allSettled([a, b]);
    try {
      await secondStarted.wait;
      expect(firstPid).not.toBe(secondPid);
      await waitForBlock(secondPid);
    } finally {
      release.release();
    }
    return all;
  }
  it('material concurrency: two debits compete for the last quantity', async () => {
    const s = await seed(5);
    const results = await rootRace(out(s.positionId, 4), out(s.positionId, 4));
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    if (results[1].status === 'rejected')
      expect(results[1].reason).toMatchObject({
        code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY',
      });
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 1,
    });
  });
  it('material concurrency: concurrent AVAILABLE creation reuses one position', async () => {
    const id = await product();
    const results = await rootRace(credit(id, 2), credit(id, 3));
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(
      await db.inventoryPosition.findMany({
        where: { companyId, productId: id },
        select: { quantity: true, revision: true },
      }),
    ).toEqual([{ quantity: 5, revision: 2 }]);
  });
  it('material concurrency: same origin/hash commits one physical effect and replays', async () => {
    const id = await product();
    const request = credit(id, 5);
    const results = await rootRace(request, request);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const values = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof apply>>> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
    expect(values.map((r) => r.replay)).toEqual([false, true]);
    expect(values[0].effect.id).toBe(values[1].effect.id);
    expect(await reads.product(db, companyId, id)).toMatchObject({ owned: 5 });
    expect(values[1].projectionDeltas).toEqual([]);
  });
  it('material concurrency: disjoint Products race for one origin; loser aborts then fresh mismatch', async () => {
    const p1 = await product();
    const p2 = await product();
    const a = credit(p1, 5);
    const b = { ...credit(p2, 5), origin: a.origin };
    const arrived = gate();
    let count = 0;
    const controlled = new PhysicalInventoryRepository();
    jest
      .spyOn(controlled, 'claimEffect')
      .mockImplementation(async (...args) => {
        if (++count === 2) arrived.release();
        await arrived.wait;
        return repo.claimEffect(...args);
      });
    const core = new PhysicalInventoryService(controlled);
    const results = await Promise.allSettled([apply(a, core), apply(b, core)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const loser = results.findIndex((r) => r.status === 'rejected');
    const failed = results[loser];
    if (failed.status === 'rejected')
      expect(failed.reason).toMatchObject({
        code: 'PHYSICAL_EFFECT_CLAIM_CONFLICT',
      });
    await expect(
      tx((client) => service.classifyCommittedEffect(client, [a, b][loser])),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    const totals = await Promise.all([
      reads.product(db, companyId, p1),
      reads.product(db, companyId, p2),
    ]);
    expect(totals.reduce((sum, t) => sum + t.owned, 0)).toBe(5);
  });
  it('a stale same-hash claim aborts and fresh classification returns replay', async () => {
    const s = await seed(5);
    await expect(
      tx((client) =>
        repo.claimEffect(client, s.request, physicalRequestHash(s.request), 1),
      ),
    ).rejects.toBeInstanceOf(PhysicalInventoryError);
    const replay = await tx((client) =>
      service.classifyCommittedEffect(client, s.request),
    );
    expect(replay).toMatchObject({
      replay: true,
      effect: { id: s.result.effect.id },
      projectionDeltas: [],
    });
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 5,
    });
  });
  it('supports a multi-product effect and deterministic lock ordering across opposite input orders', async () => {
    const p1 = await product();
    const p2 = await product();
    const a = credit(p1);
    a.operation = {
      kind: 'CREDIT',
      credits: [
        { target: available(p2), quantity: 2 },
        { target: available(p1), quantity: 3 },
      ],
    };
    const b = credit(p2);
    b.operation = {
      kind: 'CREDIT',
      credits: [
        { target: available(p1), quantity: 4 },
        { target: available(p2), quantity: 5 },
      ],
    };
    const results = await rootRace(a, b);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect((await repo.findEffect(db, a))?.lines).toHaveLength(2);
    expect(await reads.product(db, companyId, p1)).toMatchObject({ owned: 7 });
    expect(await reads.product(db, companyId, p2)).toMatchObject({ owned: 7 });
  });
  it('rejects conditional zero-row mutations and preserves the complete transaction', async () => {
    const s = await seed();
    const request = out(s.positionId, 1);
    const controlled = new PhysicalInventoryRepository();
    jest.spyOn(controlled, 'mutatePosition').mockResolvedValue({ count: 0 });
    await expect(
      apply(request, new PhysicalInventoryService(controlled)),
    ).rejects.toMatchObject({ code: 'PHYSICAL_POSITION_CONFLICT' });
    expect(await repo.findEffect(db, request)).toBeNull();
    expect(await reads.product(db, companyId, s.productId)).toMatchObject({
      owned: 5,
    });
  });
  it('PostgreSQL enforces Effect actor tenant and Line Effect/Position tenant coherence', async () => {
    const s = await seed();
    const foreignPosition = await db.inventoryPosition.create({
      data: {
        companyId: foreignId,
        productId: foreignProduct,
        state: 'AVAILABLE',
      },
    });
    await expect(
      db.inventoryPhysicalEffect.create({
        data: {
          companyId: foreignId,
          actorId,
          originType: 'TEST',
          originId: randomUUID(),
          originOperation: 'CREDIT',
          kind: 'CREDIT',
          requestHash: '0'.repeat(64),
          lineCount: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryPhysicalEffectLine.create({
        data: {
          companyId: foreignId,
          effectId: s.result.effect.id,
          positionId: foreignPosition.id,
          sequence: 2,
          delta: 1,
          quantityBefore: 0,
          quantityAfter: 1,
          revisionBefore: 0,
          revisionAfter: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryPhysicalEffectLine.create({
        data: {
          companyId,
          effectId: s.result.effect.id,
          positionId: foreignPosition.id,
          sequence: 2,
          delta: 1,
          quantityBefore: 0,
          quantityAfter: 1,
          revisionBefore: 0,
          revisionAfter: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('PostgreSQL rejects unbalanced transfer and duplicate Effect/Position lines', async () => {
    const s = await seed();
    const destination = await db.inventoryPosition.create({
      data: {
        companyId,
        productId: s.productId,
        state: 'CUSTODY',
        contextType: 'TEST',
        contextId: 'invalid-transfer',
      },
    });
    const request: PhysicalRequest = {
      ...out(s.positionId, 1),
      operation: { kind: 'TRANSFER', transfers: [] },
    };
    await expect(
      tx(async (client) => {
        const h = await repo.claimEffect(client, request, '0'.repeat(64), 2);
        await repo.appendLine(client, {
          companyId,
          effectId: h.id,
          positionId: s.positionId,
          sequence: 1,
          delta: -1,
          quantityBefore: 5,
          quantityAfter: 4,
          revisionBefore: 1,
          revisionAfter: 2,
        });
        await repo.appendLine(client, {
          companyId,
          effectId: h.id,
          positionId: destination.id,
          sequence: 2,
          delta: 2,
          quantityBefore: 0,
          quantityAfter: 2,
          revisionBefore: 0,
          revisionAfter: 1,
        });
      }),
    ).rejects.toThrow('Invalid transfer shape');
    await expect(
      db.inventoryPhysicalEffectLine.create({
        data: {
          companyId,
          effectId: s.result.effect.id,
          positionId: s.positionId,
          sequence: 2,
          delta: 1,
          quantityBefore: 5,
          quantityAfter: 6,
          revisionBefore: 1,
          revisionAfter: 2,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('reads expiry eligibility without changing owned or legacy projections', async () => {
    const id = await product();
    const b = await batch(id);
    await apply(credit(id, 4, b.id));
    await db.inventoryBatch.update({
      where: { id: b.id },
      data: { expirationDate: new Date(0) },
    });
    expect(await reads.product(db, companyId, id)).toMatchObject({
      owned: 4,
      available: 0,
    });
    const rows = await db.product.findMany({
      where: { companyId, id: { in: products } },
      select: { stock: true },
    });
    expect(rows.every((r) => r.stock === legacyStock)).toBe(true);
    expect(await db.inventoryMovement.count({ where: { companyId } })).toBe(0);
    const batches = await db.inventoryBatch.findMany({ where: { companyId } });
    expect(
      batches.every(
        (row) => row.availableQuantity === 11 && row.initialQuantity === 11,
      ),
    ).toBe(true);
  });
});
