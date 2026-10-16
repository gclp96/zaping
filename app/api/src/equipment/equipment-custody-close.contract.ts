import { EquipmentAsset } from '@prisma/client';
import {
  equipmentPhysicalAssert,
  equipmentPhysicalHash,
  physicalId,
  physicalRevision,
  physicalText,
} from './equipment-physical.contract';

export const EQUIPMENT_CUSTODY_CLOSE_CONDITIONS = Object.freeze([
  'GOOD',
  'INSPECTION_PENDING',
  'DAMAGED',
  'OUT_OF_SERVICE',
] as const);
export type EquipmentCustodyCloseCommand = {
  companyId: string;
  assetId: string;
  custodyId: string;
  caseId: string;
  assignmentId: string;
  expectedPhysicalRevision: number;
  reportedCondition: EquipmentAsset['condition'];
  validatedContext: { adapterKey: string; contextId: string };
  actorId: string;
  durableOrigin: { type: string; id: string; operation: string };
};
export type EquipmentCustodyCloseResult = {
  outcome: 'CLOSED' | 'REPLAY';
  custodyId: string;
  physicalEventId: string;
  assetId: string;
  revisionBefore: number;
  revisionAfter: number;
  conditionBefore: EquipmentAsset['condition'];
  conditionAfter: EquipmentAsset['condition'];
  lifecycleBefore: EquipmentAsset['lifecycle'];
  lifecycleAfter: EquipmentAsset['lifecycle'];
  locationBefore: 'CUSTODY';
  locationAfter: 'WAREHOUSE';
  activeCustodyIdBefore: string;
  activeCustodyIdAfter: null;
  closedAt: Date;
  closedById: string;
};
export function validateEquipmentCustodyClose(
  c: EquipmentCustodyCloseCommand,
): void {
  equipmentPhysicalAssert(c);
  for (const id of [
    c.companyId,
    c.assetId,
    c.custodyId,
    c.caseId,
    c.assignmentId,
    c.actorId,
    c.durableOrigin?.id,
  ])
    physicalId(id);
  physicalRevision(c.expectedPhysicalRevision);
  equipmentPhysicalAssert(
    EQUIPMENT_CUSTODY_CLOSE_CONDITIONS.some(
      (value) => value === c.reportedCondition,
    ) &&
      physicalText(c.validatedContext?.adapterKey, 64) &&
      physicalText(c.validatedContext?.contextId, 128) &&
      physicalText(c.durableOrigin.type, 64) &&
      physicalText(c.durableOrigin.operation, 64),
  );
}
export function equipmentCustodyCloseHash(
  c: EquipmentCustodyCloseCommand,
): string {
  return equipmentPhysicalHash({
    version: 1,
    operation: 'CUSTODY_CLOSE',
    companyId: c.companyId,
    assetId: c.assetId,
    custodyId: c.custodyId,
    caseId: c.caseId,
    assignmentId: c.assignmentId,
    expectedPhysicalRevision: c.expectedPhysicalRevision,
    reportedCondition: c.reportedCondition,
    adapterKey: c.validatedContext.adapterKey,
    contextId: c.validatedContext.contextId,
    originType: c.durableOrigin.type,
    originId: c.durableOrigin.id,
    originOperation: c.durableOrigin.operation,
  });
}
