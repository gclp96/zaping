import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentPhysicalLocation,
  HealthcareCaseReconciliationAuditOperation as Operation,
  HealthcareCaseReconciliationEquipmentOutcome as Outcome,
} from '@prisma/client';
import {
  DispatchActor,
  DispatchItemSnapshot,
  DispatchRootSnapshot,
} from '../case-dispatches/healthcare-case-dispatch.types';
export interface ReconciliationRootSnapshot {
  version: 1;
  reconciliationId: string;
  sourceDispatch: {
    id: string;
    caseId: string;
    caseKitId: string;
    history: DispatchRootSnapshot;
  };
  confirmedBy: DispatchActor;
  confirmedAt: string;
  observation: string | null;
  episodeFacts: {
    materialItemCount: number;
    equipmentItemCount: number;
    hasPhysicalMutation: boolean;
  };
}
export interface EquipmentObservation {
  condition: EquipmentCondition;
  lifecycle: EquipmentLifecycle;
  location: EquipmentPhysicalLocation;
  revision: number;
}
export interface MaterialResult {
  type: 'MATERIAL';
  returnedQty: number;
  usedQty: number;
  unresolvedBefore: number;
  unresolvedAfter: number;
  source: { positionId: string; revision: number; quantity: number };
  returnedDestinationPositionId: string | null;
  returnedPhysicalEffectId: string | null;
  usedPhysicalEffectId: string | null;
}
export interface EquipmentResult {
  type: 'EQUIPMENT';
  custodyId: string;
  assignmentId: string;
  openPhysicalEventId: string;
  outcome: Outcome;
  reportedCondition: EquipmentCondition | null;
  before: EquipmentObservation;
  after: EquipmentObservation;
  closePhysicalEventId: string | null;
  custodyClosedAt: string | null;
}
export interface ReconciliationItemSnapshot {
  version: 1;
  sourceDispatchItemId: string;
  history: DispatchItemSnapshot;
  dispatchedQty: number | null;
  capturedAt: string;
  result: MaterialResult | EquipmentResult | null;
}
type EquipmentIntent = {
  outcome: Outcome;
  reportedCondition: EquipmentCondition | null;
};
export type ReconciliationAuditChange =
  | { version: 1; operation: 'CREATE' | 'ITEM_ADD' | 'CONFIRM' }
  | { version: 1; operation: 'CANCEL' | 'ITEM_EXCLUDE'; reason: string }
  | {
      version: 1;
      operation: 'OUTCOME_SET';
      type: 'MATERIAL';
      before: { returnedQty: number; usedQty: number };
      after: { returnedQty: number; usedQty: number };
    }
  | {
      version: 1;
      operation: 'OUTCOME_SET';
      type: 'EQUIPMENT';
      before: EquipmentIntent;
      after: EquipmentIntent;
    };
export type ReconciliationOperation = Operation;
