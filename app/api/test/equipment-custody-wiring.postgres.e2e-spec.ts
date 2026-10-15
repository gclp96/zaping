import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { PurchaseReceiptsService } from '../src/purchases-receipts/purchases-receipts.service';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { EquipmentService } from '../src/equipment/equipment.service';
import { EquipmentAvailabilityService } from '../src/equipment/equipment-availability.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';
import { EquipmentPhysicalRepository } from '../src/equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../src/equipment/equipment-physical-history.service';
import { EquipmentPhysicalBaselineService } from '../src/equipment/equipment-physical-baseline.service';
import { EquipmentCustodyService } from '../src/equipment/equipment-custody.service';
import {
  EquipmentCustodyCommand,
  EquipmentCustodyContextAdapter,
  EquipmentCustodyContextRegistry,
} from '../src/equipment/equipment-custody-context.registry';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { applyHealthcareSubsequentTransactionTimeouts } from '../src/healthcare/common/healthcare-subsequent-transaction-timeouts';
import { HealthcareEquipmentAssignmentsRepository } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { createHealthcareEquipmentAssignmentRequestHash } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignment-request-hash';
import { HealthcareEquipmentCoverageService } from '../src/healthcare/equipment-assignments/healthcare-equipment-coverage.service';
import { HealthcareCaseKitsRepository } from '../src/healthcare/case-kits/healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from '../src/healthcare/case-kits/healthcare-case-kits.service';
import { HealthcareCaseKitItemSourceType } from '../src/healthcare/case-kits/dto/add-healthcare-case-kit-item.dto';

jest.setTimeout(30000);
const suite =
  process.env.RUN_EQUIPMENT_CUSTODY_POSTGRES === '1' ? describe : describe.skip;
