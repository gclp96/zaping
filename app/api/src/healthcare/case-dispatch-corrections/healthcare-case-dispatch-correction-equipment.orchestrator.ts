import { HealthcareCaseDispatchCorrection, Prisma } from '@prisma/client';
import { EquipmentCustodyCloseService } from '../../equipment/equipment-custody-close.service';
import { EquipmentCustodyCloseContextRegistry } from '../../equipment/equipment-custody-close-context.registry';
import { EquipmentPhysicalRepository } from '../../equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../../equipment/equipment-physical-history.service';
import { EquipmentCustodyCloseCommand } from '../../equipment/equipment-custody-close.contract';
import { HealthcareCaseDispatchCorrectionEquipmentAdapter } from './healthcare-case-dispatch-correction-equipment.adapter';
import {
  MaterialCorrectionContext,
  DispatchCorrectionWitness,
  assertMaterialCommand as prove,
} from './healthcare-case-dispatch-correction-command.contract';
import type { MaterialCorrectionSource } from './healthcare-case-dispatch-correction-command.repository';

// Optional internal composition for 01D. No Nest registration or public caller.
export class HealthcareCaseDispatchCorrectionEquipmentOrchestrator {
  private readonly adapter =
    new HealthcareCaseDispatchCorrectionEquipmentAdapter();
  private readonly close: EquipmentCustodyCloseService;
  constructor() {
    const repository = new EquipmentPhysicalRepository();
    this.close = new EquipmentCustodyCloseService(
      repository,
      new EquipmentPhysicalHistoryService(repository),
      new EquipmentCustodyCloseContextRegistry([this.adapter]),
    );
  }
  async hasMaterial(
    tx: Prisma.TransactionClient,
    c: MaterialCorrectionContext,
  ) {
    const source = await tx.healthcareCaseDispatch.findFirst({
      where: { id: c.dispatchId, companyId: c.companyId, caseId: c.caseId },
      include: { items: { where: { lifecycle: 'ACTIVE' } } },
    });
    prove(source, 'CORRECTION_DISPATCH_NOT_FOUND');
    return source.items.some((i) => i.type === 'MATERIAL');
  }
  async lockAssignments(
    tx: Prisma.TransactionClient,
    c: MaterialCorrectionContext,
    source: MaterialCorrectionSource,
  ) {
    const equipment = source.items.filter((i) => i.type === 'EQUIPMENT');
    prove(
      new Set(equipment.map((i) => i.assetId)).size === equipment.length &&
        equipment.every(
          (i) =>
            i.assetId &&
            i.assignmentId &&
            i.equipmentCustodyId &&
            i.equipmentPhysicalEventId,
        ),
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    if (equipment.length)
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "HealthcareEquipmentAssignment" WHERE "companyId"=${c.companyId} AND id IN (${Prisma.join([...new Set(equipment.map((i) => i.assignmentId!))].sort())}) ORDER BY id FOR SHARE`,
      );
  }
  private async command(
    tx: Prisma.TransactionClient,
    c: MaterialCorrectionContext,
    item: {
      id: string;
      assetId: string | null;
      equipmentCustodyId: string | null;
      openPhysicalEventId: string | null;
    },
    source: MaterialCorrectionSource['items'][number],
  ): Promise<EquipmentCustodyCloseCommand> {
    const open = await tx.equipmentAssetPhysicalEvent.findFirst({
      where: { id: item.openPhysicalEventId ?? '', companyId: c.companyId },
    });
    prove(
      open && item.assetId && item.equipmentCustodyId && source.assignmentId,
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    return {
      companyId: c.companyId,
      caseId: c.caseId,
      assetId: item.assetId,
      custodyId: item.equipmentCustodyId,
      assignmentId: source.assignmentId,
      actorId: c.requesterId,
      expectedPhysicalRevision: open.revisionAfter,
      reportedCondition: open.conditionAfter,
      validatedContext: { adapterKey: this.adapter.key, contextId: item.id },
      durableOrigin: {
        type: this.adapter.originType,
        id: item.id,
        operation: this.adapter.originOperation,
      },
    };
  }
  async compensate(
    tx: Prisma.TransactionClient,
    c: MaterialCorrectionContext,
    root: HealthcareCaseDispatchCorrection,
    source: MaterialCorrectionSource,
  ) {
    const equipment = source.items.filter((i) => i.type === 'EQUIPMENT');
    if (!equipment.length) return;
    // Match RR's physical prefix: MATERIAL Product/Batch/Positions first (caller),
    // then ALL Assets in id order, then ALL Custodies before invoking the primitive.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "EquipmentAsset" WHERE "companyId"=${c.companyId} AND id IN (${Prisma.join(equipment.map((i) => i.assetId!).sort())}) ORDER BY id FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "EquipmentAssetCustody" WHERE "companyId"=${c.companyId} AND id IN (${Prisma.join(equipment.map((i) => i.equipmentCustodyId!).sort())}) ORDER BY id FOR UPDATE`,
    );
    for (const s of [...equipment].sort((a, b) =>
      a.assetId!.localeCompare(b.assetId!),
    )) {
      const item = await tx.healthcareCaseDispatchCorrectionItem.create({
        data: {
          companyId: c.companyId,
          correctionId: root.id,
          dispatchId: c.dispatchId,
          sourceDispatchItemId: s.id,
          type: 'EQUIPMENT',
          assetId: s.assetId,
          equipmentCustodyId: s.equipmentCustodyId,
          openPhysicalEventId: s.equipmentPhysicalEventId,
        },
      });
      const command = await this.command(tx, c, item, s);
      const result = await this.close.returnFromCustody(tx, command);
      prove(
        result.outcome === 'CLOSED' &&
          result.assetId === s.assetId &&
          result.custodyId === s.equipmentCustodyId &&
          result.closedAt.getTime() === root.confirmedAt.getTime() &&
          result.closedById === root.confirmedById &&
          result.conditionBefore === result.conditionAfter &&
          result.lifecycleBefore === result.lifecycleAfter &&
          result.revisionAfter === result.revisionBefore + 1,
        'CORRECTION_EVIDENCE_INCONSISTENT',
      );
      await tx.healthcareCaseDispatchCorrectionItem.update({
        where: { id: item.id },
        data: { closePhysicalEventId: result.physicalEventId },
      });
      const count =
        await tx.$executeRaw`UPDATE "HealthcareCaseDispatchCorrectionItem" SET snapshot=public.dispatch_correction_item_snapshot(id) WHERE id=${item.id} AND "companyId"=${c.companyId}`;
      prove(count === 1, 'CORRECTION_EVIDENCE_INCONSISTENT');
    }
  }
  async replay(
    tx: Prisma.TransactionClient,
    c: MaterialCorrectionContext,
    witness: DispatchCorrectionWitness,
  ) {
    const source = await tx.healthcareCaseDispatch.findFirst({
      where: { id: c.dispatchId, companyId: c.companyId, caseId: c.caseId },
      include: { items: { where: { lifecycle: 'ACTIVE' } } },
    });
    prove(
      source &&
        source.items.length > 0 &&
        source.items.length === witness.items.length &&
        new Set(witness.items.map((i) => i.sourceDispatchItemId)).size ===
          source.items.length,
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    for (const s of source.items) {
      const item = witness.items.find((i) => i.sourceDispatchItemId === s.id);
      prove(
        item && item.type === s.type && item.snapshot !== null,
        'CORRECTION_EVIDENCE_INCONSISTENT',
      );
      if (s.type === 'EQUIPMENT')
        await this.adapter.dispatchCorrectionMetadata(
          tx,
          await this.command(tx, c, item, s),
          'REPLAY',
        );
    }
    return source.items.some((i) => i.type === 'MATERIAL');
  }
}
