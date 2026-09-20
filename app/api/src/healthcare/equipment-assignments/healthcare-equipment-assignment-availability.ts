import { createHash } from 'node:crypto';

export const SYSTEM_PRE_CASE_BUFFER_MINUTES = 120;
export const SYSTEM_POST_CASE_BUFFER_MINUTES = 180;

export type EquipmentAssignmentBufferSource =
  'SYSTEM_DEFAULT' | 'COMPANY_SETTINGS';

export type EquipmentAssignmentBuffers = {
  preCaseBufferMinutes: number;
  postCaseBufferMinutes: number;
  source: EquipmentAssignmentBufferSource;
};

export type OperationalWindow = {
  start: Date;
  end: Date;
};

export type FingerprintConflict = {
  assignmentId: string;
  caseId: string;
  window: OperationalWindow;
  assignmentUpdatedAt: Date;
  caseUpdatedAt: Date;
};

export type FingerprintUnresolvedReservation = {
  assignmentId: string;
  caseId: string;
  assignmentUpdatedAt: Date;
  caseUpdatedAt: Date;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
};

export type EquipmentAssignmentConflictReviewFingerprintInput = {
  companyId: string;
  candidate: {
    caseId: string;
    equipmentAssetId: string;
    requirementId: string | null;
    origin: string;
    window: OperationalWindow;
    caseUpdatedAt: Date;
    equipmentAssetUpdatedAt: Date;
  };
  buffers: EquipmentAssignmentBuffers;
  requirementCapacity: {
    lifecycle: string;
    requestedQty: number;
    currentCoverage: number;
    updatedAt: Date;
  } | null;
  conflicts: FingerprintConflict[];
  unresolvedReservations: FingerprintUnresolvedReservation[];
};

export type EquipmentAssignmentReplaceConflictReviewFingerprintInput = {
  companyId: string;
  sourceAssignment: {
    id: string;
    lifecycle: string;
    updatedAt: Date;
  };
  candidate: {
    caseId: string;
    equipmentAssetId: string;
    requirementId: string | null;
    origin: string;
    window: OperationalWindow;
    caseUpdatedAt: Date;
    equipmentAssetUpdatedAt: Date;
  };
  buffers: EquipmentAssignmentBuffers;
  requirementCapacity: {
    lifecycle: string;
    requestedQty: number;
    currentCoverage: number;
    updatedAt: Date;
  } | null;
  conflicts: FingerprintConflict[];
  unresolvedReservations: FingerprintUnresolvedReservation[];
};

