import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { correctionFixtureFactory } from './dispatch-correction-fixture';
import { groupedCorrectionOrigin } from './dispatch-correction-grouped-fixture';
import { createDispatchCorrectionRequestHash } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract';
import { PhysicalInventoryService } from '../../src/inventory/physical/physical-inventory.service';
import { PhysicalInventoryRepository } from '../../src/inventory/physical/physical-inventory.repository';
import { InventoryCompatibilityProjectionService } from '../../src/inventory/physical/inventory-compatibility-projection.service';
import { inventoryAuthorityFence } from '../../src/inventory/physical/inventory-authority-fence';
import { InventoryAuthorityResolver } from '../../src/inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../../src/inventory/physical/inventory-runtime-compatibility.service';
import { DispatchCorrectionMaterialInput } from '../../src/inventory/physical/dispatch-correction-physical.adapter';

// Synthetic isolated contract harness, not a correction command or production caller.
export const materialService = () =>
  new PhysicalInventoryService(new PhysicalInventoryRepository());
export async function materialOrigin(
  db: PrismaClient,
  grouped = false,
  mixed = false,
  batched = false,
) {
  let o: Awaited<
    ReturnType<ReturnType<typeof correctionFixtureFactory>['origin']>
  >;
  if (batched) {
    const factory = correctionFixtureFactory(db);
    const f = await factory.fixture();
    const { d, i } = await factory.confirmed(
      f,
      false,
      async (tx, _id, itemId) => {
        const batch = await tx.inventoryBatch.create({
          data: {
            companyId: f.companyId,
            productId: f.product.id,
            lotNumber: randomUUID(),
            expirationDate: new Date(Date.now() + 86400000),
            initialQuantity: 10,
            availableQuantity: 8,
          },
        });
        await tx.product.update({
          where: { id: f.product.id },
          data: { lotTracking: 'REQUIRED' },
        });
        await tx.inventoryPosition.updateMany({
          where: { companyId: f.companyId, productId: f.product.id },
          data: { inventoryBatchId: batch.id },
        });
        await tx.healthcareCaseDispatchItem.update({
          where: { id: itemId },
          data: {
            batchId: batch.id,
            snapshot: {
              ...factory.itemSnapshot(f),
              product: {
                ...factory.itemSnapshot(f).product,
                lotTracking: 'REQUIRED',
              },
              batch: {
                id: batch.id,
                lotNumber: batch.lotNumber,
                expirationDate: batch.expirationDate!.toISOString(),
              },
            },
          },
        });
      },
    );
    o = {
      f,
      d,
      source: await db.healthcareCaseDispatchItem.findUniqueOrThrow({
        where: { id: i.id },
      }),
    };
  } else {
    o = grouped
      ? await groupedCorrectionOrigin(db, mixed)
      : await correctionFixtureFactory(db).origin();
  }
  await db.company.update({
    where: { id: o.f.companyId },
    data: { name: 'HC-DSP-COR-01C-A QA' },
  });
  await db.product.updateMany({
    where: { companyId: o.f.companyId, inventoryTracking: 'QUANTITY' },
    data: { stock: 10 },
  });
  // This is synthetic control in the dedicated QA DB; never an operational cutover.
  await db.inventoryCutover.create({
    data: {
      companyId: o.f.companyId,
      status: 'PHYSICAL_ACTIVE',
      initiatedBy: o.f.user.id,
      approvedBy: o.f.user.id,
      activatedBy: o.f.user.id,
      activatedAt: new Date(),
      manifestDigest: 'a'.repeat(64),
      snapshotFingerprint: 'b'.repeat(64),
      baselineBuild: '01c-a-fixture',
      manifestLockedAt: new Date(),
    },
  });
  return o;
}
export type MaterialOrigin = Awaited<ReturnType<typeof materialOrigin>>;
export type MaterialOptions = {
  reason?: string;
  beforeApply?: (
    tx: Prisma.TransactionClient,
    input: DispatchCorrectionMaterialInput,
  ) => Promise<void>;
  afterApply?: (
    tx: Prisma.TransactionClient,
    input: DispatchCorrectionMaterialInput,
  ) => Promise<void>;
};

