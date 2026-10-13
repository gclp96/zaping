import type { HealthcareCaseAvailability } from './healthcare-case-availability';

// Public response fixture shared by the service and modal tests.
export function availabilityFixture(
  caseId = 'case-1',
): HealthcareCaseAvailability {
  return {
    caseId,
    caseStatus: 'SCHEDULED',
    schedule: {
      scheduledStart: '2026-09-12T16:00:00.000Z',
      scheduledEnd: '2026-09-12T18:00:00.000Z',
      complete: true,
      warnings: [],
    },
    requirements: { activeCount: 10, requiredCount: 7, backupCount: 3 },
    coverage: {
      requirementCount: 10,
      coveredCount: 4,
      partialCount: 3,
      pendingCount: 2,
      unavailableCount: 1,
      activeNoteCount: 5,
    },
    equipment: {
      reservedAssignmentCount: 6,
      fullyVerifiable: true,
      conflictFree: true,
      warnings: [],
    },
    preparation: {
      caseKitId: 'kit-1',
      status: 'DRAFT',
      readiness: { status: 'PASS', blockers: [] },
    },
  };
}
