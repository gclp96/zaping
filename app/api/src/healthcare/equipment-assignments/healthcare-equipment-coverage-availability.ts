import type { EquipmentAssignmentAvailability } from './healthcare-equipment-assignments.service';
import type { OperationalWindow } from './healthcare-equipment-assignment-availability';

export function currentConflictOverrideMatches(
  override: {
    conflictingAssignmentId: string;
    assignmentWindowStart: Date;
    assignmentWindowEnd: Date;
    conflictingWindowStart: Date;
    conflictingWindowEnd: Date;
  },
  candidate: OperationalWindow,
  conflict: { reservation: { id: string }; window: OperationalWindow },
): boolean {
  return (
    override.conflictingAssignmentId === conflict.reservation.id &&
    override.assignmentWindowStart.getTime() === candidate.start.getTime() &&
    override.assignmentWindowEnd.getTime() === candidate.end.getTime() &&
    override.conflictingWindowStart.getTime() ===
      conflict.window.start.getTime() &&
    override.conflictingWindowEnd.getTime() === conflict.window.end.getTime()
  );
}

export type CoverageAvailabilityInput = {
  availability: EquipmentAssignmentAvailability;
  currentConflicts: { confirmed: boolean }[];
};

export function aggregateRequirementAvailability(
  inputs: CoverageAvailabilityInput[],
): EquipmentAssignmentAvailability {
  if (inputs.length === 0) {
    return { fullyVerifiable: false, conflictFree: null, warnings: [] };
  }
  const conflicts = inputs.flatMap((input) => input.currentConflicts);
  const hasConflict = conflicts.length > 0;
  const allConfirmed = hasConflict && conflicts.every((item) => item.confirmed);
  const order = [
    'INCOMPLETE_CASE_SCHEDULE',
    'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
    'CURRENT_ASSIGNMENT_CONFLICT',
    'CONFLICT_OVERRIDE_CONFIRMED',
  ] as const;
  const warnings = inputs.flatMap((input) => input.availability.warnings);
  return {
    fullyVerifiable: inputs.every(
      (input) => input.availability.fullyVerifiable,
    ),
    conflictFree: inputs.some(
      (input) => input.availability.conflictFree === false,
    )
      ? false
      : inputs.some((input) => input.availability.conflictFree === null)
        ? null
        : true,
    warnings: order.flatMap((code) => {
      if (code === 'CURRENT_ASSIGNMENT_CONFLICT' && !hasConflict) return [];
      if (code === 'CONFLICT_OVERRIDE_CONFIRMED' && !allConfirmed) return [];
      const warning = warnings.find((item) => item.code === code);
      return warning ? [warning] : [];
    }),
  };
}