suite('01E-B new isolated PostgreSQL cross-domain acceptance', () => {
  let db: PrismaClient, other: PrismaClient;
  const policy = healthcareCompanyTransactionTimeoutConfiguration();
  const repository = new EquipmentPhysicalRepository();
  const history = new EquipmentPhysicalHistoryService(repository);
  // Test-only retained evidence. No adapter is registered in the application.
  const evidence = new Map<string, Omit<EquipmentCustodyCommand, 'actorId'>>();
  const adapter: EquipmentCustodyContextAdapter = {
    key: 'ISOLATED_TEST',
    originType: 'ISOLATED_TEST_HANDOFF',
    originOperation: 'OPEN',
    validate: async (_tx, c, requestHash) => {
      const owner = await _tx.healthcareCase.findFirst({
        where: { id: c.caseId, companyId: c.companyId },
        select: { id: true },
      });
      if (!owner) throw new Error('Foreign test context');
      const saved = evidence.get(c.validatedContext.contextId);
      if (!saved || JSON.stringify(saved) !== JSON.stringify(withoutActor(c)))
        throw new Error('Invalid retained test context');
      return {
        companyId: c.companyId,
        assetId: c.assetId,
        caseId: c.caseId,
        assignmentId: c.assignmentId,
        contextId: c.validatedContext.contextId,
        originId: c.durableOrigin.id,
        requestHash,
      };
    },
  };
  const custody = new EquipmentCustodyService(
    repository,
    history,
    new EquipmentCustodyContextRegistry([adapter]),
  );
  function withoutActor(c: EquipmentCustodyCommand) {
    return {
      companyId: c.companyId,
      assetId: c.assetId,
      caseId: c.caseId,
      assignmentId: c.assignmentId,
      expectedPhysicalRevision: c.expectedPhysicalRevision,
      validatedContext: c.validatedContext,
      durableOrigin: c.durableOrigin,
    };
  }
  beforeAll(async () => {
    const url = new URL(process.env.EQUIPMENT_CUSTODY_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_equipment_custody_test' ||
      url.username !== 'equipment_custody_test' ||
      !process.env.EQUIPMENT_CUSTODY_TEST_RUN
    )
      throw new Error('Unverified isolated target');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    await other.$connect();
    const [role] = await db.$queryRaw<
      { rolsuper: boolean }[]
    >`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`;
    expect(role.rolsuper).toBe(false);
  });
  afterAll(async () => {
    await db?.$disconnect();
    await other?.$disconnect();
  });
  const prisma = (client: PrismaClient) => client as PrismaService;
  const assignments = (client = db) =>
    new HealthcareEquipmentAssignmentsService(
      new HealthcareEquipmentAssignmentsRepository(prisma(client)),
      policy,
    );
  const equipment = (client = db, repo = repository) =>
    new EquipmentService(
      prisma(client),
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
      repo,
      new EquipmentPhysicalHistoryService(repo),
      policy,
    );
  async function fixture(accredited = true) {
    const company = await db.company.create({
      data: { name: '01E-B isolated', rfc: randomUUID() },
    });
    const companyId = company.id;
    const actor = await db.user.create({
      data: {
        companyId,
        firstName: 'Test',
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
        title: 'Test',
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-11-01T10:00:00Z'),
        scheduledEnd: new Date('2026-11-01T12:00:00Z'),
        createdById: actor.id,
      },
    });
    const a = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId,
        caseId: c.id,
        equipmentAssetId: asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Test only',
        createdById: actor.id,
      },
    });
    const f = {
      companyId,
      actorId: actor.id,
      product,
      asset,
      caseId: c.id,
      assignmentId: a.id,
    };
    if (accredited) await accredit(f);
    return f;
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function accredit(f: Fixture) {
    await new EquipmentPhysicalBaselineService(db, {
      accept: (c, requestHash) =>
        Promise.resolve({
          requestHash,
          evidenceHash: c.evidenceHash,
          operatorIdentity: c.operatorIdentity,
          warehousePresenceVerified: true,
        }),
    }).reconcile({
      companyId: f.companyId,
      assetId: f.asset.id,
      reconciliationId: randomUUID(),
      expectedPhysicalRevision: 0,
      targetPhysicalLocation: 'WAREHOUSE',
      operatorIdentity: 'TEST-ONLY',
      evidenceReference: 'fixture://' + f.asset.id,
      evidenceHash: 'a'.repeat(64),
    });
  }
  function command(f: Fixture, change: Partial<EquipmentCustodyCommand> = {}) {
    const c: EquipmentCustodyCommand = {
      companyId: f.companyId,
      assetId: f.asset.id,
      caseId: f.caseId,
      assignmentId: f.assignmentId,
      expectedPhysicalRevision: 1,
      actorId: f.actorId,
      validatedContext: { adapterKey: adapter.key, contextId: randomUUID() },
      durableOrigin: {
        type: adapter.originType,
        id: randomUUID(),
        operation: adapter.originOperation,
      },
      ...change,
    };
    evidence.set(c.validatedContext.contextId, withoutActor(c));
    return c;
  }
  function claim(
    client: PrismaClient,
    c: EquipmentCustodyCommand,
    service = custody,
  ) {
    return client.$transaction(
      async (tx) => {
        await acquireHealthcareCompanyLock(tx, c.companyId, {
          acquisitionTimeoutMs: policy.companyLockAcquisitionTimeoutMs,
        });
        await applyHealthcareSubsequentTransactionTimeouts(tx, policy);
        return service.transferToCustody(tx, c);
      },
      {
        maxWait: policy.prismaMaxWaitMs,
        timeout: policy.prismaTransactionTimeoutMs,
      },
    );
  }
  const state = (f: Fixture) =>
    db.equipmentAsset.findUniqueOrThrow({ where: { id: f.asset.id } });
  const events = (f: Fixture) =>
    db.equipmentAssetPhysicalEvent.findMany({
      where: { companyId: f.companyId, equipmentAssetId: f.asset.id },
      orderBy: { revisionAfter: 'asc' },
    });
  async function snapshot(f: Fixture) {
    return JSON.stringify({
      asset: await state(f),
      events: await events(f),
      custody: await db.equipmentAssetCustody.findMany({
        where: { companyId: f.companyId },
      }),
      inspections: await db.equipmentInspection.findMany({
        where: { companyId: f.companyId },
      }),
    });
  }
  async function reserve(client: PrismaClient, f: Fixture, key = randomUUID()) {
    return assignments(client).create(f.companyId, f.actorId, key, {
      caseId: f.caseId,
      equipmentAssetId: f.asset.id,
      directAssignmentReason: 'Test reservation',
    });
  }
  async function newCase(f: Fixture) {
    return db.healthcareCase.create({
      data: {
        companyId: f.companyId,
        folio: randomUUID(),
        title: 'Other',
        scheduledStart: new Date('2026-11-03T10:00:00Z'),
        scheduledEnd: new Date('2026-11-03T12:00:00Z'),
        createdById: f.actorId,
      },
    });
  }
  async function target(f: Fixture) {
    const asset = await db.equipmentAsset.create({
      data: {
        companyId: f.companyId,
        productId: f.product.id,
        assetCode: randomUUID(),
        condition: 'GOOD',
      },
    });
    const result = { ...f, asset };
    await accredit(result);
    return result;
  }
  const replace = (client: PrismaClient, f: Fixture, b: Fixture) =>
    assignments(client).replace(
      f.companyId,
      f.actorId,
      f.assignmentId,
      randomUUID(),
      { equipmentAssetId: b.asset.id, replacementReason: 'Test replacement' },
    );
  const inspect = (
    client: PrismaClient,
    f: Fixture,
    conditionAfter: 'GOOD' | 'DAMAGED' = 'DAMAGED',
  ) =>
    equipment(client).createInspection(f.companyId, f.actorId, f.asset.id, {
      conditionAfter,
    });
  const retire = (client: PrismaClient, f: Fixture) =>
    equipment(client).retire(f.companyId, f.actorId, f.asset.id, {
      retiredReason: 'END_OF_LIFE',
    });
  function signal<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  // Hooks delay commit only. The second connection must demonstrably block in PG.
  async function race<A, B>(
    first: (client: PrismaClient) => Promise<A>,
    second: (client: PrismaClient) => Promise<B>,
    observeFirst?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    const held = signal(),
      release = signal(),
      pid = signal<number>();
    const wrap = (base: PrismaClient, hold: boolean) =>
      new Proxy(base, {
        get(obj, key) {
          if (key === '$transaction')
            return (
              cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
              options: object,
            ) =>
              obj.$transaction(async (tx) => {
                if (!hold) {
                  const [row] = await tx.$queryRaw<
                    { pid: number }[]
                  >`SELECT pg_backend_pid() AS pid`;
                  pid.resolve(row.pid);
                }
                const result = await cb(tx);
                if (hold) {
                  await observeFirst?.(tx);
                  held.resolve();
                  await release.promise;
                }
                return result;
              }, options);
          const value: unknown = Reflect.get(obj, key);
          return typeof value === 'function'
            ? (value.bind(obj) as unknown)
            : value;
        },
      });
    const a = first(wrap(db, true));
    const safeA = a.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await Promise.race([
      held.promise,
      a.then(() => {
        throw new Error('First transaction not held');
      }),
    ]);
    const b = second(wrap(other, false));
    const safeB = b.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      const backend = await pid.promise;
      let observed = false;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const [r] = await db.$queryRaw<
          { blocked: boolean }[]
        >`SELECT cardinality(pg_blocking_pids(${backend}::int))>0 AS blocked`;
        if (r.blocked) {
          observed = true;
          break;
        }
        await new Promise<void>((r) => setImmediate(r));
      }
      expect(observed).toBe(true);
    } finally {
      release.resolve();
    }
    return [await safeA, await safeB] as const;
  }
  function succeeds(result: object) {
    expect(result).toHaveProperty('value');
  }
  function fails(result: object) {
    expect(result).toHaveProperty('error');
  }

  it('1 custody wins: waiting reservation rejects without writes', async () => {
    const f = await fixture(),
      c = command(f),
      next = { ...f, caseId: (await newCase(f)).id };
    const [a, b] = await race(
      (client) => claim(client, c),
      (client) => reserve(client, next),
    );
    succeeds(a);
    fails(b);
    expect(
      await db.healthcareEquipmentAssignment.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it('2 reservation wins: exact new reservation is revalidated before custody', async () => {
    const f = await fixture(),
      next = { ...f, caseId: (await newCase(f)).id };
    let c: EquipmentCustodyCommand;
    const [a, b] = await race(
      (client) => reserve(client, next),
      (client) => claim(client, c),
      async (tx) => {
        const a = await tx.healthcareEquipmentAssignment.findFirstOrThrow({
          where: {
            companyId: f.companyId,
            caseId: next.caseId,
            equipmentAssetId: f.asset.id,
          },
        });
        c = command(next, { assignmentId: a.id });
      },
    );
    succeeds(a);
    succeeds(b);
    expect((await state(f)).physicalLocation).toBe('CUSTODY');
  });
  it('3 Replace wins: claim using replaced source rejects', async () => {
    const f = await fixture(),
      b = await target(f),
      c = command(f);
    const [a, z] = await race(
      (client) => replace(client, f, b),
      (client) => claim(client, c),
    );
    succeeds(a);
    fails(z);
    expect((await state(f)).physicalLocation).toBe('WAREHOUSE');
  });
  it('4 claim wins: Replace preserves source custody and revision', async () => {
    const f = await fixture(),
      b = await target(f),
      c = command(f);
    const [a, z] = await race(
      (client) => claim(client, c),
      (client) => replace(client, f, b),
    );
    succeeds(a);
    succeeds(z);
    expect(await state(f)).toMatchObject({
      physicalLocation: 'CUSTODY',
      physicalRevision: 2,
    });
    expect((await events(f)).map((e) => e.operation)).toEqual([
      'BASELINE_RECONCILIATION',
      'CUSTODY_OPEN',
    ]);
  });
  it('5 two concurrent claims produce exactly one episode/event', async () => {
    const f = await fixture(),
      a = command(f),
      b = command(f);
    const [x, y] = await race(
      (client) => claim(client, a),
      (client) => claim(client, b),
    );
    succeeds(x);
    fails(y);
    expect(
      await db.equipmentAssetCustody.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
    expect(
      (await events(f)).filter((e) => e.operation === 'CUSTODY_OPEN'),
    ).toHaveLength(1);
  });
  it('6 stale physicalRevision fails with zero writes', async () => {
    const f = await fixture(),
      before = await snapshot(f);
    await expect(
      claim(db, command(f, { expectedPhysicalRevision: 0 })),
    ).rejects.toThrow('RESOURCE_STATE_CHANGED');
    expect(await snapshot(f)).toBe(before);
  });
  it('7 Inspection DAMAGED wins before claim', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => inspect(client, f),
      (client) => claim(client, c),
    );
    succeeds(a);
    fails(b);
    expect(await state(f)).toMatchObject({
      condition: 'DAMAGED',
      physicalRevision: 2,
      physicalLocation: 'WAREHOUSE',
    });
  });
  it('8 Retirement wins before claim', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => retire(client, f),
      (client) => claim(client, c),
    );
    succeeds(a);
    fails(b);
    expect(await state(f)).toMatchObject({
      lifecycle: 'RETIRED',
      physicalRevision: 2,
      physicalLocation: 'WAREHOUSE',
    });
  });
  it('9 claim wins: waiting Inspection preserves episode/pointer', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => claim(client, c),
      (client) => inspect(client, f),
    );
    succeeds(a);
    succeeds(b);
    const asset = await state(f);
    expect(asset).toMatchObject({
      condition: 'DAMAGED',
      physicalLocation: 'CUSTODY',
      physicalRevision: 3,
    });
    expect((await events(f))[2]).toMatchObject({
      operation: 'CONDITION_CHANGE',
      custodyId: asset.activeCustodyId,
    });
  });
  it('10 Replace source already CUSTODY leaves all physical evidence unchanged', async () => {
    const f = await fixture(),
      b = await target(f);
    await claim(db, command(f));
    const before = await snapshot(f);
    await replace(db, f, b);
    expect(await snapshot(f)).toBe(before);
  });
  it('11 B becomes CUSTODY while Replace waits: authoritative reread rejects', async () => {
    const f = await fixture(),
      b = await target(f),
      c = await newCase(f);
    const a = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId: f.companyId,
        caseId: c.id,
        equipmentAssetId: b.asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Target claim',
        createdById: f.actorId,
      },
    });
    const [x, y] = await race(
      (client) =>
        claim(client, command(b, { caseId: c.id, assignmentId: a.id })),
      (client) => replace(client, f, b),
    );
    succeeds(x);
    fails(y);
    expect(
      (
        await db.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: f.assignmentId },
        })
      ).lifecycle,
    ).toBe('RESERVED');
  });
  it('12 response lost: fresh replay after Inspection/Replace is zero-write with original actor', async () => {
    const f = await fixture(),
      b = await target(f),
      c = command(f),
      opened = await claim(db, c);
    await inspect(db, f);
    await replace(db, f, b);
    const actor = await db.user.create({
      data: {
        companyId: f.companyId,
        firstName: 'Retry',
        lastName: 'Only',
        email: randomUUID() + '@example.invalid',
        passwordHash: 'TEST',
        role: 'WAREHOUSE',
      },
    });
    const before = await snapshot(f),
      replay = await claim(other, { ...c, actorId: actor.id });
    expect(replay.outcome).toBe('REPLAY');
    expect(replay.event.actorId).toBe(f.actorId);
    expect(replay.custody.id).toBe(opened.custody.id);
    expect(await snapshot(f)).toBe(before);
  });
  it('13 same origin with changed payload rejects', async () => {
    const f = await fixture(),
      c = command(f);
    await claim(db, c);
    const before = await snapshot(f);
    await expect(
      claim(db, { ...c, expectedPhysicalRevision: 2 }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(await snapshot(f)).toBe(before);
  });
  it('14 append failure rolls back episode, pointer, revision and event', async () => {
    const f = await fixture(),
      before = await snapshot(f);
    class Fault extends EquipmentPhysicalRepository {
      override appendPhysicalEvent(): never {
        throw new Error('injected');
      }
    }
    const service = new EquipmentCustodyService(
      new Fault(),
      history,
      new EquipmentCustodyContextRegistry([adapter]),
    );
    await expect(claim(db, command(f), service)).rejects.toThrow(
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
    expect(await snapshot(f)).toBe(before);
  });
  it('15 real CaseKit PREPARED produces zero physical effects', async () => {
    const f = await fixture(),
      before = await snapshot(f),
      kits = new HealthcareCaseKitsService(
        new HealthcareCaseKitsRepository(prisma(db)),
        policy,
      );
    const kit = await kits.create(
      f.companyId,
      f.actorId,
      f.caseId,
      randomUUID(),
    );
    await kits.addItem(f.companyId, f.actorId, kit.data.id, randomUUID(), {
      sourceType: HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT,
      equipmentAssignmentId: f.assignmentId,
    });
    const prepared = await kits.confirmPreparation(
      f.companyId,
      f.actorId,
      kit.data.id,
      randomUUID(),
    );
    expect(prepared.data.status).toBe('PREPARED');
    expect(await snapshot(f)).toBe(before);
  });
  it('16 availability reader handles UNVERIFIED, warehouse health, retired and custody without exposing facts', async () => {
    const f = await fixture(false),
      reader = new EquipmentAvailabilityService(prisma(db));
    expect(
      (await reader.evaluateCurrent(f.companyId, f.asset.id)).reasons,
    ).toContain('PHYSICAL_LOCATION_UNVERIFIED');
    await accredit(f);
    expect(
      (await reader.evaluateCurrent(f.companyId, f.asset.id)).available,
    ).toBe(true);
    for (const conditionAfter of [
      'DAMAGED',
      'OUT_OF_SERVICE',
      'GOOD',
    ] as const) {
      await equipment().createInspection(f.companyId, f.actorId, f.asset.id, {
        conditionAfter,
      });
      expect(
        (await reader.evaluateCurrent(f.companyId, f.asset.id)).available,
      ).toBe(conditionAfter === 'GOOD');
    }
    const revision = (await state(f)).physicalRevision;
    await claim(db, command(f, { expectedPhysicalRevision: revision }));
    expect(
      (await reader.evaluateCurrent(f.companyId, f.asset.id)).reasons,
    ).toContain('EQUIPMENT_IN_CUSTODY');
    await retire(db, f);
    const result = await reader.evaluateCurrent(f.companyId, f.asset.id);
    expect(result.primaryReason).toBe('RETIRED');
    expect(Object.keys(result).sort()).toEqual([
      'available',
      'evaluatedAt',
      'primaryReason',
      'reasons',
    ]);
  });
  it('17 Coverage population/quantities remain unchanged for UNVERIFIED and CUSTODY', async () => {
    const f = await fixture(false),
      requirement = await db.healthcareCaseRequirement.create({
        data: {
          companyId: f.companyId,
          caseId: f.caseId,
          productId: f.product.id,
          requestedQty: 1,
          type: 'REQUIRED',
          sortOrder: 10,
          createdById: f.actorId,
        },
      });
    await db.healthcareEquipmentAssignment.update({
      where: { id: f.assignmentId },
      data: {
        origin: 'REQUIREMENT',
        requirementId: requirement.id,
        directAssignmentReason: null,
      },
    });
    const coverage = new HealthcareEquipmentCoverageService(
      new HealthcareEquipmentAssignmentsRepository(prisma(db)),
      assignments(),
    );
    const before = await coverage.findCoverage(f.companyId, f.caseId);
    await accredit(f);
    await claim(db, command(f));
    expect(await coverage.findCoverage(f.companyId, f.caseId)).toEqual(before);
  });
  it('18 receipt-created Warehouse/INSPECTION_PENDING unavailable until real Inspection', async () => {
    const f = await fixture(),
      { dto } = await purchase(f);
    await receipts().create(f.companyId, f.actorId, randomUUID(), dto);
    const asset = await db.equipmentAsset.findFirstOrThrow({
      where: { companyId: f.companyId, purchaseReceiptItemId: { not: null } },
    });
    const reader = new EquipmentAvailabilityService(prisma(db));
    expect(asset).toMatchObject({
      physicalLocation: 'WAREHOUSE',
      physicalRevision: 1,
      condition: 'INSPECTION_PENDING',
    });
    expect(
      (await reader.evaluateCurrent(f.companyId, asset.id)).available,
    ).toBe(false);
    await equipment().createInspection(f.companyId, f.actorId, asset.id, {
      conditionAfter: 'GOOD',
    });
    expect(
      (await reader.evaluateCurrent(f.companyId, asset.id)).available,
    ).toBe(true);
  });
  it('19 manual UNVERIFIED remains unavailable, Create and Replace reject even with override', async () => {
    const f = await fixture(),
      manual = await equipment().create(f.companyId, {
        productId: f.product.id,
        condition: 'GOOD',
      });
    const candidate = {
      ...f,
      asset: { ...f.asset, id: manual.id },
      caseId: (await newCase(f)).id,
    };
    expect(
      (
        await new EquipmentAvailabilityService(prisma(db)).evaluateCurrent(
          f.companyId,
          manual.id,
        )
      ).available,
    ).toBe(false);
    await expect(
      assignments().create(f.companyId, f.actorId, randomUUID(), {
        caseId: candidate.caseId,
        equipmentAssetId: manual.id,
        directAssignmentReason: 'Test',
        confirmConflictOverride: true,
        conflictOverrideReason: 'No bypass',
        conflictReviewFingerprint: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({
      response: { code: 'EQUIPMENT_ASSET_NOT_ELIGIBLE' },
    });
    await expect(replace(db, f, candidate)).rejects.toMatchObject({
      response: { code: 'EQUIPMENT_ASSET_NOT_ELIGIBLE' },
    });
  });
  it('20 tenant isolation: foreign asset/assignment/case cannot open custody', async () => {
    const f = await fixture(),
      foreign = await fixture(),
      before = await snapshot(f);
    for (const change of [
      { companyId: foreign.companyId, actorId: foreign.actorId },
      { assignmentId: foreign.assignmentId },
      { caseId: foreign.caseId },
    ])
      await expect(claim(db, command(f, change))).rejects.toThrow();
    expect(await snapshot(f)).toBe(before);
  });
  it('21 mixed Receipt keeps QUANTITY behavior independent of Equipment', async () => {
    const f = await fixture(),
      { dto, quantity } = await purchase(f);
    await receipts().create(f.companyId, f.actorId, randomUUID(), dto);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: quantity.id } }))
        .stock,
    ).toBe(3);
    expect(
      await db.equipmentAsset.count({ where: { productId: quantity.id } }),
    ).toBe(0);
  });
  it('22 custody wins: waiting Retirement preserves open authoritative episode', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => claim(client, c),
      (client) => retire(client, f),
    );
    succeeds(a);
    succeeds(b);
    const asset = await state(f);
    expect(asset).toMatchObject({
      lifecycle: 'RETIRED',
      physicalLocation: 'CUSTODY',
      physicalRevision: 3,
    });
    expect(
      await db.equipmentAssetCustody.findUniqueOrThrow({
        where: { id: asset.activeCustodyId! },
      }),
    ).toMatchObject({ closedAt: null, closedById: null });
    expect((await events(f))[2]).toMatchObject({
      operation: 'LIFECYCLE_CHANGE',
      custodyId: asset.activeCustodyId,
    });
    await expect(retire(db, f)).rejects.toMatchObject({ status: 409 });
  });
  it('23 same-condition Inspection creates document but no physical event/revision', async () => {
    const f = await fixture(),
      before = await state(f),
      prior = await events(f);
    await inspect(db, f, 'GOOD');
    expect(await state(f)).toEqual(before);
    expect(await events(f)).toEqual(prior);
    expect(
      await db.equipmentInspection.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
  });
  it('empty production registry rejects even plausible context with zero writes', async () => {
    const f = await fixture(),
      before = await snapshot(f);
    await expect(
      claim(
        db,
        command(f),
        new EquipmentCustodyService(
          repository,
          history,
          new EquipmentCustodyContextRegistry(),
        ),
      ),
    ).rejects.toThrow('RESOURCE_STATE_CHANGED');
    expect(await snapshot(f)).toBe(before);
  });
  it('completed historical reservation replay remains valid for an UNVERIFIED Asset', async () => {
    const f = await fixture(false),
      key = randomUUID(),
      dto = {
        caseId: f.caseId,
        equipmentAssetId: f.asset.id,
        directAssignmentReason: 'Test reservation',
      };
    await db.idempotencyRecord.create({
      data: {
        companyId: f.companyId,
        scope: 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE',
        key,
        requestHash: createHealthcareEquipmentAssignmentRequestHash(dto),
        resourceId: f.assignmentId,
      },
    });
    const before = await snapshot(f);
    const replay = await assignments().create(f.companyId, f.actorId, key, dto);
    expect(replay).toMatchObject({
      outcome: 'CREATED',
      data: { id: f.assignmentId },
    });
    expect(await snapshot(f)).toBe(before);
  });
  it('historical custody replay after a coherent future close does not reopen or rewrite attribution', async () => {
    const f = await fixture(),
      c = command(f),
      opened = await claim(db, c);
    // Explicit future-state fixture only: no Return service or productive adapter.
    await db.$transaction(async (tx) => {
      await acquireHealthcareCompanyLock(tx, f.companyId, {
        acquisitionTimeoutMs: policy.companyLockAcquisitionTimeoutMs,
      });
      const asset = await repository.lockAssetForPhysicalMutation(
        tx,
        f.companyId,
        f.asset.id,
      );
      await tx.equipmentAssetCustody.update({
        where: { id: opened.custody.id },
        data: { closedAt: new Date(), closedById: f.actorId },
      });
      await tx.equipmentAsset.update({
        where: { id: f.asset.id },
        data: {
          physicalLocation: 'WAREHOUSE',
          activeCustodyId: null,
          condition: 'INSPECTION_PENDING',
          physicalRevision: 3,
        },
      });
      await repository.appendPhysicalEvent(tx, {
        companyId: f.companyId,
        equipmentAssetId: f.asset.id,
        custodyId: opened.custody.id,
        operation: 'CUSTODY_CLOSE',
        originType: 'ISOLATED_FUTURE_RETURN',
        originId: randomUUID(),
        originOperation: 'CLOSE',
        requestHash: 'b'.repeat(64),
        physicalLocationBefore: asset.physicalLocation,
        physicalLocationAfter: 'WAREHOUSE',
        conditionBefore: asset.condition,
        conditionAfter: 'INSPECTION_PENDING',
        lifecycleBefore: asset.lifecycle,
        lifecycleAfter: asset.lifecycle,
        revisionBefore: 2,
        revisionAfter: 3,
        actorId: f.actorId,
        reasonCode: 'TEST_ONLY',
      });
    });
    const before = await snapshot(f),
      replay = await claim(other, c);
    expect(replay.outcome).toBe('REPLAY');
    expect(replay.custody.closedAt).not.toBeNull();
    expect(replay.event).toEqual(opened.event);
    expect(await snapshot(f)).toBe(before);
  });
  it.each(['inspection', 'retirement'] as const)(
    '%s wins before Reserve/Replace: physical target rejected',
    async (operation) => {
      const f = await fixture(),
        next = { ...f, caseId: (await newCase(f)).id },
        b = await target(f);
      const mutate = (client: PrismaClient, item: Fixture): Promise<unknown> =>
        operation === 'inspection'
          ? inspect(client, item)
          : retire(client, item);
      const [a, z] = await race(
        (client) => mutate(client, f),
        (client) => reserve(client, next),
      );
      succeeds(a);
      fails(z);
      const [x, y] = await race(
        (client) => mutate(client, b),
        (client) => replace(client, f, b),
      );
      succeeds(x);
      fails(y);
      expect(
        await db.healthcareEquipmentAssignment.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(1);
    },
  );
  it.each(['inspection', 'retirement'] as const)(
    'Reserve/Replace wins before %s: logical result remains and physical mutation follows',
    async (operation) => {
      const f = await fixture(),
        next = { ...f, caseId: (await newCase(f)).id },
        b = await target(f);
      const mutate = (client: PrismaClient, item: Fixture): Promise<unknown> =>
        operation === 'inspection'
          ? inspect(client, item)
          : retire(client, item);
      const [a, z] = await race(
        (client) => reserve(client, next),
        (client) => mutate(client, f),
      );
      succeeds(a);
      succeeds(z);
      const [x, y] = await race(
        (client) => replace(client, f, b),
        (client) => mutate(client, b),
      );
      succeeds(x);
      succeeds(y);
      expect((await state(b)).physicalRevision).toBe(2);
    },
  );
  it('missing Company lock rejects before row mutation', async () => {
    const f = await fixture(),
      before = await snapshot(f);
    await expect(
      db.$transaction((tx) => custody.transferToCustody(tx, command(f))),
    ).rejects.toThrow('RESOURCE_STATE_CHANGED');
    expect(await snapshot(f)).toBe(before);
  });
  it.each(['RELEASED', 'REPLACED'] as const)(
    'claim rejects %s Assignment',
    async (lifecycle) => {
      const f = await fixture();
      if (lifecycle === 'REPLACED') await replace(db, f, await target(f));
      else
        await assignments().release(
          f.companyId,
          f.actorId,
          f.assignmentId,
          { reason: 'Test release' },
          randomUUID(),
        );
      const before = await snapshot(f);
      await expect(claim(db, command(f))).rejects.toThrow(
        'RESOURCE_STATE_CHANGED',
      );
      expect(await snapshot(f)).toBe(before);
    },
  );
  it.each(['inspection', 'retirement'] as const)(
    '%s event failure rolls back domain/root/history atomically',
    async (operation) => {
      const f = await fixture(),
        before = await snapshot(f);
      class Fault extends EquipmentPhysicalRepository {
        override appendPhysicalEvent(): never {
          throw new Error('injected');
        }
      }
      const service = equipment(db, new Fault());
      await expect(
        operation === 'inspection'
          ? service.createInspection(f.companyId, f.actorId, f.asset.id, {
              conditionAfter: 'DAMAGED',
            })
          : service.retire(f.companyId, f.actorId, f.asset.id, {
              retiredReason: 'END_OF_LIFE',
            }),
      ).rejects.toThrow('EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR');
      expect(await snapshot(f)).toBe(before);
    },
  );
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
});
