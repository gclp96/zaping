import { randomUUID } from 'node:crypto';
import { EquipmentCondition, Prisma, PrismaClient } from '@prisma/client';
import { correctionFixtureFactory } from './dispatch-correction-fixture';
import {
  orchestrationHarness,
  orchestrationState,
} from './dispatch-correction-material-orchestration-fixture';
import { HealthcareCaseDispatchCorrectionCommandService } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.service';
import { HealthcareCaseDispatchCorrectionEquipmentOrchestrator } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-equipment.orchestrator';
import { InventoryAuthorityResolver } from '../../src/inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../../src/inventory/physical/inventory-runtime-compatibility.service';
import { EquipmentService } from '../../src/equipment/equipment.service';
import { EquipmentAssetCodeService } from '../../src/equipment/equipment-asset-code.service';
import { CompanySequenceAllocatorService } from '../../src/company-sequences/company-sequence-allocator.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MaterialCorrectionResult } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.contract';

// Isolated structural fixtures, NOT a production Dispatch/cutover execution.
// Original Equipment opening facts are created together while Dispatch is DRAFT;
// no mutation of immutable Events or confirmed Dispatch history is necessary.
export async function equipmentOrigin(
  db: PrismaClient,
  runId: string,
  material = false,
  equipmentCount = 1,
  condition: EquipmentCondition = 'GOOD',
) {
  const factory = correctionFixtureFactory(db),
    f = await factory.fixture();
  async function equipment(tx: Prisma.TransactionClient, dispatchId: string) {
    for (let n = 0; n < equipmentCount; n++) {
      const asset =
        n === 0
          ? f.asset
          : await tx.equipmentAsset.create({
              data: {
                companyId: f.companyId,
                productId: f.ep.id,
                assetCode: randomUUID(),
                condition,
              },
            });
      const assignment =
        n === 0
          ? f.assignment
          : await tx.healthcareEquipmentAssignment.create({
              data: {
                companyId: f.companyId,
                caseId: f.c.id,
                equipmentAssetId: asset.id,
                origin: 'DIRECT',
                directAssignmentReason: '01D isolated fixture',
                createdById: f.user.id,
              },
            });
      const kitItem =
        n === 0
          ? f.es
          : await tx.healthcareCaseKitItem.create({
              data: {
                companyId: f.companyId,
                caseId: f.c.id,
                caseKitId: f.kit.id,
                equipmentAssignmentId: assignment.id,
                addedById: f.user.id,
              },
            });
      const item = await tx.healthcareCaseDispatchItem.create({
        data: {
          ...factory.equipmentData(f, dispatchId),
          assetId: asset.id,
          assignmentId: assignment.id,
          sourceCaseKitItemId: kitItem.id,
        },
      });
      const [{ at }] = await tx.$queryRaw<
        { at: Date }[]
      >`SELECT date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC') AS at`;
      const custody = await tx.equipmentAssetCustody.create({
        data: {
          companyId: f.companyId,
          equipmentAssetId: asset.id,
          caseId: f.c.id,
          assignmentId: assignment.id,
          openedById: f.user.id,
          openedAt: at,
        },
      });
      const event = await tx.equipmentAssetPhysicalEvent.create({
        data: {
          companyId: f.companyId,
          equipmentAssetId: asset.id,
          custodyId: custody.id,
          operation: 'CUSTODY_OPEN',
          originType: 'CASE_DISPATCH_ITEM',
          originId: item.id,
          originOperation: 'CONFIRM_EQUIPMENT',
          requestHash: 'a'.repeat(64),
          physicalLocationBefore: 'WAREHOUSE',
          physicalLocationAfter: 'CUSTODY',
          conditionBefore: condition,
          conditionAfter: condition,
          lifecycleBefore: asset.lifecycle,
          lifecycleAfter: asset.lifecycle,
          revisionBefore: 0,
          revisionAfter: 1,
          actorId: f.user.id,
          reasonCode: 'ISOLATED_FIXTURE',
          createdAt: at,
        },
      });
      await tx.equipmentAsset.update({
        where: { id: asset.id },
        data: {
          physicalLocation: 'CUSTODY',
          activeCustodyId: custody.id,
          physicalRevision: 1,
          condition,
        },
      });
      const snapshot = factory.itemSnapshot(
        { ...f, asset, assignment, es: kitItem },
        true,
      );
      await tx.healthcareCaseDispatchItem.update({
        where: { id: item.id },
        data: {
          equipmentCustodyId: custody.id,
          equipmentPhysicalEventId: event.id,
          snapshot,
        },
      });
    }
  }
  let dispatchId: string;
  if (material) {
    const { d } = await factory.confirmed(f, false, (tx, id) =>
      equipment(tx, id),
    );
    dispatchId = d.id;
    await db.product.update({
      where: { id: f.product.id },
      data: { stock: 10 },
    });
    await db.inventoryCutover.create({
      data: {
        companyId: f.companyId,
        status: 'PHYSICAL_ACTIVE',
        initiatedBy: f.user.id,
        approvedBy: f.user.id,
        activatedBy: f.user.id,
        activatedAt: new Date(),
        manifestDigest: 'a'.repeat(64),
        snapshotFingerprint: 'b'.repeat(64),
        baselineBuild: '01d-isolated-fixture',
        manifestLockedAt: new Date(),
      },
    });
  } else {
    const d = await db.healthcareCaseDispatch.create({
      data: {
        companyId: f.companyId,
        caseId: f.c.id,
        caseKitId: f.kit.id,
        createdById: f.user.id,
        custodianType: 'EXTERNAL_PERSON',
        custodianDisplayName: 'Receiver',
      },
    });
    dispatchId = d.id;
    await db.$transaction(async (tx) => {
      await equipment(tx, d.id);
      const [{ at }] = await tx.$queryRaw<
        { at: Date }[]
      >`SELECT date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC') AS at`;
      await tx.healthcareCaseDispatch.update({
        where: { id: d.id },
        data: { snapshot: factory.rootSnapshot(f, at), snapshotVersion: 1 },
      });
      await tx.healthcareCaseDispatch.update({
        where: { id: d.id },
        data: {
          status: 'CONFIRMED',
          revision: 1,
          confirmedFromRevision: 0,
          confirmedById: f.user.id,
          confirmedAt: at,
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
    });
  }
  await db.company.update({
    where: { id: f.companyId },
    data: { name: 'HC-DSP-COR-01D QA ' + runId },
  });
  const d = await db.healthcareCaseDispatch.findUniqueOrThrow({
    where: { id: dispatchId },
  });
  const items = await db.healthcareCaseDispatchItem.findMany({
    where: { dispatchId, companyId: f.companyId, lifecycle: 'ACTIVE' },
    orderBy: { id: 'asc' },
  });
  const source = items[0];
  if (!source) throw new Error('01D fixture must contain ACTIVE source');
  return { f, d, source, items };
}
export type EquipmentOrigin = Awaited<ReturnType<typeof equipmentOrigin>>;

export function equipmentHarness(db: PrismaClient) {
  const h = orchestrationHarness(db);
  const equipment = new HealthcareCaseDispatchCorrectionEquipmentOrchestrator();
  return {
    ...h,
    equipment,
    service: new HealthcareCaseDispatchCorrectionCommandService(
      h.repo,
      h.policy,
      h.physical,
      h.projections,
      new InventoryAuthorityResolver(),
      new InventoryRuntimeCompatibilityService(),
      equipment,
    ),
  };
}
export async function equipmentState(db: PrismaClient, companyId: string) {
  const where = { companyId },
    orderBy = { id: 'asc' as const };
  return {
    ...(await orchestrationState(db, companyId)),
    custodies: await db.equipmentAssetCustody.findMany({ where, orderBy }),
    assignments: await db.healthcareEquipmentAssignment.findMany({
      where,
      orderBy,
    }),
    inspections: await db.equipmentInspection.findMany({ where, orderBy }),
    cutover: await db.inventoryCutover.findMany({ where, orderBy }),
    case: await db.healthcareCase.findMany({ where, orderBy }),
  };
}
export type EquipmentState = Awaited<ReturnType<typeof equipmentState>>;
export function inspectionService(db: PrismaClient) {
  const prisma = db as PrismaService;
  return new EquipmentService(
    prisma,
    new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
  );
}
export function expectEquipmentCorrection(
  before: EquipmentState,
  after: EquipmentState,
  result: MaterialCorrectionResult,
) {
  expect(result.replay).toBe(false);
  expect(after.roots).toHaveLength(1);
  const root = after.roots[0];
  expect(root.snapshot).not.toBeNull();
  expect(result.witness).toMatchObject(root);
  expect(after.items).toHaveLength(before.sources.length);
  expect(result.witness.items).toHaveLength(before.sources.length);
  const claims = after.claims.filter(
    (c) => c.scope === 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
  );
  expect(claims).toHaveLength(1);
  expect(claims[0]).toMatchObject({
    id: root.idempotencyRecordId,
    resourceId: root.id,
    requestHash: root.requestHash,
  });
  for (const source of before.sources) {
    const item = after.items.find((i) => i.sourceDispatchItemId === source.id)!;
    expect(item.snapshot).not.toBeNull();
    expect(result.witness.items.find((i) => i.id === item.id)).toEqual(item);
    if (source.type !== 'EQUIPMENT') continue;
    const original = before.assets.find((a) => a.id === source.assetId)!;
    const asset = after.assets.find((a) => a.id === original.id)!;
    expect(asset).toMatchObject({
      physicalLocation: 'WAREHOUSE',
      activeCustodyId: null,
      physicalRevision: original.physicalRevision + 1,
      condition: original.condition,
      lifecycle: original.lifecycle,
    });
    const custody = after.custodies.find(
      (c) => c.id === source.equipmentCustodyId,
    )!;
    expect(custody).toMatchObject({
      companyId: source.companyId,
      equipmentAssetId: source.assetId,
      caseId: source.caseId,
      assignmentId: source.assignmentId,
      closedAt: root.confirmedAt,
      closedById: root.confirmedById,
    });
    const closes = after.events.filter(
      (e) => e.custodyId === custody.id && e.operation === 'CUSTODY_CLOSE',
    );
    expect(closes).toHaveLength(1);
    expect(closes[0]).toMatchObject({
      id: item.closePhysicalEventId,
      originType: 'CASE_DISPATCH_CORRECTION_ITEM',
      originId: item.id,
      originOperation: 'COMPENSATE_NO_HANDOFF_EQUIPMENT',
      actorId: root.confirmedById,
      requestHash: root.requestHash,
      createdAt: root.confirmedAt,
      revisionBefore: original.physicalRevision,
      revisionAfter: original.physicalRevision + 1,
      conditionBefore: original.condition,
      conditionAfter: original.condition,
      lifecycleBefore: original.lifecycle,
      lifecycleAfter: original.lifecycle,
    });
    expect(item).toMatchObject({
      assetId: source.assetId,
      equipmentCustodyId: source.equipmentCustodyId,
      openPhysicalEventId: source.equipmentPhysicalEventId,
    });
  }
  expect(after.events.filter((e) => e.operation !== 'CUSTODY_CLOSE')).toEqual(
    before.events,
  );
  expect(after.events.length - before.events.length).toBe(
    before.sources.filter((s) => s.type === 'EQUIPMENT').length,
  );
  expect(after.assignments).toEqual(before.assignments);
  expect(after.products).toEqual(before.products);
  expect(after.dispatch).toEqual(before.dispatch);
  expect(after.sources).toEqual(before.sources);
  expect(after.dispatchAudit).toEqual(before.dispatchAudit);
  expect(after.kits).toEqual(before.kits);
  expect(after.rr).toEqual(before.rr);
  expect(after.inspections).toEqual(before.inspections);
  expect(after.case).toEqual(before.case);
  expect(after.cutover).toEqual(before.cutover);
  for (const p of before.products) {
    const total = (s: EquipmentState) =>
      s.positions
        .filter((pos) => pos.productId === p.id)
        .reduce((n, pos) => n + pos.quantity, 0);
    expect(total(after)).toBe(total(before));
  }
  const material = before.sources.filter((s) => s.type === 'MATERIAL');
  const effects = after.effects.filter(
    (e) => e.originType === 'CASE_DISPATCH_CORRECTION',
  );
  expect(effects).toHaveLength(material.length ? 1 : 0);
  if (!material.length) expect(after.positions).toEqual(before.positions);
  expect(after.batches).toEqual(before.batches);
  if (material.length) {
    const effect = effects[0];
    expect(effect).toMatchObject({
      originId: root.id,
      actorId: root.confirmedById,
      requestHash: root.requestHash,
      occurredAt: root.confirmedAt,
      kind: 'TRANSFER',
    });
    expect(effect.lines).toHaveLength(effect.lineCount);
    expect(effect.lines.reduce((n, line) => n + line.delta, 0)).toBe(0);
    for (const s of material) {
      const item = after.items.find((i) => i.sourceDispatchItemId === s.id)!;
      expect(item).toMatchObject({
        originalPhysicalEffectId: s.physicalEffectId,
        sourceCustodyPositionId: s.destinationPositionId,
        quantity: s.quantity,
        compensatingEffectId: effect.id,
      });
      expect(
        after.positions.find((p) => p.id === s.destinationPositionId),
      ).toMatchObject({ quantity: 0 });
      const target = after.positions.find(
        (p) => p.id === item.destinationPositionId,
      )!;
      const old = before.positions.find((p) => p.id === target.id)!;
      expect(target).toMatchObject({
        state: 'AVAILABLE',
        productId: s.productId,
        inventoryBatchId: s.batchId,
        quantity: old.quantity + s.quantity!,
        revision: old.revision + 1,
      });
    }
    for (const line of effect.lines) {
      expect(
        after.positions.find((p) => p.id === line.positionId),
      ).toMatchObject({
        quantity: line.quantityAfter,
        revision: line.revisionAfter,
      });
      expect(line.quantityAfter).toBe(line.quantityBefore + line.delta);
      expect(line.revisionAfter).toBe(line.revisionBefore + 1);
    }
  }
  expect(
    after.effects.filter((e) => e.originType !== 'CASE_DISPATCH_CORRECTION'),
  ).toEqual(before.effects);
}
