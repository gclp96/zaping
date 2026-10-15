import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { HealthcareCaseDispatchesRepository } from '../src/healthcare/case-dispatches/healthcare-case-dispatches.repository';
import { HealthcareCaseDispatchReadService } from '../src/healthcare/case-dispatches/healthcare-case-dispatch-read.service';
jest.setTimeout(30000);
const suite =
  process.env.RUN_CASE_DISPATCH_POSTGRES === '1' ? describe : describe.skip;
suite('HC-DSP-01A isolated PostgreSQL16 structural acceptance', () => {
  let db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(process.env.CASE_DISPATCH_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_case_dispatch_persistence_test' ||
      url.username !== 'case_dispatch_persistence_test' ||
      !process.env.CASE_DISPATCH_TEST_RUN
    )
      throw Error('Unverified target');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    const [role] = await db.$queryRaw<
      { rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }[]
    >`SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`;
    expect(role).toEqual({
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });
  });
  afterAll(async () => {
    await db?.$disconnect();
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
  async function cancelled(f: F) {
    const r = await draft(f);
    await db.healthcareCaseDispatch.update({
      where: { id: r.d.id },
      data: {
        status: 'CANCELLED',
        revision: 1,
        cancelledById: f.user.id,
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled fixture',
      },
    });
    return r;
  }
  const read = () =>
    new HealthcareCaseDispatchReadService(
      new HealthcareCaseDispatchesRepository(db as PrismaService),
    );
  it('01 tenant-safe root Case FK', async () => {
    const f = await fixture(),
      o = await fixture();
    await rejected(
      db.healthcareCaseDispatch.create({
        data: { ...rootData(f), caseId: o.c.id },
      }),
    );
  });
  it('02 tenant-safe root CaseKit FK', async () => {
    const f = await fixture(),
      o = await fixture();
    await rejected(
      db.healthcareCaseDispatch.create({
        data: { ...rootData(f), caseKitId: o.kit.id },
      }),
    );
  });
  it('03 tenant-safe item source FK', async () => {
    const f = await fixture(),
      o = await fixture(),
      d = await db.healthcareCaseDispatch.create({ data: rootData(f) });
    await rejected(
      db.healthcareCaseDispatchItem.create({
        data: { ...itemData(f, d.id), sourceCaseKitItemId: o.source.id },
      }),
    );
  });
  it('04 exact material/equipment discriminator', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    await rejected(
      db.healthcareCaseDispatchItem.create({
        data: { ...itemData(f, d.id), assetId: f.asset.id },
      }),
    );
  });
  it('05 material quantity positive', async () => {
    const f = await fixture(),
      { i } = await draft(f);
    await rejected(
      db.healthcareCaseDispatchItem.update({
        where: { id: i.id },
        data: { quantity: 0 },
      }),
    );
  });
  it('06 root revision nonnegative', async () => {
    const f = await fixture();
    await rejected(
      db.healthcareCaseDispatch.create({
        data: { ...rootData(f), revision: -1 },
      }),
    );
  });
  it('07 EXTERNAL cannot have user FK', async () => {
    const f = await fixture();
    await rejected(
      db.healthcareCaseDispatch.create({
        data: { ...rootData(f), custodianUserId: f.user.id },
      }),
    );
  });
  it('08 INTERNAL user must be same tenant', async () => {
    const f = await fixture(),
      o = await fixture();
    await rejected(
      db.healthcareCaseDispatch.create({
        data: {
          ...rootData(f),
          custodianType: 'INTERNAL_USER',
          custodianUserId: o.user.id,
        },
      }),
    );
  });
  it('09 ACTIVE/EXCLUDED shape', async () => {
    const f = await fixture(),
      { i } = await draft(f);
    await rejected(
      db.healthcareCaseDispatchItem.update({
        where: { id: i.id },
        data: { lifecycle: 'EXCLUDED' },
      }),
    );
  });
  it('10 DRAFT physical evidence rejected at commit', async () => {
    const f = await fixture();
    await rejected(confirmed(f, false, undefined, 'DRAFT'), /final evidence/);
  });
  it('11 CANCELLED with physical evidence rejected at final commit', async () => {
    const f = await fixture();
    await rejected(
      confirmed(f, false, undefined, 'CANCELLED'),
      /final evidence/,
    );
  });
  it('12 valid DRAFT persists', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    expect(
      (
        await db.healthcareCaseDispatch.findUniqueOrThrow({
          where: { id: d.id },
        })
      ).status,
    ).toBe('DRAFT');
  });
  it('13 competing Equipment DRAFTs allowed', async () => {
    const f = await fixture();
    await draft(f, true);
    await expect(draft(f, true)).resolves.toHaveProperty('i');
  });
  it('14 partial material across multiple Dispatches allowed', async () => {
    const f = await fixture();
    await draft(f);
    await expect(draft(f)).resolves.toHaveProperty('i');
  });
  it('15 local material duplicate rejected', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    await rejected(
      db.healthcareCaseDispatchItem.create({ data: itemData(f, d.id) }),
    );
  });
  it('16 local Equipment duplicate rejected', async () => {
    const f = await fixture(),
      { d } = await draft(f, true);
    await rejected(
      db.healthcareCaseDispatchItem.create({ data: equipmentData(f, d.id) }),
    );
  });
  it('17 incomplete CONFIRMED rejected at commit', async () => {
    const f = await fixture(),
      { d } = await draft(f),
      now = new Date();
    await rejected(
      db.healthcareCaseDispatch.update({
        where: { id: d.id },
        data: {
          status: 'CONFIRMED',
          revision: 1,
          confirmedFromRevision: 0,
          confirmedById: f.user.id,
          confirmedAt: now,
          snapshotVersion: 1,
          snapshot: rootSnapshot(f, now),
        },
      }),
    );
  });
  it('18 structurally complete CONFIRMED and future ordering accepted', async () => {
    const f = await fixture();
    await expect(confirmed(f)).resolves.toHaveProperty('d');
  });
  it.each(['CONFIRMED', 'CANCELLED'] as const)(
    '%s rejects root UPDATE',
    async (status) => {
      const f = await fixture(),
        { d } =
          status === 'CONFIRMED' ? await confirmed(f) : await cancelled(f);
      await rejected(
        db.healthcareCaseDispatch.update({
          where: { id: d.id },
          data: { revision: { increment: 1 } },
        }),
      );
    },
  );
  it.each(['CONFIRMED', 'CANCELLED'] as const)(
    '%s rejects root DELETE',
    async (status) => {
      const f = await fixture(),
        { d } =
          status === 'CONFIRMED' ? await confirmed(f) : await cancelled(f);
      await rejected(db.healthcareCaseDispatch.delete({ where: { id: d.id } }));
    },
  );
  it.each(['CONFIRMED', 'CANCELLED'] as const)(
    '%s rejects item INSERT/UPDATE/DELETE',
    async (status) => {
      const f = await fixture(),
        { d, i } =
          status === 'CONFIRMED' ? await confirmed(f) : await cancelled(f);
      await rejected(
        db.healthcareCaseDispatchItem.update({
          where: { id: i.id },
          data: { quantity: 3 },
        }),
      );
      await rejected(
        db.healthcareCaseDispatchItem.delete({ where: { id: i.id } }),
      );
      await rejected(
        db.healthcareCaseDispatchItem.create({
          data: {
            ...itemData(f, d.id),
            lifecycle: 'EXCLUDED',
            excludedById: f.user.id,
            excludedAt: new Date(),
            exclusionReason: 'Fixture',
          },
        }),
      );
    },
  );
  async function audit() {
    const f = await fixture(),
      { d } = await draft(f);
    const a = await db.healthcareCaseDispatchAudit.create({
      data: {
        companyId: f.companyId,
        dispatchId: d.id,
        operation: 'CREATE',
        actorId: f.user.id,
        revisionAfter: 0,
        change: { version: 1, operation: 'CREATE', reason: null },
      },
    });
    return { f, d, a };
  }
  it('25 audit UPDATE rejected', async () => {
    const { a } = await audit();
    await rejected(
      db.healthcareCaseDispatchAudit.update({
        where: { id: a.id },
        data: {
          change: { version: 1, operation: 'CREATE', reason: 'Changed' },
        },
      }),
    );
  });
  it('26 audit DELETE rejected', async () => {
    const { a } = await audit();
    await rejected(
      db.healthcareCaseDispatchAudit.delete({ where: { id: a.id } }),
    );
  });
  it('27 audit TRUNCATE rejected by trigger', async () => {
    await rejected(
      db.$executeRawUnsafe('TRUNCATE "HealthcareCaseDispatchAudit"'),
      /append-only/,
    );
  });
  it('28 all historical Dispatch tables TRUNCATE rejected', async () => {
    await rejected(
      db.$executeRawUnsafe(
        'TRUNCATE "HealthcareCaseDispatch", "HealthcareCaseDispatchItem", "HealthcareCaseDispatchAudit"',
      ),
      /append-only/,
    );
  });
  const idem = (
    f: F,
    resourceId: string | null,
    scope: Prisma.IdempotencyRecordUncheckedCreateInput['scope'] = 'HEALTHCARE_CASE_DISPATCH_CREATE',
  ) =>
    db.idempotencyRecord.create({
      data: {
        companyId: f.companyId,
        scope,
        key: randomUUID(),
        requestHash: 'a'.repeat(64),
        resourceId,
      },
    });
  it('29 Dispatch invalid idempotency resource rejected', async () => {
    const f = await fixture();
    await rejected(idem(f, randomUUID()));
    await rejected(idem(f, null));
  });
  it('30 same-Company idempotency root accepted', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    await expect(idem(f, d.id)).resolves.toHaveProperty('resourceId', d.id);
  });
  it('31 foreign-Company idempotency rejected', async () => {
    const f = await fixture(),
      o = await fixture(),
      { d } = await draft(o);
    await rejected(idem(f, d.id));
  });
  it('32 GET DRAFT fixture', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    expect(await read().detail(f.companyId, f.c.id, d.id)).toMatchObject({
      status: 'DRAFT',
      items: [{ product: { name: 'Material original' }, batch: null }],
    });
  });
  it('33 GET CONFIRMED fixture', async () => {
    const f = await fixture(),
      { d } = await confirmed(f);
    expect(await read().detail(f.companyId, f.c.id, d.id)).toMatchObject({
      status: 'CONFIRMED',
      dispatchedBy: { id: f.user.id },
      items: [{ product: { name: 'Material original' } }],
      audit: [{ operation: 'CONFIRM' }],
    });
  });
  it('34 GET CANCELLED fixture', async () => {
    const f = await fixture(),
      { d } = await cancelled(f);
    expect(await read().detail(f.companyId, f.c.id, d.id)).toMatchObject({
      status: 'CANCELLED',
      dispatchedAt: null,
      cancellationReason: 'Cancelled fixture',
    });
  });
  it('35 confirmed snapshot survives later legitimate live changes', async () => {
    const f = await fixture(),
      { d } = await confirmed(f);
    await db.product.update({
      where: { id: f.product.id },
      data: { name: 'Changed', lotTracking: 'REQUIRED' },
    });
    await db.healthcareCase.update({
      where: { id: f.c.id },
      data: { folio: 'Changed', scheduledStart: new Date() },
    });
    await db.inventoryPosition.update({
      where: { id: f.position.id },
      data: { quantity: 0, revision: 5 },
    });
    expect(await read().detail(f.companyId, f.c.id, d.id)).toMatchObject({
      case: { folio: f.c.folio },
      items: [{ product: { name: 'Material original', lotTracking: 'NONE' } }],
    });
  });
  it('36 INTERNAL nullable user is approved', async () => {
    const f = await fixture();
    await expect(
      db.healthcareCaseDispatch.create({
        data: { ...rootData(f), custodianType: 'INTERNAL_USER' },
      }),
    ).resolves.toHaveProperty('custodianUserId', null);
  });
  it('37 Equipment complete CONFIRMED accepted', async () => {
    const f = await fixture(),
      { d } = await confirmed(f, true);
    expect(await read().detail(f.companyId, f.c.id, d.id)).toMatchObject({
      items: [{ equipment: { assetCode: f.asset.assetCode } }],
    });
  });
  it('38 prepared Equipment capacity cannot be reused after custody closes', async () => {
    const f = await fixture(),
      { i } = await confirmed(f, true);
    const old = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
      where: { id: i.id },
    });
    await db.$transaction(async (tx) => {
      await tx.equipmentAssetCustody.update({
        where: { id: old.equipmentCustodyId! },
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
    await rejected(
      confirmed(f, true),
      /sourceCaseKitItemId|Dispatch_equipment_historical_source_key/,
    );
  });
  it('39 item idempotency scopes require item resources', async () => {
    const f = await fixture(),
      { d, i } = await draft(f);
    await expect(
      idem(f, i.id, 'HEALTHCARE_CASE_DISPATCH_ITEM_ADD'),
    ).resolves.toHaveProperty('resourceId', i.id);
    await rejected(idem(f, d.id, 'HEALTHCARE_CASE_DISPATCH_ITEM_EXCLUDE'));
  });
  it('40 old idempotency scope remains unchanged', async () => {
    const f = await fixture();
    await expect(
      idem(f, null, 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE'),
    ).resolves.toHaveProperty('resourceId', null);
  });
  it('41 claim completion can occur within same transaction', async () => {
    const f = await fixture();
    await db.$transaction(async (tx) => {
      const r = await tx.idempotencyRecord.create({
        data: {
          companyId: f.companyId,
          scope: 'HEALTHCARE_CASE_DISPATCH_CREATE',
          key: randomUUID(),
          requestHash: 'a'.repeat(64),
        },
      });
      const d = await tx.healthcareCaseDispatch.create({ data: rootData(f) });
      await tx.idempotencyRecord.update({
        where: { id: r.id },
        data: { resourceId: d.id },
      });
    });
  });
  it('42 list ordering, status filtering and pagination in real repository', async () => {
    const f = await fixture(),
      a = await draft(f),
      b = await cancelled(f);
    await db.healthcareCaseDispatch.update({
      where: { id: a.d.id },
      data: { revision: 2 },
    });
    const result = await read().list(f.companyId, f.c.id, {
      page: 1,
      pageSize: 1,
      status: 'CANCELLED',
    });
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });
    expect(result.items[0].id).toBe(b.d.id);
  });
  it('43 foreign Company and wrong Case return 404', async () => {
    const f = await fixture(),
      o = await fixture(),
      { d } = await draft(f);
    await expect(
      read().detail(o.companyId, o.c.id, d.id),
    ).rejects.toMatchObject({ status: 404 });
    const c = await db.healthcareCase.create({
      data: {
        companyId: f.companyId,
        createdById: f.user.id,
        title: 'Other',
        folio: randomUUID(),
      },
    });
    await expect(read().detail(f.companyId, c.id, d.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('44 invalid confirmed item snapshot rejected at commit', async () => {
    const f = await fixture();
    await rejected(
      confirmed(f, false, async (tx, _d, i) => {
        await tx.healthcareCaseDispatchItem.update({
          where: { id: i },
          data: { snapshot: { version: 1 } },
        });
      }),
    );
  });
  it('45 invalid confirmed root snapshot rejected at commit', async () => {
    const f = await fixture();
    await rejected(
      confirmed(f, false, async (tx, d) => {
        await tx.healthcareCaseDispatch.update({
          where: { id: d },
          data: { snapshot: { version: 1 } },
        });
      }),
    );
  });
  it('46 no active items prevents confirmation', async () => {
    const f = await fixture();
    await rejected(
      confirmed(f, false, async (tx, _d, i) => {
        await tx.healthcareCaseDispatchItem.update({
          where: { id: i },
          data: {
            lifecycle: 'EXCLUDED',
            excludedById: f.user.id,
            excludedAt: new Date(),
            exclusionReason: 'Fixture',
            destinationPositionId: null,
            physicalEffectId: null,
          },
        });
      }),
    );
  });
  it('47 excluded confirmed item retains descriptive snapshot without physical evidence', async () => {
    const f = await fixture();
    const { d } = await confirmed(f, false, async (tx, id) => {
      await tx.healthcareCaseDispatchItem.create({
        data: {
          ...itemData(f, id),
          lifecycle: 'EXCLUDED',
          excludedById: f.user.id,
          excludedAt: new Date(),
          exclusionReason: 'Fixture',
          snapshot: itemSnapshot(f),
        },
      });
    });
    expect((await read().detail(f.companyId, f.c.id, d.id)).items).toHaveLength(
      2,
    );
  });
  it('48 duplicate audit revision rejected', async () => {
    const { f, d } = await audit();
    await rejected(
      db.healthcareCaseDispatchAudit.create({
        data: {
          companyId: f.companyId,
          dispatchId: d.id,
          operation: 'CREATE',
          actorId: f.user.id,
          revisionAfter: 0,
          change: { version: 1, operation: 'CREATE', reason: null },
        },
      }),
    );
  });
  it('49 malformed audit JSON rejected', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    await rejected(
      db.healthcareCaseDispatchAudit.create({
        data: {
          companyId: f.companyId,
          dispatchId: d.id,
          operation: 'CREATE',
          actorId: f.user.id,
          revisionAfter: 0,
          change: {},
        },
      }),
    );
  });
  it('50 DRAFT snapshot cannot survive commit', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    await rejected(
      db.healthcareCaseDispatch.update({
        where: { id: d.id },
        data: { snapshot: rootSnapshot(f, new Date()), snapshotVersion: 1 },
      }),
    );
  });
  it('51 custody/event evidence cannot be linked to another item', async () => {
    const f = await fixture(),
      { i } = await confirmed(f, true);
    const original = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
        where: { id: i.id },
      }),
      o = await draft(f, true);
    await rejected(
      db.healthcareCaseDispatchItem.update({
        where: { id: o.i.id },
        data: {
          equipmentCustodyId: original.equipmentCustodyId,
          equipmentPhysicalEventId: original.equipmentPhysicalEventId,
        },
      }),
      /equipmentCustodyId|equipmentPhysicalEventId|sourceCaseKitItemId/,
    );
  });
  it('52 excluded confirmed item requires snapshot', async () => {
    const f = await fixture();
    await rejected(
      confirmed(f, false, async (tx, id) => {
        await tx.healthcareCaseDispatchItem.create({
          data: {
            ...itemData(f, id),
            lifecycle: 'EXCLUDED',
            excludedById: f.user.id,
            excludedAt: new Date(),
            exclusionReason: 'Fixture',
          },
        });
      }),
      /final evidence/,
    );
  });
  it('53 wrong material destination rejected', async () => {
    const f = await fixture();
    await rejected(
      confirmed(f, false, async (tx, _d, id) => {
        await tx.healthcareCaseDispatchItem.update({
          where: { id },
          data: { destinationPositionId: f.position.id },
        });
      }),
      /final evidence/,
    );
  });
  it('54 completed item idempotency resource cannot be deleted', async () => {
    const f = await fixture(),
      { i } = await draft(f);
    await idem(f, i.id, 'HEALTHCARE_CASE_DISPATCH_ITEM_ADD');
    await rejected(
      db.healthcareCaseDispatchItem.delete({ where: { id: i.id } }),
      /idempotency resource/,
    );
  });
  it.each([
    'HEALTHCARE_CASE_DISPATCH_CREATE',
    'HEALTHCARE_CASE_DISPATCH_CUSTODIAN_SET',
    'HEALTHCARE_CASE_DISPATCH_CONFIRM',
    'HEALTHCARE_CASE_DISPATCH_CANCEL',
  ] as const)('55 root scope %s validates same tenant', async (scope) => {
    const f = await fixture(),
      { d } = await draft(f);
    await expect(idem(f, d.id, scope)).resolves.toHaveProperty(
      'resourceId',
      d.id,
    );
    await rejected(idem(f, randomUUID(), scope), /idempotency resource/);
  });
  it('56 multiple explicit material sources within one Dispatch allowed', async () => {
    const f = await fixture(),
      { d } = await draft(f);
    const batch = await db.inventoryBatch.create({
      data: {
        companyId: f.companyId,
        productId: f.product.id,
        lotNumber: 'OTHER',
      },
    });
    const position = await db.inventoryPosition.create({
      data: {
        companyId: f.companyId,
        productId: f.product.id,
        inventoryBatchId: batch.id,
        state: 'AVAILABLE',
        quantity: 5,
      },
    });
    await expect(
      db.healthcareCaseDispatchItem.create({
        data: {
          ...itemData(f, d.id),
          batchId: batch.id,
          sourcePositionId: position.id,
        },
      }),
    ).resolves.toHaveProperty('sourcePositionId', position.id);
  });
});
