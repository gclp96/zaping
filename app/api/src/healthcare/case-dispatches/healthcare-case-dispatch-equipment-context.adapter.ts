import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  EquipmentCustodyCommand,
  EquipmentCustodyContextAdapter,
} from '../../equipment/equipment-custody-context.registry';
import {
  equipmentPhysicalAssert,
  equipmentPhysicalHash,
} from '../../equipment/equipment-physical.contract';
import { HealthcareCaseDispatchEquipmentEvidenceRepository } from './healthcare-case-dispatch-equipment-evidence.repository';
import { createDispatchConfirmRequestHash } from './healthcare-case-dispatch-request-hash';

@Injectable()
export class HealthcareCaseDispatchEquipmentContextAdapter implements EquipmentCustodyContextAdapter {
  readonly key = 'CASE_DISPATCH_ITEM';
  readonly originType = 'CASE_DISPATCH_ITEM';
  readonly originOperation = 'CONFIRM_EQUIPMENT';
  constructor(
    private readonly evidence: HealthcareCaseDispatchEquipmentEvidenceRepository,
  ) {}
  async validate(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCommand,
    hash: string,
    mode: 'APPLY' | 'REPLAY',
  ) {
    equipmentPhysicalAssert(
      c.validatedContext.adapterKey === this.key &&
        c.durableOrigin.type === this.originType &&
        c.durableOrigin.operation === this.originOperation &&
        c.durableOrigin.id === c.validatedContext.contextId,
      'RESOURCE_STATE_CHANGED',
    );
    const item = await this.evidence.item(
      tx,
      c.companyId,
      c.validatedContext.contextId,
    );
    equipmentPhysicalAssert(
      item &&
        item.lifecycle === 'ACTIVE' &&
        item.type === 'EQUIPMENT' &&
        item.caseId === c.caseId &&
        item.assignmentId === c.assignmentId &&
        item.assetId === c.assetId &&
        item.expectedPhysicalRevision === c.expectedPhysicalRevision,
      'RESOURCE_STATE_CHANGED',
    );
    const root = item.dispatch,
      source = item.sourceCaseKitItem;
    const committed = root.status === 'CONFIRMED';
    equipmentPhysicalAssert(
      root.companyId === c.companyId &&
        root.caseId === c.caseId &&
        (root.status === 'DRAFT' || (mode === 'REPLAY' && committed)),
      'RESOURCE_STATE_CHANGED',
    );
    const revision = committed ? root.confirmedFromRevision : root.revision;
    equipmentPhysicalAssert(revision !== null, 'RESOURCE_STATE_CHANGED');
    const audit = await this.evidence.audit(tx, c.companyId, root.id, revision);
    const requestHash = createDispatchConfirmRequestHash(
      { ...c, dispatchId: root.id, key: '' },
      revision,
    );
    const claim = await this.evidence.claim(
      tx,
      c.companyId,
      requestHash,
      committed ? root.id : null,
    );
    equipmentPhysicalAssert(
      audit &&
        audit.actorId === c.actorId &&
        claim &&
        source.companyId === c.companyId &&
        source.caseId === c.caseId &&
        source.caseKitId === root.caseKitId &&
        source.caseKit.status === 'PREPARED' &&
        source.lifecycle === 'ACTIVE' &&
        source.equipmentAssignmentId === c.assignmentId &&
        source.requirementId === null &&
        item.assignment?.equipmentAssetId === c.assetId &&
        item.assignment.caseId === c.caseId &&
        (mode === 'REPLAY' || item.assignment.lifecycle === 'RESERVED') &&
        (!committed ||
          (root.confirmedById === c.actorId &&
            root.revision === revision + 1 &&
            item.equipmentCustodyId &&
            item.equipmentPhysicalEventId)),
      'RESOURCE_STATE_CHANGED',
    );
    equipmentPhysicalAssert(
      await this.evidence.actor(tx, c.companyId, c.actorId),
      'EQUIPMENT_PHYSICAL_ACTOR_INVALID',
    );
    const expected = equipmentPhysicalHash({
      version: 1,
      companyId: c.companyId,
      assetId: c.assetId,
      caseId: c.caseId,
      assignmentId: c.assignmentId,
      expectedPhysicalRevision: c.expectedPhysicalRevision,
      adapterKey: this.key,
      contextId: item.id,
      originType: this.originType,
      originId: item.id,
      originOperation: this.originOperation,
    });
    equipmentPhysicalAssert(hash === expected, 'RESOURCE_STATE_CHANGED');
    return {
      companyId: c.companyId,
      assetId: c.assetId,
      caseId: c.caseId,
      assignmentId: c.assignmentId,
      contextId: item.id,
      originId: item.id,
      requestHash: hash,
    };
  }
}
