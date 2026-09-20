import { createHash } from 'node:crypto';

import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';
import { ReplaceHealthcareEquipmentAssignmentDto } from './dto/replace-healthcare-equipment-assignment.dto';

export function createHealthcareEquipmentAssignmentReplaceRequestHash(
  sourceAssignmentId: string,
  dto: ReplaceHealthcareEquipmentAssignmentDto,
): string {
  const canonicalRequest = {
    sourceAssignmentId,
    equipmentAssetId: dto.equipmentAssetId,
    replacementReason:
      normalizeHealthcareOptionalText(dto.replacementReason) ?? null,
    confirmConflictOverride: dto.confirmConflictOverride ?? false,
    conflictReviewFingerprint: dto.conflictReviewFingerprint ?? null,
    conflictOverrideReason:
      normalizeHealthcareOptionalText(dto.conflictOverrideReason) ?? null,
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalRequest))
    .digest('hex');
}
