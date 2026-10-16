import { healthcarePersistenceException } from '../src/healthcare/common/healthcare-errors';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { HealthcareCaseReconciliationsRepository } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationReadService } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-read.service';
import { parseReconciliationRootSnapshot } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation.snapshot';
import { PrismaService } from '../src/prisma/prisma.service';
jest.setTimeout(30000);
const suite =
  process.env.RUN_CASE_RECONCILIATION_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-RR-01A isolated PostgreSQL16 structural acceptance', () => {
  let db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(process.env.CASE_RECONCILIATION_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_case_reconciliation_persistence_test' ||
      url.username !== 'case_reconciliation_persistence_test' ||
      !process.env.CASE_RECONCILIATION_TEST_RUN
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
    pattern = /23514|23503|23505|constraint|Dispatch|Foreign key|Unique constraint|Reconciliation|reconciliation/i,
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
  async function origin(equipment = false) {
    const f = await fixture();
    const { d, i } = await confirmed(f, equipment);
    const source = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
      where: { id: i.id },
    });
    return { f, d, source };
  }
  type O = Awaited<ReturnType<typeof origin>>;
  const rrData = (o: O) => ({
    companyId: o.f.companyId,
    caseId: o.f.c.id,
    caseKitId: o.f.kit.id,
    dispatchId: o.d.id,
    createdById: o.f.user.id,
  });
  const riData = (o: O, id: string) => ({
    companyId: o.f.companyId,
    caseId: o.f.c.id,
    dispatchId: o.d.id,
    reconciliationId: id,
    sourceDispatchItemId: o.source.id,
    createdById: o.f.user.id,
    ...(o.source.type === 'MATERIAL'
      ? {
          type: 'MATERIAL' as const,
          sourceCustodyPositionId: o.source.destinationPositionId!,
          expectedSourceRevision: 1,
          returnedQty: 0,
          usedQty: 0,
        }
      : {
          type: 'EQUIPMENT' as const,
          equipmentCustodyId: o.source.equipmentCustodyId!,
          assetId: o.source.assetId!,
          assignmentId: o.source.assignmentId!,
          expectedPhysicalRevision: 1,
          outcome: 'UNRESOLVED' as const,
        }),
  });
  async function episode(o: O) {
    const r = await db.healthcareCaseReconciliation.create({ data: rrData(o) });
    const i = await db.healthcareCaseReconciliationItem.create({
      data: riData(o, r.id),
    });
    return { r, i };
  }
  type E = Awaited<ReturnType<typeof episode>>;
  const read = () =>
    new HealthcareCaseReconciliationReadService(
      new HealthcareCaseReconciliationsRepository(db as PrismaService),
    );
  async function cancel(o: O, e: E) {
    await db.healthcareCaseReconciliation.update({
      where: { id: e.r.id },
      data: {
        status: 'CANCELLED',
        revision: 1,
        cancelledById: o.f.user.id,
        cancelledAt: new Date(),
        cancellationReason: 'Fixture',
      },
    });
  }
  // Structural fixtures author durable evidence directly; no return/close primitive or production adapter is invoked.
  async function finish(
    o: O,
    e: E,
    qty = 0,
    close = false,
    corrupt = false,
    returned = false,
  ) {
    const now = new Date();
    await db.$transaction(async (tx) => {
      let result: Prisma.InputJsonObject;
      if (o.source.type === 'MATERIAL') {
        const source = await tx.inventoryPosition.findUniqueOrThrow({
          where: { id: o.source.destinationPositionId! },
        });
        let effectId: string | null = null;
        let destinationId: string | null = null;
        if (qty) {
          const effect = await tx.inventoryPhysicalEffect.create({
            data: {
              companyId: o.f.companyId,
              originType: 'CASE_RECONCILIATION',
              originId: e.r.id,
              originOperation: returned ? 'CONFIRM_RETURNED' : 'CONFIRM_USED',
              kind: returned ? 'TRANSFER' : 'DEFINITIVE_OUT',
              requestHash: 'b'.repeat(64),
              lineCount: returned ? 2 : 1,
              actorId: o.f.user.id,
            },
          });
          effectId = effect.id;
          await tx.inventoryPhysicalEffectLine.create({
            data: {
              companyId: o.f.companyId,
              effectId,
              positionId: source.id,
              sequence: 1,
              delta: -qty,
              quantityBefore: source.quantity,
              quantityAfter: source.quantity - qty,
              revisionBefore: source.revision,
              revisionAfter: source.revision + 1,
            },
          });
          await tx.inventoryPosition.update({
            where: { id: source.id },
            data: {
              quantity: source.quantity - qty,
              revision: source.revision + 1,
            },
          });
          if (returned) {
            const dest = await tx.inventoryPosition.findUniqueOrThrow({
              where: { id: o.f.position.id },
            });
            destinationId = dest.id;
            await tx.inventoryPhysicalEffectLine.create({
              data: {
                companyId: o.f.companyId,
                effectId,
                positionId: dest.id,
                sequence: 2,
                delta: qty,
                quantityBefore: dest.quantity,
                quantityAfter: dest.quantity + qty,
                revisionBefore: dest.revision,
                revisionAfter: dest.revision + 1,
              },
            });
            await tx.inventoryPosition.update({
              where: { id: dest.id },
              data: {
                quantity: dest.quantity + qty,
                revision: dest.revision + 1,
              },
            });
          }
        }
        const evidence = {
          returnedQty: returned ? qty : 0,
          usedQty: returned ? 0 : qty,
          returnedDestinationPositionId: destinationId,
          returnedPhysicalEffectId: returned ? effectId : null,
          usedPhysicalEffectId: returned ? null : effectId,
        };
        await tx.healthcareCaseReconciliationItem.update({
          where: { id: e.i.id },
          data: { ...evidence, expectedSourceRevision: source.revision },
        });
        result = {
          type: 'MATERIAL',
          ...evidence,
          unresolvedBefore: source.quantity,
          unresolvedAfter: source.quantity - qty,
          source: {
            positionId: source.id,
            revision: source.revision,
            quantity: source.quantity,
          },
        };
      } else {
        const asset = await tx.equipmentAsset.findUniqueOrThrow({
          where: { id: o.source.assetId! },
        });
        let eventId: string | null = null;
        if (close) {
          const event = await tx.equipmentAssetPhysicalEvent.create({
            data: {
              companyId: o.f.companyId,
              equipmentAssetId: asset.id,
              custodyId: o.source.equipmentCustodyId,
              operation: 'CUSTODY_CLOSE',
              originType: 'CASE_RECONCILIATION_ITEM',
              originId: e.i.id,
              originOperation: 'CONFIRM_EQUIPMENT_RETURN',
              requestHash: 'c'.repeat(64),
              physicalLocationBefore: 'CUSTODY',
              physicalLocationAfter: 'WAREHOUSE',
              conditionBefore: asset.condition,
              conditionAfter: 'INSPECTION_PENDING',
              lifecycleBefore: asset.lifecycle,
              lifecycleAfter: asset.lifecycle,
              revisionBefore: asset.physicalRevision,
              revisionAfter: asset.physicalRevision + 1,
              actorId: o.f.user.id,
              reasonCode: 'FIXTURE',
            },
          });
          eventId = event.id;
          await tx.equipmentAssetCustody.update({
            where: { id: o.source.equipmentCustodyId! },
            data: { closedAt: now, closedById: o.f.user.id },
          });
          await tx.equipmentAsset.update({
            where: { id: asset.id },
            data: {
              activeCustodyId: null,
              physicalLocation: 'WAREHOUSE',
              physicalRevision: asset.physicalRevision + 1,
              condition: 'INSPECTION_PENDING',
            },
          });
        }
        const before = {
          condition: asset.condition,
          lifecycle: asset.lifecycle,
          location: 'CUSTODY',
          revision: asset.physicalRevision,
        };
        result = {
          type: 'EQUIPMENT',
          custodyId: o.source.equipmentCustodyId!,
          assignmentId: o.source.assignmentId!,
          openPhysicalEventId: o.source.equipmentPhysicalEventId!,
          outcome: close ? 'RETURNED' : 'UNRESOLVED',
          reportedCondition: close ? 'INSPECTION_PENDING' : null,
          before,
          after: close
            ? {
                ...before,
                condition: 'INSPECTION_PENDING',
                location: 'WAREHOUSE',
                revision: asset.physicalRevision + 1,
              }
            : before,
          closePhysicalEventId: eventId,
          custodyClosedAt: close ? now.toISOString() : null,
        };
        await tx.healthcareCaseReconciliationItem.update({
          where: { id: e.i.id },
          data: {
            outcome: close ? 'RETURNED' : 'UNRESOLVED',
            reportedCondition: close ? 'INSPECTION_PENDING' : null,
            expectedPhysicalRevision: asset.physicalRevision,
            closePhysicalEventId: eventId,
          },
        });
      }
      await tx.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: {
          snapshot: {
            version: 1,
            sourceDispatchItemId: o.source.id,
            history: o.source.snapshot as Prisma.InputJsonObject,
            dispatchedQty: o.source.quantity,
            capturedAt: now.toISOString(),
            result,
          },
        },
      });
      await tx.healthcareCaseReconciliationAudit.create({
        data: {
          companyId: o.f.companyId,
          reconciliationId: e.r.id,
          operation: 'CONFIRM',
          actorId: o.f.user.id,
          revisionBefore: 0,
          revisionAfter: 1,
          change: { version: 1, operation: 'CONFIRM' },
        },
      });
      const dispatch = await tx.healthcareCaseDispatch.findUniqueOrThrow({
        where: { id: o.d.id },
      });
      await tx.healthcareCaseReconciliation.update({
        where: { id: e.r.id },
        data: {
          observation: 'Observed pending resources',
          snapshotVersion: 1,
          snapshot: {
            version: 1,
            reconciliationId: e.r.id,
            sourceDispatch: {
              id: o.d.id,
              caseId: o.f.c.id,
              caseKitId: o.f.kit.id,
              history: dispatch.snapshot as Prisma.InputJsonObject,
            },
            confirmedBy: {
              id: o.f.user.id,
              firstName: o.f.user.firstName,
              lastName: o.f.user.lastName,
            },
            confirmedAt: now.toISOString(),
            observation: 'Observed pending resources',
            episodeFacts: {
              materialItemCount: o.source.type === 'MATERIAL' ? 1 : 0,
              equipmentItemCount: o.source.type === 'EQUIPMENT' ? 1 : 0,
              hasPhysicalMutation: qty > 0 || close,
            },
          },
        },
      });
      if (corrupt)
        await tx.healthcareCaseReconciliationItem.update({
          where: { id: e.i.id },
          data: { snapshot: { version: 9 } },
        });
      await tx.healthcareCaseReconciliation.update({
        where: { id: e.r.id },
        data: {
          status: 'CONFIRMED',
          confirmedFromRevision: 0,
          revision: 1,
          confirmedById: o.f.user.id,
          confirmedAt: now,
        },
      });
    });
  }
  it('01 root tenant-safe Dispatch FK', async () => {
    const a = await origin(),
      b = await origin();
    await rejected(
      db.healthcareCaseReconciliation.create({
        data: { ...rrData(a), dispatchId: b.d.id },
      }),
    );
  });
  it('02 wrong Case/Dispatch rejected', async () => {
    const a = await origin(),
      b = await fixture();
    await rejected(
      db.healthcareCaseReconciliation.create({
        data: { ...rrData(a), caseId: b.c.id },
      }),
    );
  });
  it('03 foreign source item rejected', async () => {
    const a = await origin(),
      b = await origin(),
      e = await episode(a);
    await rejected(
      db.healthcareCaseReconciliationItem.create({
        data: { ...riData(a, e.r.id), sourceDispatchItemId: b.source.id },
      }),
    );
  });
  it('04 Material discriminator', async () => {
    const o = await origin(),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { expectedPhysicalRevision: 0 },
      }),
    );
  });
  it('05 Equipment discriminator', async () => {
    const o = await origin(true),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { returnedQty: 0 },
      }),
    );
  });
  it.each([
    ['06', 'returnedQty'],
    ['07', 'usedQty'],
  ] as const)('%s negative %s', async (_, key) => {
    const o = await origin(),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { [key]: -1 },
      }),
    );
  });
  it('08 valid 0/0 DRAFT', async () => {
    const o = await origin(),
      e = await episode(o);
    expect(e.i.returnedQty).toBe(0);
    expect(e.i.usedQty).toBe(0);
  });
  it('09 RETURNED requires condition', async () => {
    const o = await origin(true),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { outcome: 'RETURNED' },
      }),
    );
    await db.healthcareCaseReconciliationItem.update({
      where: { id: e.i.id },
      data: { outcome: 'RETURNED', reportedCondition: 'DAMAGED' },
    });
  });
  it('10 UNRESOLVED condition null', async () => {
    const o = await origin(true),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { reportedCondition: 'GOOD' },
      }),
    );
  });
  it('11 lifecycle exclusion shape', async () => {
    const o = await origin(),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { lifecycle: 'EXCLUDED' },
      }),
    );
  });
  it('12 duplicate ACTIVE source', async () => {
    const o = await origin(),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliationItem.create({ data: riData(o, e.r.id) }),
    );
  });
  it('13 EXCLUDED replacement ACTIVE', async () => {
    const o = await origin(),
      e = await episode(o);
    await db.healthcareCaseReconciliationItem.update({
      where: { id: e.i.id },
      data: {
        lifecycle: 'EXCLUDED',
        excludedById: o.f.user.id,
        excludedAt: new Date(),
        exclusionReason: 'Replaced',
      },
    });
    await db.healthcareCaseReconciliationItem.create({
      data: riData(o, e.r.id),
    });
  });
  it('14 multiple DRAFT episodes same source', async () => {
    const o = await origin();
    await episode(o);
    await episode(o);
  });
  it('15 unresolved Equipment permits later return episode', async () => {
    const o = await origin(true),
      a = await episode(o);
    await finish(o, a);
    const b = await episode(o);
    await finish(o, b, 0, true);
    expect((await read().summary(o.f.companyId, o.f.c.id, o.d.id)).status).toBe(
      'FULLY_RECONCILED',
    );
  });
  it('16 close evidence uniqueness', async () => {
    const o = await origin(true),
      e = await episode(o);
    await finish(o, e, 0, true);
    const b = await episode(o);
    const closed = await db.healthcareCaseReconciliationItem.findUniqueOrThrow({
      where: { id: e.i.id },
    });
    await rejected(
      db.$transaction(async (tx) => {
        await tx.healthcareCaseReconciliationItem.update({
          where: { id: b.i.id },
          data: {
            outcome: 'RETURNED',
            reportedCondition: 'GOOD',
            closePhysicalEventId: closed.closePhysicalEventId,
          },
        });
      }),
    );
  });
  it('17 foreign material Effect FK', async () => {
    const a = await origin(),
      b = await origin(),
      e = await episode(a);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { usedQty: 1, usedPhysicalEffectId: b.source.physicalEffectId },
      }),
    );
  });
  it('18 foreign close event / Asset FK', async () => {
    const a = await origin(true),
      b = await origin(true),
      e = await episode(a);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: {
          outcome: 'RETURNED',
          reportedCondition: 'GOOD',
          closePhysicalEventId: b.source.equipmentPhysicalEventId,
        },
      }),
    );
  });
  it('19 valid DRAFT', async () => {
    const o = await origin(),
      e = await episode(o);
    expect((await read().detail(o.f.companyId, o.f.c.id, e.r.id)).status).toBe(
      'DRAFT',
    );
  });
  it('20 incomplete confirmed at commit', async () => {
    const o = await origin(),
      e = await episode(o);
    await rejected(
      db.healthcareCaseReconciliation.update({
        where: { id: e.r.id },
        data: {
          status: 'CONFIRMED',
          confirmedFromRevision: 0,
          revision: 1,
          confirmedById: o.f.user.id,
          confirmedAt: new Date(),
          snapshotVersion: 1,
          snapshot: { version: 1 },
        },
      }),
    );
  });
  it('21 observational CONFIRMED', async () => {
    const o = await origin(),
      e = await episode(o);
    await finish(o, e);
    expect((await read().summary(o.f.companyId, o.f.c.id, o.d.id)).status).toBe(
      'UNRECONCILED',
    );
  });
  it('22 physical evidence confirmed staging before terminal flip', async () => {
    const o = await origin(),
      e = await episode(o);
    await finish(o, e, 1);
    expect((await read().detail(o.f.companyId, o.f.c.id, e.r.id)).status).toBe(
      'CONFIRMED',
    );
  });
  it.each(['UPDATE', 'DELETE'] as const)(
    '23/24 terminal root %s rejected',
    async (op) => {
      const o = await origin(),
        e = await episode(o);
      await finish(o, e);
      await rejected(
        op === 'UPDATE'
          ? db.healthcareCaseReconciliation.update({
              where: { id: e.r.id },
              data: { observation: 'Changed' },
            })
          : db.healthcareCaseReconciliation.delete({ where: { id: e.r.id } }),
      );
    },
  );
  it('25 confirmed item mutation rejected', async () => {
    const o = await origin(),
      e = await episode(o);
    await finish(o, e);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { usedQty: 1 },
      }),
    );
    await rejected(
      db.healthcareCaseReconciliationItem.create({ data: riData(o, e.r.id) }),
    );
    await rejected(
      db.healthcareCaseReconciliationItem.delete({ where: { id: e.i.id } }),
    );
  });
  it('26 cancelled root immutable', async () => {
    const o = await origin(),
      e = await episode(o);
    await cancel(o, e);
    await rejected(
      db.healthcareCaseReconciliation.update({
        where: { id: e.r.id },
        data: { revision: 2 },
      }),
    );
  });
  it('27 cancelled item immutable', async () => {
    const o = await origin(),
      e = await episode(o);
    await cancel(o, e);
    await rejected(
      db.healthcareCaseReconciliationItem.update({
        where: { id: e.i.id },
        data: { usedQty: 1 },
      }),
    );
  });
  it.each(['UPDATE', 'DELETE'] as const)(
    '28/29 audit %s rejected',
    async (op) => {
      const o = await origin(),
        e = await episode(o);
      await finish(o, e);
      await rejected(
        db.$executeRawUnsafe(
          op === 'UPDATE'
            ? `UPDATE "HealthcareCaseReconciliationAudit" SET "createdAt"=now() WHERE "reconciliationId"='${e.r.id}'`
            : `DELETE FROM "HealthcareCaseReconciliationAudit" WHERE "reconciliationId"='${e.r.id}'`,
        ),
      );
    },
  );
  it.each([
    'HealthcareCaseReconciliation',
    'HealthcareCaseReconciliationItem',
    'HealthcareCaseReconciliationAudit',
  ])('30 %s TRUNCATE rejected', async (table) => {
    await rejected(db.$executeRawUnsafe(`TRUNCATE "${table}" CASCADE`));
  });
  it('31 all six idempotency resources and incomplete claim completion', async () => {
    const o = await origin(),
      e = await episode(o);
    for (const suffix of [
      'CREATE',
      'ITEM_ADD',
      'OUTCOME_SET',
      'ITEM_EXCLUDE',
      'CONFIRM',
      'CANCEL',
    ] as const) {
      const scope = `HEALTHCARE_CASE_RECONCILIATION_${suffix}` as const;
      await db.$transaction(async (tx) => {
        const claim = await tx.idempotencyRecord.create({
          data: {
            companyId: o.f.companyId,
            scope,
            key: randomUUID(),
            requestHash: 'a'.repeat(64),
          },
        });
        await tx.idempotencyRecord.update({
          where: { id: claim.id },
          data: {
            resourceId: ['ITEM_ADD', 'OUTCOME_SET', 'ITEM_EXCLUDE'].includes(
              suffix,
            )
              ? e.i.id
              : e.r.id,
          },
        });
      });
    }
  });
  it('32 foreign idempotency resource rejected', async () => {
    const a = await origin(),
      b = await origin(),
      e = await episode(b);
    await rejected(
      db.idempotencyRecord.create({
        data: {
          companyId: a.f.companyId,
          scope: 'HEALTHCARE_CASE_RECONCILIATION_CREATE',
          key: randomUUID(),
          requestHash: 'a'.repeat(64),
          resourceId: e.r.id,
        },
      }),
    );
  });
  it('33 reads and list order/status/filter/tenant boundaries', async () => {
    const o = await origin(),
      a = await episode(o),
      b = await episode(o),
      c = await episode(o);
    await finish(o, b);
    await cancel(o, c);
    for (const [e, status] of [
      [a, 'DRAFT'],
      [b, 'CONFIRMED'],
      [c, 'CANCELLED'],
    ] as const)
      expect(
        (await read().detail(o.f.companyId, o.f.c.id, e.r.id)).status,
      ).toBe(status);
    const q = {
      page: 1,
      pageSize: 1,
      status: 'CONFIRMED' as const,
      dispatchId: o.d.id,
    };
    const list = await read().list(o.f.companyId, o.f.c.id, q);
    expect(list.pagination.totalItems).toBe(1);
    expect(list.items[0].id).toBe(b.r.id);
    const all = await read().list(o.f.companyId, o.f.c.id, {
      page: 1,
      pageSize: 25,
    });
    expect(all.items.map((x) => x.id)).toEqual(
      [...all.items]
        .sort(
          (x, y) =>
            y.createdAt.getTime() - x.createdAt.getTime() ||
            y.id.localeCompare(x.id),
        )
        .map((x) => x.id),
    );
    const foreign = await fixture();
    await expect(
      read().detail(foreign.companyId, o.f.c.id, a.r.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      read().detail(o.f.companyId, foreign.c.id, a.r.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('34 multi-episode material totals reconcile with physical custody', async () => {
    const o = await origin(),
      a = await episode(o);
    await finish(o, a, 1);
    expect((await read().summary(o.f.companyId, o.f.c.id, o.d.id)).status).toBe(
      'PARTIALLY_RECONCILED',
    );
    const b = await episode(o);
    await finish(o, b, 1);
    const s = await read().summary(o.f.companyId, o.f.c.id, o.d.id);
    expect(s.status).toBe('FULLY_RECONCILED');
    expect(s.items[0]).toMatchObject({ confirmedUsedQty: 2, unresolvedQty: 0 });
  });
  it('35 Equipment closure derived with INSPECTION_PENDING', async () => {
    const o = await origin(true),
      e = await episode(o);
    await finish(o, e, 0, true);
    expect(
      (await read().summary(o.f.companyId, o.f.c.id, o.d.id)).items[0],
    ).toMatchObject({
      custodyStatus: 'CLOSED',
      closeEvidence: { condition: 'INSPECTION_PENDING' },
    });
  });
  it('36 invalid confirmed snapshot fails closed', async () => {
    const o = await origin(),
      e = await episode(o);
    await rejected(finish(o, e, 0, false, true));
    expect(() => parseReconciliationRootSnapshot({ version: 9 })).toThrow(
      healthcarePersistenceException(),
    );
  });

  it('37 returned and used episodes use distinct durable effect kinds', async () => {
    const o = await origin(),
      a = await episode(o);
    await finish(o, a, 1, false, false, true);
    const b = await episode(o);
    await finish(o, b, 1);
    const r = await read().summary(o.f.companyId, o.f.c.id, o.d.id);
    expect(r.status).toBe('FULLY_RECONCILED');
    expect(r.items[0]).toMatchObject({
      confirmedReturnedQty: 1,
      confirmedUsedQty: 1,
      unresolvedQty: 0,
    });
  });
  it('38 physical/business mismatch fails closed without repair', async () => {
    const o = await origin();
    await db.inventoryPosition.update({
      where: { id: o.source.destinationPositionId! },
      data: { quantity: 1 },
    });
    await expect(
      read().summary(o.f.companyId, o.f.c.id, o.d.id),
    ).rejects.toHaveProperty('response.code', 'HEALTHCARE_PERSISTENCE_ERROR');
  });
  it('39 confirmed presentation survives later Product rename', async () => {
    const o = await origin(),
      e = await episode(o);
    await finish(o, e);
    await db.product.update({
      where: { id: o.f.product.id },
      data: { name: 'Renamed after episode' },
    });
    expect(
      (await read().detail(o.f.companyId, o.f.c.id, e.r.id)).items[0]
        .presentation.product.name,
    ).toBe('Material original');
  });
  it('40 incomplete idempotency claim rejected at commit', async () => {
    const o = await origin();
    await rejected(
      db.idempotencyRecord.create({
        data: {
          companyId: o.f.companyId,
          scope: 'HEALTHCARE_CASE_RECONCILIATION_CREATE',
          key: randomUUID(),
          requestHash: 'a'.repeat(64),
        },
      }),
    );
  });
  it('41 wrong same-Company Case and nonconfirmed Dispatch summaries return 404', async () => {
    const o = await origin(),
      e = await episode(o);
    const other = await db.healthcareCase.create({
      data: {
        companyId: o.f.companyId,
        createdById: o.f.user.id,
        title: 'Other',
        folio: randomUUID(),
      },
    });
    await expect(
      read().detail(o.f.companyId, other.id, e.r.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      read().summary(o.f.companyId, other.id, o.d.id),
    ).rejects.toMatchObject({ status: 404 });
    const d = await draft(o.f);
    await expect(
      read().summary(o.f.companyId, o.f.c.id, d.d.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('42 strict audit v1 rejects missing version and observation payload', async () => {
    const o = await origin(),
      e = await episode(o);
    for (const change of [
      { operation: 'CREATE' },
      { version: 1, operation: 'CREATE', observationAfter: 'not approved' },
    ])
      await rejected(
        db.healthcareCaseReconciliationAudit.create({
          data: {
            companyId: o.f.companyId,
            reconciliationId: e.r.id,
            operation: 'CREATE',
            actorId: o.f.user.id,
            revisionAfter: 0,
            change,
          },
        }),
      );
  });
});
