import { api } from './api';
import type { HealthcareCaseKitReadinessBlocker } from './healthcare-case-kits';
import type { HealthcareEquipmentAssignmentAvailabilityWarning } from './healthcare-equipment-assignments';

export type HealthcareCaseAvailability = {
  caseId: string;
  caseStatus: 'DRAFT' | 'SCHEDULED' | 'CANCELLED';
  schedule: {
    scheduledStart: string | null;
    scheduledEnd: string | null;
    complete: boolean;
    warnings: { code: 'INCOMPLETE_CASE_SCHEDULE'; message: string }[];
  };
  requirements: {
    activeCount: number;
    requiredCount: number;
    backupCount: number;
  };
  coverage: {
    requirementCount: number;
    coveredCount: number;
    partialCount: number;
    pendingCount: number;
    unavailableCount: number;
    activeNoteCount: number;
  };
  equipment: {
    reservedAssignmentCount: number;
    fullyVerifiable: boolean;
    conflictFree: boolean | null;
    warnings: HealthcareEquipmentAssignmentAvailabilityWarning[];
  };
  preparation: {
    caseKitId: string | null;
    status: 'DRAFT' | 'PREPARED' | null;
    readiness: {
      status: 'PASS' | 'BLOCKED';
      blockers: Pick<
        HealthcareCaseKitReadinessBlocker,
        'code' | 'requirementId'
      >[];
    } | null;
  };
};

export async function getHealthcareCaseAvailability(caseId: string) {
  const response = await api.get<HealthcareCaseAvailability>(
    `/healthcare/cases/${caseId}/availability`,
  );
  return response.data;
}
