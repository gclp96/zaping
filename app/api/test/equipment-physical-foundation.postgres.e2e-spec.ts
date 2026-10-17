import { randomUUID } from 'node:crypto';
import { EquipmentAsset, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { EquipmentPhysicalBaselineService } from '../src/equipment/equipment-physical-baseline.service';
import { EquipmentPhysicalRepository } from '../src/equipment/equipment-physical.repository';
import {
  EquipmentBaselineCommand,
  EquipmentBaselineEvidenceAdapter,
} from '../src/equipment/equipment-physical.contract';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { EquipmentService } from '../src/equipment/equipment.service';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';
import { PurchaseReceiptsService } from '../src/purchases-receipts/purchases-receipts.service';
import { createPurchaseReceiptRequestHash } from '../src/purchases-receipts/purchase-receipt-request-hash';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';

const suite =
  process.env.RUN_EQUIPMENT_PHYSICAL_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('01E-A fresh isolated Equipment physical foundation', () => {
  let db: PrismaClient, other: PrismaClient;
  const accept: EquipmentBaselineEvidenceAdapter = {
    accept: (c, requestHash) =>
      Promise.resolve({
        requestHash,
        evidenceHash: c.evidenceHash,
        operatorIdentity: c.operatorIdentity,
        warehousePresenceVerified: true,
      }),
  };
  beforeAll(async () => {
    const url = new URL(process.env.EQUIPMENT_PHYSICAL_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_equipment_physical_test' ||
      url.username !== 'equipment_physical_test' ||
      !process.env.EQUIPMENT_PHYSICAL_TEST_RUN
    )
      throw new Error('Unverified isolated DB');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    await other.$connect();
    const [r] = await db.$queryRaw<
      { rolsuper: boolean }[]
    >`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`;
    expect(r.rolsuper).toBe(false);
  });
  afterAll(async () => {
    await db?.$disconnect();
    await other?.$disconnect();
  });
  function barrier() {
    let release!: () => void;
    const promise = new Promise<void>((r) => {
      release = r;
    });
    return { promise, release };
  }
  async function blocked(pid: number) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const [r] = await db.$queryRaw<
        { blocked: boolean }[]
      >`SELECT cardinality(pg_blocking_pids(${pid}::int))>0 AS blocked`;
      if (r.blocked) return;
      await new Promise<void>((r) => setImmediate(r));
    }
    throw new Error('No explicit PostgreSQL blocking barrier observed');
  }
  async function fixture() {
    const company = await db.company.create({
      data: { name: 'ISOLATED EQUIPMENT', rfc: randomUUID() },
    });
    const companyId = company.id;
    const user = await db.user.create({
      data: {
        companyId,
        firstName: 'Fixture',
        lastName: 'Only',
        email: randomUUID() + '@example.invalid',
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    const product = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Equipment',
        inventoryTracking: 'ASSET',
      },
    });
    const asset = await db.equipmentAsset.create({
      data: {
        companyId,
        productId: product.id,
        assetCode: randomUUID(),
        condition: 'GOOD',
      },
    });
    const c = await db.healthcareCase.create({
      data: {
        companyId,
        folio: randomUUID(),
        title: 'Fixture',
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-10-15T10:00:00Z'),
        scheduledEnd: new Date('2026-10-15T12:00:00Z'),
        createdById: user.id,
      },
    });
    const assignment = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId,
        caseId: c.id,
        equipmentAssetId: asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Fixture only',
        createdById: user.id,
      },
    });
    const command: EquipmentBaselineCommand = {
      companyId,
      assetId: asset.id,
      reconciliationId: randomUUID(),
      expectedPhysicalRevision: 0,
      targetPhysicalLocation: 'WAREHOUSE',
      operatorIdentity: 'isolated-operator',
      evidenceReference: 'fixture://' + asset.id,
      evidenceHash: 'a'.repeat(64),
    };
    return {
      companyId,
      actorId: user.id,
      product,
      asset,
      caseId: c.id,
      assignmentId: assignment.id,
      command,
    };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const custodyData = (f: Fixture) => ({
    companyId: f.companyId,
    equipmentAssetId: f.asset.id,
    caseId: f.caseId,
    assignmentId: f.assignmentId,
    openedById: f.actorId,
  });
  async function open(tx: Prisma.TransactionClient, f: Fixture) {
    const episode = await tx.equipmentAssetCustody.create({
      data: custodyData(f),
    });
    await tx.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { physicalLocation: 'CUSTODY', activeCustodyId: episode.id },
    });
    return episode;
  }
  function eventData(
    f: Fixture,
    originId = randomUUID(),
    revisionBefore = 0,
  ): Prisma.EquipmentAssetPhysicalEventUncheckedCreateInput {
    return {
      companyId: f.companyId,
      equipmentAssetId: f.asset.id,
      operation: 'BASELINE_RECONCILIATION',
      originType: 'BASELINE_RECONCILIATION',
      originId,
      originOperation: 'ESTABLISH_WAREHOUSE',
      hashVersion: 1,
      requestHash: 'a'.repeat(64),
      physicalLocationBefore: 'UNVERIFIED',
      physicalLocationAfter: 'WAREHOUSE',
      conditionBefore: 'GOOD',
      conditionAfter: 'GOOD',
      lifecycleBefore: 'ACTIVE',
      lifecycleAfter: 'ACTIVE',
      revisionBefore,
      revisionAfter: revisionBefore + 1,
      actorId: null,
      reasonCode: 'BASELINE_RECONCILIATION',
      operatorIdentity: 'fixture',
      evidenceReference: 'fixture://proof',
      evidenceHash: 'a'.repeat(64),
    };
  }
  async function snapshot(f: Fixture) {
    return JSON.stringify(
      await Promise.all([
        db.equipmentAsset.findMany({
          where: { companyId: f.companyId },
          orderBy: { id: 'asc' },
        }),
        db.equipmentAssetPhysicalEvent.findMany({
          where: { companyId: f.companyId },
          orderBy: { id: 'asc' },
        }),
        db.equipmentAssetCustody.findMany({
          where: { companyId: f.companyId },
          orderBy: { id: 'asc' },
        }),
      ]),
    );
  }
  it('39→41 migration preserves every historical field and defaults all eight combinations to UNVERIFIED/0', async () => {
    const historical = JSON.parse(
      process.env.EQUIPMENT_PHYSICAL_HISTORICAL_FIXTURES!,
    ) as {
      companyId: string;
      productId: string;
      assets: Record<string, unknown>[];
    };
    const rows = await db.$queryRaw<{ row: Record<string, unknown> }[]>(
      Prisma.sql`SELECT row_to_json(a) AS row FROM "EquipmentAsset" a WHERE "companyId"=${historical.companyId} ORDER BY "id"`,
    );
    expect(rows).toHaveLength(8);
    for (let i = 0; i < rows.length; i++) {
      const { physicalLocation, physicalRevision, activeCustodyId, ...before } =
        rows[i].row;
      expect(before).toEqual(historical.assets[i]);
      expect({ physicalLocation, physicalRevision, activeCustodyId }).toEqual({
        physicalLocation: 'UNVERIFIED',
        physicalRevision: 0,
        activeCustodyId: null,
      });
    }
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: historical.companyId },
      }),
    ).toBe(0);
    expect(
      await db.equipmentAssetCustody.count({
        where: { companyId: historical.companyId },
      }),
    ).toBe(0);
    expect(
      (
        await db.product.findUniqueOrThrow({
          where: { id: historical.productId },
        })
      ).stock,
    ).toBe(13);
    expect(
      await db.healthcareEquipmentAssignment.count({
        where: { companyId: historical.companyId, lifecycle: 'RESERVED' },
      }),
    ).toBe(1);
    expect(
      await db.healthcareCaseKit.count({
        where: { companyId: historical.companyId, status: 'PREPARED' },
      }),
    ).toBe(1);
    expect(
      await db.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND migration_name < '20261015000200'`,
    ).toEqual([{ count: 41n }]);
  });
  it('defers coherent open/close ordering but rejects an open episode without pointer at COMMIT', async () => {
    const f = await fixture();
    await expect(
      db.$transaction((tx) =>
        tx.equipmentAssetCustody.create({ data: custodyData(f) }),
      ),
    ).rejects.toThrow();
    const e = await db.$transaction((tx) => open(tx, f));
    await db.$transaction(async (tx) => {
      // Pointer first, episode second: structural validation is deferred, not workflow.
      await tx.equipmentAsset.update({
        where: { id: f.asset.id },
        data: { physicalLocation: 'WAREHOUSE', activeCustodyId: null },
      });
      await tx.equipmentAssetCustody.update({
        where: { id: e.id },
        data: { closedAt: new Date(Date.now() + 1000), closedById: f.actorId },
      });
    });
    expect(
      (await db.equipmentAsset.findUniqueOrThrow({ where: { id: f.asset.id } }))
        .activeCustodyId,
    ).toBeNull();
  });
  it('pointer to a closed episode fails only at structural commit', async () => {
    const f = await fixture();
    await expect(
      db.$transaction(async (tx) => {
        const e = await tx.equipmentAssetCustody.create({
          data: {
            ...custodyData(f),
            closedAt: new Date(Date.now() + 1000),
            closedById: f.actorId,
          },
        });
        await tx.equipmentAsset.update({
          where: { id: f.asset.id },
          data: { physicalLocation: 'CUSTODY', activeCustodyId: e.id },
        });
        return 'statements succeeded';
      }),
    ).rejects.toThrow();
    expect(
      await db.equipmentAssetCustody.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
  });
  it.each(['asset', 'case', 'assignment', 'actor'] as const)(
    'rejects cross-Company %s custody FK',
    async (kind) => {
      const f = await fixture(),
        foreign = await fixture();
      const data = custodyData(f);
      if (kind === 'asset') data.equipmentAssetId = foreign.asset.id;
      if (kind === 'case') data.caseId = foreign.caseId;
      if (kind === 'assignment') data.assignmentId = foreign.assignmentId;
      if (kind === 'actor') data.openedById = foreign.actorId;
      await expect(
        db.equipmentAssetCustody.create({ data }),
      ).rejects.toMatchObject({ code: 'P2003' });
    },
  );
  it('rejects pointer to another Asset and Company and enforces local pointer CHECK', async () => {
    const f = await fixture(),
      g = await fixture();
    const e = await db.$transaction((tx) => open(tx, g));
    await expect(
      db.equipmentAsset.update({
        where: { id: f.asset.id },
        data: { physicalLocation: 'CUSTODY', activeCustodyId: e.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.equipmentAsset.update({
        where: { id: f.asset.id },
        data: { physicalLocation: 'CUSTODY' },
      }),
    ).rejects.toThrow();
    await expect(
      db.equipmentAsset.update({
        where: { id: f.asset.id },
        data: { physicalLocation: 'WAREHOUSE', activeCustodyId: e.id },
      }),
    ).rejects.toThrow();
  });
  it('allows CUSTODY + DAMAGED without erasing physical custody', async () => {
    const f = await fixture(),
      e = await db.$transaction((tx) => open(tx, f));
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { condition: 'DAMAGED' },
    });
    expect(
      await db.equipmentAsset.findUniqueOrThrow({ where: { id: f.asset.id } }),
    ).toMatchObject({
      physicalLocation: 'CUSTODY',
      activeCustodyId: e.id,
      condition: 'DAMAGED',
    });
  });
  it('two independent open-custody inserts arbitrate through the partial UNIQUE index', async () => {
    const f = await fixture(),
      held = barrier(),
      release = barrier(),
      started = barrier();
    let pid = 0;
    const first = db.$transaction(
      async (tx) => {
        const e = await open(tx, f);
        held.release();
        await release.promise;
        return e;
      },
      { timeout: 20000 },
    );
    await held.promise;
    const second = other
      .$transaction(
        async (tx) => {
          pid = (
            await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`
          )[0].pid;
          started.release();
          return tx.equipmentAssetCustody.create({ data: custodyData(f) });
        },
        { timeout: 20000 },
      )
      .then(
        () => null,
        (e: unknown) => e,
      );
    try {
      await started.promise;
      await blocked(pid);
    } finally {
      release.release();
    }
    await first;
    expect(await second).toMatchObject({ code: 'P2002' });
    expect(
      await db.equipmentAssetCustody.count({
        where: { companyId: f.companyId, closedAt: null },
      }),
    ).toBe(1);
  });
  it.each(['origin', 'revision'] as const)(
    'concurrent duplicate event %s has one durable winner',
    async (kind) => {
      const f = await fixture(),
        held = barrier(),
        release = barrier(),
        started = barrier(),
        origin = randomUUID();
      let pid = 0;
      const first = db.$transaction(
        async (tx) => {
          await tx.equipmentAssetPhysicalEvent.create({
            data: eventData(f, origin),
          });
          held.release();
          await release.promise;
        },
        { timeout: 20000 },
      );
      await held.promise;
      const second = other
        .$transaction(
          async (tx) => {
            pid = (
              await tx.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`
            )[0].pid;
            started.release();
            return tx.equipmentAssetPhysicalEvent.create({
              data: eventData(
                f,
                kind === 'origin' ? origin : randomUUID(),
                kind === 'origin' ? 1 : 0,
              ),
            });
          },
          { timeout: 20000 },
        )
        .then(
          () => null,
          (e: unknown) => e,
        );
      try {
        await started.promise;
        await blocked(pid);
      } finally {
        release.release();
      }
      await first;
      expect(await second).toMatchObject({ code: 'P2002' });
      expect(
        await db.equipmentAssetPhysicalEvent.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(1);
    },
  );
  it('concurrent baseline waits on HC lock, then replays exactly one transition/event', async () => {
    const f = await fixture(),
      held = barrier(),
      release = barrier(),
      started = barrier();
    let pid = 0;
    const slow: EquipmentBaselineEvidenceAdapter = {
      accept: async (c, hash, mode) => {
        held.release();
        await release.promise;
        return accept.accept(c, hash, mode);
      },
    };
    const first = new EquipmentPhysicalBaselineService(db, slow).reconcile(
      f.command,
    );
    await held.promise;
    const observed = {
      $transaction: (
        fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options: {
          maxWait: number;
          timeout: number;
          isolationLevel: Prisma.TransactionIsolationLevel;
        },
      ) =>
        other.$transaction(async (tx) => {
          pid = (
            await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`
          )[0].pid;
          started.release();
          return fn(tx);
        }, options),
    };
    const second = new EquipmentPhysicalBaselineService(
      observed as unknown as PrismaClient,
      accept,
    ).reconcile(f.command);
    try {
      await started.promise;
      await blocked(pid);
    } finally {
      release.release();
    }
    expect((await first).outcome).toBe('APPLIED');
    expect((await second).outcome).toBe('REPLAY');
    expect(
      (await db.equipmentAsset.findUniqueOrThrow({ where: { id: f.asset.id } }))
        .physicalRevision,
    ).toBe(1);
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it('baseline without evidence/stale revision/foreign Company never writes', async () => {
    const f = await fixture(),
      before = await snapshot(f);
    await expect(
      new EquipmentPhysicalBaselineService(db).reconcile(f.command),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_EVIDENCE_REQUIRED');
    await expect(
      new EquipmentPhysicalBaselineService(db, accept).reconcile({
        ...f.command,
        expectedPhysicalRevision: 1,
      }),
    ).rejects.toThrow('RESOURCE_STATE_CHANGED');
    await expect(
      new EquipmentPhysicalBaselineService(db, accept).reconcile({
        ...f.command,
        companyId: randomUUID(),
      }),
    ).rejects.toThrow('EQUIPMENT_ASSET_NOT_FOUND');
    expect(await snapshot(f)).toBe(before);
  });
  it('baseline records nullable actor with operator proof, preserves condition/lifecycle and replays history', async () => {
    const f = await fixture();
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { condition: 'DAMAGED', lifecycle: 'RETIRED' },
    });
    const service = new EquipmentPhysicalBaselineService(db, accept),
      first = await service.reconcile(f.command);
    expect(first.event).toMatchObject({
      actorId: null,
      conditionBefore: 'DAMAGED',
      conditionAfter: 'DAMAGED',
      lifecycleBefore: 'RETIRED',
      lifecycleAfter: 'RETIRED',
      revisionBefore: 0,
      revisionAfter: 1,
    });
    // 01E-B legacy condition wiring deliberately remains outside A.
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { condition: 'OUT_OF_SERVICE' },
    });
    const before = await snapshot(f);
    expect((await service.reconcile(f.command)).outcome).toBe('REPLAY');
    expect(await snapshot(f)).toBe(before);
    await expect(
      service.reconcile({ ...f.command, evidenceHash: 'b'.repeat(64) }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    const invalid: EquipmentBaselineEvidenceAdapter = {
      accept: (c, hash) =>
        Promise.resolve({
          requestHash: hash,
          evidenceHash: c.evidenceHash,
          operatorIdentity: c.operatorIdentity,
          warehousePresenceVerified: false,
        }),
    };
    await expect(
      new EquipmentPhysicalBaselineService(db, invalid).reconcile(f.command),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_EVIDENCE_INVALID');
  });
  it('fault after CAS before event append rolls back state and timestamp', async () => {
    const f = await fixture(),
      before = await snapshot(f);
    class Fault extends EquipmentPhysicalRepository {
      override appendPhysicalEvent(): never {
        throw new Error('fixture fault');
      }
    }
    await expect(
      new EquipmentPhysicalBaselineService(
        db,
        accept,
        undefined,
        new Fault(),
      ).reconcile(f.command),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR');
    expect(await snapshot(f)).toBe(before);
  });
  it('event CHECKs reject gaps, invalid hashes/actor, and UPDATE/DELETE are append-only', async () => {
    const f = await fixture();
    await expect(
      db.equipmentAssetPhysicalEvent.create({
        data: { ...eventData(f), revisionAfter: 2 },
      }),
    ).rejects.toThrow();
    await expect(
      db.equipmentAssetPhysicalEvent.create({
        data: { ...eventData(f), requestHash: 'INVALID' },
      }),
    ).rejects.toThrow();
    await expect(
      db.equipmentAssetPhysicalEvent.create({
        data: { ...eventData(f), operation: 'RECEIPT_INITIALIZATION' },
      }),
    ).rejects.toThrow();
    const e = await db.equipmentAssetPhysicalEvent.create({
      data: eventData(f),
    });
    await expect(
      db.equipmentAssetPhysicalEvent.update({
        where: { id: e.id },
        data: { reason: 'rewrite' },
      }),
    ).rejects.toThrow();
    await expect(
      db.equipmentAssetPhysicalEvent.delete({ where: { id: e.id } }),
    ).rejects.toThrow();
    expect(
      (
        await db.equipmentAssetPhysicalEvent.findUniqueOrThrow({
          where: { id: e.id },
        })
      ).reason,
    ).toBeNull();
  });

  function receipts(client = db, equipment?: EquipmentProvisioningService) {
    const equip =
      equipment ??
      new EquipmentProvisioningService(
        new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
      );
    const repo = new PhysicalInventoryRepository(),
      physical = new PhysicalInventoryService(repo);
    const authority = new InventoryAuthorityTransactionService(
      client as PrismaService,
      new InventoryAuthorityResolver(),
      new InventoryRuntimeCompatibilityService(),
    );
    return new PurchaseReceiptsService(
      client as PrismaService,
      equip,
      authority,
      new ReceiptPhysicalIntegrationService(
        repo,
        physical,
        new InventoryCompatibilityProjectionService(),
        new InventoryCompatibilityHistoryService(),
        equip,
      ),
    );
  }
  async function purchase(f: Fixture) {
    const supplier = await db.supplier.create({
      data: { companyId: f.companyId, name: 'Fixture supplier' },
    });
    const quantity = await db.product.create({
      data: {
        companyId: f.companyId,
        sku: randomUUID(),
        name: 'QUANTITY',
        inventoryTracking: 'QUANTITY',
        lotTracking: 'NONE',
      },
    });
    const p = await db.purchase.create({
      data: {
        companyId: f.companyId,
        supplierId: supplier.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 5,
        iva: 0,
        total: 5,
        items: {
          create: [
            { productId: f.product.id, quantity: 2, price: 1, subtotal: 2 },
            { productId: quantity.id, quantity: 3, price: 1, subtotal: 3 },
          ],
        },
      },
      include: { items: true },
    });
    const dto = {
      purchaseId: p.id,
      items: p.items.map((i) => ({
        purchaseItemId: i.id,
        quantityReceived: i.quantity,
      })),
    };
    return { p, dto, quantity };
  }
  it('mixed Receipt initializes two Assets/events once, keeps QUANTITY behavior and historical replay zero-write', async () => {
    const f = await fixture(),
      { dto, quantity } = await purchase(f),
      service = receipts();
    const first = await service.create(
      f.companyId,
      f.actorId,
      'receipt-key',
      dto,
    );
    const assets = await db.equipmentAsset.findMany({
      where: { companyId: f.companyId, purchaseReceiptItemId: { not: null } },
    });
    expect(assets).toHaveLength(2);
    for (const a of assets)
      expect(a).toMatchObject({
        physicalLocation: 'WAREHOUSE',
        physicalRevision: 1,
        activeCustodyId: null,
        condition: 'INSPECTION_PENDING',
        lifecycle: 'ACTIVE',
      });
    const events = await db.equipmentAssetPhysicalEvent.findMany({
      where: { companyId: f.companyId },
    });
    expect(events).toHaveLength(2);
    for (const e of events)
      expect(e).toMatchObject({
        operation: 'RECEIPT_INITIALIZATION',
        actorId: f.actorId,
        revisionBefore: 0,
        revisionAfter: 1,
        physicalLocationBefore: 'UNVERIFIED',
        physicalLocationAfter: 'WAREHOUSE',
      });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: quantity.id } }))
        .stock,
    ).toBe(3);
    expect(
      await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
    ).toBe(2);
    const before = await snapshot(f);
    expect(
      (await service.create(f.companyId, f.actorId, 'receipt-key', dto)).id,
    ).toBe(first.id);
    expect(await snapshot(f)).toBe(before);
  });
  it('old Receipt replay never retroactively provisions Assets or physical events', async () => {
    const f = await fixture(),
      { p, dto } = await purchase(f);
    const receipt = await db.purchaseReceipt.create({
      data: {
        companyId: f.companyId,
        purchaseId: p.id,
        folio: randomUUID(),
        receivedBy: f.actorId,
        items: {
          create: p.items.map((i) => ({
            companyId: f.companyId,
            purchaseItemId: i.id,
            productId: i.productId,
            quantityReceived: i.quantity,
            unitCost: 1,
          })),
        },
      },
    });
    await db.idempotencyRecord.create({
      data: {
        companyId: f.companyId,
        scope: 'PURCHASE_RECEIPT_CREATE',
        key: 'historical',
        requestHash: createPurchaseReceiptRequestHash(dto),
        resourceId: receipt.id,
      },
    });
    const before = await snapshot(f);
    expect(
      (await receipts().create(f.companyId, f.actorId, 'historical', dto)).id,
    ).toBe(receipt.id);
    expect(await snapshot(f)).toBe(before);
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
  });
  it('failure after Receipt Asset/event reverses Receipt, identities, event, stock and claim atomically', async () => {
    const f = await fixture(),
      { p, dto, quantity } = await purchase(f),
      before = await snapshot(f);
    class Fault extends EquipmentProvisioningService {
      override async provisionFromPurchaseReceiptItem(
        ...args: Parameters<
          EquipmentProvisioningService['provisionFromPurchaseReceiptItem']
        >
      ): Promise<EquipmentAsset[]> {
        await super.provisionFromPurchaseReceiptItem(...args);
        throw new Error('isolated fault after Asset/event');
      }
    }
    const faulty = new Fault(
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
    );
    await expect(
      receipts(db, faulty).create(f.companyId, f.actorId, 'fault', dto),
    ).rejects.toThrow();
    expect(await snapshot(f)).toBe(before);
    expect(
      await db.purchaseReceipt.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
    expect(
      await db.idempotencyRecord.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: quantity.id } }))
        .stock,
    ).toBe(0);
    expect(
      (await db.purchase.findUniqueOrThrow({ where: { id: p.id } })).status,
    ).toBe('CONFIRMED');
  });
  it('new ASSET Receipt without actor rolls back without fake User', async () => {
    const f = await fixture(),
      { dto } = await purchase(f),
      before = await snapshot(f);
    await expect(
      receipts().create(f.companyId, undefined, 'no-actor', dto),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_ACTOR_INVALID');
    expect(await snapshot(f)).toBe(before);
    expect(
      await db.purchaseReceipt.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
  });
  it('Receipt finishes while an independent transaction holds HC Company lock: no lock inversion', async () => {
    const f = await fixture(),
      { dto } = await purchase(f),
      held = barrier(),
      release = barrier();
    const keeper = db.$transaction(
      async (tx) => {
        await acquireHealthcareCompanyLock(tx, f.companyId, {
          acquisitionTimeoutMs: 1000,
        });
        held.release();
        await release.promise;
      },
      { timeout: 20000 },
    );
    await held.promise;
    try {
      await receipts(other).create(f.companyId, f.actorId, 'no-hc-lock', dto);
    } finally {
      release.release();
    }
    await keeper;
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(2);
  });
  it('manual create stays UNVERIFIED/0 and public Equipment queries omit physical internals', async () => {
    const f = await fixture(),
      service = new EquipmentService(
        db as PrismaService,
        new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
      );
    const created = await service.create(f.companyId, {
      productId: f.product.id,
      condition: 'GOOD',
    });
    expect(created).not.toHaveProperty('physicalLocation');
    expect(created).not.toHaveProperty('physicalRevision');
    expect(created).not.toHaveProperty('activeCustodyId');
    const stored = await db.equipmentAsset.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored).toMatchObject({
      physicalLocation: 'UNVERIFIED',
      physicalRevision: 0,
      activeCustodyId: null,
    });
    for (const row of await service.findAll(f.companyId))
      expect(row).not.toHaveProperty('physicalLocation');
    expect(await service.findOne(f.companyId, created.id)).not.toHaveProperty(
      'physicalRevision',
    );
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
  });
});
