import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';

export const DISPATCH_CORRECTION_SCOPE =
  'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF' as const;

export type DispatchCorrectionIntent = {
  companyId: string;
  caseId: string;
  dispatchId: string;
  attestedNoHandoff: true;
  reason: string;
};

// No actor or mutable physical state in the intention hash. Authorization is a
// future command responsibility; replay reads the immutable historical witness.
export function createDispatchCorrectionRequestHash(
  intent: DispatchCorrectionIntent,
): string {
  const reason = intent.reason.trim();
  if (
    intent.attestedNoHandoff !== true ||
    reason.length < 1 ||
    [...reason].length > 1000 ||
    !intent.companyId ||
    !intent.caseId ||
    !intent.dispatchId
  ) {
    throw new Error('Invalid no-handoff correction intention');
  }
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        operation: 'CORRECT_NO_HANDOFF',
        companyId: intent.companyId,
        caseId: intent.caseId,
        dispatchId: intent.dispatchId,
        attestedNoHandoff: true,
        reason,
      }),
    )
    .digest('hex');
}

export function assertDispatchCorrectionReplayHash(
  recordedHash: string,
  requestedHash: string,
): void {
  if (recordedHash !== requestedHash) {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'La clave de idempotencia corresponde a otra intención',
    });
  }
}
