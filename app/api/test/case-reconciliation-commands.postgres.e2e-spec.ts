import { ValidationPipe } from '@nestjs/common';
import { SetHealthcareCaseReconciliationOutcomeDto } from '../src/healthcare/case-reconciliations/dto/set-healthcare-case-reconciliation-outcome.dto';
import { HealthcareCaseReconciliationCommandService } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.service';
import { HealthcareCaseReconciliationCommandRepository } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.repository';
import { createHealthcareCompanyTransactionTimeoutPolicy } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import {
  ReconciliationCommandIntent as Intent,
  ReconciliationCommandContext as Context,
} from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.types';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { HealthcareCaseReconciliationsRepository } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationReadService } from '../src/healthcare/case-reconciliations/healthcare-case-reconciliation-read.service';
import { PrismaService } from '../src/prisma/prisma.service';
jest.setTimeout(30000);
const suite =
  process.env.RUN_CASE_RECONCILIATION_COMMANDS_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-RR-01B isolated PostgreSQL16 command acceptance', () => {
  let db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(
      process.env.CASE_RECONCILIATION_COMMANDS_TEST_DATABASE_URL!,
    );
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_case_reconciliation_commands_test' ||
      url.username !== 'case_reconciliation_commands_test' ||
      !process.env.CASE_RECONCILIATION_COMMANDS_TEST_RUN
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
  const policy = createHealthcareCompanyTransactionTimeoutPolicy({
    companyLockAcquisitionTimeoutMs: 1000,
    subsequentLockTimeoutMs: 5000,
    subsequentStatementTimeoutMs: 10000,
    prismaMaxWaitMs: 5000,
    prismaTransactionTimeoutMs: 15000,
  });
  const repository = (client = db) =>
    new HealthcareCaseReconciliationCommandRepository(
      client as PrismaService,
      new HealthcareCaseReconciliationsRepository(client as PrismaService),
    );
  const service = (repo = repository()) =>
    new HealthcareCaseReconciliationCommandService(repo, policy);
  const context = (
    o: O,
    id?: string,
    itemId?: string,
    key: string = randomUUID(),
  ): Context => ({
    companyId: o.f.companyId,
    actorId: o.f.user.id,
    caseId: o.f.c.id,
    reconciliationId: id,
    itemId,
    key,
  });
  const execute = (
    o: O,
    i: Intent,
    id?: string,
    itemId?: string,
    key?: string,
  ) => service().execute(context(o, id, itemId, key), i);
  const create = (o: O, observation?: string | null, key?: string) =>
    execute(
      o,
      { operation: 'CREATE', dto: { dispatchId: o.d.id, observation } },
      undefined,
      undefined,
      key,
    );
  const add = (o: O, id: string, expectedRevision = 0) =>
    execute(
      o,
      {
        operation: 'ITEM_ADD',
        dto: { expectedRevision, sourceDispatchItemId: o.source.id },
      },
      id,
    );
  async function prepared(equipment = false) {
    const o = await origin(equipment),
      r = await create(o, 'Pending'),
      a = await add(o, r.data.id);
    return { o, id: r.data.id, itemId: a.command.itemId! };
  }
  const material = (
    expectedRevision: number,
    returnedQty = 0,
    usedQty = 0,
  ): Intent => ({
    operation: 'OUTCOME_SET',
    dto: { expectedRevision, type: 'MATERIAL', returnedQty, usedQty },
  });
  async function code(p: Promise<unknown>, expected: string) {
    await expect(p).rejects.toHaveProperty('response.code', expected);
  }
  const newPeer = () =>
    new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.CASE_RECONCILIATION_COMMANDS_TEST_DATABASE_URL! +
            '&application_name=rr-command-contender',
        },
      },
    });
  async function competing(
    i: Intent,
    c: Context,
    at: 'createClaim' | 'lockDraftById',
  ) {
    const repo = repository(),
      peer = newPeer();
    let release!: () => void,
      held!: () => void,
      pid = 0;
    const gate = new Promise<void>((r) => (release = r)),
      entered = new Promise<void>((r) => (held = r));
    if (at === 'createClaim') {
      const base = repository();
      const original = (
        ...args: Parameters<
          HealthcareCaseReconciliationCommandRepository['createClaim']
        >
      ) => base.createClaim(...args);
      jest.spyOn(repo, 'createClaim').mockImplementation(async (...args) => {
        const result = await original(...args);
        const [row] = await args[3].$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        pid = row.pid;
        held();
        await gate;
        return result;
      });
    } else {
      const base = repository();
      const original = (
        ...args: Parameters<
          HealthcareCaseReconciliationCommandRepository['lockDraftById']
        >
      ) => base.lockDraftById(...args);
      jest.spyOn(repo, 'lockDraftById').mockImplementation(async (...args) => {
        const result = await original(...args);
        const [row] = await args[1].$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        pid = row.pid;
        held();
        await gate;
        return result;
      });
    }
    const first = service(repo).execute(c, i);
    const firstResult = Promise.allSettled([first]);
    let secondResult:
      | Promise<PromiseSettledResult<Awaited<ReturnType<typeof create>>>[]>
      | undefined;
    try {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          entered,
          first.then(() => {
            throw Error('Holder ended before barrier');
          }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(Error('Holder barrier timeout')),
              4000,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      secondResult = Promise.allSettled([
        service(repository(peer)).execute(
          at === 'createClaim' ? c : { ...c, key: randomUUID() },
          i,
        ),
      ]);
      let observed = false;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const [r] = await db.$queryRaw<
          { waiting: boolean }[]
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='rr-command-contender' AND wait_event_type='Lock' AND ${pid} = ANY(pg_blocking_pids(pid))) AS waiting`;
        if (r.waiting) {
          observed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(observed).toBe(true);
      console.log(`OBSERVED BARRIER ${at}: contender waits for backend ${pid}`);
    } finally {
      release();
    }
    try {
      return [...(await firstResult), ...(await secondResult)];
    } finally {
      await peer.$disconnect();
    }
  }
  it('01 same-key concurrent CREATE uses observable unique-lock barrier', async () => {
    const o = await origin(),
      c = context(o, undefined, undefined, 'same-key');
    const results = await competing(
      { operation: 'CREATE', dto: { dispatchId: o.d.id } },
      c,
      'createClaim',
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const values = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof create>>> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
    expect(values.map((v) => v.replay).sort()).toEqual([false, true]);
    expect(values[0].command).toEqual(values[1].command);
    expect(
      await db.healthcareCaseReconciliation.count({
        where: { companyId: o.f.companyId },
      }),
    ).toBe(1);
  });
  it('02 distinct-key CREATE same Dispatch creates empty episodes', async () => {
    const o = await origin(),
      r = await Promise.all([create(o), create(o)]);
    expect(r[0].data.id).not.toBe(r[1].data.id);
    expect(
      r.every((v) => v.data.items.length === 0 && v.data.revision === 0),
    ).toBe(true);
  });
  it('03 wrong/foreign Dispatch rejects without claim', async () => {
    const o = await origin(),
      b = await origin();
    await code(
      execute(o, { operation: 'CREATE', dto: { dispatchId: b.d.id } }),
      'CASE_RECONCILIATION_SOURCE_NOT_VALID',
    );
    expect(
      await db.idempotencyRecord.count({ where: { companyId: o.f.companyId } }),
    ).toBe(0);
  });
  it('04 nonconfirmed Dispatch rejects', async () => {
    const o = await origin(),
      d = await draft(o.f);
    await code(
      execute(o, { operation: 'CREATE', dto: { dispatchId: d.d.id } }),
      'CASE_RECONCILIATION_SOURCE_NOT_VALID',
    );
  });
  it.each([false, true])(
    '05/06 valid source type equipment=%s',
    async (equipment) => {
      const { o, id, itemId } = await prepared(equipment),
        r = await read().detail(o.f.companyId, o.f.c.id, id);
      expect(r.items[0].id).toBe(itemId);
      expect(r.items[0].type).toBe(equipment ? 'EQUIPMENT' : 'MATERIAL');
    },
  );
  it('07 duplicate ACTIVE source', async () => {
    const { o, id } = await prepared();
    await code(add(o, id, 1), 'CASE_RECONCILIATION_SOURCE_ALREADY_REPRESENTED');
  });
  it('08 EXCLUDED then replacement ACTIVE', async () => {
    const { o, id, itemId } = await prepared();
    await execute(
      o,
      {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 1, reason: 'replace' },
      },
      id,
      itemId,
    );
    const r = await add(o, id, 2);
    expect(r.data.items.map((i) => i.lifecycle)).toEqual([
      'EXCLUDED',
      'ACTIVE',
    ]);
  });
  it('09 MATERIAL initial neutral', async () => {
    const { o, id } = await prepared();
    expect(
      (await read().detail(o.f.companyId, o.f.c.id, id)).items[0],
    ).toMatchObject({ returnedQty: 0, usedQty: 0, expectedSourceRevision: 1 });
  });
  it('10 Equipment initial UNRESOLVED', async () => {
    const { o, id } = await prepared(true);
    expect(
      (await read().detail(o.f.companyId, o.f.c.id, id)).items[0],
    ).toMatchObject({
      outcome: 'UNRESOLVED',
      reportedCondition: null,
      expectedPhysicalRevision: 1,
    });
  });
  it.each([
    [1, 0],
    [0, 1],
    [1, 1],
  ])(
    '11/12/13 outcome returned=%s used=%s replaces intent',
    async (returnedQty, usedQty) => {
      const { o, id, itemId } = await prepared();
      const r = await execute(o, material(1, returnedQty, usedQty), id, itemId);
      expect(r.data.items[0]).toMatchObject({ returnedQty, usedQty });
      expect(r.data.audit[2].change).toMatchObject({
        before: { returnedQty: 0, usedQty: 0 },
        after: { returnedQty, usedQty },
      });
    },
  );
  it('14 overflow-safe large intent rejected by capacity', async () => {
    const { o, id, itemId } = await prepared();
    await code(
      execute(o, material(1, 2147483647, 2147483647), id, itemId),
      'CASE_RECONCILIATION_CAPACITY_EXCEEDED',
    );
  });
  it('15 confirmed historical capacity and revision refresh', async () => {
    const o = await origin(),
      past = await episode(o);
    await finish(o, past, 1);
    const r = await create(o),
      a = await add(o, r.data.id);
    expect(a.data.items[0].expectedSourceRevision).toBe(2);
    await code(
      execute(o, material(1, 1, 1), r.data.id, a.command.itemId!),
      'CASE_RECONCILIATION_CAPACITY_EXCEEDED',
    );
    await execute(o, material(1, 0, 1), r.data.id, a.command.itemId!);
  });
  it('16 other DRAFT does not reserve capacity or double-count replaced intent', async () => {
    const { o, id, itemId } = await prepared(),
      b = await create(o),
      bi = await add(o, b.data.id);
    await execute(o, material(1, 2, 0), id, itemId);
    await execute(o, material(1, 0, 2), b.data.id, bi.command.itemId!);
    const r = await execute(o, material(2, 1, 1), id, itemId);
    expect(r.data.revision).toBe(3);
  });
  it('17 fully resolved source rejects ADD and even 0/0 update; CREATE stays allowed', async () => {
    const { o, id, itemId } = await prepared(),
      past = await episode(o);
    await finish(o, past, 2);
    await code(
      execute(o, material(1), id, itemId),
      'CASE_RECONCILIATION_CAPACITY_EXCEEDED',
    );
    const r = await create(o);
    await code(add(o, r.data.id), 'CASE_RECONCILIATION_CAPACITY_EXCEEDED');
  });
  it('18 prior UNRESOLVED episode permits later Equipment DRAFT', async () => {
    const o = await origin(true),
      past = await episode(o);
    await finish(o, past);
    const r = await create(o);
    await add(o, r.data.id);
  });
  it('19 actual prior Equipment close rejects ADD', async () => {
    const o = await origin(true),
      past = await episode(o);
    await finish(o, past, 0, true);
    const r = await create(o);
    await code(add(o, r.data.id), 'CASE_RECONCILIATION_CAPACITY_EXCEEDED');
  });
  it.each(['RETURNED', 'UNRESOLVED'] as const)(
    '20/21 Equipment %s and same-values revision refresh',
    async (outcome) => {
      const { o, id, itemId } = await prepared(true);
      await db.equipmentAsset.update({
        where: { id: o.f.asset.id },
        data: { physicalRevision: 2 },
      });
      const i: Intent = {
        operation: 'OUTCOME_SET',
        dto: {
          expectedRevision: 1,
          type: 'EQUIPMENT',
          outcome,
          reportedCondition: outcome === 'RETURNED' ? 'DAMAGED' : null,
        },
      };
      const r = await execute(o, i, id, itemId);
      expect(r.data.items[0]).toMatchObject({
        expectedPhysicalRevision: 2,
        outcome,
      });
      const next = await execute(
        o,
        { ...i, dto: { ...i.dto, expectedRevision: 2 } },
        id,
        itemId,
      );
      expect(next.data.revision).toBe(3);
    },
  );
  it('22 stale root revision race has observable row-lock barrier', async () => {
    const { o, id, itemId } = await prepared();
    const results = await competing(
      material(1, 1, 0),
      context(o, id, itemId),
      'lockDraftById',
    );
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected')
      expect(results[1].reason).toHaveProperty(
        'response.code',
        'RESOURCE_STATE_CHANGED',
      );
    expect(
      await db.healthcareCaseReconciliationAudit.count({
        where: { reconciliationId: id, operation: 'OUTCOME_SET' },
      }),
    ).toBe(1);
  });
  it('23 same key different payload fails before mutable gates', async () => {
    const o = await origin();
    await create(o, 'first', 'same');
    await code(create(o, 'second', 'same'), 'IDEMPOTENCY_KEY_REUSED');
  });
  it('24 replay preserves receipt after subsequent outcome/exclusion/cancellation and physical degradation', async () => {
    const { o, id, itemId } = await prepared(),
      key = 'lost-response',
      intent = material(1, 1, 0),
      first = await execute(o, intent, id, itemId, key);
    await execute(o, material(2, 0, 1), id, itemId);
    await execute(
      o,
      {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 3, reason: 'exclude' },
      },
      id,
      itemId,
    );
    await execute(
      o,
      { operation: 'CANCEL', dto: { expectedRevision: 4, reason: 'cancel' } },
      id,
    );
    await db.inventoryPosition.update({
      where: { id: o.source.destinationPositionId! },
      data: { quantity: 0 },
    });
    const actor = await db.user.create({
      data: {
        companyId: o.f.companyId,
        email: randomUUID() + '@example.invalid',
        firstName: 'Later',
        lastName: 'Actor',
        passwordHash: 'TEST',
        role: 'ADMIN',
      },
    });
    const r = await service().execute(
      { ...context(o, id, itemId, key), actorId: actor.id },
      intent,
    );
    expect(r.replay).toBe(true);
    expect(r.command).toEqual(first.command);
    expect(r.data.status).toBe('CANCELLED');
    expect(r.data.items[0].usedQty).toBe(1);
  });
  it('25 EXCLUDE preserves history, new key fails, same key replays', async () => {
    const { o, id, itemId } = await prepared(),
      i: Intent = {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 1, reason: ' reason ' },
      };
    const a = await execute(o, i, id, itemId, 'exclude');
    expect(a.data.items[0]).toMatchObject({
      lifecycle: 'EXCLUDED',
      exclusionReason: 'reason',
    });
    expect((await execute(o, i, id, itemId, 'exclude')).command).toEqual(
      a.command,
    );
    await code(
      execute(
        o,
        {
          operation: 'ITEM_EXCLUDE',
          dto: { expectedRevision: 2, reason: 'again' },
        },
        id,
        itemId,
      ),
      'CASE_RECONCILIATION_NOT_MUTABLE',
    );
  });
  it('26 CANCEL terminal and replay', async () => {
    const o = await origin(),
      r = await create(o),
      i: Intent = {
        operation: 'CANCEL',
        dto: { expectedRevision: 0, reason: ' done ' },
      };
    const a = await execute(o, i, r.data.id, undefined, 'cancel');
    expect(a.data.status).toBe('CANCELLED');
    expect(
      (await execute(o, i, r.data.id, undefined, 'cancel')).command,
    ).toEqual(a.command);
  });
  it('27 CANCEL ignores degraded physical source and Case state', async () => {
    const { o, id } = await prepared();
    await db.inventoryPosition.update({
      where: { id: o.source.destinationPositionId! },
      data: { quantity: 0 },
    });
    await db.healthcareCase.update({
      where: { id: o.f.c.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: o.f.user.id,
        cancellationReason: 'Changed',
      },
    });
    expect(
      (
        await execute(
          o,
          {
            operation: 'CANCEL',
            dto: { expectedRevision: 1, reason: 'cleanup' },
          },
          id,
        )
      ).data.status,
    ).toBe('CANCELLED');
  });
  it('28 terminal handling and stale precedence', async () => {
    const o = await origin(),
      e = await episode(o);
    await cancel(o, e);
    await code(
      execute(
        o,
        { operation: 'CANCEL', dto: { expectedRevision: 0, reason: 'x' } },
        e.r.id,
      ),
      'RESOURCE_STATE_CHANGED',
    );
    await code(
      execute(
        o,
        { operation: 'CANCEL', dto: { expectedRevision: 1, reason: 'x' } },
        e.r.id,
      ),
      'CASE_RECONCILIATION_NOT_MUTABLE',
    );
  });
  it('29 audit/completion failure rolls back claim, item, CAS and audit', async () => {
    const o = await origin(),
      r = await create(o),
      repo = repository();
    jest
      .spyOn(repo, 'appendAudit')
      .mockRejectedValueOnce(Error('Injected SQL secret'));
    await code(
      service(repo).execute(context(o, r.data.id), {
        operation: 'ITEM_ADD',
        dto: { expectedRevision: 0, sourceDispatchItemId: o.source.id },
      }),
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
    expect(
      await db.healthcareCaseReconciliationItem.count({
        where: { reconciliationId: r.data.id },
      }),
    ).toBe(0);
    expect(
      await db.idempotencyRecord.count({ where: { companyId: o.f.companyId } }),
    ).toBe(1);
    expect(
      (await read().detail(o.f.companyId, o.f.c.id, r.data.id)).revision,
    ).toBe(0);
    const repo2 = repository();
    jest
      .spyOn(repo2, 'completeClaim')
      .mockRejectedValueOnce(Error('Injected completion'));
    await code(
      service(repo2).execute(context(o, r.data.id), {
        operation: 'ITEM_ADD',
        dto: { expectedRevision: 0, sourceDispatchItemId: o.source.id },
      }),
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
    expect(
      (await read().detail(o.f.companyId, o.f.c.id, r.data.id)).audit,
    ).toHaveLength(1);
  });
  it('30 tenant and parent isolation', async () => {
    const { o, id, itemId } = await prepared(),
      foreign = await origin();
    await code(
      execute(foreign, material(1, 1, 0), id, itemId),
      'CASE_RECONCILIATION_NOT_FOUND',
    );
    const other = await create(o);
    await code(
      execute(o, material(0, 1, 0), other.data.id, itemId),
      'CASE_RECONCILIATION_ITEM_NOT_FOUND',
    );
  });
  it('31 observation CREATE-only and immutable across commands', async () => {
    const { o, id, itemId } = await prepared();
    await execute(o, material(1, 1, 0), id, itemId);
    await execute(
      o,
      {
        operation: 'ITEM_EXCLUDE',
        dto: { expectedRevision: 2, reason: 'exclude' },
      },
      id,
      itemId,
    );
    const r = await execute(
      o,
      { operation: 'CANCEL', dto: { expectedRevision: 3, reason: 'cancel' } },
      id,
    );
    expect(r.data.observation).toBe('Pending');
    expect(r.data.audit.every((a) => !('observation' in a.change))).toBe(true);
    const a = await create(o, null),
      b = await create(o, ' trimmed ');
    expect(a.data.observation).toBeNull();
    expect(b.data.observation).toBe('trimmed');
  });
  async function physicalSnapshot(o: O) {
    const companyId = o.f.companyId;
    return {
      effects: await db.inventoryPhysicalEffect.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      lines: await db.inventoryPhysicalEffectLine.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      positions: await db.inventoryPosition.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      products: await db.product.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      batches: await db.inventoryBatch.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      assets: await db.equipmentAsset.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      custodies: await db.equipmentAssetCustody.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      events: await db.equipmentAssetPhysicalEvent.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
      assignments: await db.healthcareEquipmentAssignment.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
      }),
    };
  }
  it.each([false, true])(
    '32/33/34/35 zero physical deltas per command Equipment=%s',
    async (equipment) => {
      const o = await origin(equipment),
        before = await physicalSnapshot(o),
        r = await create(o);
      expect(await physicalSnapshot(o)).toEqual(before);
      const a = await add(o, r.data.id);
      expect(await physicalSnapshot(o)).toEqual(before);
      const i: Intent = equipment
        ? {
            operation: 'OUTCOME_SET',
            dto: {
              expectedRevision: 1,
              type: 'EQUIPMENT',
              outcome: 'RETURNED',
              reportedCondition: 'INSPECTION_PENDING',
            },
          }
        : material(1, 1, 1);
      await execute(o, i, r.data.id, a.command.itemId!);
      expect(await physicalSnapshot(o)).toEqual(before);
      await execute(
        o,
        {
          operation: 'ITEM_EXCLUDE',
          dto: { expectedRevision: 2, reason: 'exclude' },
        },
        r.data.id,
        a.command.itemId!,
      );
      expect(await physicalSnapshot(o)).toEqual(before);
      await execute(
        o,
        { operation: 'CANCEL', dto: { expectedRevision: 3, reason: 'cancel' } },
        r.data.id,
      );
      expect(await physicalSnapshot(o)).toEqual(before);
    },
  );
  it('36 no authority fence or advisory Company lock in command transaction', async () => {
    const { o, id, itemId } = await prepared(),
      repo = repository(),
      original = (
        ...args: Parameters<
          HealthcareCaseReconciliationCommandRepository['setMaterialOutcome']
        >
      ) => repository().setMaterialOutcome(...args);
    let checked = false;
    jest
      .spyOn(repo, 'setMaterialOutcome')
      .mockImplementation(async (...args) => {
        const [row] = await args[4].$queryRaw<
          { count: bigint }[]
        >`SELECT count(*) FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'`;
        expect(row.count).toBe(0n);
        checked = true;
        return original(...args);
      });
    await service(repo).execute(context(o, id, itemId), material(1, 1, 1));
    expect(checked).toBe(true);
  });

  it.each([
    { type: 'MATERIAL', returnedQty: -1, usedQty: 0 },
    { type: 'MATERIAL', returnedQty: '1', usedQty: 0 },
    { type: 'EQUIPMENT', outcome: 'RETURNED', reportedCondition: null },
    { type: 'EQUIPMENT', outcome: 'UNRESOLVED', reportedCondition: 'GOOD' },
  ])('37 invalid outcome DTO rejects before DB command', async (patch) => {
    const o = await origin(),
      before = await db.idempotencyRecord.count({
        where: { companyId: o.f.companyId },
      });
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { expectedRevision: 0, ...patch },
        { type: 'body', metatype: SetHealthcareCaseReconciliationOutcomeDto },
      ),
    ).rejects.toThrow();
    expect(
      await db.idempotencyRecord.count({ where: { companyId: o.f.companyId } }),
    ).toBe(before);
  });
  it('38 same-value Material outcome refreshes observed Position revision', async () => {
    const { o, id, itemId } = await prepared();
    await db.inventoryPosition.update({
      where: { id: o.source.destinationPositionId! },
      data: { revision: 3 },
    });
    const r = await execute(o, material(1), id, itemId);
    expect(r.data.items[0].expectedSourceRevision).toBe(3);
    expect(r.data.revision).toBe(2);
  });
});
