import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EquipmentCustodyCloseContextAdapter } from '../../equipment/equipment-custody-close-context.registry';
import {
  EquipmentCustodyCloseCommand,
  equipmentCustodyCloseHash,
} from '../../equipment/equipment-custody-close.contract';
import { equipmentPhysicalAssert } from '../../equipment/equipment-physical.contract';
import { HealthcareCaseReconciliationEquipmentEvidenceRepository } from './healthcare-case-reconciliation-equipment-evidence.repository';
import { createReconciliationConfirmRequestHash } from './healthcare-case-reconciliation-request-hash';
import {
  parseReconciliationAuditChange,
  parseReconciliationItemSnapshot,
  parseReconciliationRootSnapshot,
} from './healthcare-case-reconciliation.snapshot';
@Injectable()
export class HealthcareCaseReconciliationEquipmentContextAdapter implements EquipmentCustodyCloseContextAdapter {
  readonly key = 'CASE_RECONCILIATION_ITEM';
  readonly originType = 'CASE_RECONCILIATION_ITEM';
  readonly originOperation = 'CONFIRM_EQUIPMENT_RETURN';
  constructor(
    private readonly evidence: HealthcareCaseReconciliationEquipmentEvidenceRepository,
  ) {}
  async validate(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCloseCommand,
    hash: string,
    mode: 'APPLY' | 'REPLAY',
  ) {
    equipmentPhysicalAssert(
      c.validatedContext.adapterKey === this.key &&
        c.validatedContext.contextId === c.durableOrigin.id &&
        c.durableOrigin.type === this.originType &&
        c.durableOrigin.operation === this.originOperation &&
        equipmentCustodyCloseHash(c) === hash,
      'RESOURCE_STATE_CHANGED',
    );
    const item = await this.evidence.item(
      tx,
      c.companyId,
      c.validatedContext.contextId,
    );
    equipmentPhysicalAssert(
      item &&
        item.companyId === c.companyId &&
        item.caseId === c.caseId &&
        item.lifecycle === 'ACTIVE' &&
        item.type === 'EQUIPMENT' &&
        item.outcome === 'RETURNED' &&
        item.assetId === c.assetId &&
        item.equipmentCustodyId === c.custodyId &&
        item.assignmentId === c.assignmentId &&
        item.expectedPhysicalRevision === c.expectedPhysicalRevision &&
        item.reportedCondition === c.reportedCondition,
      'RESOURCE_STATE_CHANGED',
    );
    const root = item.reconciliation,
      source = item.sourceDispatchItem,
      custody = item.equipmentCustody,
      assignment = item.assignment;
    equipmentPhysicalAssert(
      root.companyId === c.companyId &&
        root.caseId === c.caseId &&
        root.dispatchId === source.dispatchId &&
        root.caseKitId === source.dispatch.caseKitId &&
        source.companyId === c.companyId &&
        source.caseId === c.caseId &&
        source.dispatch.companyId === c.companyId &&
        source.dispatch.caseId === c.caseId &&
        source.dispatch.status === 'CONFIRMED' &&
        source.lifecycle === 'ACTIVE' &&
        source.type === 'EQUIPMENT' &&
        source.assetId === c.assetId &&
        source.equipmentCustodyId === c.custodyId &&
        source.assignmentId === c.assignmentId &&
        custody &&
        custody.companyId === c.companyId &&
        custody.equipmentAssetId === c.assetId &&
        custody.caseId === c.caseId &&
        custody.assignmentId === c.assignmentId &&
        assignment &&
        assignment.companyId === c.companyId &&
        assignment.caseId === c.caseId &&
        assignment.equipmentAssetId === c.assetId,
      'RESOURCE_STATE_CHANGED',
    );
    const committed = root.status === 'CONFIRMED';
    equipmentPhysicalAssert(
      mode === 'APPLY' ? root.status === 'DRAFT' : committed,
      'RESOURCE_STATE_CHANGED',
    );
    const revision = committed ? root.confirmedFromRevision : root.revision;
    equipmentPhysicalAssert(revision !== null, 'RESOURCE_STATE_CHANGED');
    const audit = await this.evidence.audit(tx, c.companyId, root.id, revision);
    const claim = await this.evidence.claim(
      tx,
      c.companyId,
      createReconciliationConfirmRequestHash(
        { companyId: c.companyId, caseId: c.caseId, reconciliationId: root.id },
        revision,
      ),
      committed ? root.id : null,
    );
    equipmentPhysicalAssert(audit && claim, 'RESOURCE_STATE_CHANGED');
    parseReconciliationAuditChange(audit.change, 'CONFIRM');
    equipmentPhysicalAssert(
      await this.evidence.actor(tx, c.companyId, c.actorId),
      'EQUIPMENT_PHYSICAL_ACTOR_INVALID',
    );
    if (mode === 'APPLY')
      equipmentPhysicalAssert(
        audit.actorId === c.actorId &&
          custody.closedAt === null &&
          custody.closedById === null &&
          item.closePhysicalEventId === null,
        'RESOURCE_STATE_CHANGED',
      );
    else {
      const snapshot = parseReconciliationRootSnapshot(root.snapshot),
        result = parseReconciliationItemSnapshot(item.snapshot).result,
        event = item.closePhysicalEvent;
      equipmentPhysicalAssert(
        root.revision === revision + 1 &&
          root.confirmedById === audit.actorId &&
          audit.createdAt.getTime() === root.confirmedAt?.getTime() &&
          snapshot.confirmedBy.id === audit.actorId &&
          Date.parse(snapshot.confirmedAt) === audit.createdAt.getTime() &&
          event &&
          event.actorId === audit.actorId &&
          event.requestHash === hash &&
          event.originType === this.originType &&
          event.originId === item.id &&
          event.originOperation === this.originOperation &&
          result?.type === 'EQUIPMENT' &&
          result.closePhysicalEventId === event.id &&
          result.custodyId === c.custodyId,
        'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
      );
    }
    return {
      companyId: c.companyId,
      assetId: c.assetId,
      custodyId: c.custodyId,
      caseId: c.caseId,
      assignmentId: c.assignmentId,
      actorId: c.actorId,
      contextId: item.id,
      originType: this.originType,
      originId: item.id,
      originOperation: this.originOperation,
      requestHash: hash,
    };
  }
}
