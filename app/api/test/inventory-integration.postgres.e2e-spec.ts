import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import {
  ManualPhysicalInventoryService,
  ManualPhysicalInput,
} from '../src/inventory/physical/manual-physical-inventory.service';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';

const enabled = process.env.RUN_INVENTORY_INTEGRATION_POSTGRES === '1';
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
  const projection = new InventoryCompatibilityProjectionService();
  const history = new InventoryCompatibilityHistoryService();
  const manual = new ManualPhysicalInventoryService(
    service,
    projection,
    history,
  );
  const receipts = new ReceiptPhysicalIntegrationService(
    repo,
    service,
    projection,
    history,
    new EquipmentProvisioningService(
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
    ),
  );
  const products: string[] = [];
  const legacyStock = 0;

  const tx = <T>(fn: (client: Prisma.TransactionClient) => Promise<T>) =>
    db.$transaction(fn, {
      isolationLevel: 'ReadCommitted',
      timeout: 15000,
      maxWait: 5000,
    });
  async function product() {
    const id = randomUUID();
    await db.product.create({
      data: {
        id,
        companyId,
        name: 'INV01B fixture',
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
        initialQuantity: 0,
        availableQuantity: 0,
      },
    });
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
      !/^zaping_inv01b_[0-9a-f]{12}$/.test(url.username)
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
        name: `INV01B ${companyId}`,
        rfc: `I${id.replaceAll('-', '').slice(0, 12)}`,
      })),
    });
    actorId = randomUUID();
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Fixture',
        lastName: 'INV01B',
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

  function manualIn(
    productId: string,
    quantity = 5,
    batchId: string | null = null,
  ): ManualPhysicalInput {
    return {
      companyId,
      actorId,
      key: randomUUID(),
      operation: { kind: 'IN', productId, batchId, quantity },
    };
  }
  const run = (input: ManualPhysicalInput) =>
    tx((c) => manual.execute(c, input));
  async function opening(q = 5, batched = false) {
    const id = await product();
    const b = batched ? await batch(id) : null;
    const input = manualIn(id, q, b?.id ?? null);
    const result = await run(input);
    return {
      id,
      b,
      input,
      result,
      positionId: result.effect.lines[0].positionId,
    };
  }
  function count(
    positionId: string,
    countedQuantity: number,
    expectedRevision: number,
  ): ManualPhysicalInput {
    return {
      companyId,
      actorId,
      key: randomUUID(),
      reason: 'physical count',
      operation: {
        kind: 'COUNT_CORRECTION',
        positionId,
        countedQuantity,
        expectedRevision,
      },
    };
  }
  it.each([8, 2, 5, 0])(
    'counts %i with evidence and atomic projections',
    async (q) => {
      const s = await opening(5, true);
      const before = await db.inventoryPosition.findUniqueOrThrow({
        where: { id: s.positionId },
      });
      const request = count(s.positionId, q, 1);
      const result = await run(request);
      expect(result.effect.kind).toBe('COUNT_CORRECTION');
      expect(result.effect.lines).toHaveLength(1);
      expect(result.effect.lines[0]).toMatchObject({
        delta: q - 5,
        quantityBefore: 5,
        quantityAfter: q,
        revisionBefore: 1,
        revisionAfter: q === 5 ? 1 : 2,
      });
      const after = await db.inventoryPosition.findUniqueOrThrow({
        where: { id: s.positionId },
      });
      if (q === 5) expect(after.updatedAt).toEqual(before.updatedAt);
      expect(
        (await db.product.findUniqueOrThrow({ where: { id: s.id } })).stock,
      ).toBe(q);
      expect(
        await db.inventoryBatch.findUniqueOrThrow({ where: { id: s.b!.id } }),
      ).toMatchObject({ availableQuantity: q, initialQuantity: 0 });
      expect(
        await db.inventoryMovement.findFirst({
          where: { referenceId: result.effect.id },
        }),
      ).toMatchObject({ movementType: 'ADJUSTMENT', quantity: q, balance: q });
      expect((await run(request)).replay).toBe(true);
      expect(
        await db.inventoryMovement.count({
          where: { referenceId: result.effect.id },
        }),
      ).toBe(1);
    },
  );
  it('rejects stale revision, missing reason and actor', async () => {
    const s = await opening();
    await expect(run(count(s.positionId, 2, 0))).rejects.toMatchObject({
      code: 'STALE_INVENTORY_REVISION',
    });
    await expect(
      run({ ...count(s.positionId, 2, 1), reason: '' }),
    ).rejects.toBeDefined();
    await expect(
      run({ ...count(s.positionId, 2, 1), actorId: '' }),
    ).rejects.toBeDefined();
  });
  it('manual OUT uses multiple exact sources and deterministic balances', async () => {
    const id = await product();
    const b = await batch(id);
    const a = await run(manualIn(id, 3));
    const c = await run(manualIn(id, 4, b.id));
    const request: ManualPhysicalInput = {
      companyId,
      actorId,
      key: randomUUID(),
      operation: {
        kind: 'OUT',
        sources: [
          {
            positionId: a.effect.lines[0].positionId,
            quantity: 2,
            expectedRevision: 1,
          },
          {
            positionId: c.effect.lines[0].positionId,
            quantity: 3,
            expectedRevision: 1,
          },
        ],
      },
    };
    const result = await run(request);
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stock).toBe(
      2,
    );
    expect(
      (await db.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } }))
        .availableQuantity,
    ).toBe(1);
    const movements = await db.inventoryMovement.findMany({
      where: { referenceId: result.effect.id },
    });
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => m.balance)).toContain(2);
    expect((await run(request)).replay).toBe(true);
    await expect(
      run({
        ...request,
        operation: {
          kind: 'OUT',
          sources: [
            {
              positionId: a.effect.lines[0].positionId,
              quantity: 1,
              expectedRevision: 1,
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
  });
  it.each([
    'missing',
    'company',
    'product',
    'duplicate',
    'underflow',
    'overflow',
  ] as const)(
    'PERF-02 Batch bulk %s rejects and rolls back all affected rows',
    async (kind) => {
      const id = await product(),
        a = await batch(id),
        b = await batch(id);
      const first = { id: a.id, productId: id, delta: 1 };
      const second = {
        id: kind === 'missing' ? randomUUID() : b.id,
        productId: kind === 'product' ? randomUUID() : id,
        delta: kind === 'underflow' ? -1 : kind === 'overflow' ? 2147483647 : 1,
      };
      if (kind === 'overflow')
        await db.inventoryBatch.update({
          where: { id: b.id },
          data: { availableQuantity: 1 },
        });
      const before = await db.inventoryBatch.findMany({
        where: { id: { in: [a.id, b.id] } },
        orderBy: { id: 'asc' },
      });
      await expect(
        tx(async (c) => {
          await repo.lockProducts(c, companyId, [id]);
          await repo.lockBatches(c, companyId, [a.id, b.id].sort());
          await projection.applyBatchDeltas(
            c,
            kind === 'company' ? foreignId : companyId,
            [first, kind === 'duplicate' ? first : second],
          );
        }),
      ).rejects.toThrow();
      expect(
        await db.inventoryBatch.findMany({
          where: { id: { in: [a.id, b.id] } },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(before);
    },
  );
  it('PERF-02 CUSTODY to AVAILABLE restores Batch availability without owned stock credit', async () => {
    const f = await opening(5, true);
    const forward = await tx(async (c) => {
      const r = await service.transfer(
        c,
        {
          companyId,
          actorId,
          origin: { type: 'PERF02', id: randomUUID(), operation: 'FORWARD' },
        },
        [
          {
            sourceId: f.positionId,
            quantity: 2,
            target: {
              productId: f.id,
              inventoryBatchId: f.b!.id,
              state: 'CUSTODY',
              contextType: 'PERF02',
              contextId: randomUUID(),
            },
          },
        ],
      );
      await projection.apply(c, companyId, r);
      return r;
    });
    const source = forward.effect.lines.find((l) => l.delta > 0)!;
    const origin = { type: 'PERF02', id: randomUUID(), operation: 'RETURN' };
    for (let i = 0; i < 2; i++)
      await tx(async (c) => {
        const r = await service.transfer(c, { companyId, actorId, origin }, [
          {
            sourceId: source.positionId,
            expectedSourceRevision: 1,
            quantity: 2,
            target: {
              productId: f.id,
              inventoryBatchId: f.b!.id,
              state: 'AVAILABLE',
              contextType: null,
              contextId: null,
            },
          },
        ]);
        expect(r.replay).toBe(i === 1);
        await projection.apply(c, companyId, r);
      });
    expect(await db.product.findUnique({ where: { id: f.id } })).toMatchObject({
      stock: 5,
    });
    expect(
      await db.inventoryBatch.findUnique({ where: { id: f.b!.id } }),
    ).toMatchObject({ availableQuantity: 5 });
  });
  it('PERF-02 competing Batch writers block on canonical prelocks then recheck quantity bounds', async () => {
    const f = await opening(5, true);
    const held = gate(),
      release = gate(),
      started = gate();
    let firstPid = 0,
      secondPid = 0;
    const write = async (c: Prisma.TransactionClient) => {
      await repo.lockProducts(c, companyId, [f.id]);
      await repo.lockBatches(c, companyId, [f.b!.id]);
      await projection.applyBatchDeltas(c, companyId, [
        { id: f.b!.id, productId: f.id, delta: -3 },
      ]);
    };
    const a = tx(async (c) => {
      firstPid = (
        await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      await write(c);
      held.release();
      await release.wait;
    });
    await held.wait;
    const b = tx(async (c) => {
      secondPid = (
        await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      started.release();
      await write(c);
    });
    const settled = Promise.allSettled([a, b]);
    try {
      await started.wait;
      expect(firstPid).not.toBe(secondPid);
      await waitForBlock(secondPid);
    } finally {
      release.release();
    }
    const outcomes = await settled;
    expect(outcomes.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(
      await db.inventoryBatch.findUnique({ where: { id: f.b!.id } }),
    ).toMatchObject({ availableQuantity: 2 });
    expect(await db.product.findUnique({ where: { id: f.id } })).toMatchObject({
      stock: 5,
    });
  });
  it('transfer preserves owned and custody OUT does not reduce batch AVAILABLE', async () => {
    const s = await opening(5, true);
    const moved = await tx(async (c) => {
      const result = await service.transfer(
        c,
        {
          companyId,
          actorId,
          origin: { type: 'TEST', id: randomUUID(), operation: 'TRANSFER' },
        },
        [
          {
            sourceId: s.positionId,
            quantity: 2,
            target: {
              productId: s.id,
              inventoryBatchId: s.b!.id,
              state: 'CUSTODY',
              contextType: 'TEST',
              contextId: 'custody',
            },
          },
        ],
      );
      await projection.apply(c, companyId, result);
      return result;
    });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: s.id } })).stock,
    ).toBe(5);
    expect(
      (await db.inventoryBatch.findUniqueOrThrow({ where: { id: s.b!.id } }))
        .availableQuantity,
    ).toBe(3);
    const custody = moved.effect.lines.find((l) => l.delta > 0)!.positionId;
    await expect(
      run({
        companyId,
        actorId,
        key: randomUUID(),
        operation: {
          kind: 'OUT',
          sources: [{ positionId: custody, quantity: 1, expectedRevision: 1 }],
        },
      }),
    ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
    await expect(run(count(custody, 1, 1))).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    await tx(async (c) => {
      const r = await service.definitiveOut(
        c,
        {
          companyId,
          actorId,
          origin: { type: 'TEST', id: randomUUID(), operation: 'OUT' },
        },
        [{ sourceId: custody, quantity: 1 }],
      );
      await projection.apply(c, companyId, r);
    });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: s.id } })).stock,
    ).toBe(4);
    expect(
      (await db.inventoryBatch.findUniqueOrThrow({ where: { id: s.b!.id } }))
        .availableQuantity,
    ).toBe(3);
  });
  it('rolls back Position, projections, evidence and key after compatibility work', async () => {
    const id = await product();
    const b = await batch(id);
    const request = manualIn(id, 4, b.id);
    await expect(
      tx(async (c) => {
        await manual.execute(c, request);
        throw new Error('injected');
      }),
    ).rejects.toThrow('injected');
    expect(await db.inventoryPosition.count({ where: { productId: id } })).toBe(
      0,
    );
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stock).toBe(
      0,
    );
    expect(
      (await db.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } }))
        .availableQuantity,
    ).toBe(0);
    expect(
      await db.idempotencyRecord.count({
        where: { companyId, key: request.key },
      }),
    ).toBe(0);
    expect(await db.inventoryMovement.count({ where: { productId: id } })).toBe(
      0,
    );
  });
  it.each(['NONE', 'OPTIONAL', 'REQUIRED'] as const)(
    'manual lot rules %s',
    async (lotTracking) => {
      const id = await product();
      await db.product.update({ where: { id }, data: { lotTracking } });
      const b = await batch(id);
      if (lotTracking === 'REQUIRED')
        await expect(run(manualIn(id))).rejects.toBeDefined();
      else await run(manualIn(id));
      if (lotTracking === 'NONE')
        await expect(run(manualIn(id, 1, b.id))).rejects.toBeDefined();
      else await run(manualIn(id, 1, b.id));
    },
  );
  it('rejects projection overflow atomically', async () => {
    const id = await product();
    await db.product.update({ where: { id }, data: { stock: 2147483647 } });
    await expect(run(manualIn(id, 1))).rejects.toMatchObject({
      code: 'PHYSICAL_POSITION_CONFLICT',
    });
    expect(await db.inventoryPosition.count({ where: { productId: id } })).toBe(
      0,
    );
  });
  it('material same-key race aborts loser, fresh replay does not double-project', async () => {
    const id = await product();
    const request = manualIn(id, 2);
    const held = gate();
    const release = gate();
    const started = gate();
    let pid = 0;
    const first = tx(async (c) => {
      const r = await manual.execute(c, request);
      held.release();
      await release.wait;
      return r;
    });
    await held.wait;
    const second = tx(async (c) => {
      pid = (
        await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      started.release();
      return manual.execute(c, request);
    }).then(
      () => null,
      (e) => e as unknown,
    );
    try {
      await started.wait;
      await waitForBlock(pid);
    } finally {
      release.release();
    }
    await first;
    expect(await second).toBeDefined();
    expect((await run(request)).replay).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stock).toBe(
      2,
    );
  });
  it('material concurrent counts with same revision have one winner', async () => {
    const s = await opening();
    const held = gate();
    const release = gate();
    const started = gate();
    let pid = 0;
    const first = tx(async (c) => {
      const r = await manual.execute(c, count(s.positionId, 3, 1));
      held.release();
      await release.wait;
      return r;
    });
    await held.wait;
    const second = tx(async (c) => {
      pid = (
        await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      started.release();
      return manual.execute(c, count(s.positionId, 2, 1));
    }).then(
      () => null,
      (e) => e as unknown,
    );
    try {
      await started.wait;
      await waitForBlock(pid);
    } finally {
      release.release();
    }
    await first;
    expect(await second).toMatchObject({ code: 'STALE_INVENTORY_REVISION' });
  });
  it.each(['CREDIT', 'DEFINITIVE_OUT', 'TRANSFER'] as const)(
    'DB rejects zero %s',
    async (kind) => {
      const s = await opening();
      await expect(
        tx(async (c) => {
          const e = await c.inventoryPhysicalEffect.create({
            data: {
              companyId,
              actorId,
              originType: 'BAD',
              originId: randomUUID(),
              originOperation: 'ZERO',
              kind,
              requestHash: 'a'.repeat(64),
              lineCount: 1,
            },
          });
          await c.inventoryPhysicalEffectLine.create({
            data: {
              companyId,
              effectId: e.id,
              positionId: s.positionId,
              sequence: 1,
              delta: 0,
              quantityBefore: 5,
              quantityAfter: 5,
              revisionBefore: 1,
              revisionAfter: 1,
            },
          });
        }),
      ).rejects.toBeDefined();
    },
  );
  async function purchaseFixture(ids: string[], price = 2) {
    const supplier = await db.supplier.create({
      data: { companyId, name: randomUUID() },
    });
    return db.purchase.create({
      data: {
        companyId,
        supplierId: supplier.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 100,
        iva: 0,
        total: 100,
        items: {
          create: ids.map((productId) => ({
            productId,
            quantity: 20,
            price,
            subtotal: 40,
          })),
        },
      },
      include: { items: true },
    });
  }
  it.each([false, true])(
    'Receipt integration batch=%s replays all projections once',
    async (batched) => {
      const a = await product();
      const b = await product();
      const p = await purchaseFixture([a, b]);
      const key = randomUUID();
      const dto = {
        purchaseId: p.id,
        items: p.items.map((i) => ({
          purchaseItemId: i.id,
          quantityReceived: 3,
          ...(batched ? { lotNumber: 'LOT' } : {}),
        })),
      };
      const r = await tx((c) =>
        receipts.execute(c, companyId, actorId, key, dto),
      );
      expect(
        await db.inventoryPhysicalEffect.count({
          where: { companyId, originId: r.id },
        }),
      ).toBe(1);
      expect(
        (await tx((c) => receipts.execute(c, companyId, actorId, key, dto))).id,
      ).toBe(r.id);
      for (const id of [a, b])
        expect(
          (await db.product.findUniqueOrThrow({ where: { id } })).stock,
        ).toBe(3);
      expect(
        await db.inventoryMovement.count({ where: { referenceId: r.id } }),
      ).toBe(2);
      if (batched)
        for (const i of r.items)
          expect(
            await db.inventoryBatch.findUnique({ where: { id: i.batchId! } }),
          ).toMatchObject({ initialQuantity: 3, availableQuantity: 3 });
      await expect(
        tx((c) =>
          receipts.execute(c, companyId, actorId, key, {
            ...dto,
            notes: 'different',
          }),
        ),
      ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    },
  );
  it.each([true, false])(
    'mixed tracking quantity=%s creates disjoint identities',
    async (hasQuantity) => {
      const asset = await product();
      const serialized = await product();
      await db.product.update({
        where: { id: asset },
        data: { inventoryTracking: 'ASSET' },
      });
      await db.product.update({
        where: { id: serialized },
        data: { inventoryTracking: 'SERIALIZED' },
      });
      const ids = hasQuantity
        ? [asset, serialized, await product()]
        : [asset, serialized];
      const p = await purchaseFixture(ids);
      const key = randomUUID();
      const dto = {
        purchaseId: p.id,
        items: p.items.map((i) => ({
          purchaseItemId: i.id,
          quantityReceived: 2,
        })),
      };
      const r = await tx((c) =>
        receipts.execute(c, companyId, actorId, key, dto),
      );
      expect(
        await db.inventoryPosition.count({
          where: { productId: { in: [asset, serialized] } },
        }),
      ).toBe(0);
      expect(
        await db.equipmentAsset.count({ where: { productId: asset } }),
      ).toBe(2);
      expect(
        await db.equipmentAsset.count({ where: { productId: serialized } }),
      ).toBe(0);
      expect(
        await db.inventoryPhysicalEffect.count({ where: { originId: r.id } }),
      ).toBe(hasQuantity ? 1 : 0);
      await tx((c) => receipts.execute(c, companyId, actorId, key, dto));
      expect(
        await db.equipmentAsset.count({ where: { productId: asset } }),
      ).toBe(2);
    },
  );
  it('material concurrent Receipts serialize same Product/new batch without drift', async () => {
    const id = await product();
    const a = await purchaseFixture([id]);
    const b = await purchaseFixture([id]);
    const dto = (p: typeof a) => ({
      purchaseId: p.id,
      items: [
        {
          purchaseItemId: p.items[0].id,
          quantityReceived: 3,
          lotNumber: 'SHARED',
        },
      ],
    });
    const held = gate();
    const release = gate();
    const started = gate();
    let pid = 0;
    const first = tx(async (c) => {
      const r = await receipts.execute(
        c,
        companyId,
        actorId,
        randomUUID(),
        dto(a),
      );
      held.release();
      await release.wait;
      return r;
    });
    await held.wait;
    const second = tx(async (c) => {
      pid = (
        await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      started.release();
      return receipts.execute(c, companyId, actorId, randomUUID(), dto(b));
    });
    try {
      await started.wait;
      await waitForBlock(pid);
    } finally {
      release.release();
    }
    await Promise.all([first, second]);
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stock).toBe(
      6,
    );
    expect(
      await db.inventoryBatch.findMany({ where: { productId: id } }),
    ).toEqual([
      expect.objectContaining({
        initialQuantity: 6,
        availableQuantity: 6,
        unitCost: 2,
      }),
    ]);
  });
  it.each(['two-lines', 'quantity', 'revision', 'custody'] as const)(
    'DB rejects invalid count %s',
    async (invalid) => {
      const s = await opening();
      const other = await opening();
      let position = s.positionId;
      if (invalid === 'custody')
        position = await tx(async (c) => {
          const r = await service.transfer(
            c,
            {
              companyId,
              actorId,
              origin: { type: 'TEST', id: randomUUID(), operation: 'TRANSFER' },
            },
            [
              {
                sourceId: s.positionId,
                quantity: 1,
                target: {
                  productId: s.id,
                  inventoryBatchId: null,
                  state: 'CUSTODY',
                  contextType: 'TEST',
                  contextId: 'test',
                },
              },
            ],
          );
          await projection.apply(c, companyId, r);
          return r.effect.lines.find((l) => l.delta > 0)!.positionId;
        });
      await expect(
        tx(async (c) => {
          const e = await c.inventoryPhysicalEffect.create({
            data: {
              companyId,
              actorId,
              originType: 'INVALID',
              originId: randomUUID(),
              originOperation: 'COUNT',
              kind: 'COUNT_CORRECTION',
              reason: 'test',
              requestHash: 'a'.repeat(64),
              lineCount: invalid === 'two-lines' ? 2 : 1,
            },
          });
          await c.inventoryPhysicalEffectLine.create({
            data: {
              companyId,
              effectId: e.id,
              positionId: position,
              sequence: 1,
              delta: 0,
              quantityBefore: 5,
              quantityAfter: invalid === 'quantity' ? 6 : 5,
              revisionBefore: 1,
              revisionAfter: invalid === 'revision' ? 2 : 1,
            },
          });
          if (invalid === 'two-lines')
            await c.inventoryPhysicalEffectLine.create({
              data: {
                companyId,
                effectId: e.id,
                positionId: other.positionId,
                sequence: 2,
                delta: 0,
                quantityBefore: 5,
                quantityAfter: 5,
                revisionBefore: 1,
                revisionAfter: 1,
              },
            });
        }),
      ).rejects.toBeDefined();
    },
  );
  it('core count replay uses original intent after later changes and never double-projects', async () => {
    const s = await opening();
    const command = {
      companyId,
      actorId,
      reason: 'count',
      origin: { type: 'COUNT_TEST', id: randomUUID(), operation: 'COUNT' },
    };
    const execute = () =>
      tx(async (c) => {
        const result = await service.countCorrection(c, command, {
          sourceId: s.positionId,
          countedQuantity: 3,
          expectedRevision: 1,
        });
        await projection.apply(c, companyId, result);
        return result;
      });
    await execute();
    await run(manualIn(s.id, 2));
    expect((await execute()).replay).toBe(true);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: s.id } })).stock,
    ).toBe(5);
    await expect(
      tx((c) =>
        service.countCorrection(c, command, {
          sourceId: s.positionId,
          countedQuantity: 4,
          expectedRevision: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
  });
  it('Receipt REQUIRED rules, repeated product items and historical weighted cost', async () => {
    const id = await product();
    await db.product.update({
      where: { id },
      data: { lotTracking: 'REQUIRED' },
    });
    const p = await purchaseFixture([id, id]);
    const dto = {
      purchaseId: p.id,
      items: p.items.map((i) => ({
        purchaseItemId: i.id,
        quantityReceived: 2,
        lotNumber: 'REQUIRED',
      })),
    };
    await expect(
      tx((c) =>
        receipts.execute(c, companyId, actorId, randomUUID(), {
          ...dto,
          items: dto.items.map((i) => ({ ...i, lotNumber: undefined })),
        }),
      ),
    ).rejects.toBeDefined();
    const result = await tx((c) =>
      receipts.execute(c, companyId, actorId, randomUUID(), dto),
    );
    const effect = await db.inventoryPhysicalEffect.findFirstOrThrow({
      where: { originId: result.id },
      include: { lines: true },
    });
    expect(effect.lines).toHaveLength(1);
    expect(
      await db.inventoryMovement.count({ where: { referenceId: result.id } }),
    ).toBe(2);
    const p2 = await purchaseFixture([id], 4);
    await tx((c) =>
      receipts.execute(c, companyId, actorId, randomUUID(), {
        purchaseId: p2.id,
        items: [
          {
            purchaseItemId: p2.items[0].id,
            quantityReceived: 4,
            lotNumber: 'REQUIRED',
          },
        ],
      }),
    );
    expect(
      await db.inventoryBatch.findFirst({ where: { productId: id } }),
    ).toMatchObject({ initialQuantity: 8, availableQuantity: 8, unitCost: 3 });
  });
  it('mixed Receipt rollback after completion leaves no provisioning or partial business state', async () => {
    const id = await product();
    const asset = await product();
    await db.product.update({
      where: { id: asset },
      data: { inventoryTracking: 'ASSET' },
    });
    const p = await purchaseFixture([id, asset]);
    const key = randomUUID();
    await expect(
      tx(async (c) => {
        await receipts.execute(c, companyId, actorId, key, {
          purchaseId: p.id,
          items: p.items.map((i) => ({
            purchaseItemId: i.id,
            quantityReceived: 2,
            lotNumber: 'ROLLBACK',
          })),
        });
        throw new Error('receipt failure');
      }),
    ).rejects.toThrow('receipt failure');
    expect(
      await db.purchaseReceipt.count({ where: { purchaseId: p.id } }),
    ).toBe(0);
    expect(await db.equipmentAsset.count({ where: { productId: asset } })).toBe(
      0,
    );
    expect(await db.inventoryPosition.count({ where: { productId: id } })).toBe(
      0,
    );
    expect(
      await db.inventoryBatch.count({
        where: { productId: { in: [id, asset] } },
      }),
    ).toBe(0);
    expect(
      await db.idempotencyRecord.count({ where: { companyId, key } }),
    ).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stock).toBe(
      0,
    );
  });
  it('material concurrent same Receipt key replays after loser abort', async () => {
    const id = await product();
    const p = await purchaseFixture([id]);
    const key = randomUUID();
    const dto = {
      purchaseId: p.id,
      items: [{ purchaseItemId: p.items[0].id, quantityReceived: 2 }],
    };
    const held = gate();
    const release = gate();
    const started = gate();
    let pid = 0;
    const first = tx(async (c) => {
      const r = await receipts.execute(c, companyId, actorId, key, dto);
      held.release();
      await release.wait;
      return r;
    });
    await held.wait;
    const second = tx(async (c) => {
      pid = (
        await c.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      started.release();
      return receipts.execute(c, companyId, actorId, key, dto);
    }).then(
      () => null,
      (e) => e as unknown,
    );
    try {
      await started.wait;
      await waitForBlock(pid);
    } finally {
      release.release();
    }
    const result = await first;
    expect(await second).toBeDefined();
    expect(
      (await tx((c) => receipts.execute(c, companyId, actorId, key, dto))).id,
    ).toBe(result.id);
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stock).toBe(
      2,
    );
  });
});
