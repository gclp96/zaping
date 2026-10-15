import {
  HealthcareCaseDispatchAuditOperation,
  HealthcareCaseDispatchCustodianType,
  ProductInventoryTracking,
  ProductLotTracking,
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentPhysicalLocation,
} from '@prisma/client';
export interface DispatchActor {
  id: string;
  firstName: string;
  lastName: string;
}
export interface DispatchCustodian {
  type: HealthcareCaseDispatchCustodianType;
  userId: string | null;
  displayName: string;
}
export interface DispatchCaseFacts {
  id: string;
  folio: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}
export interface DispatchRootSnapshot {
  version: 1;
  case: DispatchCaseFacts;
  custodian: DispatchCustodian;
  dispatchedBy: DispatchActor;
  dispatchedAt: string;
}
export interface DispatchItemSnapshot {
  version: 1;
  product: {
    id: string;
    sku: string;
    name: string;
    inventoryTracking: ProductInventoryTracking;
    lotTracking: ProductLotTracking;
  };
  preparation: {
    sourceCaseKitItemId: string;
    requirementId: string | null;
    assignmentId: string | null;
    preparedQuantity: number | null;
  };
  batch: {
    id: string;
    lotNumber: string;
    expirationDate: string | null;
  } | null;
  equipment: {
    id: string;
    assetCode: string;
    serialNumber: string | null;
  } | null;
  // Optional only for pre-productive v1 scaffold history. Confirm always authors
  // both fields; historical reads never fill absent facts from live relations.
  capturedAt?: string;
  handoff?: DispatchItemHandoff | null;
}
export interface DispatchItemHandoff {
  quantity: number | null;
  sourcePositionId: string | null;
  sourceRevision: number | null;
  destinationPositionId: string | null;
  physicalEffectId: string | null;
  assignmentId: string | null;
  assetId: string | null;
  physicalRevisionBefore: number | null;
  physicalRevisionAfter: number | null;
  equipmentCustodyId: string | null;
  equipmentPhysicalEventId: string | null;
  conditionBefore: EquipmentCondition | null;
  lifecycleBefore: EquipmentLifecycle | null;
  locationBefore: EquipmentPhysicalLocation | null;
}
export type DispatchAuditChange = {
  version: 1;
  operation: HealthcareCaseDispatchAuditOperation;
  reason: string | null;
};
