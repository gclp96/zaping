/* Test-only adapters and barriers, never installed by productive modules. */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, ProductLotTracking } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { resolve as resolvePath } from 'node:path';
import { InventoryCutoverService } from '../src/inventory/physical/inventory-cutover.service';
import { InventoryCutoverRepository } from '../src/inventory/physical/inventory-cutover.repository';
import { InventoryOpeningService } from '../src/inventory/physical/inventory-opening.service';
import { InventoryReconciliationService } from '../src/inventory/physical/inventory-reconciliation.service';
import { InventoryCutoverVerifyService } from '../src/inventory/physical/inventory-cutover-verify.service';
import { InventoryCutoverActivationService } from '../src/inventory/physical/inventory-cutover-activation.service';
import {
  ActivationRequest,
  ActivationEvidenceAdapter,
} from '../src/inventory/physical/inventory-cutover-activation.contract';
import {
  openingHash,
  OpeningManifest,
} from '../src/inventory/physical/inventory-opening-manifest';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { ManualPhysicalInventoryService } from '../src/inventory/physical/manual-physical-inventory.service';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { SalesPhysicalIntegrationService } from '../src/inventory/physical/sales-physical-integration.service';
import { SalesPhysicalSourceResolver } from '../src/inventory/physical/sales-physical-source-resolver';
import { InventoryService } from '../src/inventory/inventory.service';
import { PurchaseReceiptsService } from '../src/purchases-receipts/purchases-receipts.service';
import { SalesService } from '../src/sales/sales.service';
import { SalesFolioService } from '../src/sales/sales-folio.service';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';

