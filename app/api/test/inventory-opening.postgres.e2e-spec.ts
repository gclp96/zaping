/* Async test adapters intentionally implement the production Promise contract. */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { InventoryCutoverRepository } from '../src/inventory/physical/inventory-cutover.repository';
import { InventoryCutoverService } from '../src/inventory/physical/inventory-cutover.service';
import { InventoryOpeningService } from '../src/inventory/physical/inventory-opening.service';
import { InventoryReconciliationService } from '../src/inventory/physical/inventory-reconciliation.service';
import { InventoryCutoverVerifyService } from '../src/inventory/physical/inventory-cutover-verify.service';
import {
  Evidence,
  OpeningCustodyRegistry,
  OpeningEvidenceProvider,
  OpeningManifest,
  Pool,
  canonical,
  openingHash,
  manifestHash,
} from '../src/inventory/physical/inventory-opening-manifest';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';

const suite =
  process.env.RUN_INVENTORY_OPENING_POSTGRES === '1' ? describe : describe.skip;
suite('01D-B isolated opening PostgreSQL acceptance', () => {
  let db: PrismaClient, other: PrismaClient;
  const run = process.env.INVENTORY_OPENING_TEST_RUN;
  const control = new InventoryCutoverService(new InventoryCutoverRepository());
  beforeAll(async () => {
    const url = new URL(process.env.INVENTORY_OPENING_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_opening_test' ||
      url.username !== 'opening_test' ||
      !run
    )
      throw new Error('Unverified isolated target');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    await other.$connect();
    expect(
      (await db.$queryRaw<{ current_user: string }[]>`SELECT current_user`)[0]
        .current_user,
    ).toBe('opening_test');
  });
  afterAll(async () => {
    await db?.$disconnect();
    await other?.$disconnect();
  });
  async function fixture(
    options: {
      zero?: boolean;
      batch?: boolean;
      expired?: boolean;
      inactive?: boolean;
      custody?: boolean;
      missingResolver?: boolean;
      wrongTenant?: boolean;
      optional?: boolean;
      mixed?: boolean;
      sellable?: boolean | null;
    } = {},
  ) {
    const companyId = randomUUID(),
      actorId = randomUUID(),
      productId = randomUUID(),
      cutoverId = randomUUID(),
      batchId = options.batch ? randomUUID() : null;
    const quantity = options.zero ? 0 : 10;
    await db.company.create({
      data: { id: companyId, name: `OPENING TEST ${run}`, rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Test',
        lastName: 'Only',
        email: `${actorId}@example.invalid`,
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    await db.product.create({
      data: {
        id: productId,
        companyId,
        sku: productId,
        name: 'Opening test',
        stock: quantity,
        inventoryTracking: 'QUANTITY',
        lotTracking: options.optional
          ? 'OPTIONAL'
          : batchId
            ? 'REQUIRED'
            : 'NONE',
        isActive: !options.inactive,
      },
    });
    if (batchId)
      await db.inventoryBatch.create({
        data: {
          id: batchId,
          companyId,
          productId,
          lotNumber: batchId,
          initialQuantity: 20,
          availableQuantity: 19,
          isActive: !options.inactive,
          expirationDate: options.expired
            ? new Date('2020-01-01T00:00:00.000Z')
            : null,
        },
      });
    const evidence: Evidence = {
      reference: `test-evidence:${companyId}`,
      contentHash: openingHash({ companyId, productId, quantity, batchId }),
      evidenceType: 'TEST_ONLY',
    };
    const pools: Pool[] = quantity
      ? [
          {
            batchId,
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
            quantity: options.custody || options.mixed ? 6 : quantity,
            evidenceRefs: [evidence.reference],
          },
        ]
      : [];
    if (options.mixed)
      pools.push({
        batchId: null,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        quantity: 4,
        evidenceRefs: [evidence.reference],
      });
    if (options.custody)
      pools.push({
        batchId,
        state: 'CUSTODY',
        contextType: 'TEST_ONLY',
        contextId: companyId,
        quantity: 4,
        evidenceRefs: [evidence.reference],
      });
    const provider: OpeningEvidenceProvider = {
      freeze: async (_tx, c, e) =>
        c.companyId === companyId && e.contentHash === evidence.contentHash,
      product: async () => ({
        pools: structuredClone(pools),
        evidence: [evidence],
        historicallySellableBatched: options.sellable ?? null,
      }),
      verify: async (_tx, c, p) =>
        c.companyId === companyId &&
        canonical(
          [...p.pools].sort((a, b) => a.state.localeCompare(b.state)),
        ) ===
          canonical([...pools].sort((a, b) => a.state.localeCompare(b.state))),
    };
    const registry = new OpeningCustodyRegistry(
      options.missingResolver
        ? new Map()
        : new Map([
            [
              'TEST_ONLY',
              async (_tx, c, _p, pool) =>
                !options.wrongTenant &&
                c.companyId === companyId &&
                pool.contextId === companyId,
            ],
          ]),
    );
    const rec = new InventoryReconciliationService(provider, registry),
      opening = new InventoryOpeningService(rec);
    await db.$transaction((tx) =>
      control.create(tx, { id: cutoverId, companyId, actorId }),
    );
    await db.$transaction((tx) =>
      control.transition(
        tx,
        {
          companyId,
          cutoverId,
          expectedStatus: 'PRECHECK',
          expectedRevision: 0,
          manifestDigest: null,
        },
        actorId,
        { kind: 'FROZEN' },
      ),
    );
    const input = {
      companyId,
      cutoverId,
      frozenAsOf: new Date().toISOString(),
      baselineBuild: 'test-build',
      freezeEvidence: evidence,
    };
    const candidate = await rec.finalDryRun(db, input);
    const prepare = async () => {
      const m = candidate.manifest!;
      expect(m).not.toBeNull();
      await opening.reviewImport(db, m, actorId, {
        companyId,
        cutoverId,
        expectedStatus: 'WRITERS_FROZEN',
        expectedRevision: 1,
        manifestDigest: null,
      });
      await db.$transaction((tx) =>
        control.transition(
          tx,
          {
            companyId,
            cutoverId,
            expectedStatus: 'DRY_RUN_REVIEWED',
            expectedRevision: 2,
            manifestDigest: m.manifestDigest,
          },
          actorId,
          { kind: 'LOCK_MANIFEST' },
        ),
      );
      return m;
    };
    return {
      companyId,
      actorId,
      productId,
      cutoverId,
      batchId,
      quantity,
      rec,
      opening,
      candidate,
      input,
      prepare,
    };
  }
  async function snapshot(companyId: string) {
    return JSON.stringify(
      await Promise.all([
        db.product.findMany({ where: { companyId }, orderBy: { id: 'asc' } }),
        db.inventoryBatch.findMany({
          where: { companyId },
          orderBy: { id: 'asc' },
        }),
        db.inventoryPosition.findMany({
          where: { companyId },
          orderBy: { id: 'asc' },
        }),
        db.inventoryPhysicalEffect.findMany({
          where: { companyId },
          include: { lines: { orderBy: { sequence: 'asc' } } },
          orderBy: { id: 'asc' },
        }),
        db.inventoryCutover.findMany({ where: { companyId } }),
        db.inventoryCutoverProduct.findMany({
          where: { companyId },
          orderBy: { productId: 'asc' },
        }),
        db.inventoryMovement.findMany({ where: { companyId } }),
      ]),
    );
  }
  it('Receipt and linked IN Movement remain supporting evidence without double count', async () => {
    const f = await fixture();
    const supplier = await db.supplier.create({
      data: { companyId: f.companyId, name: 'Test supplier' },
    });
    const purchase = await db.purchase.create({
      data: {
        companyId: f.companyId,
        supplierId: supplier.id,
        folio: randomUUID(),
        subtotal: 10,
        iva: 0,
        total: 10,
        items: {
          create: {
            productId: f.productId,
            quantity: 10,
            price: 1,
            subtotal: 10,
          },
        },
      },
      include: { items: true },
    });
    const receipt = await db.purchaseReceipt.create({
      data: {
        companyId: f.companyId,
        purchaseId: purchase.id,
        folio: randomUUID(),
        items: {
          create: {
            companyId: f.companyId,
            purchaseItemId: purchase.items[0].id,
            productId: f.productId,
            quantityReceived: 10,
            unitCost: 1,
          },
        },
      },
    });
    await db.inventoryMovement.create({
      data: {
        companyId: f.companyId,
        productId: f.productId,
        movementType: 'IN',
        quantity: 10,
        balance: 10,
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: receipt.id,
      },
    });
    const result = await f.rec.finalDryRun(db, f.input);
    expect(result.manifest?.products[0].expectedOwned).toBe(10);
    expect(result.manifest?.snapshotFingerprint).not.toBe(
      f.candidate.manifest?.snapshotFingerprint,
    );
  });
  it('ordinary CREDIT/TRANSFER/OUT/COUNT remain operational and CREDIT eligibility stays strict', async () => {
    const f = await fixture();
    const service = new PhysicalInventoryService(
      new PhysicalInventoryRepository(),
    );
    const target = {
      productId: f.productId,
      inventoryBatchId: null,
      state: 'AVAILABLE' as const,
      contextType: null,
      contextId: null,
    };
    const command = () => ({
      companyId: f.companyId,
      actorId: f.actorId,
      origin: { type: 'TEST', id: randomUUID(), operation: 'TEST' },
    });
    await db.$transaction((tx) =>
      service.apply(tx, {
        ...command(),
        operation: { kind: 'CREDIT', credits: [{ target, quantity: 10 }] },
      }),
    );
    let pos = await db.inventoryPosition.findFirstOrThrow({
      where: { companyId: f.companyId, state: 'AVAILABLE' },
    });
    await db.$transaction((tx) =>
      service.apply(tx, {
        ...command(),
        operation: {
          kind: 'TRANSFER',
          transfers: [
            {
              sourceId: pos.id,
              quantity: 2,
              target: {
                ...target,
                state: 'CUSTODY',
                contextType: 'TEST_ONLY',
                contextId: f.companyId,
              },
            },
          ],
        },
      }),
    );
    await db.$transaction((tx) =>
      service.apply(tx, {
        ...command(),
        operation: {
          kind: 'DEFINITIVE_OUT',
          debits: [{ sourceId: pos.id, quantity: 1 }],
        },
      }),
    );
    pos = await db.inventoryPosition.findUniqueOrThrow({
      where: { id: pos.id },
    });
    await db.$transaction((tx) =>
      service.apply(tx, {
        ...command(),
        reason: 'Certified test count',
        operation: {
          kind: 'COUNT_CORRECTION',
          sourceId: pos.id,
          countedQuantity: 6,
          expectedRevision: pos.revision,
        },
      }),
    );
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(4);
    await db.product.update({
      where: { id: f.productId },
      data: { isActive: false },
    });
    await expect(
      db.$transaction((tx) =>
        service.apply(tx, {
          ...command(),
          operation: { kind: 'CREDIT', credits: [{ target, quantity: 1 }] },
        }),
      ),
    ).rejects.toThrow();
  });
  it('preview/final dry-run deterministic and database read-only', async () => {
    const f = await fixture();
    const before = await snapshot(f.companyId);
    expect((await f.rec.finalDryRun(db, f.input)).manifest).toEqual(
      f.candidate.manifest,
    );
    await f.rec.preview(db, f.input);
    expect(await snapshot(f.companyId)).toBe(before);
    await expect(
      f.rec.readOnly(db, (tx) =>
        tx.product.updateMany({
          where: { companyId: f.companyId },
          data: { stock: 11 },
        }),
      ),
    ).rejects.toThrow();
  });
  it('positive opening, sequential replay zero writes, stock preserved, no movement', async () => {
    const f = await fixture();
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    const before = await snapshot(f.companyId);
    expect(await f.opening.applyProduct(db, m, f.productId, f.actorId)).toBe(
      'REPLAY',
    );
    expect(await snapshot(f.companyId)).toBe(before);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(10);
    expect(
      await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
  });
  it('concurrent independent connections have one durable winner', async () => {
    const f = await fixture();
    const m = await f.prepare();
    const results = await Promise.all([
      f.opening.applyProduct(db, m, f.productId, f.actorId),
      f.opening.applyProduct(other, m, f.productId, f.actorId),
    ]);
    expect(results.sort()).toEqual(['APPLIED', 'REPLAY']);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it.each(['effect', 'position'] as const)(
    'rollback after %s rolls back complete Product',
    async (stage) => {
      const f = await fixture();
      const m = await f.prepare();
      const before = await snapshot(f.companyId);
      const repository = new PhysicalInventoryRepository();
      if (stage === 'effect') {
        const original = new PhysicalInventoryRepository();
        jest
          .spyOn(repository, 'claimOpeningEffect')
          .mockImplementation(async (...args) => {
            await original.claimOpeningEffect(...args);
            throw new Error('fault');
          });
      } else {
        const original = new PhysicalInventoryRepository();
        jest
          .spyOn(repository, 'mutatePosition')
          .mockImplementation(async (...args) => {
            await original.mutatePosition(...args);
            throw new Error('fault');
          });
      }
      await expect(
        new InventoryOpeningService(f.rec, repository).applyProduct(
          db,
          m,
          f.productId,
          f.actorId,
        ),
      ).rejects.toThrow('fault');
      expect(await snapshot(f.companyId)).toBe(before);
    },
  );
  it('successful commit with lost response recovers by fresh readback', async () => {
    const f = await fixture();
    const m = await f.prepare();
    await expect(
      (async () => {
        await f.opening.applyProduct(db, m, f.productId, f.actorId);
        throw new Error('lost response');
      })(),
    ).rejects.toThrow();
    const before = await snapshot(f.companyId);
    expect(await f.opening.applyProduct(other, m, f.productId, f.actorId)).toBe(
      'REPLAY',
    );
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('Product A committed, B fails, resume retains A without writes', async () => {
    const f = await fixture();
    const second = randomUUID();
    await db.product.create({
      data: {
        id: second,
        companyId: f.companyId,
        sku: second,
        name: 'Second',
        stock: 10,
        inventoryTracking: 'QUANTITY',
        lotTracking: 'NONE',
      },
    });
    const m = (await f.rec.finalDryRun(db, f.input)).manifest!;
    await f.opening.reviewImport(db, m, f.actorId, {
      companyId: f.companyId,
      cutoverId: f.cutoverId,
      expectedStatus: 'WRITERS_FROZEN',
      expectedRevision: 1,
      manifestDigest: null,
    });
    await db.$transaction((tx) =>
      control.transition(
        tx,
        {
          companyId: f.companyId,
          cutoverId: f.cutoverId,
          expectedStatus: 'DRY_RUN_REVIEWED',
          expectedRevision: 2,
          manifestDigest: m.manifestDigest,
        },
        f.actorId,
        { kind: 'LOCK_MANIFEST' },
      ),
    );
    const [a, b] = m.products;
    await f.opening.applyProduct(db, m, a.productId, f.actorId);
    const persisted = await db.inventoryPosition.findFirstOrThrow({
      where: { companyId: f.companyId, productId: a.productId },
    });
    const repository = new PhysicalInventoryRepository();
    jest
      .spyOn(repository, 'claimOpeningEffect')
      .mockRejectedValue(new Error('B fault'));
    await expect(
      new InventoryOpeningService(f.rec, repository).applyProduct(
        db,
        m,
        b.productId,
        f.actorId,
      ),
    ).rejects.toThrow('B fault');
    await f.opening.apply(db, m, f.actorId);
    expect(
      await db.inventoryPosition.findUnique({ where: { id: persisted.id } }),
    ).toEqual(persisted);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(2);
  });
  it('batch projection is guarded and initialQuantity unchanged', async () => {
    const f = await fixture({ batch: true });
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    const b = await db.inventoryBatch.findUniqueOrThrow({
      where: { id: f.batchId! },
    });
    expect(b.availableQuantity).toBe(10);
    expect(b.initialQuantity).toBe(20);
  });
  it('stale batch before-value blocks without opening', async () => {
    const f = await fixture({ batch: true });
    const m = await f.prepare();
    await db.inventoryBatch.update({
      where: { id: f.batchId! },
      data: { availableQuantity: 18 },
    });
    const before = await snapshot(f.companyId);
    await expect(f.opening.apply(db, m, f.actorId)).rejects.toThrow();
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it.each([{ expired: true }, { inactive: true }])(
    'truthful ineligible owned baseline %j',
    async (option) => {
      const f = await fixture({ batch: true, ...option });
      const m = await f.prepare();
      expect(m.products[0].expectedAvailable).toBe(0);
      await f.opening.apply(db, m, f.actorId);
      expect(
        (
          await db.inventoryPosition.findFirstOrThrow({
            where: { companyId: f.companyId },
          })
        ).quantity,
      ).toBe(10);
    },
  );
  it('registered CUSTODY opening is one effect with two positive lines', async () => {
    const f = await fixture({ custody: true });
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    const e = await db.inventoryPhysicalEffect.findFirstOrThrow({
      where: { companyId: f.companyId },
      include: { lines: true },
    });
    expect(e.kind).toBe('OPENING');
    expect(e.lines.map((x) => x.delta).sort()).toEqual([4, 6]);
  });
  it.each([{ missingResolver: true }, { wrongTenant: true }])(
    'CUSTODY rejects unresolved context %j',
    async (options) => {
      const f = await fixture({ custody: true, ...options });
      expect(f.candidate.manifest).toBeNull();
      expect(f.candidate.discrepancies[0].code).toBe(
        'CUSTODY_CONTEXT_UNPROVEN',
      );
    },
  );
  it.each([true, null])(
    'OPTIONAL batched accessibility blocks %s',
    async (sellable) => {
      const f = await fixture({ batch: true, optional: true, sellable });
      expect(f.candidate.manifest).toBeNull();
    },
  );
  it.each([true, false])(
    'OPTIONAL mixed identity preserves both pools and enforces commercial gate %s',
    async (sellable) => {
      const f = await fixture({
        batch: true,
        optional: true,
        mixed: true,
        sellable,
      });
      if (sellable) {
        expect(f.candidate.manifest).toBeNull();
        return;
      }
      const m = await f.prepare();
      expect(m.products[0].pools).toHaveLength(2);
      await f.opening.apply(db, m, f.actorId);
      expect(
        (
          await db.inventoryBatch.findUniqueOrThrow({
            where: { id: f.batchId! },
          })
        ).availableQuantity,
      ).toBe(6);
    },
  );
  it('REQUIRED residual without batch blocks final approval', async () => {
    const f = await fixture({ batch: true, mixed: true });
    expect(f.candidate.manifest).toBeNull();
    expect(f.candidate.discrepancies[0].blocksApproval).toBe(true);
  });
  it('OPTIONAL unbatched is admitted', async () => {
    const f = await fixture({ optional: true });
    await f.opening.apply(db, await f.prepare(), f.actorId);
  });
  it('unexpected Position blocks APPLY and leaves evidence unchanged', async () => {
    const f = await fixture();
    const m = await f.prepare();
    await db.inventoryPosition.create({
      data: {
        companyId: f.companyId,
        productId: f.productId,
        state: 'AVAILABLE',
      },
    });
    const before = await snapshot(f.companyId);
    await expect(f.opening.apply(db, m, f.actorId)).rejects.toThrow();
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('wrong digest and altered checkpoint fail closed', async () => {
    const f = await fixture();
    const m = await f.prepare();
    await expect(
      f.opening.apply(db, { ...m, manifestDigest: 'a'.repeat(64) }, f.actorId),
    ).rejects.toThrow();
    await db.inventoryCutoverProduct.updateMany({
      where: { companyId: f.companyId },
      data: { manifestProductFingerprint: 'b'.repeat(64) },
    });
    await expect(f.opening.apply(db, m, f.actorId)).rejects.toThrow();
  });
  it('OPENING_APPLIED rejects incomplete checkpoint set', async () => {
    const f = await fixture();
    const m = await f.prepare();
    await expect(f.opening.complete(db, m, f.actorId)).rejects.toThrow();
  });
  it('independent VERIFY, Product and Company certification remain non-activating', async () => {
    const f = await fixture();
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    const verify = new InventoryCutoverVerifyService(f.opening, {
      load: async () => JSON.parse(JSON.stringify(m)) as OpeningManifest,
    });
    const before = await snapshot(f.companyId);
    const proof = await verify.verify(
      other,
      f.companyId,
      f.cutoverId,
      m.manifestDigest,
    );
    expect(await snapshot(f.companyId)).toBe(before);
    await verify.certifyProduct(db, proof, f.productId, f.actorId);
    await verify.certifyCompany(db, proof, f.actorId);
    const c = await db.inventoryCutover.findUniqueOrThrow({
      where: { id: f.cutoverId },
    });
    expect(c.status).toBe('VERIFIED');
    expect(c.activatedAt).toBeNull();
    expect(c.activatedBy).toBeNull();
  });
  it('VERIFY rejects APPLY interleaving and stale certification/tampering', async () => {
    const f = await fixture();
    const m = await f.prepare();
    const verify = new InventoryCutoverVerifyService(f.opening, {
      load: async () => structuredClone(m),
    });
    await expect(
      verify.verify(other, f.companyId, f.cutoverId, m.manifestDigest),
    ).rejects.toThrow();
    await f.opening.apply(db, m, f.actorId);
    const proof = await verify.verify(
      other,
      f.companyId,
      f.cutoverId,
      m.manifestDigest,
    );
    await db.inventoryPosition.updateMany({
      where: { companyId: f.companyId },
      data: { quantity: 9 },
    });
    await expect(
      verify.certifyProduct(db, proof, f.productId, f.actorId),
    ).rejects.toThrow();
    await expect(
      verify.verify(other, f.companyId, f.cutoverId, m.manifestDigest),
    ).rejects.toThrow();
  });
  it('VERIFY rechecks OPTIONAL accessibility evidence', async () => {
    const f = await fixture({ batch: true, optional: true, sellable: false });
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    const original = await f.rec.evidence.product(db, m, f.productId);
    jest.spyOn(f.rec.evidence, 'product').mockResolvedValue({
      ...original,
      historicallySellableBatched: true,
    });
    const verify = new InventoryCutoverVerifyService(f.opening, {
      load: async () => structuredClone(m),
    });
    await expect(
      verify.verify(other, f.companyId, f.cutoverId, m.manifestDigest),
    ).rejects.toThrow();
  });
  it('VERIFY rejects changed batch projection and changed legacy membership', async () => {
    const f = await fixture({ batch: true });
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    const verify = new InventoryCutoverVerifyService(f.opening, {
      load: async () => structuredClone(m),
    });
    await db.inventoryBatch.update({
      where: { id: f.batchId! },
      data: { initialQuantity: 21 },
    });
    await expect(
      verify.verify(other, f.companyId, f.cutoverId, m.manifestDigest),
    ).rejects.toThrow();
    await db.inventoryBatch.update({
      where: { id: f.batchId! },
      data: { initialQuantity: 20 },
    });
    const customer = await db.customer.create({
      data: { companyId: f.companyId, name: 'Only test' },
    });
    await db.sale.create({
      data: {
        companyId: f.companyId,
        customerId: customer.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 1,
        iva: 0,
        total: 1,
        items: {
          create: {
            productId: f.productId,
            quantity: 1,
            price: 1,
            subtotal: 1,
          },
        },
      },
    });
    await expect(
      verify.verify(other, f.companyId, f.cutoverId, m.manifestDigest),
    ).rejects.toThrow();
  });
  it('review import rolls back its entire child set on membership insertion failure', async () => {
    const f = await fixture();
    const m = f.candidate.manifest!;
    const before = await snapshot(f.companyId);
    // A transaction-local failure after import proves parent and all children rollback.
    const repo = new InventoryCutoverRepository();
    const service = new InventoryCutoverService(repo);
    await expect(
      db.$transaction(async (tx) => {
        await service.transition(
          tx,
          {
            companyId: f.companyId,
            cutoverId: f.cutoverId,
            expectedStatus: 'WRITERS_FROZEN',
            expectedRevision: 1,
            manifestDigest: null,
          },
          f.actorId,
          {
            kind: 'REVIEW',
            manifest: {
              manifestDigest: m.manifestDigest,
              snapshotFingerprint: m.snapshotFingerprint,
              baselineBuild: m.baselineBuild,
              products: m.products.map((p) => ({
                productId: p.productId,
                manifestProductFingerprint: p.manifestProductFingerprint,
                expectedOwned: p.expectedOwned,
                expectedAvailable: p.expectedAvailable,
                expectedCustody: p.expectedCustody,
                projectionEvidence: p.projectionEvidence,
              })),
              legacySales: [],
            },
          },
        );
        throw new Error('after complete import');
      }),
    ).rejects.toThrow('after complete import');
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('zero Product has checkpoint only', async () => {
    const f = await fixture({ zero: true });
    const m = await f.prepare();
    await f.opening.apply(db, m, f.actorId);
    expect(
      await db.inventoryPosition.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
  });
  it('full-set replacement cannot omit a QUANTITY Product even with a recomputed digest', async () => {
    const f = await fixture();
    const m = f.candidate.manifest!;
    await f.opening.reviewImport(db, m, f.actorId, {
      companyId: f.companyId,
      cutoverId: f.cutoverId,
      expectedStatus: 'WRITERS_FROZEN',
      expectedRevision: 1,
      manifestDigest: null,
    });
    const incomplete = { ...m, products: [] };
    incomplete.manifestDigest = manifestHash(incomplete);
    const before = await snapshot(f.companyId);
    await expect(
      f.opening.reviewImport(
        db,
        incomplete,
        f.actorId,
        {
          companyId: f.companyId,
          cutoverId: f.cutoverId,
          expectedStatus: 'DRY_RUN_REVIEWED',
          expectedRevision: 2,
          manifestDigest: m.manifestDigest,
        },
        true,
      ),
    ).rejects.toThrow();
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('full review replacement only before manifest lock', async () => {
    const f = await fixture();
    const m = f.candidate.manifest!;
    await f.opening.reviewImport(db, m, f.actorId, {
      companyId: f.companyId,
      cutoverId: f.cutoverId,
      expectedStatus: 'WRITERS_FROZEN',
      expectedRevision: 1,
      manifestDigest: null,
    });
    await f.opening.reviewImport(
      db,
      m,
      f.actorId,
      {
        companyId: f.companyId,
        cutoverId: f.cutoverId,
        expectedStatus: 'DRY_RUN_REVIEWED',
        expectedRevision: 2,
        manifestDigest: m.manifestDigest,
      },
      true,
    );
    await db.$transaction((tx) =>
      control.transition(
        tx,
        {
          companyId: f.companyId,
          cutoverId: f.cutoverId,
          expectedStatus: 'DRY_RUN_REVIEWED',
          expectedRevision: 3,
          manifestDigest: m.manifestDigest,
        },
        f.actorId,
        { kind: 'LOCK_MANIFEST' },
      ),
    );
    await expect(
      f.opening.reviewImport(
        db,
        m,
        f.actorId,
        {
          companyId: f.companyId,
          cutoverId: f.cutoverId,
          expectedStatus: 'OPENING_APPLYING',
          expectedRevision: 4,
          manifestDigest: m.manifestDigest,
        },
        true,
      ),
    ).rejects.toThrow();
  });
  it.each([
    'negative',
    'before',
    'revision',
    'namespace',
    'origin',
    'incomplete',
  ] as const)('DB rejects malformed OPENING: %s', async (shape) => {
    const f = await fixture();
    await expect(
      db.$transaction(async (tx) => {
        const position = await tx.inventoryPosition.create({
          data: {
            companyId: f.companyId,
            productId: f.productId,
            state: 'AVAILABLE',
            quantity: 1,
            revision: 1,
          },
        });
        const effect = await tx.inventoryPhysicalEffect.create({
          data: {
            companyId: f.companyId,
            actorId: f.actorId,
            kind: 'OPENING',
            originType: shape === 'namespace' ? 'WRONG' : 'INVENTORY_OPENING',
            originId: f.cutoverId,
            originOperation:
              shape === 'origin' ? 'WRONG' : `OPEN_${f.productId}`,
            requestHash: 'a'.repeat(64),
            lineCount: shape === 'incomplete' ? 2 : 1,
          },
        });
        await tx.inventoryPhysicalEffectLine.create({
          data: {
            companyId: f.companyId,
            effectId: effect.id,
            positionId: position.id,
            sequence: 1,
            delta: shape === 'negative' ? -1 : 1,
            quantityBefore:
              shape === 'negative' ? 2 : shape === 'before' ? 1 : 0,
            quantityAfter: shape === 'before' ? 2 : 1,
            revisionBefore: shape === 'revision' ? 1 : 0,
            revisionAfter: shape === 'revision' ? 2 : 1,
          },
        });
      }),
    ).rejects.toThrow();
  });
  it.each([
    'CREDIT',
    'TRANSFER',
    'DEFINITIVE_OUT',
    'COUNT_CORRECTION',
  ] as const)('DB still rejects malformed %s', async (kind) => {
    const f = await fixture();
    await expect(
      db.$transaction(async (tx) => {
        const position = await tx.inventoryPosition.create({
          data: {
            companyId: f.companyId,
            productId: f.productId,
            state: kind === 'COUNT_CORRECTION' ? 'CUSTODY' : 'AVAILABLE',
            contextType: kind === 'COUNT_CORRECTION' ? 'TEST' : null,
            contextId: kind === 'COUNT_CORRECTION' ? 'test' : null,
          },
        });
        const effect = await tx.inventoryPhysicalEffect.create({
          data: {
            companyId: f.companyId,
            actorId: f.actorId,
            kind,
            originType: 'TEST',
            originId: f.cutoverId,
            originOperation: 'TEST',
            requestHash: 'a'.repeat(64),
            lineCount: 1,
          },
        });
        await tx.inventoryPhysicalEffectLine.create({
          data: {
            companyId: f.companyId,
            effectId: effect.id,
            positionId: position.id,
            sequence: 1,
            delta: kind === 'CREDIT' ? -1 : 1,
            quantityBefore: kind === 'CREDIT' ? 1 : 0,
            quantityAfter: kind === 'CREDIT' ? 0 : 1,
            revisionBefore: 0,
            revisionAfter: 1,
          },
        });
      }),
    ).rejects.toThrow();
  });
});