export async function stageMaterialContract(
  tx: Prisma.TransactionClient,
  o: MaterialOrigin,
  options: MaterialOptions = {},
) {
  await inventoryAuthorityFence(tx, o.f.companyId, 'shared');
  if (
    (await new InventoryAuthorityResolver().resolve(tx, o.f.companyId)) !==
    'PHYSICAL'
  )
    throw new Error('Fixture requires PHYSICAL');
  new InventoryRuntimeCompatibilityService().identity();
  // Lock prefix owned by the harness. Global HC/RR concurrency is a B/C gate.
  await tx.$queryRaw`SELECT id FROM "HealthcareCase" WHERE id=${o.f.c.id} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "HealthcareCaseDispatch" WHERE id=${o.d.id} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "HealthcareCaseDispatchItem" WHERE "dispatchId"=${o.d.id} ORDER BY id FOR UPDATE`;
  const input: DispatchCorrectionMaterialInput = {
    companyId: o.f.companyId,
    caseId: o.f.c.id,
    dispatchId: o.d.id,
    correctionId: randomUUID(),
    requesterId: o.f.user.id,
    idempotencyKey: randomUUID(),
    attestedNoHandoff: true,
    reason: options.reason ?? 'Confirmado por error; sin entrega física',
  };
  const requestHash = createDispatchCorrectionRequestHash(input);
  const [{ at }] = await tx.$queryRaw<
    { at: Date }[]
  >`SELECT date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC') AS at`;
  const claim = await tx.idempotencyRecord.create({
    data: {
      companyId: input.companyId,
      scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
      key: input.idempotencyKey,
      resourceId: input.correctionId,
      requestHash,
    },
  });
  await tx.healthcareCaseDispatchCorrection.create({
    data: {
      id: input.correctionId,
      companyId: input.companyId,
      caseId: input.caseId,
      caseKitId: o.f.kit.id,
      dispatchId: input.dispatchId,
      reason: input.reason,
      attestedNoHandoff: true,
      confirmedById: input.requesterId,
      confirmedAt: at,
      requestHash,
      idempotencyRecordId: claim.id,
    },
  });
  await options.beforeApply?.(tx, input);
  const result = await materialService().transferDispatchCorrectionMaterial(
    tx,
    input,
  );
  if (result.replay) throw new Error('Fresh fixture unexpectedly replayed');
  await new InventoryCompatibilityProjectionService().apply(
    tx,
    input.companyId,
    result,
  );
  await options.afterApply?.(tx, input);
  const items = await tx.healthcareCaseDispatchItem.findMany({
    where: { dispatchId: input.dispatchId, lifecycle: 'ACTIVE' },
    orderBy: { id: 'asc' },
  });
  for (const source of items) {
    const destination = await tx.inventoryPosition.findFirstOrThrow({
      where: {
        companyId: input.companyId,
        productId: source.productId,
        inventoryBatchId: source.batchId,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
      },
    });
    await tx.healthcareCaseDispatchCorrectionItem.create({
      data: {
        companyId: input.companyId,
        correctionId: input.correctionId,
        dispatchId: input.dispatchId,
        sourceDispatchItemId: source.id,
        type: 'MATERIAL',
        quantity: source.quantity,
        originalPhysicalEffectId: source.physicalEffectId,
        sourceCustodyPositionId: source.destinationPositionId,
        compensatingEffectId: result.effect.id,
        destinationPositionId: destination.id,
      },
    });
  }
  await tx.$executeRaw`UPDATE "HealthcareCaseDispatchCorrectionItem" SET snapshot=public.dispatch_correction_item_snapshot(id) WHERE "correctionId"=${input.correctionId}`;
  const source = await tx.healthcareCaseDispatch.findUniqueOrThrow({
    where: { id: input.dispatchId },
  });
  const actor = await tx.user.findUniqueOrThrow({
    where: { id: input.requesterId },
  });
  await tx.healthcareCaseDispatchCorrection.update({
    where: { id: input.correctionId },
    data: {
      snapshot: {
        version: 1,
        correctionId: input.correctionId,
        kind: 'NO_PHYSICAL_HANDOFF',
        reason: input.reason,
        attestedNoHandoff: true,
        sourceDispatch: { id: source.id, history: source.snapshot },
        confirmedBy: { id: actor.id, role: actor.role },
        confirmedAt: at.toISOString(),
        requestHash,
      },
    },
  });
  return { input, result, at };
}

export function persistMaterialContract(
  db: PrismaClient,
  o: MaterialOrigin,
  options?: MaterialOptions,
) {
  return db.$transaction((tx) => stageMaterialContract(tx, o, options), {
    isolationLevel: 'ReadCommitted',
    timeout: 15000,
  });
}