const suite =
  process.env.RUN_INVENTORY_AUTHORITY_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('01D-C isolated authority acceptance', () => {
  let db: PrismaClient, other: PrismaClient;
  const runtime = new InventoryRuntimeCompatibilityService();
  const control = new InventoryCutoverService(new InventoryCutoverRepository());
  beforeAll(async () => {
    const url = new URL(process.env.INVENTORY_AUTHORITY_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_authority_test' ||
      url.username !== 'authority_test' ||
      !process.env.INVENTORY_AUTHORITY_TEST_RUN
    )
      throw new Error('Unverified isolated target');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    await other.$connect();
  });
  afterAll(async () => {
    await db?.$disconnect();
    await other?.$disconnect();
  });
  function barrier() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  }
  async function waitBlocked(pid: number) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const [row] = await db.$queryRaw<
        { blocked: boolean }[]
      >`SELECT cardinality(pg_blocking_pids(${pid}::int)) > 0 AS blocked`;
      if (row.blocked) return;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    throw new Error('No observed database lock barrier');
  }
  function services(client = db, resolver = new InventoryAuthorityResolver()) {
    const prisma = client as PrismaService;
    const authority = new InventoryAuthorityTransactionService(
      prisma,
      resolver,
      runtime,
    );
    const repo = new PhysicalInventoryRepository(),
      physical = new PhysicalInventoryService(repo);
    const projection = new InventoryCompatibilityProjectionService(),
      history = new InventoryCompatibilityHistoryService();
    const sequence = new CompanySequenceAllocatorService();
    const equipment = new EquipmentProvisioningService(
      new EquipmentAssetCodeService(sequence),
    );
    const folios = new SalesFolioService(sequence);
    const salesPhysical = new SalesPhysicalIntegrationService(
      prisma,
      folios,
      new SalesPhysicalSourceResolver(repo),
      physical,
      projection,
      history,
      authority,
    );
    return {
      authority,
      inventory: new InventoryService(
        prisma,
        authority,
        new ManualPhysicalInventoryService(physical, projection, history),
      ),
      receipts: new PurchaseReceiptsService(
        prisma,
        equipment,
        authority,
        new ReceiptPhysicalIntegrationService(
          repo,
          physical,
          projection,
          history,
          equipment,
        ),
      ),
      sales: new SalesService(prisma, folios, salesPhysical),
    };
  }
  async function fixture(lotTracking: ProductLotTracking = 'NONE') {
    const companyId = randomUUID(),
      actorId = randomUUID(),
      productId = randomUUID(),
      cutoverId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'AUTHORITY TEST', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Isolated',
        lastName: 'Test',
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
        name: 'Physical',
        stock: 10,
        inventoryTracking: 'QUANTITY',
        lotTracking,
      },
    });
    const customer = await db.customer.create({
      data: { companyId, name: 'Isolated customer' },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'Isolated supplier' },
    });
    const purchase = await db.purchase.create({
      data: {
        companyId,
        supplierId: supplier.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 20,
        iva: 0,
        total: 20,
        items: {
          create: [{ productId, quantity: 20, price: 1, subtotal: 20 }],
        },
      },
      include: { items: true },
    });
    const sale = await db.sale.create({
      data: {
        companyId,
        customerId: customer.id,
        folio: randomUUID(),
        subtotal: 1,
        iva: 0,
        total: 1,
        items: { create: [{ productId, quantity: 1, price: 1, subtotal: 1 }] },
      },
    });
    const quote = await db.quote.create({
      data: {
        companyId,
        customerId: customer.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 1,
        iva: 0,
        total: 1,
        items: { create: [{ productId, quantity: 1, price: 1, subtotal: 1 }] },
      },
    });
    const evidence = {
      reference: `test:${companyId}`,
      contentHash: openingHash({ companyId }),
      evidenceType: 'ISOLATED_TEST_ONLY',
    };
    const reconciliation = new InventoryReconciliationService({
      freeze: async () => true,
      product: async () => ({
        pools: [
          {
            batchId: null,
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
            quantity: 10,
            evidenceRefs: [evidence.reference],
          },
        ],
        evidence: [evidence],
        historicallySellableBatched: false,
      }),
      verify: async () => true,
    });
    const opening = new InventoryOpeningService(reconciliation);
    let manifest!: OpeningManifest;
    const verify = new InventoryCutoverVerifyService(opening, {
      load: async () => manifest,
    });
    const adapter: ActivationEvidenceAdapter = {
      accept: async (request) => ({
        retainedRequest: { ...request },
        protocol: 'inventory-authority-v1',
        validFrom: new Date(Date.now() - 60000).toISOString(),
        validUntil: new Date(Date.now() + 60000).toISOString(),
        freezeAccepted: true,
        writerInventoryCertified: true,
        staleRuntimeFenceCertified: true,
        runtimeCertified: true,
        beforeImagesCompatible: true,
      }),
    };
    const activation = new InventoryCutoverActivationService(
      db,
      verify,
      runtime,
      adapter,
    );
    const prepare = async () => {
      await db.$transaction((tx) =>
        control.create(tx, { id: cutoverId, companyId, actorId }),
      );
      await db.$transaction((tx) =>
        control.transition(
          tx,
          {
            companyId,
            cutoverId,
            expectedRevision: 0,
            expectedStatus: 'PRECHECK',
            manifestDigest: null,
          },
          actorId,
          { kind: 'FROZEN' },
        ),
      );
      const candidate = await reconciliation.finalDryRun(db, {
        companyId,
        cutoverId,
        baselineBuild: 'opening-fixture',
        frozenAsOf: new Date().toISOString(),
        freezeEvidence: evidence,
      });
      expect(candidate.discrepancies).toEqual([]);
      manifest = candidate.manifest!;
      await opening.reviewImport(db, manifest, actorId, {
        companyId,
        cutoverId,
        expectedRevision: 1,
        expectedStatus: 'WRITERS_FROZEN',
        manifestDigest: null,
      });
      await db.$transaction((tx) =>
        control.transition(
          tx,
          {
            companyId,
            cutoverId,
            expectedRevision: 2,
            expectedStatus: 'DRY_RUN_REVIEWED',
            manifestDigest: manifest.manifestDigest,
          },
          actorId,
          { kind: 'LOCK_MANIFEST' },
        ),
      );
      await opening.apply(db, manifest, actorId);
      const proof = await verify.verify(
        db,
        companyId,
        cutoverId,
        manifest.manifestDigest,
      );
      await verify.certifyProduct(db, proof, productId, actorId);
      await verify.certifyCompany(db, proof, actorId);
      const c = await db.inventoryCutover.findUniqueOrThrow({
        where: { companyId },
      });
      const request: ActivationRequest = {
        companyId,
        cutoverId,
        expectedRevision: c.revision,
        manifestDigest: manifest.manifestDigest,
        expectedBuild: 'authority-fixture',
        expectedEnvironment: 'isolated',
        businessActorId: actorId,
        operatorId: 'isolated-operator',
        evidencePath: resolvePath(
          __dirname,
          'test-evidence-not-a-real-artifact',
        ),
        evidenceHash: evidence.contentHash,
      };
      return request;
    };
    return {
      companyId,
      actorId,
      productId,
      cutoverId,
      purchase,
      sale,
      quote,
      prepare,
      activation,
      verify,
      adapter,
    };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  function write(s: ReturnType<typeof services>, f: Fixture, kind: string) {
    if (kind === 'manual')
      return s.inventory.createMovement(f.companyId, {
        productId: f.productId,
        movementType: 'IN',
        quantity: 1,
      });
    if (kind === 'receipt')
      return s.receipts.create(f.companyId, f.actorId, 'receipt-key', {
        purchaseId: f.purchase.id,
        items: [
          { purchaseItemId: f.purchase.items[0].id, quantityReceived: 1 },
        ],
      });
    if (kind === 'approve')
      return s.sales.approve(f.companyId, f.sale.id, f.actorId);
    return s.sales.createFromQuote(f.companyId, f.quote.id, f.actorId);
  }
  async function snapshot(companyId: string) {
    return JSON.stringify(
      await Promise.all([
        db.product.findMany({ where: { companyId } }),
        db.inventoryMovement.findMany({ where: { companyId } }),
        db.inventoryPhysicalEffect.findMany({ where: { companyId } }),
        db.inventoryPosition.findMany({ where: { companyId } }),
        db.sale.findMany({ where: { companyId } }),
        db.quote.findMany({ where: { companyId } }),
        db.purchaseReceipt.findMany({ where: { companyId } }),
        db.idempotencyRecord.findMany({ where: { companyId } }),
        db.companySequence.findMany({ where: { companyId } }),
      ]),
    );
  }
  it.each(['manual', 'receipt', 'approve', 'quote'])(
    'LEGACY %s in flight drains before initial control creation',
    async (kind) => {
      const f = await fixture(),
        held = barrier(),
        release = barrier(),
        started = barrier();
      const resolver = new InventoryAuthorityResolver();
      const original: InventoryAuthorityResolver['resolve'] = (tx, c) =>
        InventoryAuthorityResolver.prototype.resolve.call(
          resolver,
          tx,
          c,
        ) as ReturnType<InventoryAuthorityResolver['resolve']>;
      jest.spyOn(resolver, 'resolve').mockImplementation(async (tx, c) => {
        const a = await original(tx, c);
        held.release();
        await release.promise;
        return a;
      });
      const writer = write(services(other, resolver), f, kind);
      await held.promise;
      let pid = 0;
      const transition = db.$transaction(
        async (tx) => {
          pid = (
            await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`
          )[0].pid;
          started.release();
          return control.create(tx, {
            id: f.cutoverId,
            companyId: f.companyId,
            actorId: f.actorId,
          });
        },
        { timeout: 15000 },
      );
      await started.promise;
      try {
        await waitBlocked(pid);
      } finally {
        release.release();
      }
      await writer;
      await transition;
      expect(
        await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
      ).toBe(1);
      await expect(write(services(), f, kind)).rejects.toMatchObject({
        code: 'CUTOVER_FROZEN',
      });
    },
  );
  it('CUTOVER produces no business, claim, inventory or folio writes', async () => {
    const f = await fixture();
    await db.$transaction((tx) =>
      control.create(tx, {
        id: f.cutoverId,
        companyId: f.companyId,
        actorId: f.actorId,
      }),
    );
    const before = await snapshot(f.companyId);
    for (const kind of ['manual', 'receipt', 'approve', 'quote'])
      await expect(write(services(), f, kind)).rejects.toMatchObject({
        code: 'CUTOVER_FROZEN',
      });
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('concurrent activation has one durable CAS winner', async () => {
    const f = await fixture(),
      r = await f.prepare();
    const results = await Promise.all([
      f.activation.activate(r),
      f.activation.activate(r),
    ]);
    expect(results.map((x) => x.outcome).sort()).toEqual([
      'ACTIVATED',
      'ALREADY_ACTIVATED',
    ]);
    expect(results[0].control?.revision).toBe(r.expectedRevision + 1);
  });
  it.each([
    'checkpoint',
    'membership',
    'revision',
    'digest',
    'build',
    'evidence',
  ] as const)('activation rejects changed %s', async (mode) => {
    const f = await fixture(),
      r = await f.prepare();
    if (mode === 'checkpoint')
      await db.inventoryCutoverProduct.updateMany({
        where: { companyId: f.companyId },
        data: { status: 'APPLIED', verifiedAt: null },
      });
    if (mode === 'membership')
      await db.sale.update({
        where: { id: f.sale.id },
        data: { status: 'CONFIRMED' },
      });
    if (mode === 'revision') r.expectedRevision--;
    if (mode === 'digest') r.manifestDigest = 'f'.repeat(64);
    if (mode === 'build') r.expectedBuild = 'stale';
    if (mode === 'evidence')
      jest
        .spyOn(f.adapter, 'accept')
        .mockRejectedValue(new Error('Test evidence rejected'));
    await expect(f.activation.activate(r)).rejects.toThrow();
    expect(
      (
        await db.inventoryCutover.findUniqueOrThrow({
          where: { companyId: f.companyId },
        })
      ).status,
    ).toBe('VERIFIED');
  });
  it('lost response readback preserves original attribution even after business', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    await services().inventory.createPhysicalMovement({
      companyId: f.companyId,
      actorId: f.actorId,
      key: 'first',
      operation: {
        kind: 'IN',
        productId: f.productId,
        batchId: null,
        quantity: 1,
      },
    });
    const replay = await f.activation.activate(r);
    expect(replay.outcome).toBe('ALREADY_ACTIVATED');
    expect(replay.control?.activatedBy).toBe(f.actorId);
    const otherActor = await db.user.create({
      data: {
        companyId: f.companyId,
        firstName: 'Other',
        lastName: 'Actor',
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    await expect(
      f.activation.activate({ ...r, businessActorId: otherActor.id }),
    ).rejects.toMatchObject({ code: 'CUTOVER_ACTIVATION_PRECONDITION_FAILED' });
  });
  it('a writer waiting behind an exclusive transition reads its committed state', async () => {
    const f = await fixture(),
      held = barrier(),
      release = barrier(),
      started = barrier();
    const transition = db.$transaction(
      async (tx) => {
        await control.create(tx, {
          id: f.cutoverId,
          companyId: f.companyId,
          actorId: f.actorId,
        });
        held.release();
        await release.promise;
      },
      { timeout: 15000 },
    );
    await held.promise;
    let pid = 0;
    const wrapper = {
      $transaction: (
        fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
        opts: object,
      ) =>
        other.$transaction(async (tx) => {
          pid = (
            await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`
          )[0].pid;
          started.release();
          return fn(tx);
        }, opts),
    } as unknown as PrismaClient;
    const result = write(services(wrapper), f, 'manual').then(
      () => null,
      (e) => e as { code: string },
    );
    await started.promise;
    try {
      await waitBlocked(pid);
    } finally {
      release.release();
    }
    await transition;
    expect(await result).toMatchObject({ code: 'CUTOVER_FROZEN' });
  });
  it.each(['receipt', 'manual', 'approve', 'quote'])(
    'first PHYSICAL %s creates exactly one business Effect and compatibility Movement',
    async (kind) => {
      const f = await fixture(),
        r = await f.prepare();
      await f.activation.activate(r);
      const s = services();
      const invoke = () =>
        kind === 'manual'
          ? s.inventory.createPhysicalMovement({
              companyId: f.companyId,
              actorId: f.actorId,
              key: 'manual-key',
              operation: {
                kind: 'IN',
                productId: f.productId,
                batchId: null,
                quantity: 1,
              },
            })
          : write(s, f, kind);
      await invoke();
      await invoke();
      const effects = await db.inventoryPhysicalEffect.findMany({
        where: { companyId: f.companyId, kind: { not: 'OPENING' } },
        include: { lines: true },
      });
      expect(effects).toHaveLength(1);
      expect(effects[0].actorId).toBe(f.actorId);
      expect(effects[0].lines).toHaveLength(1);
      expect(
        await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
      ).toBe(1);
      const expected = kind === 'approve' || kind === 'quote' ? 9 : 11;
      expect(
        (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
          .stock,
      ).toBe(expected);
      expect(
        (
          await db.inventoryPosition.aggregate({
            where: { companyId: f.companyId },
            _sum: { quantity: true },
          })
        )._sum.quantity,
      ).toBe(expected);
    },
  );
  it('REQUIRED Sales remains rejected with no mutation or fallback', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    await db.product.update({
      where: { id: f.productId },
      data: { lotTracking: 'REQUIRED' },
    });
    const before = await snapshot(f.companyId);
    await expect(write(services(), f, 'approve')).rejects.toThrow();
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('OPTIONAL Candidate C consumes unbatched sources only', async () => {
    const f = await fixture('OPTIONAL'),
      r = await f.prepare();
    await f.activation.activate(r);
    await services().receipts.create(f.companyId, f.actorId, 'batch', {
      purchaseId: f.purchase.id,
      items: [
        {
          purchaseItemId: f.purchase.items[0].id,
          quantityReceived: 1,
          lotNumber: 'PHYSICAL-BATCH',
        },
      ],
    });
    await write(services(), f, 'approve');
    const effect = await db.inventoryPhysicalEffect.findFirstOrThrow({
      where: { companyId: f.companyId, kind: 'DEFINITIVE_OUT' },
      include: { lines: { include: { position: true } } },
    });
    expect(
      effect.lines.every((l) => l.position.inventoryBatchId === null),
    ).toBe(true);
    expect(
      (
        await db.inventoryBatch.findFirstOrThrow({
          where: { companyId: f.companyId },
        })
      ).availableQuantity,
    ).toBe(1);
  });
  it('rollback boundary uses exact opening membership and zero COUNT is business', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    expect(await f.activation.rollbackBoundary(r)).toEqual({
      status: 'ROLLBACK_EVALUATION_ELIGIBLE',
      rollbackAllowed: false,
    });
    const pos = await db.inventoryPosition.findFirstOrThrow({
      where: { companyId: f.companyId },
    });
    await services().inventory.createPhysicalMovement({
      companyId: f.companyId,
      actorId: f.actorId,
      key: 'count',
      reason: 'Verified count',
      operation: {
        kind: 'COUNT_CORRECTION',
        positionId: pos.id,
        countedQuantity: pos.quantity,
        expectedRevision: pos.revision,
      },
    });
    expect(await f.activation.rollbackBoundary(r)).toEqual({
      status: 'FREEZE_DIAGNOSE_FORWARD_FIX',
      rollbackAllowed: false,
    });
  });
  it('RECOVERY_REQUIRED blocks all productive writers', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    await db.$transaction((tx) =>
      control.transition(
        tx,
        {
          companyId: f.companyId,
          cutoverId: f.cutoverId,
          expectedRevision: r.expectedRevision + 1,
          expectedStatus: 'PHYSICAL_ACTIVE',
          manifestDigest: r.manifestDigest,
        },
        f.actorId,
        { kind: 'RECOVERY' },
      ),
    );
    const before = await snapshot(f.companyId);
    for (const kind of ['manual', 'receipt', 'approve', 'quote'])
      await expect(write(services(), f, kind)).rejects.toMatchObject({
        code: 'RECOVERY_REQUIRED',
      });
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('stale Position revision rejects without any legacy mutation', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    const pos = await db.inventoryPosition.findFirstOrThrow({
      where: { companyId: f.companyId },
    });
    const before = await snapshot(f.companyId);
    await expect(
      services().inventory.createPhysicalMovement({
        companyId: f.companyId,
        actorId: f.actorId,
        key: 'stale',
        operation: {
          kind: 'OUT',
          sources: [
            {
              positionId: pos.id,
              quantity: 1,
              expectedRevision: pos.revision - 1,
            },
          ],
        },
      }),
    ).rejects.toThrow();
    expect(await snapshot(f.companyId)).toBe(before);
  });
  it('two compatible physical writers share the authority fence concurrently', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    const held = barrier(),
      release = barrier();
    const resolver = new InventoryAuthorityResolver();
    const resolve: InventoryAuthorityResolver['resolve'] = (tx, c) =>
      InventoryAuthorityResolver.prototype.resolve.call(
        resolver,
        tx,
        c,
      ) as ReturnType<InventoryAuthorityResolver['resolve']>;
    jest
      .spyOn(resolver, 'resolve')
      .mockImplementation(async (tx, companyId) => {
        const authority = await resolve(tx, companyId);
        held.release();
        await release.promise;
        return authority;
      });
    const first = services(other, resolver).inventory.createPhysicalMovement({
      companyId: f.companyId,
      actorId: f.actorId,
      key: 'first-parallel',
      operation: {
        kind: 'IN',
        productId: f.productId,
        batchId: null,
        quantity: 1,
      },
    });
    await held.promise;
    try {
      await services().inventory.createPhysicalMovement({
        companyId: f.companyId,
        actorId: f.actorId,
        key: 'parallel',
        operation: {
          kind: 'IN',
          productId: f.productId,
          batchId: null,
          quantity: 1,
        },
      });
    } finally {
      release.release();
    }
    await first;
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(12);
  });
  it('control transitions reject fixed-snapshot transactions before writes', async () => {
    const f = await fixture();
    await expect(
      db.$transaction(
        (tx) =>
          control.create(tx, {
            id: f.cutoverId,
            companyId: f.companyId,
            actorId: f.actorId,
          }),
        { isolationLevel: 'Serializable' },
      ),
    ).rejects.toThrow('INVALID_TRANSITION');
    expect(
      await db.inventoryCutover.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
  });
  it('mixed QUANTITY, ASSET and SERIALIZED Receipt stays atomic and replays once', async () => {
    const f = await fixture(),
      r = await f.prepare();
    await f.activation.activate(r);
    const extra: { purchaseItemId: string; quantityReceived: number }[] = [];
    for (const inventoryTracking of ['ASSET', 'SERIALIZED'] as const) {
      const product = await db.product.create({
        data: {
          companyId: f.companyId,
          sku: randomUUID(),
          name: inventoryTracking,
          inventoryTracking,
          stock: 0,
        },
      });
      const item = await db.purchaseItem.create({
        data: {
          purchaseId: f.purchase.id,
          productId: product.id,
          quantity: 1,
          price: 1,
          subtotal: 1,
        },
      });
      extra.push({ purchaseItemId: item.id, quantityReceived: 1 });
    }
    const dto = {
      purchaseId: f.purchase.id,
      items: [
        { purchaseItemId: f.purchase.items[0].id, quantityReceived: 1 },
        ...extra,
      ],
    };
    const receipt = await services().receipts.create(
      f.companyId,
      f.actorId,
      'mixed',
      dto,
    );
    expect(receipt.items).toHaveLength(3);
    expect(receipt.purchase.id).toBe(f.purchase.id);
    await services().receipts.create(f.companyId, f.actorId, 'mixed', dto);
    expect(
      await db.equipmentAsset.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId, kind: 'CREDIT' },
      }),
    ).toBe(1);
    expect(
      await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
    ).toBe(3);
  });
  it('external old-role revocation also terminates existing sessions', async () => {
    const url = new URL(process.env.INVENTORY_AUTHORITY_TEST_ADMIN_URL!);
    const target = new URL(process.env.INVENTORY_AUTHORITY_TEST_DATABASE_URL!);
    if (
      url.hostname !== target.hostname ||
      url.port !== target.port ||
      url.pathname !== target.pathname ||
      url.username !== 'postgres'
    )
      throw new Error('Admin target is not the isolated database');
    const admin = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const role = `old_${randomUUID().replaceAll('-', '')}`;
    const password = randomUUID();
    const oldUrl = new URL(url);
    oldUrl.username = role;
    oldUrl.password = password;
    oldUrl.searchParams.set('connection_limit', '1');
    const old = new PrismaClient({
      datasources: { db: { url: oldUrl.toString() } },
    });
    try {
      // Generated identifiers contain only [a-z0-9_], never operator input.
      await admin.$executeRawUnsafe(
        `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`,
      );
      await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await admin.$executeRawUnsafe(
        `GRANT SELECT, UPDATE ON "Product" TO ${role}`,
      );
      const f = await fixture();
      await old.$executeRaw`UPDATE "Product" SET stock=stock WHERE id=${f.productId}`;
      const pid = (
        await old.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      await admin.$executeRawUnsafe(`ALTER ROLE ${role} NOLOGIN`);
      await admin.$executeRawUnsafe(`REVOKE ALL ON "Product" FROM ${role}`);
      await expect(
        old.$executeRaw`UPDATE "Product" SET stock=stock WHERE id=${f.productId}`,
      ).rejects.toThrow();
      await admin.$queryRaw`SELECT pg_terminate_backend(${pid}::int)`;
      expect(
        await admin.$queryRaw`SELECT pid FROM pg_stat_activity WHERE usename=${role}`,
      ).toEqual([]);
      await expect(old.$queryRaw`SELECT 1`).rejects.toThrow();
      expect(
        await admin.$queryRaw`SELECT gid FROM pg_prepared_xacts WHERE owner=${role}`,
      ).toEqual([]);
    } finally {
      await old.$disconnect();
      await admin.$disconnect();
    }
  });
});
