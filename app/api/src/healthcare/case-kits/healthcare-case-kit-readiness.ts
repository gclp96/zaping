import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseKitItemLifecycle,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareRequirementLifecycle,
  HealthcareRequirementType,
  ProductInventoryTracking,
} from '@prisma/client';

import {
  HealthcareCaseKitItemRecord,
  HealthcareCaseKitRecord,
} from './healthcare-case-kits.repository';

export type HealthcareCaseKitWarningCode =
  | 'CASE_KIT_CASE_CANCELLED'
  | 'CASE_KIT_REQUIREMENT_NOT_ACTIVE'
  | 'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE'
  | 'CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED'
  | 'CASE_KIT_ASSIGNMENT_NOT_RESERVED'
  | 'CASE_KIT_EQUIPMENT_NOT_ACTIVE'
  | 'CASE_KIT_EQUIPMENT_NOT_GOOD';

export type HealthcareCaseKitReadinessBlockerCode =
  | HealthcareCaseKitWarningCode
  | 'CASE_KIT_CASE_NOT_SCHEDULED'
  | 'CASE_KIT_CASE_SCHEDULE_INCOMPLETE'
  | 'CASE_KIT_REQUIRED_QUANTITY_NOT_COVERED'
  | 'CASE_KIT_REQUIRED_ASSET_NOT_COVERED'
  | 'CASE_KIT_SERIALIZED_REQUIREMENT_UNSUPPORTED';

export type HealthcareCaseKitReadinessBlocker = {
  code: HealthcareCaseKitReadinessBlockerCode;
  requirementId?: string;
  caseKitItemId?: string;
};

export type HealthcareCaseKitPreparationReadiness = {
  status: 'PASS' | 'BLOCKED';
  blockers: HealthcareCaseKitReadinessBlocker[];
};

export function deriveHealthcareCaseKitItemWarningCodes(
  item: HealthcareCaseKitItemRecord,
  caseStatus: HealthcareCaseStatus,
): HealthcareCaseKitWarningCode[] {
  const warnings: HealthcareCaseKitWarningCode[] = [];
  if (caseStatus === HealthcareCaseStatus.CANCELLED) {
    warnings.push('CASE_KIT_CASE_CANCELLED');
  }
  if (item.requirement) {
    if (item.requirement.lifecycle !== HealthcareRequirementLifecycle.ACTIVE) {
      warnings.push('CASE_KIT_REQUIREMENT_NOT_ACTIVE');
    }
    if (!item.requirement.product.isActive) {
      warnings.push('CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE');
    }
    if ((item.preparedQuantity ?? 0) > item.requirement.requestedQty) {
      warnings.push('CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED');
    }
  }
  if (item.equipmentAssignment) {
    if (
      item.equipmentAssignment.lifecycle !==
      HealthcareEquipmentAssignmentLifecycle.RESERVED
    ) {
      warnings.push('CASE_KIT_ASSIGNMENT_NOT_RESERVED');
    }
    if (
      item.equipmentAssignment.equipmentAsset.lifecycle !==
      EquipmentLifecycle.ACTIVE
    ) {
      warnings.push('CASE_KIT_EQUIPMENT_NOT_ACTIVE');
    }
    if (
      item.equipmentAssignment.equipmentAsset.condition !==
      EquipmentCondition.GOOD
    ) {
      warnings.push('CASE_KIT_EQUIPMENT_NOT_GOOD');
    }
  }
  return warnings;
}

export function evaluateHealthcareCaseKitReadiness(
  kit: HealthcareCaseKitRecord,
): HealthcareCaseKitPreparationReadiness {
  const blockers: HealthcareCaseKitReadinessBlocker[] = [];
  const seen = new Set<string>();
  const add = (blocker: HealthcareCaseKitReadinessBlocker) => {
    const key = `${blocker.code}:${blocker.requirementId ?? ''}:${blocker.caseKitItemId ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      blockers.push(blocker);
    }
  };

  const healthcareCase = kit.healthcareCase;
  if (healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
    add({ code: 'CASE_KIT_CASE_CANCELLED' });
  } else if (healthcareCase.status !== HealthcareCaseStatus.SCHEDULED) {
    add({ code: 'CASE_KIT_CASE_NOT_SCHEDULED' });
  } else if (!healthcareCase.scheduledStart || !healthcareCase.scheduledEnd) {
    add({ code: 'CASE_KIT_CASE_SCHEDULE_INCOMPLETE' });
  }

  const activeItems = kit.items.filter(
    (item) => item.lifecycle === HealthcareCaseKitItemLifecycle.ACTIVE,
  );
  for (const item of activeItems) {
    for (const code of deriveHealthcareCaseKitItemWarningCodes(
      item,
      healthcareCase.status,
    )) {
      if (code === 'CASE_KIT_CASE_CANCELLED') continue;
      add({
        code,
        requirementId:
          item.requirementId ??
          item.equipmentAssignment?.requirementId ??
          undefined,
        caseKitItemId: item.id,
      });
    }
  }

  const requiredRequirements = healthcareCase.requirements.filter(
    (requirement) =>
      requirement.lifecycle === HealthcareRequirementLifecycle.ACTIVE &&
      requirement.type === HealthcareRequirementType.REQUIRED,
  );

  for (const requirement of requiredRequirements) {
    switch (requirement.product.inventoryTracking) {
      case ProductInventoryTracking.QUANTITY: {
        const covered = activeItems.some(
          (item) =>
            item.requirementId === requirement.id &&
            item.preparedQuantity === requirement.requestedQty &&
            deriveHealthcareCaseKitItemWarningCodes(
              item,
              healthcareCase.status,
            ).filter((code) => code !== 'CASE_KIT_CASE_CANCELLED').length === 0,
        );
        if (!covered) {
          add({
            code: 'CASE_KIT_REQUIRED_QUANTITY_NOT_COVERED',
            requirementId: requirement.id,
          });
        }
        break;
      }
      case ProductInventoryTracking.ASSET: {
        const coveredCount = activeItems.filter((item) => {
          const assignment = item.equipmentAssignment;
          return (
            assignment?.origin ===
              HealthcareEquipmentAssignmentOrigin.REQUIREMENT &&
            assignment.requirementId === requirement.id &&
            deriveHealthcareCaseKitItemWarningCodes(
              item,
              healthcareCase.status,
            ).filter((code) => code !== 'CASE_KIT_CASE_CANCELLED').length === 0
          );
        }).length;
        if (coveredCount < requirement.requestedQty) {
          add({
            code: 'CASE_KIT_REQUIRED_ASSET_NOT_COVERED',
            requirementId: requirement.id,
          });
        }
        break;
      }
      case ProductInventoryTracking.SERIALIZED:
        add({
          code: 'CASE_KIT_SERIALIZED_REQUIREMENT_UNSUPPORTED',
          requirementId: requirement.id,
        });
        break;
    }
  }

  return {
    status: blockers.length === 0 ? 'PASS' : 'BLOCKED',
    blockers,
  };
}
