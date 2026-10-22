import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { materialOrigin } from './dispatch-correction-material-contract-fixture';
import { correctionFixtureFactory } from './dispatch-correction-fixture';
import { HealthcareCaseDispatchCorrectionCommandRepository } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.repository';
import { HealthcareCaseDispatchCorrectionCommandService } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.service';
import { PhysicalInventoryService } from '../../src/inventory/physical/physical-inventory.service';
import { PhysicalInventoryRepository } from '../../src/inventory/physical/physical-inventory.repository';
import { InventoryCompatibilityProjectionService } from '../../src/inventory/physical/inventory-compatibility-projection.service';
import { InventoryAuthorityResolver } from '../../src/inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../../src/inventory/physical/inventory-runtime-compatibility.service';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { HealthcareCaseReconciliationCommandRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.repository';
import { HealthcareCaseReconciliationCommandService } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.service';
import { HealthcareCaseReconciliationsRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationConfirmRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-confirm.repository';
import { HealthcareCaseReconciliationConfirmService } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-confirm.service';
import { EquipmentCustodyCloseService } from '../../src/equipment/equipment-custody-close.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// Builders only are reused from A/01B. Database authorization is exclusively B.
export async function orchestrationOrigin(
  db: PrismaClient,
  kind:
    'simple' | 'grouped' | 'batch' | 'mixed' | 'equipment' | 'draft' = 'simple',
) {
  const factory = correctionFixtureFactory(db);
  const o =
    kind === 'equipment'
      ? await factory.origin(true)
      : kind === 'draft'
        ? await (async () => {
            const f = await factory.fixture();
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
            const i = await db.healthcareCaseDispatchItem.create({
              data: factory.itemData(f, d.id),
            });
            return { f, d, source: i };
          })()
        : await materialOrigin(
            db,
            kind === 'grouped' || kind === 'mixed',
            kind === 'mixed',
            kind === 'batch',
          );
  await db.company.update({
    where: { id: o.f.companyId },
    data: { name: 'HC-DSP-COR-01C-B QA' },
  });
  if (kind === 'equipment' || kind === 'draft') {
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
        baselineBuild: '01c-b-fixture',
        manifestLockedAt: new Date(),
      },
    });
  }
  return o;
}
export type OrchestrationOrigin = Awaited<
  ReturnType<typeof orchestrationOrigin>
>;
export const commandContext = (o: OrchestrationOrigin) => ({
  companyId: o.f.companyId,
  caseId: o.f.c.id,
  dispatchId: o.d.id,
  requesterId: o.f.user.id,
  idempotencyKey: randomUUID() as string,
});
export const commandIntent = () => ({
  attestedNoHandoff: true as const,
  reason: 'Sin entrega física 🚑',
});

export function orchestrationHarness(db: PrismaClient) {
  const repo = new HealthcareCaseDispatchCorrectionCommandRepository(db);
  const physical = new PhysicalInventoryService(
    new PhysicalInventoryRepository(),
  );
  const projections = new InventoryCompatibilityProjectionService();
  const policy = healthcareCompanyTransactionTimeoutConfiguration();
  const authority = new InventoryAuthorityResolver(),
    runtime = new InventoryRuntimeCompatibilityService();
  return {
    repo,
    physical,
    projections,
    policy,
    service: new HealthcareCaseDispatchCorrectionCommandService(
      repo,
      policy,
      physical,
      projections,
      authority,
      runtime,
    ),
  };
}

// Full state equality is used for rollback/replay, not merely row counts.
export async function orchestrationState(db: PrismaClient, companyId: string) {
  const where = { companyId },
    orderBy = { id: 'asc' as const };
  return {
    claims: await db.idempotencyRecord.findMany({ where, orderBy }),
    roots: await db.healthcareCaseDispatchCorrection.findMany({
      where,
      orderBy,
    }),
    items: await db.healthcareCaseDispatchCorrectionItem.findMany({
      where,
      orderBy,
    }),
    effects: await db.inventoryPhysicalEffect.findMany({
      where,
      orderBy,
      include: { lines: { orderBy: { sequence: 'asc' } } },
    }),
    positions: await db.inventoryPosition.findMany({ where, orderBy }),
    products: await db.product.findMany({ where, orderBy }),
    batches: await db.inventoryBatch.findMany({ where, orderBy }),
    dispatch: await db.healthcareCaseDispatch.findMany({ where, orderBy }),
    sources: await db.healthcareCaseDispatchItem.findMany({ where, orderBy }),
    dispatchAudit: await db.healthcareCaseDispatchAudit.findMany({
      where,
      orderBy,
    }),
    kits: await db.healthcareCaseKit.findMany({ where, orderBy }),
    rr: await db.healthcareCaseReconciliation.findMany({
      where,
      orderBy,
      include: { items: { orderBy }, audit: { orderBy } },
    }),
    assets: await db.equipmentAsset.findMany({ where, orderBy }),
    events: await db.equipmentAssetPhysicalEvent.findMany({ where, orderBy }),
  };
}

export async function reconciliationEpisode(
  db: PrismaClient,
  o: OrchestrationOrigin,
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED',
) {
  const h = orchestrationHarness(db),
    reads = new HealthcareCaseReconciliationsRepository(db as PrismaService);
  const repo = new HealthcareCaseReconciliationCommandRepository(
    db as PrismaService,
    reads,
  );
  const commands = new HealthcareCaseReconciliationCommandService(
    repo,
    h.policy,
  );
  const c = {
    companyId: o.f.companyId,
    caseId: o.f.c.id,
    actorId: o.f.user.id,
    key: randomUUID() as string,
  };
  let result = await commands.execute(c, {
    operation: 'CREATE',
    dto: { dispatchId: o.d.id, observation: 'QA sin movimiento' },
  });
  const context = {
    ...c,
    reconciliationId: result.command.reconciliationId,
    key: randomUUID(),
  };
  result = await commands.execute(context, {
    operation: 'ITEM_ADD',
    dto: { expectedRevision: 0, sourceDispatchItemId: o.source.id },
  });
  if (status === 'CANCELLED')
    result = await commands.execute(
      { ...context, key: randomUUID() },
      {
        operation: 'CANCEL',
        dto: {
          expectedRevision: result.command.revisionAfter,
          reason: 'QA cancellation',
        },
      },
    );
  if (status === 'CONFIRMED') {
    // This fixture is MATERIAL-only. Any Equipment close is a fixture failure.
    const close = {
      returnFromCustody: () =>
        Promise.reject(new Error('Unexpected Equipment call')),
    } as unknown as EquipmentCustodyCloseService;
    const confirm = new HealthcareCaseReconciliationConfirmService(
      new HealthcareCaseReconciliationConfirmRepository(
        repo,
        new PhysicalInventoryRepository(),
      ),
      h.physical,
      h.projections,
      close,
      new InventoryAuthorityResolver(),
      new InventoryRuntimeCompatibilityService(),
      h.policy,
    );
    result = await confirm.execute(
      { ...context, key: randomUUID() },
      { expectedRevision: result.command.revisionAfter },
    );
  }
  return result;
}

export function twoPartyBarrier() {
  let count = 0,
    release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    if (++count === 2) release();
    await ready;
  };
}
