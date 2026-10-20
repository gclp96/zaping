import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { correctionFixtureFactory } from './dispatch-correction-fixture';

export async function groupedCorrectionOrigin(
  db: PrismaClient,
  mixed: boolean,
) {
  const factory = correctionFixtureFactory(db);
  const f = await factory.fixture();
  const { d, i } = await factory.confirmed(
    f,
    false,
    async (tx, dispatchId, firstId) => {
      const first = await tx.healthcareCaseDispatchItem.findUniqueOrThrow({
        where: { id: firstId },
      });
      const product = await tx.product.create({
        data: {
          companyId: f.companyId,
          sku: randomUUID(),
          name: 'Grouped material',
          lotTracking: 'NONE',
        },
      });
      const requirement = await tx.healthcareCaseRequirement.create({
        data: {
          companyId: f.companyId,
          caseId: f.c.id,
          productId: product.id,
          requestedQty: 10,
          type: 'REQUIRED',
          sortOrder: 1,
          createdById: f.user.id,
        },
      });
      const kitItem = await tx.healthcareCaseKitItem.create({
        data: {
          companyId: f.companyId,
          caseId: f.c.id,
          caseKitId: f.kit.id,
          requirementId: requirement.id,
          preparedQuantity: 10,
          addedById: f.user.id,
        },
      });
      const available = await tx.inventoryPosition.create({
        data: {
          companyId: f.companyId,
          productId: product.id,
          state: 'AVAILABLE',
          quantity: 8,
          revision: 1,
        },
      });
      const secondId = randomUUID();
      const custody = await tx.inventoryPosition.create({
        data: {
          companyId: f.companyId,
          productId: product.id,
          state: 'CUSTODY',
          contextType: 'CASE_DISPATCH_ITEM',
          contextId: secondId,
          quantity: 2,
          revision: 1,
        },
      });
      await tx.inventoryPhysicalEffect.update({
        where: { id: first.physicalEffectId! },
        data: { lineCount: 4 },
      });
      await tx.inventoryPhysicalEffectLine.createMany({
        data: [
          {
            companyId: f.companyId,
            effectId: first.physicalEffectId!,
            positionId: available.id,
            sequence: 3,
            delta: -2,
            quantityBefore: 10,
            quantityAfter: 8,
            revisionBefore: 0,
            revisionAfter: 1,
          },
          {
            companyId: f.companyId,
            effectId: first.physicalEffectId!,
            positionId: custody.id,
            sequence: 4,
            delta: 2,
            quantityBefore: 0,
            quantityAfter: 2,
            revisionBefore: 0,
            revisionAfter: 1,
          },
        ],
      });
      await tx.healthcareCaseDispatchItem.create({
        data: {
          id: secondId,
          ...factory.itemData(f, dispatchId),
          sourceCaseKitItemId: kitItem.id,
          productId: product.id,
          sourcePositionId: available.id,
          destinationPositionId: custody.id,
          physicalEffectId: first.physicalEffectId,
          snapshot: {
            ...factory.itemSnapshot(f),
            product: {
              id: product.id,
              sku: product.sku,
              name: product.name,
              inventoryTracking: 'QUANTITY',
              lotTracking: 'NONE',
            },
            preparation: {
              sourceCaseKitItemId: kitItem.id,
              requirementId: requirement.id,
              assignmentId: null,
              preparedQuantity: 10,
            },
          },
        },
      });
      if (mixed) {
        const equipment = await tx.healthcareCaseDispatchItem.create({
          data: factory.equipmentData(f, dispatchId),
        });
        const episode = await tx.equipmentAssetCustody.create({
          data: {
            companyId: f.companyId,
            equipmentAssetId: f.asset.id,
            caseId: f.c.id,
            assignmentId: f.assignment.id,
            openedById: f.user.id,
          },
        });
        const event = await tx.equipmentAssetPhysicalEvent.create({
          data: {
            companyId: f.companyId,
            equipmentAssetId: f.asset.id,
            custodyId: episode.id,
            operation: 'CUSTODY_OPEN',
            originType: 'CASE_DISPATCH_ITEM',
            originId: equipment.id,
            originOperation: 'CONFIRM_EQUIPMENT',
            requestHash: 'a'.repeat(64),
            physicalLocationBefore: 'WAREHOUSE',
            physicalLocationAfter: 'CUSTODY',
            conditionBefore: 'GOOD',
            conditionAfter: 'GOOD',
            lifecycleBefore: 'ACTIVE',
            lifecycleAfter: 'ACTIVE',
            revisionBefore: 0,
            revisionAfter: 1,
            actorId: f.user.id,
            reasonCode: 'FIXTURE',
          },
        });
        await tx.equipmentAsset.update({
          where: { id: f.asset.id },
          data: {
            physicalLocation: 'CUSTODY',
            activeCustodyId: episode.id,
            physicalRevision: 1,
          },
        });
        await tx.healthcareCaseDispatchItem.update({
          where: { id: equipment.id },
          data: {
            equipmentCustodyId: episode.id,
            equipmentPhysicalEventId: event.id,
            snapshot: factory.itemSnapshot(f, true),
          },
        });
      }
    },
  );
  const source = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
    where: { id: i.id },
  });
  return { f, d, source };
}

export async function originalDispatchBytes(
  db: Prisma.TransactionClient,
  dispatchId: string,
) {
  const [row] = await db.$queryRaw<{ bytes: string }[]>`
    SELECT jsonb_build_object('root',to_jsonb(d),
      'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM "HealthcareCaseDispatchItem" i WHERE i."dispatchId"=d.id),
      'audit',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM "HealthcareCaseDispatchAudit" a WHERE a."dispatchId"=d.id))::text AS bytes
    FROM "HealthcareCaseDispatch" d WHERE d.id=${dispatchId}`;
  return row.bytes;
}
