import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { correctionFixtureFactory } from './dispatch-correction-fixture';
import { createDispatchCorrectionRequestHash } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract';

export type CorrectionOrigin = Awaited<
  ReturnType<ReturnType<typeof correctionFixtureFactory>['origin']>
>;
export type WitnessOptions = {
  rootPatch?: Partial<Prisma.HealthcareCaseDispatchCorrectionUncheckedCreateInput>;
  closePatch?: Partial<Prisma.EquipmentAssetPhysicalEventUncheckedCreateInput>;
  id?: string;
  key?: string;
  omitItem?: boolean;
  omitSourceId?: string;
  seal?: boolean;
  afterRoot?: (tx: Prisma.TransactionClient, id: string) => Promise<void>;
  beforeRoot?: (tx: Prisma.TransactionClient, id: string) => Promise<void>;
  beforeSnapshot?: (tx: Prisma.TransactionClient, id: string) => Promise<void>;
  afterSnapshot?: (tx: Prisma.TransactionClient, id: string) => Promise<void>;
  afterSeal?: (tx: Prisma.TransactionClient, id: string) => Promise<void>;
};

// Synthetic Effect/Event fixtures to test database constraints. This deliberately
// does not call or add any product compensation service.
export async function stageCorrectionWitness(
  tx: Prisma.TransactionClient,
  o: CorrectionOrigin,
  actorId: string,
  options: WitnessOptions = {},
) {
  const id = options.id ?? randomUUID();
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
    SELECT date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC') AS now`;
  const source = await tx.healthcareCaseDispatch.findUniqueOrThrow({
    where: { id: o.d.id },
  });
  const sources = await tx.healthcareCaseDispatchItem.findMany({
    where: { dispatchId: source.id, lifecycle: 'ACTIVE' },
    orderBy: { id: 'asc' },
  });
  const items = sources.filter((item) => item.id !== options.omitSourceId);
  const reason = 'Confirmado por error; sin entrega física';
  const requestHash = createDispatchCorrectionRequestHash({
    companyId: o.f.companyId,
    caseId: source.caseId,
    dispatchId: source.id,
    reason,
    attestedNoHandoff: true,
  });
  const claim = await tx.idempotencyRecord.create({
    data: {
      companyId: o.f.companyId,
      scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
      key: options.key ?? randomUUID(),
      resourceId: id,
      requestHash,
    },
  });
  await options.beforeRoot?.(tx, id);
  await tx.healthcareCaseDispatchCorrection.create({
    data: {
      id,
      companyId: o.f.companyId,
      caseId: source.caseId,
      caseKitId: source.caseKitId,
      dispatchId: source.id,
      reason,
      attestedNoHandoff: true,
      confirmedById: actorId,
      confirmedAt: now,
      requestHash,
      idempotencyRecordId: claim.id,
      ...options.rootPatch,
    },
  });
  await options.afterRoot?.(tx, id);
  const material = items.filter((i) => i.type === 'MATERIAL');
  let effectId: string | undefined;
  if (material.length && !options.omitItem) {
    const credits = new Map<string, number>();
    for (const item of material)
      credits.set(
        item.sourcePositionId!,
        (credits.get(item.sourcePositionId!) ?? 0) + item.quantity!,
      );
    const effect = await tx.inventoryPhysicalEffect.create({
      data: {
        companyId: o.f.companyId,
        kind: 'TRANSFER',
        originType: 'CASE_DISPATCH_CORRECTION',
        originId: id,
        originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
        requestHash,
        actorId,
        occurredAt: now,
        lineCount: material.length + credits.size,
      },
    });
    effectId = effect.id;
    let sequence = 0;
    for (const item of material) {
      const p = await tx.inventoryPosition.findUniqueOrThrow({
        where: { id: item.destinationPositionId! },
      });
      await tx.inventoryPhysicalEffectLine.create({
        data: {
          companyId: o.f.companyId,
          effectId,
          positionId: p.id,
          sequence: ++sequence,
          delta: -item.quantity!,
          quantityBefore: p.quantity,
          quantityAfter: p.quantity - item.quantity!,
          revisionBefore: p.revision,
          revisionAfter: p.revision + 1,
        },
      });
      await tx.inventoryPosition.update({
        where: { id: p.id },
        data: {
          quantity: p.quantity - item.quantity!,
          revision: p.revision + 1,
        },
      });
    }
    for (const [positionId, quantity] of credits) {
      const p = await tx.inventoryPosition.findUniqueOrThrow({
        where: { id: positionId },
      });
      await tx.inventoryPhysicalEffectLine.create({
        data: {
          companyId: o.f.companyId,
          effectId,
          positionId,
          sequence: ++sequence,
          delta: quantity,
          quantityBefore: p.quantity,
          quantityAfter: p.quantity + quantity,
          revisionBefore: p.revision,
          revisionAfter: p.revision + 1,
        },
      });
      await tx.inventoryPosition.update({
        where: { id: positionId },
        data: { quantity: p.quantity + quantity, revision: p.revision + 1 },
      });
    }
  }
  if (!options.omitItem)
    for (const item of items) {
      const itemId = randomUUID();
      const base = {
        id: itemId,
        companyId: o.f.companyId,
        correctionId: id,
        dispatchId: source.id,
        sourceDispatchItemId: item.id,
        type: item.type,
      };
      if (item.type === 'MATERIAL') {
        await tx.healthcareCaseDispatchCorrectionItem.create({
          data: {
            ...base,
            quantity: item.quantity,
            originalPhysicalEffectId: item.physicalEffectId,
            sourceCustodyPositionId: item.destinationPositionId,
            compensatingEffectId: effectId,
            destinationPositionId: item.sourcePositionId,
          },
        });
      } else {
        const open = await tx.equipmentAssetPhysicalEvent.findUniqueOrThrow({
          where: { id: item.equipmentPhysicalEventId! },
        });
        const close = await tx.equipmentAssetPhysicalEvent.create({
          data: {
            companyId: o.f.companyId,
            equipmentAssetId: item.assetId!,
            custodyId: item.equipmentCustodyId,
            operation: 'CUSTODY_CLOSE',
            originType: 'CASE_DISPATCH_CORRECTION_ITEM',
            originId: itemId,
            originOperation: 'COMPENSATE_NO_HANDOFF_EQUIPMENT',
            requestHash,
            actorId,
            createdAt: now,
            reasonCode: 'NO_PHYSICAL_HANDOFF',
            physicalLocationBefore: 'CUSTODY',
            physicalLocationAfter: 'WAREHOUSE',
            conditionBefore: open.conditionAfter,
            conditionAfter: open.conditionAfter,
            lifecycleBefore: open.lifecycleAfter,
            lifecycleAfter: open.lifecycleAfter,
            revisionBefore: open.revisionAfter,
            revisionAfter: open.revisionAfter + 1,
            ...options.closePatch,
          },
        });
        await tx.equipmentAssetCustody.update({
          where: { id: item.equipmentCustodyId! },
          data: { closedAt: now, closedById: actorId },
        });
        await tx.equipmentAsset.update({
          where: { id: item.assetId! },
          data: {
            physicalLocation: 'WAREHOUSE',
            activeCustodyId: null,
            physicalRevision: close.revisionAfter,
          },
        });
        await tx.healthcareCaseDispatchCorrectionItem.create({
          data: {
            ...base,
            assetId: item.assetId,
            equipmentCustodyId: item.equipmentCustodyId,
            openPhysicalEventId: open.id,
            closePhysicalEventId: close.id,
          },
        });
      }
    }
  await options.beforeSnapshot?.(tx, id);
  await tx.$executeRaw`UPDATE "HealthcareCaseDispatchCorrectionItem" SET snapshot=public.dispatch_correction_item_snapshot(id) WHERE "correctionId"=${id}`;
  await options.afterSnapshot?.(tx, id);
  if (options.seal !== false) {
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    await tx.healthcareCaseDispatchCorrection.update({
      where: { id },
      data: {
        snapshot: {
          version: 1,
          correctionId: id,
          kind: 'NO_PHYSICAL_HANDOFF',
          reason,
          attestedNoHandoff: true,
          sourceDispatch: { id: source.id, history: source.snapshot },
          confirmedBy: { id: actorId, role: actor.role },
          confirmedAt: now.toISOString(),
          requestHash,
        },
      },
    });
  }
  await options.afterSeal?.(tx, id);
  return { id, claim, requestHash };
}

export function persistCorrectionWitness(
  db: PrismaClient,
  o: CorrectionOrigin,
  actorId: string,
  options?: WitnessOptions,
) {
  return db.$transaction(
    (tx) => stageCorrectionWitness(tx, o, actorId, options),
    { timeout: 15000, isolationLevel: 'ReadCommitted' },
  );
}
