import { createHash } from 'node:crypto';

import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';
import { CreateHealthcareEquipmentAssignmentDto } from './dto/create-healthcare-equipment-assignment.dto';

export function createHealthcareEquipmentAssignmentRequestHash(
  dto: CreateHealthcareEquipmentAssignmentDto,
): string {
  const canonicalRequest = {
    caseId: dto.caseId,
    equipmentAssetId: dto.equipmentAssetId,
    requirementId: dto.requirementId ?? null,
    directAssignmentReason:
      normalizeHealthcareOptionalText(dto.directAssignmentReason) ?? null,
    confirmConflictOverride: dto.confirmConflictOverride ?? false,
    conflictReviewFingerprint: dto.conflictReviewFingerprint ?? null,
    conflictOverrideReason:
      normalizeHealthcareOptionalText(dto.conflictOverrideReason) ?? null,
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalRequest))
    .digest('hex');
}
