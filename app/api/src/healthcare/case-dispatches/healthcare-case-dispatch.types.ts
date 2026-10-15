import {
  HealthcareCaseDispatchAuditOperation,
  HealthcareCaseDispatchCustodianType,
  ProductInventoryTracking,
  ProductLotTracking,
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
}
export type DispatchAuditChange = {
  version: 1;
  operation: HealthcareCaseDispatchAuditOperation;
  reason: string | null;
};
