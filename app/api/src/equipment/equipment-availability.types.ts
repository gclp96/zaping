import { EquipmentCondition, EquipmentLifecycle } from '@prisma/client';

export const EQUIPMENT_AVAILABILITY_REASON = {
  RETIRED: 'RETIRED',
  INSPECTION_PENDING: 'INSPECTION_PENDING',
  DAMAGED: 'DAMAGED',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
} as const;

export type EquipmentAvailabilityReason =
  (typeof EQUIPMENT_AVAILABILITY_REASON)[keyof typeof EQUIPMENT_AVAILABILITY_REASON];

export type EquipmentCurrentAvailabilityFacts = {
  lifecycle: EquipmentLifecycle;
  condition: EquipmentCondition;
};

export type EquipmentCurrentAvailabilityEvaluation = {
  available: boolean;
  primaryReason: EquipmentAvailabilityReason | null;
  reasons: EquipmentAvailabilityReason[];
};