export function createEquipmentAssignmentReplaceConflictReviewFingerprint(
  input: EquipmentAssignmentReplaceConflictReviewFingerprintInput,
): string {
  const canonical = {
    contractVersion: 'equipment-assignment-replace-conflict-review:v1',
    companyId: input.companyId,
    sourceAssignment: {
      id: input.sourceAssignment.id,
      lifecycle: input.sourceAssignment.lifecycle,
      updatedAt: input.sourceAssignment.updatedAt.toISOString(),
    },
    candidate: {
      caseId: input.candidate.caseId,
      equipmentAssetId: input.candidate.equipmentAssetId,
      requirementId: input.candidate.requirementId,
      origin: input.candidate.origin,
      windowStart: input.candidate.window.start.toISOString(),
      windowEnd: input.candidate.window.end.toISOString(),
      caseUpdatedAt: input.candidate.caseUpdatedAt.toISOString(),
      equipmentAssetUpdatedAt:
        input.candidate.equipmentAssetUpdatedAt.toISOString(),
    },
    buffers: {
      preCaseBufferMinutes: input.buffers.preCaseBufferMinutes,
      postCaseBufferMinutes: input.buffers.postCaseBufferMinutes,
    },
    requirementCapacity: input.requirementCapacity
      ? {
          lifecycle: input.requirementCapacity.lifecycle,
          requestedQty: input.requirementCapacity.requestedQty,
          currentCoverage: input.requirementCapacity.currentCoverage,
          updatedAt: input.requirementCapacity.updatedAt.toISOString(),
        }
      : null,
    conflicts: [...input.conflicts]
      .sort((left, right) =>
        left.assignmentId.localeCompare(right.assignmentId),
      )
      .map((conflict) => ({
        assignmentId: conflict.assignmentId,
        caseId: conflict.caseId,
        windowStart: conflict.window.start.toISOString(),
        windowEnd: conflict.window.end.toISOString(),
        assignmentUpdatedAt: conflict.assignmentUpdatedAt.toISOString(),
        caseUpdatedAt: conflict.caseUpdatedAt.toISOString(),
      })),
    unresolvedReservations: [...input.unresolvedReservations]
      .sort((left, right) =>
        left.assignmentId.localeCompare(right.assignmentId),
      )
      .map((reservation) => ({
        assignmentId: reservation.assignmentId,
        caseId: reservation.caseId,
        assignmentUpdatedAt: reservation.assignmentUpdatedAt.toISOString(),
        caseUpdatedAt: reservation.caseUpdatedAt.toISOString(),
        scheduledStart: reservation.scheduledStart?.toISOString() ?? null,
        scheduledEnd: reservation.scheduledEnd?.toISOString() ?? null,
      })),
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function resolveEquipmentAssignmentBuffers(
  settings: {
    preCaseBufferMinutes: number;
    postCaseBufferMinutes: number;
  } | null,
): EquipmentAssignmentBuffers {
  return settings
    ? {
        preCaseBufferMinutes: settings.preCaseBufferMinutes,
        postCaseBufferMinutes: settings.postCaseBufferMinutes,
        source: 'COMPANY_SETTINGS',
      }
    : {
        preCaseBufferMinutes: SYSTEM_PRE_CASE_BUFFER_MINUTES,
        postCaseBufferMinutes: SYSTEM_POST_CASE_BUFFER_MINUTES,
        source: 'SYSTEM_DEFAULT',
      };
}

export function deriveEquipmentAssignmentOperationalWindow(
  schedule: { scheduledStart: Date | null; scheduledEnd: Date | null },
  buffers: EquipmentAssignmentBuffers,
): OperationalWindow | null {
  if (!schedule.scheduledStart || !schedule.scheduledEnd) {
    return null;
  }

  return {
    start: new Date(
      schedule.scheduledStart.getTime() - buffers.preCaseBufferMinutes * 60_000,
    ),
    end: new Date(
      schedule.scheduledEnd.getTime() + buffers.postCaseBufferMinutes * 60_000,
    ),
  };
}

export function equipmentAssignmentWindowsOverlap(
  candidate: OperationalWindow,
  existing: OperationalWindow,
): boolean {
  return candidate.start < existing.end && existing.start < candidate.end;
}

export function createEquipmentAssignmentConflictReviewFingerprint(
  input: EquipmentAssignmentConflictReviewFingerprintInput,
): string {
  const canonical = {
    contractVersion: 'equipment-assignment-conflict-review:v1',
    companyId: input.companyId,
    candidate: {
      caseId: input.candidate.caseId,
      equipmentAssetId: input.candidate.equipmentAssetId,
      requirementId: input.candidate.requirementId,
      origin: input.candidate.origin,
      windowStart: input.candidate.window.start.toISOString(),
      windowEnd: input.candidate.window.end.toISOString(),
      caseUpdatedAt: input.candidate.caseUpdatedAt.toISOString(),
      equipmentAssetUpdatedAt:
        input.candidate.equipmentAssetUpdatedAt.toISOString(),
    },
    buffers: {
      preCaseBufferMinutes: input.buffers.preCaseBufferMinutes,
      postCaseBufferMinutes: input.buffers.postCaseBufferMinutes,
    },
    requirementCapacity: input.requirementCapacity
      ? {
          lifecycle: input.requirementCapacity.lifecycle,
          requestedQty: input.requirementCapacity.requestedQty,
          currentCoverage: input.requirementCapacity.currentCoverage,
          updatedAt: input.requirementCapacity.updatedAt.toISOString(),
        }
      : null,
    conflicts: [...input.conflicts]
      .sort((left, right) =>
        left.assignmentId.localeCompare(right.assignmentId),
      )
      .map((conflict) => ({
        assignmentId: conflict.assignmentId,
        caseId: conflict.caseId,
        windowStart: conflict.window.start.toISOString(),
        windowEnd: conflict.window.end.toISOString(),
        assignmentUpdatedAt: conflict.assignmentUpdatedAt.toISOString(),
        caseUpdatedAt: conflict.caseUpdatedAt.toISOString(),
      })),
    unresolvedReservations: [...input.unresolvedReservations]
      .sort((left, right) =>
        left.assignmentId.localeCompare(right.assignmentId),
      )
      .map((reservation) => ({
        assignmentId: reservation.assignmentId,
        caseId: reservation.caseId,
        assignmentUpdatedAt: reservation.assignmentUpdatedAt.toISOString(),
        caseUpdatedAt: reservation.caseUpdatedAt.toISOString(),
        scheduledStart: reservation.scheduledStart?.toISOString() ?? null,
        scheduledEnd: reservation.scheduledEnd?.toISOString() ?? null,
      })),
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
