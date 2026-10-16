import { randomUUID } from 'node:crypto';
import { EquipmentPhysicalError } from '../src/equipment/equipment-physical.contract';
import { Prisma, PrismaClient } from '@prisma/client';
import { EquipmentCustodyCloseService } from '../src/equipment/equipment-custody-close.service';
import {
  EquipmentCustodyCloseCommand,
  equipmentCustodyCloseHash,
  EQUIPMENT_CUSTODY_CLOSE_CONDITIONS,
} from '../src/equipment/equipment-custody-close.contract';
import {
  EquipmentCustodyCloseContextAdapter,
  EquipmentCustodyCloseContextRegistry,
} from '../src/equipment/equipment-custody-close-context.registry';
import { EquipmentCustodyService } from '../src/equipment/equipment-custody.service';
import { EquipmentCustodyContextRegistry } from '../src/equipment/equipment-custody-context.registry';
import { EquipmentPhysicalRepository } from '../src/equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../src/equipment/equipment-physical-history.service';
import { EquipmentPhysicalBaselineService } from '../src/equipment/equipment-physical-baseline.service';
import { EquipmentService } from '../src/equipment/equipment.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { applyHealthcareSubsequentTransactionTimeouts } from '../src/healthcare/common/healthcare-subsequent-transaction-timeouts';

