import { createHash } from 'node:crypto';

import {
  AddHealthcareCaseKitItemDto,
  HealthcareCaseKitItemSourceType,
} from './dto/add-healthcare-case-kit-item.dto';

function hash(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createHealthcareCaseKitRequestHash(caseId: string): string {
  return hash({
    version: 1,
    command: 'HEALTHCARE_CASE_KIT_CREATE',
    caseId,
  });
}

export function createHealthcareCaseKitItemRequestHash(
  caseKitId: string,
  dto: AddHealthcareCaseKitItemDto,
): string {
  return hash({
    version: 1,
    command: 'HEALTHCARE_CASE_KIT_ITEM_ADD',
    caseKitId,
    sourceType: dto.sourceType,
    requirementId:
      dto.sourceType === HealthcareCaseKitItemSourceType.REQUIREMENT
        ? dto.requirementId
        : null,
    equipmentAssignmentId:
      dto.sourceType === HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT
        ? dto.equipmentAssignmentId
        : null,
    preparedQuantity:
      dto.sourceType === HealthcareCaseKitItemSourceType.REQUIREMENT
        ? dto.preparedQuantity
        : null,
  });
}

export function createHealthcareCaseKitItemExclusionRequestHash(
  caseKitId: string,
  itemId: string,
  reason: string,
): string {
  return hash({
    version: 1,
    command: 'HEALTHCARE_CASE_KIT_ITEM_EXCLUDE',
    caseKitId,
    itemId,
    reason,
  });
}
