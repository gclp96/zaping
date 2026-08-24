import { EquipmentCondition, EquipmentLifecycle } from '@prisma/client';

import {
  EQUIPMENT_AVAILABILITY_REASON,
  EquipmentCurrentAvailabilityEvaluation,
  EquipmentCurrentAvailabilityFacts,
  EquipmentAvailabilityReason,
} from './equipment-availability.types';

export function evaluateEquipmentCurrentAvailability(
  facts: EquipmentCurrentAvailabilityFacts,
): EquipmentCurrentAvailabilityEvaluation {
  const reasons: EquipmentAvailabilityReason[] = [];

  if (facts.lifecycle === EquipmentLifecycle.RETIRED) {
    reasons.push(EQUIPMENT_AVAILABILITY_REASON.RETIRED);
  }

  if (facts.condition === EquipmentCondition.INSPECTION_PENDING) {
    reasons.push(EQUIPMENT_AVAILABILITY_REASON.INSPECTION_PENDING);
  }

  if (facts.condition === EquipmentCondition.DAMAGED) {
    reasons.push(EQUIPMENT_AVAILABILITY_REASON.DAMAGED);
  }

  if (facts.condition === EquipmentCondition.OUT_OF_SERVICE) {
    reasons.push(EQUIPMENT_AVAILABILITY_REASON.OUT_OF_SERVICE);
  }

  return {
    available: reasons.length === 0,
    primaryReason: reasons[0] ?? null,
    reasons,
  };
}
