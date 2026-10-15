import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { HealthcareCaseDispatchCommandRepository } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-command.repository';
import { HealthcareCaseDispatchCommandService } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-command.service';
import { HealthcareCaseDispatchesRepository } from '../src/healthcare/case-dispatches/healthcare-case-dispatches.repository';
import { HealthcareEquipmentAssignmentsRepository } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { HealthcareCaseKitsRepository } from '../src/healthcare/case-kits/healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from '../src/healthcare/case-kits/healthcare-case-kits.service';
import { HealthcareCaseService } from '../src/healthcare/cases/healthcare-case.service';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import {
  DispatchCommandContext,
  DispatchCommandIntent,
} from '../src/healthcare/case-dispatches/healthcare-case-dispatch-command.types';
jest.setTimeout(30000);
const suite =
  process.env.RUN_CASE_DISPATCH_COMMANDS_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-DSP-LOCK-01 PostgreSQL16 + 01B regression', () => {
  let db: PrismaClient, one: PrismaClient, two: PrismaClient;
  beforeAll(async () => {
    const url = new URL(process.env.CASE_DISPATCH_COMMANDS_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_case_dispatch_commands_test' ||
      url.username !== 'case_dispatch_commands_test' ||
      !process.env.CASE_DISPATCH_COMMANDS_TEST_RUN
    )
      throw Error('Unverified task DB');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const a = new URL(url);
    a.searchParams.set('application_name', 'dispatch-command-a');
    const b = new URL(url);
    b.searchParams.set('application_name', 'dispatch-command-b');
    one = new PrismaClient({ datasources: { db: { url: a.toString() } } });
    two = new PrismaClient({ datasources: { db: { url: b.toString() } } });
    await Promise.all([db.$connect(), one.$connect(), two.$connect()]);
    const [r] = await db.$queryRaw<
      { rolsuper: boolean }[]
    >`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`;
    expect(r.rolsuper).toBe(false);
  });
  afterAll(async () => {
    await Promise.all([
      db?.$disconnect(),
      one?.$disconnect(),
      two?.$disconnect(),
    ]);
  });
  async function fixture() {
    const company = await db.company.create({
        data: { name: 'Dispatch isolated', rfc: randomUUID() },
      }),
      companyId = company.id;
    const user = await db.user.create({
      data: {
        companyId,
        firstName: 'Historical',
        lastName: 'Actor',
        email: randomUUID() + '@example.invalid',
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    const c = await db.healthcareCase.create({
      data: {
        companyId,
        createdById: user.id,
        folio: randomUUID(),
        title: 'Isolated',
      },
    });
    const kit = await db.healthcareCaseKit.create({
      data: { companyId, caseId: c.id, createdById: user.id },
    });
    const product = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Material original',
        lotTracking: 'NONE',
      },
    });
    const requirement = await db.healthcareCaseRequirement.create({
      data: {
        companyId,
        caseId: c.id,
        productId: product.id,
        requestedQty: 10,
        type: 'REQUIRED',
        sortOrder: 0,
        createdById: user.id,
      },
    });
    const source = await db.healthcareCaseKitItem.create({
      data: {
        companyId,
        caseId: c.id,
        caseKitId: kit.id,
        requirementId: requirement.id,
        preparedQuantity: 10,
        addedById: user.id,
      },
    });
    const position = await db.inventoryPosition.create({
      data: {
        companyId,
        productId: product.id,
        state: 'AVAILABLE',
        quantity: 10,
      },
    });
    const ep = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Equipment original',
        inventoryTracking: 'ASSET',
      },
    });
    const asset = await db.equipmentAsset.create({
      data: {
        companyId,
        productId: ep.id,
        assetCode: randomUUID(),
        condition: 'GOOD',
      },
    });
    const assignment = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId,
        caseId: c.id,
        equipmentAssetId: asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Fixture',
        createdById: user.id,
      },
    });
    const es = await db.healthcareCaseKitItem.create({
      data: {
        companyId,
        caseId: c.id,
        caseKitId: kit.id,
        equipmentAssignmentId: assignment.id,
        addedById: user.id,
      },
    });
    return {
      companyId,
      user,
      c,
      kit,
      product,
      requirement,
      source,
      position,
      ep,
      asset,
      assignment,
      es,
    };
  }
  type F = Awaited<ReturnType<typeof fixture>>;
  const rootData = (f: F) => ({
    companyId: f.companyId,
    caseId: f.c.id,
    caseKitId: f.kit.id,
    createdById: f.user.id,
    custodianType: 'EXTERNAL_PERSON' as const,
    custodianDisplayName: 'Receiver',
  });
  const itemData = (f: F, dispatchId: string) => ({
    companyId: f.companyId,
    dispatchId,
    caseId: f.c.id,
    caseKitId: f.kit.id,
    sourceCaseKitItemId: f.source.id,
    type: 'MATERIAL' as const,
    productId: f.product.id,
    addedById: f.user.id,
    quantity: 2,
    sourcePositionId: f.position.id,
    expectedPositionRevision: 0,
  });
  const equipmentData = (f: F, dispatchId: string) => ({
    companyId: f.companyId,
    dispatchId,
    caseId: f.c.id,
    caseKitId: f.kit.id,
    sourceCaseKitItemId: f.es.id,
    type: 'EQUIPMENT' as const,
    productId: f.ep.id,
    addedById: f.user.id,
    assignmentId: f.assignment.id,
    assetId: f.asset.id,
    expectedPhysicalRevision: 0,
  });
  async function draft(f: F, equipment = false) {
    const d = await db.healthcareCaseDispatch.create({ data: rootData(f) });
    const i = await db.healthcareCaseDispatchItem.create({
      data: equipment
        ? {
            ...equipmentData(f, d.id),
            expectedPhysicalRevision: (
              await db.equipmentAsset.findUniqueOrThrow({
                where: { id: f.asset.id },
              })
            ).physicalRevision,
          }
        : itemData(f, d.id),
    });
    return { d, i };
  }
  async function rejected(
    p: Promise<unknown>,
    pattern = /23514|23503|23505|constraint|Dispatch|Foreign key|Unique constraint/i,
  ) {
    try {
      await p;
      throw Error('Expected structural rejection');
    } catch (e) {
      const err = e as Error;
      expect(err.message).not.toBe('Expected structural rejection');
      expect(err.message + JSON.stringify(e)).toMatch(pattern);
    }
  }
  const rootSnapshot = (f: F, date: Date) => ({
    version: 1,
    case: {
      id: f.c.id,
      folio: f.c.folio,
      scheduledStart: null,
      scheduledEnd: null,
    },
    custodian: {
      type: 'EXTERNAL_PERSON',
      userId: null,
      displayName: 'Receiver',
    },
    dispatchedBy: {
      id: f.user.id,
      firstName: f.user.firstName,
      lastName: f.user.lastName,
    },
    dispatchedAt: date.toISOString(),
  });
  const itemSnapshot = (f: F, equipment = false) => ({
    version: 1,
    product: equipment
      ? {
          id: f.ep.id,
          sku: f.ep.sku,
          name: f.ep.name,
          inventoryTracking: 'ASSET',
          lotTracking: 'OPTIONAL',
        }
      : {
          id: f.product.id,
          sku: f.product.sku,
          name: f.product.name,
          inventoryTracking: 'QUANTITY',
          lotTracking: 'NONE',
        },
    preparation: {
      sourceCaseKitItemId: equipment ? f.es.id : f.source.id,
      requirementId: equipment ? null : f.requirement.id,
      assignmentId: equipment ? f.assignment.id : null,
      preparedQuantity: equipment ? null : 10,
    },
    batch: null,
    equipment: equipment
      ? { id: f.asset.id, assetCode: f.asset.assetCode, serialNumber: null }
      : null,
  });
  async function confirmed(
    f: F,
    equipment = false,
    patch?: (
      tx: Prisma.TransactionClient,
      d: string,
      i: string,
    ) => Promise<void>,
    finalStatus: 'CONFIRMED' | 'CANCELLED' | 'DRAFT' = 'CONFIRMED',
  ) {
    const { d, i } = await draft(f, equipment),
      now = new Date();
    await db.$transaction(async (tx) => {
      if (equipment) {
        const c = await tx.equipmentAssetCustody.create({
          data: {
            companyId: f.companyId,
            equipmentAssetId: f.asset.id,
            caseId: f.c.id,
            assignmentId: f.assignment.id,
            openedById: f.user.id,
          },
        });
        await tx.equipmentAsset.update({
          where: { id: f.asset.id },
          data: {
            physicalLocation: 'CUSTODY',
            activeCustodyId: c.id,
            physicalRevision: i.expectedPhysicalRevision! + 1,
          },
        });
        const e = await tx.equipmentAssetPhysicalEvent.create({
          data: {
            companyId: f.companyId,
            equipmentAssetId: f.asset.id,
            custodyId: c.id,
            operation: 'CUSTODY_OPEN',
            originType: 'CASE_DISPATCH_ITEM',
            originId: i.id,
            originOperation: 'CONFIRM_EQUIPMENT',
            requestHash: 'a'.repeat(64),
            physicalLocationBefore: 'WAREHOUSE',
            physicalLocationAfter: 'CUSTODY',
            conditionBefore: 'GOOD',
            conditionAfter: 'GOOD',
            lifecycleBefore: 'ACTIVE',
            lifecycleAfter: 'ACTIVE',
            revisionBefore: i.expectedPhysicalRevision!,
            revisionAfter: i.expectedPhysicalRevision! + 1,
            actorId: f.user.id,
            reasonCode: 'FIXTURE',
          },
        });
        await tx.healthcareCaseDispatchItem.update({
          where: { id: i.id },
          data: {
            equipmentCustodyId: c.id,
            equipmentPhysicalEventId: e.id,
            snapshot: itemSnapshot(f, true),
          },
        });
      } else {
        const dest = await tx.inventoryPosition.create({
          data: {
            companyId: f.companyId,
            productId: f.product.id,
            state: 'CUSTODY',
            contextType: 'CASE_DISPATCH_ITEM',
            contextId: i.id,
            quantity: 2,
            revision: 1,
          },
        });
        const effect = await tx.inventoryPhysicalEffect.create({
          data: {
            companyId: f.companyId,
            originType: 'CASE_DISPATCH',
            originId: d.id,
            originOperation: 'CONFIRM_QUANTITY',
            kind: 'TRANSFER',
            requestHash: 'a'.repeat(64),
            lineCount: 2,
            actorId: f.user.id,
          },
        });
        await tx.inventoryPhysicalEffectLine.createMany({
          data: [
            {
              companyId: f.companyId,
              effectId: effect.id,
              positionId: f.position.id,
              sequence: 1,
              delta: -2,
              quantityBefore: 10,
              quantityAfter: 8,
              revisionBefore: 0,
              revisionAfter: 1,
            },
            {
              companyId: f.companyId,
              effectId: effect.id,
              positionId: dest.id,
              sequence: 2,
              delta: 2,
              quantityBefore: 0,
              quantityAfter: 2,
              revisionBefore: 0,
              revisionAfter: 1,
            },
          ],
        });
        await tx.inventoryPosition.update({
          where: { id: f.position.id },
          data: { quantity: 8, revision: 1 },
        });
        await tx.healthcareCaseDispatchItem.update({
          where: { id: i.id },
          data: {
            destinationPositionId: dest.id,
            physicalEffectId: effect.id,
            snapshot: itemSnapshot(f),
          },
        });
      }
      // Explicitly exercise approved order: snapshots/evidence while DRAFT, terminal
      // flip, then audit INSERT. Deferred checks must inspect the final state.
      await tx.healthcareCaseDispatch.update({
        where: { id: d.id },
        data: { snapshot: rootSnapshot(f, now), snapshotVersion: 1 },
      });
      if (patch) await patch(tx, d.id, i.id);
      if (finalStatus === 'DRAFT') {
        await tx.healthcareCaseDispatch.update({
          where: { id: d.id },
          data: { snapshot: Prisma.DbNull, snapshotVersion: null },
        });
        await tx.healthcareCaseDispatchItem.update({
          where: { id: i.id },
          data: { snapshot: Prisma.DbNull },
        });
      } else if (finalStatus === 'CANCELLED') {
        await tx.healthcareCaseDispatch.update({
          where: { id: d.id },
          data: {
            status: 'CANCELLED',
            revision: 1,
            snapshot: Prisma.DbNull,
            snapshotVersion: null,
            cancelledById: f.user.id,
            cancelledAt: now,
            cancellationReason: 'Fixture',
          },
        });
      } else {
        await tx.healthcareCaseDispatch.update({
          where: { id: d.id },
          data: {
            status: 'CONFIRMED',
            revision: 1,
            confirmedFromRevision: 0,
            confirmedById: f.user.id,
            confirmedAt: now,
          },
        });
        await tx.healthcareCaseDispatchAudit.create({
          data: {
            companyId: f.companyId,
            dispatchId: d.id,
            operation: 'CONFIRM',
            actorId: f.user.id,
            revisionBefore: 0,
            revisionAfter: 1,
            change: { version: 1, operation: 'CONFIRM', reason: null },
          },
        });
      }
    });
    return { d, i };
  }

  const policy = healthcareCompanyTransactionTimeoutConfiguration();
  const repository = (client = db) =>
    new HealthcareCaseDispatchCommandRepository(
      client as PrismaService,
      new HealthcareCaseDispatchesRepository(client as PrismaService),
    );
  const service = (client = db) =>
    new HealthcareCaseDispatchCommandService(repository(client), policy);
  const custodian = {
    type: 'EXTERNAL_PERSON' as const,
    displayName: 'Receiver',
    userId: null,
  };
  const context = (
    f: F,
    dispatchId?: string,
    itemId?: string,
    key: string = randomUUID(),
  ): DispatchCommandContext => ({
    companyId: f.companyId,
    actorId: f.user.id,
    caseId: f.c.id,
    dispatchId,
    itemId,
    key,
  });
  const run = (
    f: F,
    i: DispatchCommandIntent,
    dispatchId?: string,
    itemId?: string,
    key?: string,
  ) => service().execute(context(f, dispatchId, itemId, key), i);
  async function admitted() {
    const f = await fixture();
    await db.healthcareCase.update({
      where: { id: f.c.id },
      data: {
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-11-01T10:00:00Z'),
        scheduledEnd: new Date('2026-11-01T12:00:00Z'),
      },
    });
    await db.healthcareCaseKit.update({
      where: { id: f.kit.id },
      data: {
        status: 'PREPARED',
        preparedById: f.user.id,
        preparedAt: new Date(),
      },
    });
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { physicalLocation: 'WAREHOUSE' },
    });
    return f;
  }
  const create = (f: F, key?: string) =>
    run(
      f,
      { operation: 'CREATE', dto: { custodian } },
      undefined,
      undefined,
      key,
    );
  const addMaterial = (
    f: F,
    dispatchId: string,
    expectedRevision = 0,
    quantity = 2,
    key?: string,
  ) =>
    run(
      f,
      {
        operation: 'ITEM_ADD',
        dto: {
          type: 'MATERIAL',
          expectedRevision,
          sourceCaseKitItemId: f.source.id,
          sourcePositionId: f.position.id,
          batchId: null,
          quantity,
        },
      },
      dispatchId,
      undefined,
      key,
    );
  const addEquipment = (
    f: F,
    dispatchId: string,
    expectedRevision = 0,
    key?: string,
  ) =>
    run(
      f,
      {
        operation: 'ITEM_ADD',
        dto: {
          type: 'EQUIPMENT',
          expectedRevision,
          sourceCaseKitItemId: f.es.id,
        },
      },
      dispatchId,
      undefined,
      key,
    );
  function gate() {
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>((r) => (release = r)),
      held = new Promise<void>((r) => (entered = r));
    return { release, entered, blocked, held };
  }
  async function observedLock() {
    for (let n = 0; n < 100; n++) {
      const [{ waiting }] = await db.$queryRaw<
        { waiting: boolean }[]
      >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='dispatch-command-b' AND wait_event_type='Lock') AS waiting`;
      if (waiting) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error('Concurrent contender never reached observable DB lock');
  }
  async function race(
    f: F,
    a: DispatchCommandIntent,
    b: DispatchCommandIntent,
    id: string | undefined,
    itemId: string | undefined,
    sameKey = false,
    holdClaim = false,
  ) {
    const g = gate(),
      repo = repository(one);
    if (holdClaim) {
      const original = (
        ...args: Parameters<
          HealthcareCaseDispatchCommandRepository['createClaim']
        >
      ) => repository(one).createClaim(...args);
      jest.spyOn(repo, 'createClaim').mockImplementation(async (...args) => {
        const result = await original(...args);
        g.entered();
        await g.blocked;
        return result;
      });
    } else {
      const original = (
        ...args: Parameters<
          HealthcareCaseDispatchCommandRepository['lockDraftById']
        >
      ) => repository(one).lockDraftById(...args);
      jest.spyOn(repo, 'lockDraftById').mockImplementation(async (...args) => {
        const result = await original(...args);
        g.entered();
        await g.blocked;
        return result;
      });
    }
    const key = randomUUID(),
      first = new HealthcareCaseDispatchCommandService(repo, policy).execute(
        context(f, id, itemId, key),
        a,
      );
    // Attach handlers before either contender can reject.
    const firstResult = first.then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error: error as Error }),
    );
    await g.held;
    const second = service(two).execute(
      context(f, id, itemId, sameKey ? key : randomUUID()),
      b,
    );
    const secondResult = second.then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error: error as Error }),
    );
    try {
      await observedLock();
    } finally {
      g.release();
    }
    const result = await Promise.all([firstResult, secondResult]);
    return result;
  }
  async function physical(f: F) {
    return {
      effects: await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
      custodies: await db.equipmentAssetCustody.count({
        where: { companyId: f.companyId },
      }),
      events: await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: f.companyId },
      }),
      positions: await db.inventoryPosition.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      assets: await db.equipmentAsset.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
      assignments: await db.healthcareEquipmentAssignment.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      }),
    };
  }
  it('01 concurrent same-key CREATE has one durable winner; observable unique lock', async () => {
    const f = await admitted(),
      intent: DispatchCommandIntent = {
        operation: 'CREATE',
        dto: { custodian },
      };
    const result = await race(
      f,
      intent,
      intent,
      undefined,
      undefined,
      true,
      true,
    );
    expect(result.every((r) => r.ok)).toBe(true);
    if (result[0].ok && result[1].ok) {
      expect(result[0].value.data.id).toBe(result[1].value.data.id);
      expect(result[1].value.replay).toBe(true);
    }
    expect(
      await db.healthcareCaseDispatch.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
    expect(
      await db.healthcareCaseDispatchAudit.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it('02 different-key concurrent CREATE permits two DRAFTs', async () => {
    const f = await admitted();
    const [a, b] = await Promise.all([
      create(f),
      service(two).execute(context(f), {
        operation: 'CREATE',
        dto: { custodian },
      }),
    ]);
    expect(a.data.id).not.toBe(b.data.id);
  });
  it('03 CUSTODIAN replay after later revision preserves original receipt', async () => {
    const f = await admitted(),
      d = await create(f),
      key = randomUUID(),
      intent: DispatchCommandIntent = {
        operation: 'CUSTODIAN_SET',
        dto: {
          expectedRevision: 0,
          custodian: { ...custodian, displayName: 'First' },
        },
      };
    const first = await run(f, intent, d.data.id, undefined, key);
    await run(
      f,
      {
        operation: 'CUSTODIAN_SET',
        dto: {
          expectedRevision: 1,
          custodian: { ...custodian, displayName: 'Later' },
        },
      },
      d.data.id,
    );
    const actor = await db.user.create({
      data: {
        companyId: f.companyId,
        firstName: 'Retry',
        lastName: 'Actor',
        email: randomUUID() + '@example.invalid',
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    const replay = await service().execute(
      { ...context(f, d.data.id, undefined, key), actorId: actor.id },
      intent,
    );
    expect(replay.command).toEqual(first.command);
    expect(replay).toMatchObject({
      replay: true,
      data: { revision: 2, custodian: { displayName: 'Later' } },
    });
  });
  it('04 stale revision race has one success and one 409', async () => {
    const f = await admitted(),
      d = await create(f);
    const results = await race(
      f,
      { operation: 'CUSTODIAN_SET', dto: { expectedRevision: 0, custodian } },
      {
        operation: 'CUSTODIAN_SET',
        dto: {
          expectedRevision: 0,
          custodian: { ...custodian, displayName: 'Other' },
        },
      },
      d.data.id,
      undefined,
    );
    expect(results[0].ok).toBe(true);
    expect(results[1]).toMatchObject({
      ok: false,
      error: { status: 409, response: { code: 'RESOURCE_STATE_CHANGED' } },
    });
    expect(
      await db.healthcareCaseDispatchAudit.count({
        where: { dispatchId: d.data.id },
      }),
    ).toBe(2);
  });
  it('05 concurrent same-source ADD same Dispatch is clean conflict', async () => {
    const f = await admitted(),
      d = await create(f),
      intent: DispatchCommandIntent = {
        operation: 'ITEM_ADD',
        dto: {
          type: 'MATERIAL',
          sourceCaseKitItemId: f.source.id,
          expectedRevision: 0,
          quantity: 2,
          batchId: null,
          sourcePositionId: f.position.id,
        },
      };
    const results = await race(f, intent, intent, d.data.id, undefined);
    expect(results[0].ok).toBe(true);
    expect(results[1]).toMatchObject({ ok: false, error: { status: 409 } });
    await expect(addMaterial(f, d.data.id, 1)).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_SOURCE_ALREADY_REPRESENTED' },
    });
    expect(
      await db.healthcareCaseDispatchItem.count({
        where: { dispatchId: d.data.id },
      }),
    ).toBe(1);
  });
  it('06 same Equipment source across two DRAFTs allowed', async () => {
    const f = await admitted(),
      a = await create(f),
      b = await create(f);
    await Promise.all([
      addEquipment(f, a.data.id),
      service(two).execute(context(f, b.data.id), {
        operation: 'ITEM_ADD',
        dto: {
          type: 'EQUIPMENT',
          expectedRevision: 0,
          sourceCaseKitItemId: f.es.id,
        },
      }),
    ]);
    expect(
      await db.healthcareCaseDispatchItem.count({
        where: { companyId: f.companyId, type: 'EQUIPMENT' },
      }),
    ).toBe(2);
  });
  it('07 confirmed Equipment source blocks later add even after episode closes', async () => {
    const f = await admitted(),
      history = await confirmed(f, true),
      item = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
        where: { id: history.i.id },
      });
    await db.$transaction(async (tx) => {
      await tx.equipmentAssetCustody.update({
        where: { id: item.equipmentCustodyId! },
        data: { closedAt: new Date(), closedById: f.user.id },
      });
      await tx.equipmentAsset.update({
        where: { id: f.asset.id },
        data: {
          physicalLocation: 'WAREHOUSE',
          activeCustodyId: null,
          physicalRevision: 2,
        },
      });
    });
    const d = await create(f),
      before = await physical(f);
    await expect(addEquipment(f, d.data.id)).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_CAPACITY_EXCEEDED' },
    });
    expect(await physical(f)).toEqual(before);
  });
  it('08 confirmed material history consumes prepared capacity', async () => {
    const f = await admitted();
    await confirmed(f);
    const d = await create(f);
    await db.inventoryPosition.update({
      where: { id: f.position.id },
      data: { quantity: 20 },
    });
    await expect(addMaterial(f, d.data.id, 0, 9)).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_CAPACITY_EXCEEDED' },
    });
    await expect(addMaterial(f, d.data.id, 0, 8)).resolves.toHaveProperty(
      'replay',
      false,
    );
  });
  it('09 competing Material DRAFTs do not reserve stock or prepared capacity', async () => {
    const f = await admitted(),
      a = await create(f),
      b = await create(f),
      before = await physical(f);
    await addMaterial(f, a.data.id, 0, 8);
    await addMaterial(f, b.data.id, 0, 8);
    expect(await physical(f)).toEqual(before);
  });
  it('10 same-Position local aggregate includes different prepared sources', async () => {
    const f = await admitted(),
      d = await create(f);
    await addMaterial(f, d.data.id, 0, 6);
    // Structural stale-preparation fixture: the old selected item remains in the
    // DRAFT while a replacement prepared source references the same Requirement.
    await db.healthcareCaseKitItem.update({
      where: { id: f.source.id },
      data: {
        lifecycle: 'EXCLUDED',
        excludedById: f.user.id,
        excludedAt: new Date(),
        exclusionReason: 'Fixture replacement',
      },
    });
    const source = await db.healthcareCaseKitItem.create({
      data: {
        companyId: f.companyId,
        caseId: f.c.id,
        caseKitId: f.kit.id,
        requirementId: f.requirement.id,
        preparedQuantity: 10,
        addedById: f.user.id,
      },
    });
    await expect(
      run(
        f,
        {
          operation: 'ITEM_ADD',
          dto: {
            type: 'MATERIAL',
            expectedRevision: 1,
            sourceCaseKitItemId: source.id,
            sourcePositionId: f.position.id,
            batchId: null,
            quantity: 5,
          },
        },
        d.data.id,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_CAPACITY_EXCEEDED' },
    });
  });
  it('11 ITEM_EXCLUDE vs mutation race advances only once', async () => {
    const f = await admitted(),
      d = await create(f),
      added = await addMaterial(f, d.data.id);
    const result = await race(
      f,
      {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 1, reason: 'Exclude' },
      },
      { operation: 'CUSTODIAN_SET', dto: { expectedRevision: 1, custodian } },
      d.data.id,
      added.command.itemId!,
    );
    expect(result[0].ok).toBe(true);
    expect(result[1]).toMatchObject({
      ok: false,
      error: { response: { code: 'RESOURCE_STATE_CHANGED' } },
    });
  });
  it('12 CANCEL vs mutation race advances once and leaves immutable terminal', async () => {
    const f = await admitted(),
      d = await create(f);
    const result = await race(
      f,
      { operation: 'CANCEL', dto: { expectedRevision: 0, reason: 'Cancel' } },
      { operation: 'CUSTODIAN_SET', dto: { expectedRevision: 0, custodian } },
      d.data.id,
      undefined,
    );
    expect(result[0].ok).toBe(true);
    expect(result[1]).toMatchObject({ ok: false, error: { status: 409 } });
    await rejected(
      db.healthcareCaseDispatch.update({
        where: { id: d.data.id },
        data: { revision: 2 },
      }),
    );
  });
  it('13 lost response CREATE replay succeeds after Case degrades', async () => {
    const f = await admitted(),
      key = randomUUID(),
      original = await create(f, key);
    await db.healthcareCase.update({
      where: { id: f.c.id },
      data: { status: 'DRAFT' },
    });
    const replay = await create(f, key);
    expect(replay.command).toEqual(original.command);
    expect(replay.replay).toBe(true);
    expect(
      await db.healthcareCaseDispatch.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });
  it('14 same key different payload conflicts before degraded business state', async () => {
    const f = await admitted(),
      key = randomUUID();
    await create(f, key);
    await db.healthcareCase.update({
      where: { id: f.c.id },
      data: { status: 'DRAFT' },
    });
    await expect(
      run(
        f,
        {
          operation: 'CREATE',
          dto: { custodian: { ...custodian, displayName: 'Different' } },
        },
        undefined,
        undefined,
        key,
      ),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });
  it('15/16 injected failure after audit rolls back mutation, revision, audit and claim', async () => {
    const f = await admitted(),
      d = await create(f),
      repo = repository(),
      key = randomUUID();
    jest
      .spyOn(repo, 'completeClaim')
      .mockRejectedValue(new Error('injected completion failure'));
    await expect(
      new HealthcareCaseDispatchCommandService(repo, policy).execute(
        context(f, d.data.id, undefined, key),
        {
          operation: 'CUSTODIAN_SET',
          dto: {
            expectedRevision: 0,
            custodian: { ...custodian, displayName: 'Changed' },
          },
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
    });
    expect(
      (
        await db.healthcareCaseDispatch.findUniqueOrThrow({
          where: { id: d.data.id },
        })
      ).revision,
    ).toBe(0);
    expect(
      await db.healthcareCaseDispatchAudit.count({
        where: { dispatchId: d.data.id },
      }),
    ).toBe(1);
    expect(
      await db.idempotencyRecord.count({
        where: { companyId: f.companyId, key },
      }),
    ).toBe(0);
  });
  it('17 CANCEL remains possible after degraded Case; new-key terminal rejected', async () => {
    const f = await admitted(),
      d = await create(f),
      key = randomUUID();
    await db.healthcareCase.update({
      where: { id: f.c.id },
      data: { status: 'DRAFT' },
    });
    const intent: DispatchCommandIntent = {
      operation: 'CANCEL',
      dto: { expectedRevision: 0, reason: 'Cancel' },
    };
    await run(f, intent, d.data.id, undefined, key);
    expect((await run(f, intent, d.data.id, undefined, key)).replay).toBe(true);
    await expect(
      run(
        f,
        {
          operation: 'CANCEL',
          dto: { expectedRevision: 1, reason: 'Again' },
        },
        d.data.id,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_NOT_MUTABLE' },
    });
  });
  it('18 tenant and wrong-Case isolation', async () => {
    const f = await admitted(),
      o = await admitted(),
      d = await create(f);
    await expect(
      run(
        o,
        {
          operation: 'CANCEL',
          dto: { expectedRevision: 0, reason: 'Foreign' },
        },
        d.data.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
    const other = await db.healthcareCase.create({
      data: {
        companyId: f.companyId,
        createdById: f.user.id,
        title: 'Other',
        folio: randomUUID(),
      },
    });
    await expect(
      service().execute(
        { ...context(f, d.data.id), caseId: other.id },
        {
          operation: 'CUSTODIAN_SET',
          dto: { expectedRevision: 0, custodian },
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('19 ADD/EXCLUDE receipts survive later legitimate revisions and cancellation', async () => {
    const f = await admitted(),
      d = await create(f),
      key = randomUUID(),
      added = await addMaterial(f, d.data.id, 0, 2, key),
      excludeKey = randomUUID(),
      intent: DispatchCommandIntent = {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 1, reason: 'Exclude' },
      };
    const excluded = await run(
      f,
      intent,
      d.data.id,
      added.command.itemId!,
      excludeKey,
    );
    await run(
      f,
      { operation: 'CANCEL', dto: { expectedRevision: 2, reason: 'Cancel' } },
      d.data.id,
    );
    const replay = await addMaterial(f, d.data.id, 0, 2, key);
    expect(replay.command).toEqual(added.command);
    expect(replay.data.status).toBe('CANCELLED');
    expect(replay.data.items[0].lifecycle).toBe('EXCLUDED');
    expect(
      (await run(f, intent, d.data.id, added.command.itemId!, excludeKey))
        .command,
    ).toEqual(excluded.command);
  });
  it('20 all five commands leave physical state and effect/custody/event counts unchanged', async () => {
    const f = await admitted(),
      before = await physical(f),
      d = await create(f);
    await run(
      f,
      { operation: 'CUSTODIAN_SET', dto: { expectedRevision: 0, custodian } },
      d.data.id,
    );
    const added = await addMaterial(f, d.data.id, 1);
    await addEquipment(f, d.data.id, 2);
    await run(
      f,
      {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 3, reason: 'Exclude' },
      },
      d.data.id,
      added.command.itemId!,
    );
    await run(
      f,
      { operation: 'CANCEL', dto: { expectedRevision: 4, reason: 'Cancel' } },
      d.data.id,
    );
    expect(await physical(f)).toEqual(before);
  });
  it.each(['NONE', 'REQUIRED', 'OPTIONAL'] as const)(
    '21 material tracking %s captures server Position revision',
    async (lotTracking) => {
      const f = await admitted();
      await db.product.update({
        where: { id: f.product.id },
        data: { lotTracking },
      });
      let batchId: string | null = null,
        positionId = f.position.id;
      if (lotTracking !== 'NONE') {
        const batch = await db.inventoryBatch.create({
          data: {
            companyId: f.companyId,
            productId: f.product.id,
            lotNumber: 'B',
            expirationDate: new Date('2099-01-01'),
          },
        });
        batchId = batch.id;
        positionId = (
          await db.inventoryPosition.create({
            data: {
              companyId: f.companyId,
              productId: f.product.id,
              inventoryBatchId: batchId,
              state: 'AVAILABLE',
              quantity: 10,
              revision: 7,
            },
          })
        ).id;
      } else
        await db.inventoryPosition.update({
          where: { id: positionId },
          data: { revision: 7 },
        });
      const d = await create(f);
      const r = await run(
        f,
        {
          operation: 'ITEM_ADD',
          dto: {
            type: 'MATERIAL',
            expectedRevision: 0,
            sourceCaseKitItemId: f.source.id,
            quantity: 2,
            sourcePositionId: positionId,
            batchId,
          },
        },
        d.data.id,
      );
      expect(r.data.items[0].expectedPositionRevision).toBe(7);
    },
  );
  it('22 OPTIONAL unbatched allowed; Product.stock irrelevant', async () => {
    const f = await admitted();
    await db.product.update({
      where: { id: f.product.id },
      data: { lotTracking: 'OPTIONAL', stock: 0 },
    });
    const d = await create(f);
    await expect(addMaterial(f, d.data.id)).resolves.toHaveProperty(
      'replay',
      false,
    );
  });
  it.each(['inactive', 'expired'] as const)(
    '23 rejects %s batch',
    async (mode) => {
      const f = await admitted();
      await db.product.update({
        where: { id: f.product.id },
        data: { lotTracking: 'REQUIRED' },
      });
      const batch = await db.inventoryBatch.create({
        data: {
          companyId: f.companyId,
          productId: f.product.id,
          lotNumber: 'BAD',
          isActive: mode !== 'inactive',
          expirationDate: mode === 'expired' ? new Date('2000-01-01') : null,
        },
      });
      const p = await db.inventoryPosition.create({
        data: {
          companyId: f.companyId,
          productId: f.product.id,
          inventoryBatchId: batch.id,
          state: 'AVAILABLE',
          quantity: 10,
        },
      });
      const d = await create(f);
      await expect(
        run(
          f,
          {
            operation: 'ITEM_ADD',
            dto: {
              type: 'MATERIAL',
              expectedRevision: 0,
              sourceCaseKitItemId: f.source.id,
              quantity: 2,
              sourcePositionId: p.id,
              batchId: batch.id,
            },
          },
          d.data.id,
        ),
      ).rejects.toMatchObject({
        response: { code: 'CASE_DISPATCH_SOURCE_NOT_VALID' },
      });
    },
  );
  it.each([
    { physicalLocation: 'UNVERIFIED' as const },
    { condition: 'DAMAGED' as const },
    { lifecycle: 'RETIRED' as const },
  ])('24 Equipment current eligibility rejects %j', async (patch) => {
    const f = await admitted(),
      d = await create(f);
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: patch,
    });
    await expect(addEquipment(f, d.data.id)).rejects.toMatchObject({
      response: { code: 'EQUIPMENT_ASSET_NOT_ELIGIBLE' },
    });
  });
  it('25 Equipment captures physical revision without mutating Asset', async () => {
    const f = await admitted();
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { physicalRevision: 4 },
    });
    const d = await create(f),
      before = await physical(f),
      r = await addEquipment(f, d.data.id);
    expect(r.data.items[0].expectedPhysicalRevision).toBe(4);
    expect(await physical(f)).toEqual(before);
  });
  it('26 new key on excluded item conflicts; excluded capacity reusable', async () => {
    const f = await admitted(),
      d = await create(f),
      a = await addMaterial(f, d.data.id, 0, 8);
    await run(
      f,
      {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 1, reason: 'Exclude' },
      },
      d.data.id,
      a.command.itemId!,
    );
    await expect(
      run(
        f,
        {
          operation: 'ITEM_EXCLUDE',
          dto: { expectedRevision: 2, reason: 'Exclude' },
        },
        d.data.id,
        a.command.itemId!,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CASE_DISPATCH_ITEM_ALREADY_EXCLUDED' },
    });
    await expect(addMaterial(f, d.data.id, 2, 8)).resolves.toHaveProperty(
      'replay',
      false,
    );
  });
  it('27 same custodian/new key is a real revisioned command', async () => {
    const f = await admitted(),
      d = await create(f);
    const a = await run(
        f,
        {
          operation: 'CUSTODIAN_SET',
          dto: { expectedRevision: 0, custodian },
        },
        d.data.id,
      ),
      b = await run(
        f,
        {
          operation: 'CUSTODIAN_SET',
          dto: { expectedRevision: 1, custodian },
        },
        d.data.id,
      );
    expect(a.command.revisionAfter).toBe(1);
    expect(b.command.revisionAfter).toBe(2);
    expect(
      await db.healthcareCaseDispatchAudit.count({
        where: { dispatchId: d.data.id },
      }),
    ).toBe(3);
  });
  it('28 internal custodian tenant FK and nullable user', async () => {
    const f = await admitted(),
      o = await admitted();
    const d = await run(f, {
      operation: 'CREATE',
      dto: {
        custodian: {
          type: 'INTERNAL_USER',
          displayName: 'Internal',
          userId: f.user.id,
        },
      },
    });
    expect(d.data.custodian.userId).toBe(f.user.id);
    await expect(
      run(
        f,
        {
          operation: 'CUSTODIAN_SET',
          dto: {
            expectedRevision: 0,
            custodian: {
              type: 'INTERNAL_USER',
              displayName: 'Foreign',
              userId: o.user.id,
            },
          },
        },
        d.data.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      run(
        f,
        {
          operation: 'CUSTODIAN_SET',
          dto: {
            expectedRevision: 0,
            custodian: {
              type: 'INTERNAL_USER',
              displayName: 'Without account',
              userId: null,
            },
          },
        },
        d.data.id,
      ),
    ).resolves.toHaveProperty('replay', false);
  });
  it('29 wrong-Case ITEM_ADD is 404 even when that Case has no Kit/schedule', async () => {
    const f = await admitted(),
      d = await create(f),
      other = await db.healthcareCase.create({
        data: {
          companyId: f.companyId,
          createdById: f.user.id,
          title: 'Other',
          folio: randomUUID(),
        },
      });
    await expect(
      service().execute(
        { ...context(f, d.data.id), caseId: other.id },
        {
          operation: 'ITEM_ADD',
          dto: {
            type: 'EQUIPMENT',
            expectedRevision: 0,
            sourceCaseKitItemId: f.es.id,
          },
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('30 Equipment currently in CUSTODY fails early eligibility', async () => {
    const f = await admitted(),
      d = await create(f);
    await confirmed(f, true);
    await expect(addEquipment(f, d.data.id)).rejects.toMatchObject({
      response: { code: 'EQUIPMENT_ASSET_NOT_ELIGIBLE' },
    });
  });
  it.each([
    'tracking',
    'inactive-product',
    'position-product',
    'position-context',
    'balance',
    'assignment',
  ] as const)(
    '31 source rejection %s produces no audit or completed claim',
    async (mode) => {
      const f = await admitted(),
        d = await create(f);
      if (mode === 'tracking')
        await db.product.update({
          where: { id: f.product.id },
          data: { lotTracking: 'REQUIRED' },
        });
      if (mode === 'inactive-product')
        await db.product.update({
          where: { id: f.product.id },
          data: { isActive: false },
        });
      if (mode === 'position-product')
        await db.inventoryPosition.update({
          where: { id: f.position.id },
          data: { productId: f.ep.id },
        });
      if (mode === 'position-context') {
        const foreign = await db.inventoryPosition.create({
          data: {
            companyId: f.companyId,
            productId: f.product.id,
            state: 'CUSTODY',
            contextType: 'CASE_DISPATCH_ITEM',
            contextId: randomUUID(),
            quantity: 10,
          },
        });
        f.position.id = foreign.id;
      }
      if (mode === 'balance')
        await db.inventoryPosition.update({
          where: { id: f.position.id },
          data: { quantity: 1 },
        });
      if (mode === 'assignment')
        await db.healthcareEquipmentAssignment.update({
          where: { id: f.assignment.id },
          data: {
            lifecycle: 'RELEASED',
            releasedById: f.user.id,
            releasedAt: new Date(),
            releaseReason: 'Fixture',
            releaseCause: 'MANUAL',
          },
        });
      const before = await physical(f);
      await expect(
        mode === 'assignment'
          ? addEquipment(f, d.data.id)
          : addMaterial(f, d.data.id),
      ).rejects.toMatchObject({ status: 409 });
      expect(await physical(f)).toEqual(before);
      expect(
        await db.healthcareCaseDispatchAudit.count({
          where: { dispatchId: d.data.id },
        }),
      ).toBe(1);
      expect(
        await db.idempotencyRecord.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(1);
    },
  );
  // HC-DSP-LOCK-01: real services, independent clients and exact blocker PID.
  const assignmentRepo = (client: PrismaClient) =>
    new HealthcareEquipmentAssignmentsRepository(client as PrismaService);
  const assignmentService = (repo: HealthcareEquipmentAssignmentsRepository) =>
    new HealthcareEquipmentAssignmentsService(repo, policy);
  const kitService = (client: PrismaClient) =>
    new HealthcareCaseKitsService(
      new HealthcareCaseKitsRepository(client as PrismaService),
      policy,
    );
  const caseService = (client: PrismaClient) =>
    new HealthcareCaseService(
      client as PrismaService,
      {} as never,
      assignmentService(assignmentRepo(client)),
      policy,
    );
  const equipmentIntent = (f: F): DispatchCommandIntent => ({
    operation: 'ITEM_ADD',
    dto: {
      type: 'EQUIPMENT',
      sourceCaseKitItemId: f.es.id,
      expectedRevision: 0,
    },
  });
  const createIntent = (): DispatchCommandIntent => ({
    operation: 'CREATE',
    dto: { custodian },
  });
  function lockGate() {
    const g = gate();
    let pid = 0;
    return {
      ...g,
      pid: () => pid,
      async pause(tx: Prisma.TransactionClient) {
        const [row] = await tx.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        pid = row.pid;
        g.entered();
        await g.blocked;
      },
    };
  }
  async function exactBlocking(pid: number) {
    for (let n = 0; n < 150; n++) {
      const rows = await db.$queryRaw<{ pid: number; blockers: number[] }[]>`
        SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
        WHERE application_name='dispatch-command-b' AND wait_event_type='Lock'`;
      const row = rows.find((r) => r.blockers.includes(pid));
      if (row) {
        console.log(`LOCK BARRIER: backend ${row.pid} waits for ${pid}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error('Expected exact blocking backend not observed');
  }
  async function lockedRace(
    g: ReturnType<typeof lockGate>,
    first: () => Promise<unknown>,
    second: () => Promise<unknown>,
  ) {
    const a = first();
    const aResult = Promise.allSettled([a]);
    let bResult: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await Promise.race([
        g.held,
        a.then(() => {
          throw Error('Holder completed before barrier');
        }),
      ]);
      bResult = Promise.allSettled([second()]);
      await exactBlocking(g.pid());
    } finally {
      g.release();
    }
    const [ar, br] = await Promise.all([aResult, bResult]);
    const results = [...ar, ...br];
    for (const result of results)
      if (result.status === 'rejected')
        expect(String(result.reason)).not.toMatch(/40P01|deadlock/i);
    return results;
  }
  function holdDraft(
    repo: HealthcareCaseDispatchCommandRepository,
    g: ReturnType<typeof lockGate>,
    point: 'assignments' | 'case' | 'root' = 'assignments',
    fail = false,
  ) {
    if (point === 'assignments') {
      const original = (
        ...args: Parameters<
          HealthcareCaseDispatchCommandRepository['lockAssignmentsForShare']
        >
      ) => repository(one).lockAssignmentsForShare(...args);
      jest
        .spyOn(repo, 'lockAssignmentsForShare')
        .mockImplementation(async (...args) => {
          await original(...args);
          await g.pause(args[2]);
          if (fail) throw Error('Injected rollback after physical locks');
        });
    } else if (point === 'case') {
      const original = (
        ...args: Parameters<
          HealthcareCaseDispatchCommandRepository['lockCaseForShare']
        >
      ) => repository(one).lockCaseForShare(...args);
      jest
        .spyOn(repo, 'lockCaseForShare')
        .mockImplementation(async (...args) => {
          await original(...args);
          await g.pause(args[2]);
        });
    } else {
      const original = (
        ...args: Parameters<
          HealthcareCaseDispatchCommandRepository['lockDraftById']
        >
      ) => repository(one).lockDraftById(...args);
      jest.spyOn(repo, 'lockDraftById').mockImplementation(async (...args) => {
        const r = await original(...args);
        await g.pause(args[1]);
        return r;
      });
    }
  }
  function holdWriter(
    repo: HealthcareEquipmentAssignmentsRepository,
    g: ReturnType<typeof lockGate>,
    point: 'asset' | 'assignment',
  ) {
    if (point === 'asset') {
      const original = (
        ...args: Parameters<
          HealthcareEquipmentAssignmentsRepository['lockEquipmentAsset']
        >
      ) => assignmentRepo(one).lockEquipmentAsset(...args);
      jest
        .spyOn(repo, 'lockEquipmentAsset')
        .mockImplementation(async (...args) => {
          const r = await original(...args);
          await g.pause(args[0]);
          return r;
        });
    } else {
      const original = (
        ...args: Parameters<
          HealthcareEquipmentAssignmentsRepository['lockAssignment']
        >
      ) => assignmentRepo(one).lockAssignment(...args);
      jest.spyOn(repo, 'lockAssignment').mockImplementation(async (...args) => {
        const r = await original(...args);
        await g.pause(args[0]);
        return r;
      });
    }
  }
  async function destination(f: F) {
    return db.equipmentAsset.create({
      data: {
        companyId: f.companyId,
        productId: f.ep.id,
        assetCode: randomUUID(),
        condition: 'GOOD',
        physicalLocation: 'WAREHOUSE',
      },
    });
  }
  async function noDraftPhysicalEffects(f: F) {
    const p = await physical(f);
    expect([p.effects, p.custodies, p.events]).toEqual([0, 0, 0]);
    expect(
      p.assets.every(
        (a) => a.physicalRevision === 0 && a.activeCustodyId === null,
      ),
    ).toBe(true);
  }
  async function assertAdd(f: F, dispatchId: string, present: boolean) {
    const root = await db.healthcareCaseDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
    });
    expect(root.revision).toBe(present ? 1 : 0);
    const items = await db.healthcareCaseDispatchItem.findMany({
      where: { dispatchId },
    });
    expect(items).toHaveLength(present ? 1 : 0);
    if (present)
      expect(items[0]).toMatchObject({
        assignmentId: f.assignment.id,
        assetId: f.asset.id,
        expectedPhysicalRevision: 0,
      });
    expect(
      await db.healthcareCaseDispatchAudit.count({
        where: { dispatchId, operation: 'ITEM_ADD' },
      }),
    ).toBe(present ? 1 : 0);
    await noDraftPhysicalEffects(f);
  }
  it.each(['draft-first', 'release-first'])(
    'LOCK01 1/2 ADD vs real RELEASE %s',
    async (order) => {
      const f = await admitted(),
        d = await create(f),
        g = lockGate(),
        dr = repository(one),
        wr = assignmentRepo(order === 'draft-first' ? two : one);
      const release = () =>
        assignmentService(wr).release(
          f.companyId,
          f.user.id,
          f.assignment.id,
          { reason: 'Compatibility release' },
          randomUUID(),
        );
      let results: PromiseSettledResult<unknown>[];
      if (order === 'draft-first') {
        holdDraft(dr, g);
        results = await lockedRace(
          g,
          () =>
            new HealthcareCaseDispatchCommandService(dr, policy).execute(
              context(f, d.data.id),
              equipmentIntent(f),
            ),
          release,
        );
        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      } else {
        holdWriter(wr, g, 'asset');
        results = await lockedRace(g, release, () =>
          service(two).execute(context(f, d.data.id), equipmentIntent(f)),
        );
        expect(results[0].status).toBe('fulfilled');
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { status: 409 },
        });
      }
      expect(
        await db.healthcareEquipmentAssignment.findUnique({
          where: { id: f.assignment.id },
        }),
      ).toMatchObject({
        lifecycle: 'RELEASED',
        releaseReason: 'Compatibility release',
        releaseCause: 'MANUAL',
      });
      await assertAdd(f, d.data.id, order === 'draft-first');
    },
  );
  it.each(['draft-first', 'replace-first'])(
    'LOCK01 3/4 ADD vs real REPLACE %s different destination',
    async (order) => {
      const f = await admitted(),
        d = await create(f),
        next = await destination(f),
        g = lockGate(),
        dr = repository(one),
        wr = assignmentRepo(order === 'draft-first' ? two : one);
      const replace = () =>
        assignmentService(wr).replace(
          f.companyId,
          f.user.id,
          f.assignment.id,
          randomUUID(),
          {
            equipmentAssetId: next.id,
            replacementReason: 'Compatibility replacement',
          },
        );
      let results: PromiseSettledResult<unknown>[];
      if (order === 'draft-first') {
        holdDraft(dr, g);
        results = await lockedRace(
          g,
          () =>
            new HealthcareCaseDispatchCommandService(dr, policy).execute(
              context(f, d.data.id),
              equipmentIntent(f),
            ),
          replace,
        );
      } else {
        holdWriter(wr, g, 'assignment');
        results = await lockedRace(g, replace, () =>
          service(two).execute(context(f, d.data.id), equipmentIntent(f)),
        );
      }
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe(
        order === 'draft-first' ? 'fulfilled' : 'rejected',
      );
      expect(
        await db.healthcareEquipmentAssignment.findUnique({
          where: { id: f.assignment.id },
        }),
      ).toMatchObject({ lifecycle: 'REPLACED' });
      expect(
        await db.healthcareEquipmentAssignment.count({
          where: {
            companyId: f.companyId,
            equipmentAssetId: next.id,
            lifecycle: 'RESERVED',
            replacesAssignmentId: f.assignment.id,
          },
        }),
      ).toBe(1);
      await assertAdd(f, d.data.id, order === 'draft-first');
    },
  );
  async function relatedCase(f: F) {
    return db.healthcareCase.create({
      data: {
        companyId: f.companyId,
        createdById: f.user.id,
        folio: randomUUID(),
        title: 'Related scheduling',
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-11-03T10:00:00Z'),
        scheduledEnd: new Date('2026-11-03T12:00:00Z'),
      },
    });
  }
  it.each(['ADD', 'CREATE'])(
    'LOCK01 5/6 %s vs real Assignment CREATE on related Case',
    async (kind) => {
      const f = await admitted(),
        d = kind === 'ADD' ? await create(f) : null,
        other = await relatedCase(f),
        g = lockGate(),
        dr = repository(one);
      holdDraft(dr, g);
      const results = await lockedRace(
        g,
        () =>
          new HealthcareCaseDispatchCommandService(dr, policy).execute(
            context(f, d?.data.id),
            kind === 'ADD' ? equipmentIntent(f) : createIntent(),
          ),
        () =>
          assignmentService(assignmentRepo(two)).create(
            f.companyId,
            f.user.id,
            randomUUID(),
            {
              caseId: other.id,
              equipmentAssetId: f.asset.id,
              directAssignmentReason: 'Related scheduling',
            },
          ),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(
        await db.healthcareEquipmentAssignment.count({
          where: {
            companyId: f.companyId,
            equipmentAssetId: f.asset.id,
            lifecycle: 'RESERVED',
          },
        }),
      ).toBe(2);
      await noDraftPhysicalEffects(f);
    },
  );
  it('LOCK01 7 CREATE readiness vs real REPLACE', async () => {
    const f = await admitted(),
      next = await destination(f),
      g = lockGate(),
      dr = repository(one);
    holdDraft(dr, g);
    const results = await lockedRace(
      g,
      () =>
        new HealthcareCaseDispatchCommandService(dr, policy).execute(
          context(f),
          createIntent(),
        ),
      () =>
        assignmentService(assignmentRepo(two)).replace(
          f.companyId,
          f.user.id,
          f.assignment.id,
          randomUUID(),
          { equipmentAssetId: next.id, replacementReason: 'Readiness race' },
        ),
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(
      await db.healthcareCaseDispatch.count({
        where: { companyId: f.companyId, revision: 0 },
      }),
    ).toBe(1);
    await noDraftPhysicalEffects(f);
  });
  it.each(['CANCEL', 'CUSTODIAN_SET'])(
    'LOCK01 8/9 ADD serializes with %s',
    async (operation) => {
      const f = await admitted(),
        d = await create(f),
        g = lockGate(),
        dr = repository(one);
      holdDraft(dr, g);
      const intent: DispatchCommandIntent =
        operation === 'CANCEL'
          ? { operation, dto: { expectedRevision: 0, reason: 'Cancel race' } }
          : {
              operation: 'CUSTODIAN_SET',
              dto: {
                expectedRevision: 0,
                custodian: { ...custodian, displayName: 'Changed' },
              },
            };
      const results = await lockedRace(
        g,
        () =>
          new HealthcareCaseDispatchCommandService(dr, policy).execute(
            context(f, d.data.id),
            equipmentIntent(f),
          ),
        () => service(two).execute(context(f, d.data.id), intent),
      );
      expect(results[0].status).toBe('fulfilled');
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: { status: 409 },
      });
      await assertAdd(f, d.data.id, true);
    },
  );
  it('LOCK01 10 two Equipment ADDs, one revision winner and one audit', async () => {
    const f = await admitted(),
      d = await create(f),
      g = lockGate(),
      dr = repository(one);
    holdDraft(dr, g);
    const results = await lockedRace(
      g,
      () =>
        new HealthcareCaseDispatchCommandService(dr, policy).execute(
          context(f, d.data.id),
          equipmentIntent(f),
        ),
      () => service(two).execute(context(f, d.data.id), equipmentIntent(f)),
    );
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { status: 409 },
    });
    await assertAdd(f, d.data.id, true);
  });
  it.each(['release', 'replace'])(
    'LOCK01 11/12 real %s semantics and idempotency regression',
    async (kind) => {
      const f = await admitted(),
        next = await destination(f),
        key = randomUUID(),
        svc = assignmentService(assignmentRepo(one));
      const command = () =>
        kind === 'release'
          ? svc.release(
              f.companyId,
              f.user.id,
              f.assignment.id,
              { reason: 'Regression reason' },
              key,
            )
          : svc.replace(f.companyId, f.user.id, f.assignment.id, key, {
              equipmentAssetId: next.id,
              replacementReason: 'Regression reason',
            });
      const first = await command(),
        before = await physical(f),
        replay = await command();
      expect(replay).toEqual(first);
      expect(await physical(f)).toEqual(before);
      const row = await db.healthcareEquipmentAssignment.findUniqueOrThrow({
        where: { id: f.assignment.id },
      });
      expect(row.lifecycle).toBe(kind === 'release' ? 'RELEASED' : 'REPLACED');
      if (kind === 'release')
        expect(row).toMatchObject({
          releasedById: f.user.id,
          releaseReason: 'Regression reason',
          releaseCause: 'MANUAL',
        });
      else
        expect(
          await db.healthcareEquipmentAssignment.count({
            where: { replacesAssignmentId: f.assignment.id },
          }),
        ).toBe(1);
      expect(
        await db.idempotencyRecord.count({
          where: { companyId: f.companyId, key },
        }),
      ).toBe(1);
      await noDraftPhysicalEffects(f);
    },
  );
  it('LOCK01 13 rollback releases physical/root locks and claim/item/audit', async () => {
    const f = await admitted(),
      d = await create(f),
      g = lockGate(),
      dr = repository(one),
      key = randomUUID();
    holdDraft(dr, g, 'assignments', true);
    const results = await lockedRace(
      g,
      () =>
        new HealthcareCaseDispatchCommandService(dr, policy).execute(
          context(f, d.data.id, undefined, key),
          equipmentIntent(f),
        ),
      () => service(two).execute(context(f, d.data.id), equipmentIntent(f)),
    );
    expect(results[0]).toMatchObject({ status: 'rejected' });
    expect(results[1].status).toBe('fulfilled');
    expect(
      await db.idempotencyRecord.count({
        where: { companyId: f.companyId, key },
      }),
    ).toBe(0);
    await assertAdd(f, d.data.id, true);
  });
  it('LOCK01 14 foreign tenant discovery cannot authorize Equipment ADD', async () => {
    const f = await admitted(),
      foreign = await admitted(),
      d = await create(f);
    await expect(
      service(one).execute(context(f, d.data.id), {
        operation: 'ITEM_ADD',
        dto: {
          type: 'EQUIPMENT',
          expectedRevision: 0,
          sourceCaseKitItemId: foreign.es.id,
        },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await assertAdd(f, d.data.id, false);
    await noDraftPhysicalEffects(foreign);
  });
  it.each(['ADD', 'CREATE'])(
    'LOCK01 15 %s blocks real preparation before its physical locks',
    async (kind) => {
      const f = await admitted(),
        d = kind === 'ADD' ? await create(f) : null,
        g = lockGate(),
        dr = repository(one);
      holdDraft(dr, g);
      const results = await lockedRace(
        g,
        () =>
          new HealthcareCaseDispatchCommandService(dr, policy).execute(
            context(f, d?.data.id),
            kind === 'ADD' ? equipmentIntent(f) : createIntent(),
          ),
        () =>
          kitService(two).confirmPreparation(
            f.companyId,
            f.user.id,
            f.kit.id,
            randomUUID(),
          ),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(
        await db.healthcareCaseKit.findUnique({ where: { id: f.kit.id } }),
      ).toMatchObject({ status: 'PREPARED' });
      await noDraftPhysicalEffects(f);
    },
  );
  it.each(['cancel', 'update'])(
    'LOCK01 16/19 real Case %s waits on SHARE before downstream roots',
    async (kind) => {
      const f = await admitted(),
        d = await create(f),
        g = lockGate(),
        dr = repository(one);
      holdDraft(dr, g);
      const results = await lockedRace(
        g,
        () =>
          new HealthcareCaseDispatchCommandService(dr, policy).execute(
            context(f, d.data.id),
            equipmentIntent(f),
          ),
        () =>
          kind === 'cancel'
            ? caseService(two).cancel(
                f.companyId,
                f.c.id,
                f.user.id,
                'Case cancellation race',
              )
            : caseService(two).update(f.companyId, f.c.id, {
                scheduledStart: new Date('2026-11-04T10:00:00Z'),
                scheduledEnd: new Date('2026-11-04T12:00:00Z'),
              }),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(
        await db.healthcareCase.findUnique({ where: { id: f.c.id } }),
      ).toMatchObject({
        status: kind === 'cancel' ? 'CANCELLED' : 'SCHEDULED',
      });
      await assertAdd(f, d.data.id, true);
    },
  );
  it('LOCK01 17 multi-Asset CREATE vs REPLACE sharing an ASSET Requirement', async () => {
    const f = await fixture(),
      next = await destination(f);
    const req = await db.healthcareCaseRequirement.create({
      data: {
        companyId: f.companyId,
        caseId: f.c.id,
        productId: f.ep.id,
        requestedQty: 2,
        type: 'BACKUP',
        sortOrder: 1,
        createdById: f.user.id,
      },
    });
    await db.healthcareEquipmentAssignment.update({
      where: { id: f.assignment.id },
      data: {
        requirementId: req.id,
        origin: 'REQUIREMENT',
        directAssignmentReason: null,
      },
    });
    const extra = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId: f.companyId,
        caseId: f.c.id,
        equipmentAssetId: next.id,
        origin: 'REQUIREMENT',
        requirementId: req.id,
        createdById: f.user.id,
      },
    });
    await db.healthcareCaseKitItem.create({
      data: {
        companyId: f.companyId,
        caseId: f.c.id,
        caseKitId: f.kit.id,
        equipmentAssignmentId: extra.id,
        addedById: f.user.id,
      },
    });
    await db.healthcareCase.update({
      where: { id: f.c.id },
      data: {
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-11-01T10:00:00Z'),
        scheduledEnd: new Date('2026-11-01T12:00:00Z'),
      },
    });
    await db.healthcareCaseKit.update({
      where: { id: f.kit.id },
      data: {
        status: 'PREPARED',
        preparedById: f.user.id,
        preparedAt: new Date(),
      },
    });
    await db.equipmentAsset.update({
      where: { id: f.asset.id },
      data: { physicalLocation: 'WAREHOUSE' },
    });
    const replacement = await destination(f),
      g = lockGate(),
      dr = repository(one);
    holdDraft(dr, g);
    const results = await lockedRace(
      g,
      () =>
        new HealthcareCaseDispatchCommandService(dr, policy).execute(
          context(f),
          createIntent(),
        ),
      () =>
        assignmentService(assignmentRepo(two)).replace(
          f.companyId,
          f.user.id,
          f.assignment.id,
          randomUUID(),
          {
            equipmentAssetId: replacement.id,
            replacementReason: 'Shared Requirement race',
          },
        ),
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    await noDraftPhysicalEffects(f);
  });
  it('LOCK01 18 distinct Cases share material Product and Asset; Product precedes Asset', async () => {
    const f = await admitted(),
      other = await relatedCase(f);
    const kit = await db.healthcareCaseKit.create({
      data: {
        companyId: f.companyId,
        caseId: other.id,
        createdById: f.user.id,
      },
    });
    const req = await db.healthcareCaseRequirement.create({
      data: {
        companyId: f.companyId,
        caseId: other.id,
        productId: f.product.id,
        requestedQty: 1,
        type: 'REQUIRED',
        sortOrder: 0,
        createdById: f.user.id,
      },
    });
    await db.healthcareCaseKitItem.create({
      data: {
        companyId: f.companyId,
        caseId: other.id,
        caseKitId: kit.id,
        requirementId: req.id,
        preparedQuantity: 1,
        addedById: f.user.id,
      },
    });
    const a = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId: f.companyId,
        caseId: other.id,
        equipmentAssetId: f.asset.id,
        origin: 'DIRECT',
        directAssignmentReason: 'Shared Asset',
        createdById: f.user.id,
      },
    });
    await db.healthcareCaseKitItem.create({
      data: {
        companyId: f.companyId,
        caseId: other.id,
        caseKitId: kit.id,
        equipmentAssignmentId: a.id,
        addedById: f.user.id,
      },
    });
    const g = lockGate(),
      dr = repository(one);
    holdDraft(dr, g);
    const results = await lockedRace(
      g,
      () =>
        new HealthcareCaseDispatchCommandService(dr, policy).execute(
          context(f),
          createIntent(),
        ),
      () =>
        kitService(two).confirmPreparation(
          f.companyId,
          f.user.id,
          kit.id,
          randomUUID(),
        ),
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    await noDraftPhysicalEffects(f);
  });
});
