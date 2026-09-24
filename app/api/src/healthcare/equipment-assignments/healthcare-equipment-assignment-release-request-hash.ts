import { createHash } from 'node:crypto';

import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';

export function createHealthcareEquipmentAssignmentReleaseRequestHash(
  assignmentId: string,
  reason: string,
): string {
  const canonicalRequest = {
    assignmentId,
    reason: normalizeHealthcareOptionalText(reason) ?? null,
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalRequest))
    .digest('hex');
}
