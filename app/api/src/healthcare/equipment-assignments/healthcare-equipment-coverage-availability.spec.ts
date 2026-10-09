import {
  aggregateRequirementAvailability,
  CoverageAvailabilityInput,
  currentConflictOverrideMatches,
} from './healthcare-equipment-coverage-availability';
import { deriveCoverageQuantities } from './healthcare-equipment-coverage.service';

const current = {
  code: 'CURRENT_ASSIGNMENT_CONFLICT' as const,
  message: 'current',
};
const override = {
  code: 'CONFLICT_OVERRIDE_CONFIRMED' as const,
  message: 'override',
};
const uncertain = {
  code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE' as const,
  message: 'uncertain',
};
function input(
  confirmed: boolean[],
  fullyVerifiable = true,
  conflictFree: boolean | null = confirmed.length ? false : true,
): CoverageAvailabilityInput {
  return {
    availability: {
      fullyVerifiable,
      conflictFree,
      warnings: [
        ...(!fullyVerifiable ? [uncertain] : []),
        ...(confirmed.length ? [current] : []),
        ...(confirmed.some(Boolean) ? [override] : []),
      ],
    },
    currentConflicts: confirmed.map((value) => ({ confirmed: value })),
  };
}
describe('DEC-C5-COV-05 aggregation', () => {
  it('does not certify empty coverage', () =>
    expect(aggregateRequirementAvailability([])).toEqual({
      fullyVerifiable: false,
      conflictFree: null,
      warnings: [],
    }));
  it('preserves all verified conflict-free assignments', () =>
    expect(aggregateRequirementAvailability([input([]), input([])])).toEqual({
      fullyVerifiable: true,
      conflictFree: true,
      warnings: [],
    }));
  it('false fullyVerifiable and null conflictFree dominate true', () =>
    expect(
      aggregateRequirementAvailability([input([]), input([], false, null)]),
    ).toEqual({
      fullyVerifiable: false,
      conflictFree: null,
      warnings: [uncertain],
    }));
  it('known conflict dominates null without conflating certainty', () =>
    expect(
      aggregateRequirementAvailability([
        input([false]),
        input([], false, null),
      ]),
    ).toEqual({
      fullyVerifiable: false,
      conflictFree: false,
      warnings: [uncertain, current],
    }));
  it.each([
    ['one confirmed conflict', [input([true])], [current, override]],
    [
      'confirmed and conflict-free assignments',
      [input([true]), input([])],
      [current, override],
    ],
    ['mixed assignments', [input([true]), input([false])], [current]],
    ['mixed conflicts in one assignment', [input([true, false])], [current]],
    [
      'all conflicts confirmed',
      [input([true, true]), input([true])],
      [current, override],
    ],
    [
      'uncertainty and confirmed conflicts',
      [input([true]), input([], false, null)],
      [uncertain, current, override],
    ],
  ])('%s', (_label, inputs, warnings) => {
    expect(aggregateRequirementAvailability(inputs).warnings).toEqual(warnings);
  });
  it('keeps fullyVerifiable true with conflictFree false', () =>
    expect(aggregateRequirementAvailability([input([true])])).toMatchObject({
      fullyVerifiable: true,
      conflictFree: false,
    }));
  it('ignores historical warning presence without actual conflicts', () => {
    const historical = input([]);
    historical.availability.warnings = [current, override];
    expect(aggregateRequirementAvailability([historical]).warnings).toEqual([]);
  });
  it('deduplicates and orders all codes deterministically', () => {
    const first = input([true], false, false);
    const incomplete = {
      code: 'INCOMPLETE_CASE_SCHEDULE' as const,
      message: 'incomplete',
    };
    first.availability.warnings = [
      override,
      current,
      uncertain,
      incomplete,
      current,
    ];
    expect(
      aggregateRequirementAvailability([first, input([true])]).warnings,
    ).toEqual([incomplete, uncertain, current, override]);
  });
});

describe('exact override window matching', () => {
  const candidate = { start: new Date(1000), end: new Date(2000) };
  const conflict = {
    reservation: { id: 'conflict' },
    window: { start: new Date(1200), end: new Date(2400) },
  };
  const record = {
    conflictingAssignmentId: 'conflict',
    assignmentWindowStart: candidate.start,
    assignmentWindowEnd: candidate.end,
    conflictingWindowStart: conflict.window.start,
    conflictingWindowEnd: conflict.window.end,
  };
  it('matches exact current identity and both windows', () =>
    expect(currentConflictOverrideMatches(record, candidate, conflict)).toBe(
      true,
    ));
  it.each([
    'assignmentWindowStart',
    'assignmentWindowEnd',
    'conflictingWindowStart',
    'conflictingWindowEnd',
  ] as const)('rejects stale %s', (field) =>
    expect(
      currentConflictOverrideMatches(
        { ...record, [field]: new Date(9999) },
        candidate,
        conflict,
      ),
    ).toBe(false),
  );
  it('rejects a different conflict identity', () =>
    expect(
      currentConflictOverrideMatches(
        { ...record, conflictingAssignmentId: 'other' },
        candidate,
        conflict,
      ),
    ).toBe(false));
});

describe('coverage quantity separation', () => {
  it.each([
    [2, 0, 0, false, 'PENDING', 2],
    [2, 0, 0, true, 'UNAVAILABLE', 2],
    [2, 3, 1, false, 'PARTIAL', 1],
    [2, 3, 1, true, 'PARTIAL', 1],
    [2, 3, 2, true, 'COVERED', 0],
    [2, 3, 3, false, 'COVERED', 0],
  ])(
    'derives counts %s/%s/%s with unavailable %s',
    (requested, nominal, assigned, unavailable, quantityState, missingQty) =>
      expect(
        deriveCoverageQuantities(requested, nominal, assigned, unavailable),
      ).toEqual({
        requestedQty: requested,
        nominalAssignedQty: nominal,
        assignedQty: assigned,
        missingQty,
        quantityState,
      }),
  );
});