jest.setTimeout(30000);
const suite =
  process.env.RUN_EQUIPMENT_CUSTODY_CLOSE_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-RR-01C new isolated PostgreSQL16 acceptance', () => {
  let db: PrismaClient, other: PrismaClient;
  const policy = healthcareCompanyTransactionTimeoutConfiguration();
  const repository = new EquipmentPhysicalRepository();
  const history = new EquipmentPhysicalHistoryService(repository);
  const retained = new Map<string, { hash: string; actorId: string }>();
  const adapter: EquipmentCustodyCloseContextAdapter = {
    key: 'ISOLATED_CLOSE',
    originType: 'TEST_RETURN',
    originOperation: 'CLOSE',
    validate: async (tx, c, requestHash) => {
      const evidence = retained.get(c.validatedContext.contextId);
      const custody = await tx.equipmentAssetCustody.findFirst({
        where: {
          id: c.custodyId,
          companyId: c.companyId,
          equipmentAssetId: c.assetId,
          caseId: c.caseId,
          assignmentId: c.assignmentId,
        },
      });
      const assignment = await tx.healthcareEquipmentAssignment.findFirst({
        where: {
          id: c.assignmentId,
          companyId: c.companyId,
          caseId: c.caseId,
          equipmentAssetId: c.assetId,
        },
      });
      const owner = await tx.healthcareCase.findFirst({
        where: { id: c.caseId, companyId: c.companyId },
      });
      const actor = await tx.user.findFirst({
        where: {
          id: c.actorId,
          companyId: c.companyId,
          isActive: true,
          role: 'ADMIN',
        },
      });
      if (
        !evidence ||
        evidence.hash !== requestHash ||
        evidence.actorId !== c.actorId ||
        !custody ||
        !assignment ||
        !owner ||
        !actor
      )
        throw new EquipmentPhysicalError('RESOURCE_STATE_CHANGED');
      return {
        companyId: custody.companyId,
        assetId: custody.equipmentAssetId,
        custodyId: custody.id,
        caseId: custody.caseId,
        assignmentId: custody.assignmentId,
        actorId: actor.id,
        contextId: c.validatedContext.contextId,
        originType: c.durableOrigin.type,
        originId: c.durableOrigin.id,
        originOperation: c.durableOrigin.operation,
        requestHash: evidence.hash,
      };
    },
  };
  const service = (
    repo = repository,
    registry = new EquipmentCustodyCloseContextRegistry([adapter]),
  ) =>
    new EquipmentCustodyCloseService(
      repo,
      new EquipmentPhysicalHistoryService(repo),
      registry,
    );
  const opening = new EquipmentCustodyService(
    repository,
    history,
    new EquipmentCustodyContextRegistry([
      {
        key: 'ISOLATED_OPEN',
        originType: 'TEST_HANDOFF',
        originOperation: 'OPEN',
        validate: async (tx, c, requestHash) => {
          const assignment =
            await tx.healthcareEquipmentAssignment.findFirstOrThrow({
              where: {
                id: c.assignmentId,
                companyId: c.companyId,
                caseId: c.caseId,
                equipmentAssetId: c.assetId,
              },
            });
          return {
            companyId: assignment.companyId,
            assetId: assignment.equipmentAssetId,
            caseId: assignment.caseId,
            assignmentId: assignment.id,
            contextId: c.validatedContext.contextId,
            originId: c.durableOrigin.id,
            requestHash,
          };
        },
      },
    ]),
  );
  beforeAll(async () => {
    const url = new URL(process.env.EQUIPMENT_CUSTODY_CLOSE_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_equipment_custody_close_test' ||
      url.username !== 'equipment_custody_close_test' ||
      !process.env.EQUIPMENT_CUSTODY_CLOSE_TEST_RUN
    )
      throw new Error('Unverified isolated target');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    await other.$connect();
    const [role] = await db.$queryRaw<
      {
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        version: string;
      }[]
    >`SELECT rolsuper,rolcreatedb,rolcreaterole,current_setting('server_version') AS version FROM pg_roles WHERE rolname=current_user`;
    expect(role).toMatchObject({
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });
    expect(role.version).toMatch(/^16\./);
  });
  afterAll(async () => {
    await db?.$disconnect();
    await other?.$disconnect();
  });
  async function transaction<T>(
    client: PrismaClient,
    companyId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return client.$transaction(
      async (tx) => {
        await acquireHealthcareCompanyLock(tx, companyId, {
          acquisitionTimeoutMs: policy.companyLockAcquisitionTimeoutMs,
        });
        await applyHealthcareSubsequentTransactionTimeouts(tx, policy);
        return work(tx);
      },
      {
        maxWait: policy.prismaMaxWaitMs,
        timeout: policy.prismaTransactionTimeoutMs,
      },
    );
  }
  async function fixture(existing?: {
    companyId: string;
    actorId: string;
    caseId: string;
  }) {
    const companyId =
      existing?.companyId ??
      (
        await db.company.create({
          data: { name: '01C isolated', rfc: randomUUID() },
        })
      ).id;
    const actorId =
      existing?.actorId ??
      (
        await db.user.create({
          data: {
            companyId,
            firstName: 'Test',
            lastName: 'Only',
            email: randomUUID() + '@example.invalid',
            passwordHash: 'NOT-A-CREDENTIAL',
            role: 'ADMIN',
          },
        })
      ).id;
    const product = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Close fixture',
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
    const caseId =
      existing?.caseId ??
      (
        await db.healthcareCase.create({
          data: {
            companyId,
            folio: randomUUID(),
            title: 'Close fixture',
            status: 'SCHEDULED',
            scheduledStart: new Date('2026-11-01T10:00:00Z'),
            scheduledEnd: new Date('2026-11-01T12:00:00Z'),
            createdById: actorId,
          },
        })
      ).id;
    const assignment = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId,
        caseId,
        equipmentAssetId: asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Test only',
        createdById: actorId,
      },
    });
    await new EquipmentPhysicalBaselineService(db, {
      accept: (c, requestHash) =>
        Promise.resolve({
          requestHash,
          evidenceHash: c.evidenceHash,
          operatorIdentity: c.operatorIdentity,
          warehousePresenceVerified: true,
        }),
    }).reconcile({
      companyId,
      assetId: asset.id,
      reconciliationId: randomUUID(),
      expectedPhysicalRevision: 0,
      targetPhysicalLocation: 'WAREHOUSE',
      operatorIdentity: 'TEST-ONLY',
      evidenceReference: 'fixture://' + asset.id,
      evidenceHash: 'a'.repeat(64),
    });
    const f = {
      companyId,
      actorId,
      assetId: asset.id,
      caseId,
      assignmentId: assignment.id,
    };
    const opened = await open(f, 1);
    return { ...f, custodyId: opened.custody.id };
  }
  type Fixture = {
    companyId: string;
    actorId: string;
    assetId: string;
    caseId: string;
    assignmentId: string;
    custodyId: string;
  };
  function open(f: Omit<Fixture, 'custodyId'>, revision: number) {
    return transaction(db, f.companyId, (tx) =>
      opening.transferToCustody(tx, {
        ...f,
        expectedPhysicalRevision: revision,
        validatedContext: {
          adapterKey: 'ISOLATED_OPEN',
          contextId: randomUUID(),
        },
        durableOrigin: {
          type: 'TEST_HANDOFF',
          id: randomUUID(),
          operation: 'OPEN',
        },
      }),
    );
  }
  function command(
    f: Fixture,
    changes: Partial<EquipmentCustodyCloseCommand> = {},
  ): EquipmentCustodyCloseCommand {
    const c: EquipmentCustodyCloseCommand = {
      ...f,
      expectedPhysicalRevision: 2,
      reportedCondition: 'GOOD',
      validatedContext: { adapterKey: adapter.key, contextId: randomUUID() },
      durableOrigin: {
        type: adapter.originType,
        id: randomUUID(),
        operation: adapter.originOperation,
      },
      ...changes,
    };
    retained.set(c.validatedContext.contextId, {
      hash: equipmentCustodyCloseHash(c),
      actorId: c.actorId,
    });
    return c;
  }
  const close = (
    c: EquipmentCustodyCloseCommand,
    client = db,
    primitive = service(),
  ) =>
    transaction(client, c.companyId, (tx) =>
      primitive.returnFromCustody(tx, c),
    );
  const asset = (f: Fixture) =>
    db.equipmentAsset.findUniqueOrThrow({ where: { id: f.assetId } });
  const custody = (f: Fixture) =>
    db.equipmentAssetCustody.findUniqueOrThrow({ where: { id: f.custodyId } });
  const events = (f: Fixture) =>
    db.equipmentAssetPhysicalEvent.findMany({
      where: { companyId: f.companyId, equipmentAssetId: f.assetId },
      orderBy: { revisionAfter: 'asc' },
    });
  const equipment = (client: PrismaClient) =>
    new EquipmentService(
      client as PrismaService,
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
      repository,
      history,
      policy,
    );
  const inspect = (client: PrismaClient, f: Fixture) =>
    equipment(client).createInspection(f.companyId, f.actorId, f.assetId, {
      conditionAfter: 'DAMAGED',
    });
  const retire = (client: PrismaClient, f: Fixture) =>
    equipment(client).retire(f.companyId, f.actorId, f.assetId, {
      retiredReason: 'END_OF_LIFE',
      retirementNotes: 'Retain this metadata',
    });
  async function physicalSnapshot(f: Fixture) {
    return JSON.stringify({
      asset: await asset(f),
      custody: await custody(f),
      events: await events(f),
    });
  }
  async function unrelated(f: Fixture) {
    return {
      assignments: await db.healthcareEquipmentAssignment.findMany({
        where: { companyId: f.companyId },
      }),
      cases: await db.healthcareCase.findMany({
        where: { companyId: f.companyId },
      }),
      kits: await db.healthcareCaseKit.findMany({
        where: { companyId: f.companyId },
      }),
      positions: await db.inventoryPosition.findMany({
        where: { companyId: f.companyId },
      }),
      effects: await db.inventoryPhysicalEffect.findMany({
        where: { companyId: f.companyId },
      }),
      inspections: await db.equipmentInspection.findMany({
        where: { companyId: f.companyId },
      }),
    };
  }
  function signal<T = void>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  // Hold the first transaction after writes, before commit. Observe the waiting backend
  // from an independent connection, including its exact blocker and PG lock wait state.
  async function race<A, B>(
    first: (client: PrismaClient) => Promise<A>,
    second: (client: PrismaClient) => Promise<B>,
  ) {
    const held = signal<number>(),
      waiting = signal<number>(),
      release = signal();
    const wrap = (base: PrismaClient, hold: boolean) =>
      new Proxy(base, {
        get(obj, key) {
          if (key === '$transaction')
            return (
              cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
              options: object,
            ) =>
              obj.$transaction(async (tx) => {
                const [pid] = await tx.$queryRaw<
                  { pid: number }[]
                >`SELECT pg_backend_pid() AS pid`;
                if (!hold) waiting.resolve(pid.pid);
                const result = await cb(tx);
                if (hold) {
                  held.resolve(pid.pid);
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
    const firstPid = await Promise.race([
      held.promise,
      a.then(() => {
        throw new Error('First tx was not held');
      }),
    ]);
    const b = second(wrap(other, false));
    const safeB = b.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      const secondPid = await waiting.promise;
      expect(secondPid).not.toBe(firstPid);
      let observed = false;
      const until = Date.now() + 5000;
      while (Date.now() < until) {
        const [row] = await db.$queryRaw<
          { blocked: boolean }[]
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=${secondPid} AND wait_event_type='Lock' AND ${firstPid}::int=ANY(pg_blocking_pids(pid))) AS blocked`;
        if (row.blocked) {
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
  it.each(EQUIPMENT_CUSTODY_CLOSE_CONDITIONS)(
    'applies %s with one close event and no other side effects',
    async (reportedCondition) => {
      const f = await fixture(),
        before = await asset(f),
        unchanged = await unrelated(f);
      const r = await close(command(f, { reportedCondition }));
      expect(r).toMatchObject({
        outcome: 'CLOSED',
        custodyId: f.custodyId,
        assetId: f.assetId,
        revisionBefore: 2,
        revisionAfter: 3,
        conditionBefore: 'GOOD',
        conditionAfter: reportedCondition,
        lifecycleBefore: 'ACTIVE',
        lifecycleAfter: 'ACTIVE',
        locationBefore: 'CUSTODY',
        locationAfter: 'WAREHOUSE',
        activeCustodyIdBefore: f.custodyId,
        activeCustodyIdAfter: null,
        closedById: f.actorId,
      });
      expect({ ...(await asset(f)), updatedAt: before.updatedAt }).toEqual({
        ...before,
        physicalLocation: 'WAREHOUSE',
        activeCustodyId: null,
        condition: reportedCondition,
        physicalRevision: 3,
      });
      expect(await custody(f)).toMatchObject({
        closedAt: r.closedAt,
        closedById: r.closedById,
      });
      const all = await events(f);
      expect(all.filter((e) => e.operation === 'CUSTODY_CLOSE')).toHaveLength(
        1,
      );
      expect(
        all.filter((e) => e.operation === 'CONDITION_CHANGE'),
      ).toHaveLength(0);
      expect(all[2]).toMatchObject({
        id: r.physicalEventId,
        custodyId: f.custodyId,
        createdAt: r.closedAt,
        conditionBefore: r.conditionBefore,
        conditionAfter: r.conditionAfter,
        revisionBefore: 2,
        revisionAfter: 3,
        physicalLocationBefore: 'CUSTODY',
        physicalLocationAfter: 'WAREHOUSE',
      });
      expect(await unrelated(f)).toEqual(unchanged);
    },
  );
  it('preserves RETIRED lifecycle and every retirement audit field', async () => {
    const f = await fixture();
    await retire(db, f);
    const before = await asset(f);
    const r = await close(
      command(f, {
        expectedPhysicalRevision: 3,
        reportedCondition: 'OUT_OF_SERVICE',
      }),
    );
    expect(r).toMatchObject({
      lifecycleBefore: 'RETIRED',
      lifecycleAfter: 'RETIRED',
      revisionAfter: 4,
    });
    expect({ ...(await asset(f)), updatedAt: before.updatedAt }).toEqual({
      ...before,
      physicalLocation: 'WAREHOUSE',
      activeCustodyId: null,
      condition: 'OUT_OF_SERVICE',
      physicalRevision: 4,
    });
  });
  it.each(['RESERVED', 'RELEASED', 'REPLACED'] as const)(
    'preserves historical Assignment in %s',
    async (lifecycle) => {
      const f = await fixture();
      await db.healthcareEquipmentAssignment.update({
        where: { id: f.assignmentId },
        data: {
          lifecycle,
          ...(lifecycle === 'RELEASED'
            ? {
                releasedAt: new Date(),
                releasedById: f.actorId,
                releaseCause: 'MANUAL' as const,
                releaseReason: 'Test historical release',
              }
            : lifecycle === 'REPLACED'
              ? {
                  replacedAt: new Date(),
                  replacedById: f.actorId,
                  replacementReason: 'Test historical replacement',
                }
              : {}),
        },
      });
      const before = await unrelated(f);
      await close(command(f));
      expect(await unrelated(f)).toEqual(before);
    },
  );
  it('rejects stale revision without writes', async () => {
    const f = await fixture(),
      before = await physicalSnapshot(f);
    await expect(
      close(command(f, { expectedPhysicalRevision: 1 })),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
    expect(await physicalSnapshot(f)).toBe(before);
  });
  it('rejects another tenant custody', async () => {
    const f = await fixture(),
      g = await fixture();
    await expect(
      close(command(f, { custodyId: g.custodyId })),
    ).rejects.toHaveProperty('code', 'EQUIPMENT_CUSTODY_NOT_FOUND');
  });
  it('rejects another tenant Asset', async () => {
    const f = await fixture(),
      g = await fixture();
    await expect(
      close(command(f, { assetId: g.assetId })),
    ).rejects.toHaveProperty('code', 'EQUIPMENT_ASSET_NOT_FOUND');
  });
  it('rejects same-company Asset/custody mismatch', async () => {
    const f = await fixture(),
      g = await fixture(f);
    await expect(
      close(command(f, { custodyId: g.custodyId })),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
  });
  it.each(['caseId', 'assignmentId'] as const)(
    'rejects historical %s mismatch',
    async (field) => {
      const f = await fixture();
      await expect(
        close(command(f, { [field]: randomUUID() })),
      ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
    },
  );
  it.each(['pointer', 'location'] as const)(
    'rejects incoherent %s under retained Asset lock',
    async (kind) => {
      const f = await fixture();
      // Deferred coherence permits observing a broken shape inside the test tx;
      // rejection rolls it back before it can be committed.
      await expect(
        transaction(db, f.companyId, async (tx) => {
          await repository.lockAssetForPhysicalMutation(
            tx,
            f.companyId,
            f.assetId,
          );
          const second = await tx.equipmentAssetCustody.create({
            data: {
              companyId: f.companyId,
              equipmentAssetId: f.assetId,
              caseId: f.caseId,
              assignmentId: f.assignmentId,
              openedById: f.actorId,
              closedAt: new Date(),
              closedById: f.actorId,
              openedAt: new Date(Date.now() - 1000),
            },
          });
          await tx.equipmentAsset.update({
            where: { id: f.assetId },
            data:
              kind === 'pointer'
                ? { activeCustodyId: second.id }
                : { physicalLocation: 'WAREHOUSE', activeCustodyId: null },
          });
          return service().returnFromCustody(tx, command(f));
        }),
      ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
      expect((await asset(f)).activeCustodyId).toBe(f.custodyId);
    },
  );
  it('same-origin sequential replay has no writes', async () => {
    const f = await fixture(),
      c = command(f),
      original = await close(c),
      before = await physicalSnapshot(f);
    expect(await close(c)).toEqual({ ...original, outcome: 'REPLAY' });
    expect(await physicalSnapshot(f)).toBe(before);
  });
  it('same-origin different hash rejects before registry/state gates', async () => {
    const f = await fixture(),
      c = command(f);
    await close(c);
    await expect(
      close({ ...c, reportedCondition: 'DAMAGED' }),
    ).rejects.toHaveProperty('code', 'IDEMPOTENCY_KEY_REUSED');
  });
  it('different-origin already-closed custody conflicts', async () => {
    const f = await fixture();
    await close(command(f));
    await expect(close(command(f))).rejects.toHaveProperty(
      'code',
      'EQUIPMENT_CUSTODY_ALREADY_CLOSED',
    );
  });
  it('lost response replay returns historical transition', async () => {
    const f = await fixture(),
      c = command(f);
    const original = await close(c);
    const result = await close(c);
    expect(result).toEqual({ ...original, outcome: 'REPLAY' });
    expect(result.closedAt).toEqual((await custody(f)).closedAt);
  });
  it('lost response replay after redispatch never closes the new custody', async () => {
    const f = await fixture(),
      c = command(f),
      original = await close(c);
    await open(f, 3);
    await inspect(db, f);
    const before = await physicalSnapshot(f);
    const current = await asset(f);
    expect(current.activeCustodyId).not.toBe(f.custodyId);
    expect(current.physicalRevision).toBe(5);
    expect(await close(c)).toEqual({ ...original, outcome: 'REPLAY' });
    expect(await physicalSnapshot(f)).toBe(before);
  });
  it.each(['APPLY', 'REPLAY'] as const)(
    'empty registry fails closed in %s',
    async (mode) => {
      const f = await fixture(),
        c = command(f);
      if (mode === 'REPLAY') await close(c);
      const before = await physicalSnapshot(f);
      await expect(
        close(
          c,
          db,
          service(repository, new EquipmentCustodyCloseContextRegistry()),
        ),
      ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
      expect(await physicalSnapshot(f)).toBe(before);
    },
  );
  it('invalid actor is rejected without mutation', async () => {
    const f = await fixture();
    await expect(
      close(command(f, { actorId: randomUUID() })),
    ).rejects.toHaveProperty('code', 'EQUIPMENT_PHYSICAL_ACTOR_INVALID');
  });
  it('invalid retained context is rejected without mutation', async () => {
    const f = await fixture(),
      c = command(f);
    retained.delete(c.validatedContext.contextId);
    await expect(close(c)).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
    expect((await asset(f)).physicalRevision).toBe(2);
  });
  it('caller must retain Company exclusive advisory lock', async () => {
    const f = await fixture();
    await expect(
      db.$transaction((tx) => service().returnFromCustody(tx, command(f))),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
  });
  it('different Company advisory lock is insufficient', async () => {
    const f = await fixture();
    await expect(
      transaction(db, randomUUID(), (tx) =>
        service().returnFromCustody(tx, command(f)),
      ),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
  });
  it.each(['custody', 'asset', 'event'] as const)(
    'caller rollback after %s mutation is atomic',
    async (stage) => {
      const f = await fixture(),
        before = await physicalSnapshot(f),
        repo = new EquipmentPhysicalRepository(),
        base = new EquipmentPhysicalRepository();
      if (stage === 'custody')
        jest
          .spyOn(repo, 'closeCustodyCas')
          .mockImplementation(
            async (
              ...args: Parameters<
                EquipmentPhysicalRepository['closeCustodyCas']
              >
            ) => {
              await base.closeCustodyCas(...args);
              throw new Error('injected after custody');
            },
          );
      if (stage === 'asset')
        jest
          .spyOn(repo, 'closeAssetFromCustodyCas')
          .mockImplementation(
            async (
              ...args: Parameters<
                EquipmentPhysicalRepository['closeAssetFromCustodyCas']
              >
            ) => {
              await base.closeAssetFromCustodyCas(...args);
              throw new Error('injected after asset');
            },
          );
      await expect(
        transaction(db, f.companyId, async (tx) => {
          await service(repo).returnFromCustody(tx, command(f));
          throw new Error('caller rollback after event');
        }),
      ).rejects.toThrow();
      expect(await physicalSnapshot(f)).toBe(before);
    },
  );
  it('caller owns transaction and sees close writes before commit', async () => {
    const f = await fixture();
    await transaction(db, f.companyId, async (tx) => {
      await service().returnFromCustody(tx, command(f));
      expect(
        (
          await tx.equipmentAsset.findUniqueOrThrow({
            where: { id: f.assetId },
          })
        ).physicalLocation,
      ).toBe('WAREHOUSE');
      expect((await asset(f)).physicalLocation).toBe('CUSTODY');
    });
  });
  it('same-origin concurrent close executes once then replays', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => close(c, client),
      (client) => close(c, client),
    );
    expect(a).toHaveProperty('value.outcome', 'CLOSED');
    expect(b).toHaveProperty('value.outcome', 'REPLAY');
    expect(
      (await events(f)).filter((e) => e.operation === 'CUSTODY_CLOSE'),
    ).toHaveLength(1);
    expect((await asset(f)).physicalRevision).toBe(3);
  });
  it('different-origin concurrent close has one winner and one conflict', async () => {
    const f = await fixture(),
      a = command(f),
      b = command(f);
    const result = await race(
      (client) => close(a, client),
      (client) => close(b, client),
    );
    expect(result[0]).toHaveProperty('value.outcome', 'CLOSED');
    expect(result[1]).toHaveProperty(
      'error.code',
      'EQUIPMENT_CUSTODY_ALREADY_CLOSED',
    );
    expect(
      (await events(f)).filter((e) => e.operation === 'CUSTODY_CLOSE'),
    ).toHaveLength(1);
  });
  it('Inspection wins: stale close rejects without losing condition', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => inspect(client, f),
      (client) => close(c, client),
    );
    expect(a).toHaveProperty('value');
    expect(b).toHaveProperty('error.code', 'RESOURCE_STATE_CHANGED');
    expect(await asset(f)).toMatchObject({
      condition: 'DAMAGED',
      physicalRevision: 3,
      physicalLocation: 'CUSTODY',
    });
  });
  it('Close wins: later Inspection uses current state and advances revision', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => close(c, client),
      (client) => inspect(client, f),
    );
    expect(a).toHaveProperty('value.outcome', 'CLOSED');
    expect(b).toHaveProperty('value');
    expect(await asset(f)).toMatchObject({
      condition: 'DAMAGED',
      physicalRevision: 4,
      physicalLocation: 'WAREHOUSE',
      activeCustodyId: null,
    });
  });
  it('Retirement wins: stale close rejects; fresh revision closes RETIRED', async () => {
    const f = await fixture(),
      c = command(f);
    const [a, b] = await race(
      (client) => retire(client, f),
      (client) => close(c, client),
    );
    expect(a).toHaveProperty('value');
    expect(b).toHaveProperty('error.code', 'RESOURCE_STATE_CHANGED');
    const r = await close(command(f, { expectedPhysicalRevision: 3 }));
    expect(r).toMatchObject({ lifecycleAfter: 'RETIRED', revisionAfter: 4 });
  });
  it('Close wins: later Retirement preserves returned condition/location', async () => {
    const f = await fixture(),
      c = command(f, { reportedCondition: 'OUT_OF_SERVICE' });
    const [a, b] = await race(
      (client) => close(c, client),
      (client) => retire(client, f),
    );
    expect(a).toHaveProperty('value.outcome', 'CLOSED');
    expect(b).toHaveProperty('value');
    expect(await asset(f)).toMatchObject({
      condition: 'OUT_OF_SERVICE',
      physicalLocation: 'WAREHOUSE',
      lifecycle: 'RETIRED',
      physicalRevision: 4,
    });
  });
  it('Inspection no-op does not manufacture a stale revision', async () => {
    const f = await fixture(),
      c = command(f);
    await equipment(db).createInspection(f.companyId, f.actorId, f.assetId, {
      conditionAfter: 'GOOD',
    });
    expect((await asset(f)).physicalRevision).toBe(2);
    expect(await close(c)).toHaveProperty('outcome', 'CLOSED');
  });
  it('two Assets allow deterministic prelocks and primitive reacquisition', async () => {
    const f = await fixture(),
      g = await fixture(f),
      items = [f, g].sort((a, b) => a.assetId.localeCompare(b.assetId));
    await transaction(db, f.companyId, async (tx) => {
      for (const item of items)
        await repository.lockAssetForPhysicalMutation(
          tx,
          item.companyId,
          item.assetId,
        );
      for (const item of items)
        expect(
          await service().returnFromCustody(tx, command(item)),
        ).toHaveProperty('outcome', 'CLOSED');
    });
    expect((await asset(f)).physicalRevision).toBe(3);
    expect((await asset(g)).physicalRevision).toBe(3);
  });
  it.each([
    'assignments',
    'cases',
    'kits',
    'positions',
    'effects',
    'inspections',
  ] as const)('zero %s mutations', async (key) => {
    const f = await fixture(),
      before = await unrelated(f);
    await close(command(f, { reportedCondition: 'INSPECTION_PENDING' }));
    expect((await unrelated(f))[key]).toEqual(before[key]);
  });
  it('tenant isolation preserves unrelated tenant physical data', async () => {
    const f = await fixture(),
      g = await fixture(),
      before = await physicalSnapshot(g);
    await close(command(f));
    expect(await physicalSnapshot(g)).toBe(before);
  });
});
