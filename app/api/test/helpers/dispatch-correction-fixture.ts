// Synthetic test fixtures only. Never import from application code.
// Based on the existing Dispatch/RR structural acceptance fixture.
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
export function correctionFixtureFactory(db: PrismaClient) {
  async function fixture() {
    const company = await db.company.create({
        data: { name: 'HC-DSP-COR-01B QA', rfc: randomUUID() },
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
        : {
            ...itemData(f, d.id),
            expectedPositionRevision: (
              await db.inventoryPosition.findUniqueOrThrow({
                where: { id: f.position.id },
              })
            ).revision,
          },
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
        const [available] = await tx.$queryRaw<
          { quantity: number; revision: number }[]
        >`
          SELECT quantity,revision FROM "InventoryPosition"
          WHERE id=${f.position.id} AND "companyId"=${f.companyId} FOR UPDATE`;
        if (
          available.revision !== i.expectedPositionRevision ||
          available.quantity < i.quantity!
        ) {
          throw new Error(
            'Synthetic fixture source changed before confirmation',
          );
        }
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
              quantityBefore: available.quantity,
              quantityAfter: available.quantity - i.quantity!,
              revisionBefore: available.revision,
              revisionAfter: available.revision + 1,
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
          data: {
            quantity: available.quantity - i.quantity!,
            revision: available.revision + 1,
          },
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

  return {
    fixture,
    confirmed,
    origin,
    itemSnapshot,
    rootSnapshot,
    itemData,
    equipmentData,
  };
}
