import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  EquipmentOrigin,
  equipmentHarness,
} from './dispatch-correction-equipment-fixture';
import { PrismaService } from '../../src/prisma/prisma.service';
import { HealthcareCaseReconciliationCommandRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.repository';
import { HealthcareCaseReconciliationCommandService } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-command.service';
import { HealthcareCaseReconciliationsRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationConfirmRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-confirm.repository';
import { HealthcareCaseReconciliationConfirmService } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-confirm.service';
import { HealthcareCaseReconciliationEquipmentContextAdapter } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-equipment-context.adapter';
import { HealthcareCaseReconciliationEquipmentEvidenceRepository } from '../../src/healthcare/case-reconciliations/healthcare-case-reconciliation-equipment-evidence.repository';
import { EquipmentCustodyCloseService } from '../../src/equipment/equipment-custody-close.service';
import { EquipmentCustodyCloseContextRegistry } from '../../src/equipment/equipment-custody-close-context.registry';
import { EquipmentPhysicalRepository } from '../../src/equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../../src/equipment/equipment-physical-history.service';
import { PhysicalInventoryRepository } from '../../src/inventory/physical/physical-inventory.repository';
import { InventoryAuthorityResolver } from '../../src/inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../../src/inventory/physical/inventory-runtime-compatibility.service';

// Real RR commands and registered durable RR adapter, no substitute close writer.
export async function equipmentReconciliation(
  db: PrismaClient,
  o: EquipmentOrigin,
) {
  const h = equipmentHarness(db),
    prisma = db as PrismaService;
  const repo = new HealthcareCaseReconciliationCommandRepository(
    prisma,
    new HealthcareCaseReconciliationsRepository(prisma),
  );
  const service = new HealthcareCaseReconciliationCommandService(
    repo,
    h.policy,
  );
  const c = {
    companyId: o.f.companyId,
    caseId: o.f.c.id,
    actorId: o.f.user.id,
    key: randomUUID() as string,
  };
  const created = await service.execute(c, {
    operation: 'CREATE',
    dto: { dispatchId: o.d.id, observation: '01D actual RR fixture' },
  });
  const context = { ...c, reconciliationId: created.command.reconciliationId };
  let revision = created.command.revisionAfter;
  for (const source of o.items) {
    const added = await service.execute(
      { ...context, key: randomUUID() },
      {
        operation: 'ITEM_ADD',
        dto: { expectedRevision: revision, sourceDispatchItemId: source.id },
      },
    );
    revision = added.command.revisionAfter;
    if (source.type === 'EQUIPMENT') {
      const set = await service.execute(
        { ...context, itemId: added.command.itemId!, key: randomUUID() },
        {
          operation: 'OUTCOME_SET',
          dto: {
            expectedRevision: revision,
            type: 'EQUIPMENT',
            outcome: 'RETURNED',
            reportedCondition: 'GOOD',
          },
        },
      );
      revision = set.command.revisionAfter;
    }
  }
  const physical = new EquipmentPhysicalRepository();
  const close = new EquipmentCustodyCloseService(
    physical,
    new EquipmentPhysicalHistoryService(physical),
    new EquipmentCustodyCloseContextRegistry([
      new HealthcareCaseReconciliationEquipmentContextAdapter(
        new HealthcareCaseReconciliationEquipmentEvidenceRepository(),
      ),
    ]),
  );
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
  const confirmContext = { ...context, key: randomUUID() };
  return {
    confirm: () =>
      confirm.execute(confirmContext, { expectedRevision: revision }),
    cancel: () =>
      service.execute(
        { ...context, key: randomUUID() },
        {
          operation: 'CANCEL',
          dto: {
            expectedRevision: revision,
            reason: '01D explicit cancellation',
          },
        },
      ),
    context,
  };
}
