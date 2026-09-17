import {
  createEquipmentAssignmentConflictReviewFingerprint,
  deriveEquipmentAssignmentOperationalWindow,
  equipmentAssignmentWindowsOverlap,
  resolveEquipmentAssignmentBuffers,
  SYSTEM_POST_CASE_BUFFER_MINUTES,
  SYSTEM_PRE_CASE_BUFFER_MINUTES,
} from './healthcare-equipment-assignment-availability';

describe('Healthcare Equipment Assignment availability primitives', () => {
  it('uses the approved 120/180 system fallback without creating settings', () => {
    expect(resolveEquipmentAssignmentBuffers(null)).toEqual({
      preCaseBufferMinutes: SYSTEM_PRE_CASE_BUFFER_MINUTES,
      postCaseBufferMinutes: SYSTEM_POST_CASE_BUFFER_MINUTES,
      source: 'SYSTEM_DEFAULT',
    });
    expect(SYSTEM_PRE_CASE_BUFFER_MINUTES).toBe(120);
    expect(SYSTEM_POST_CASE_BUFFER_MINUTES).toBe(180);
  });

  it.each([
    [30, 45],
    [0, 0],
  ])('uses Company settings including zero buffers (%i/%i)', (pre, post) => {
    expect(
      resolveEquipmentAssignmentBuffers({
        preCaseBufferMinutes: pre,
        postCaseBufferMinutes: post,
      }),
    ).toEqual({
      preCaseBufferMinutes: pre,
      postCaseBufferMinutes: post,
      source: 'COMPANY_SETTINGS',
    });
  });

  it('derives the exact buffered operational window and returns null for incomplete schedules', () => {
    const buffers = resolveEquipmentAssignmentBuffers(null);

    expect(
      deriveEquipmentAssignmentOperationalWindow(
        {
          scheduledStart: new Date('2026-09-15T15:00:00.000Z'),
          scheduledEnd: new Date('2026-09-15T17:00:00.000Z'),
        },
        buffers,
      ),
    ).toEqual({
      start: new Date('2026-09-15T13:00:00.000Z'),
      end: new Date('2026-09-15T20:00:00.000Z'),
    });
    expect(
      deriveEquipmentAssignmentOperationalWindow(
        {
          scheduledStart: new Date('2026-09-15T15:00:00.000Z'),
          scheduledEnd: null as Date | null,
        },
        buffers,
      ),
    ).toBeNull();
  });

  it('uses half-open overlap semantics so touching boundaries do not overlap', () => {
    const candidate = {
      start: new Date('2026-09-15T10:00:00.000Z'),
      end: new Date('2026-09-15T12:00:00.000Z'),
    };

    expect(
      equipmentAssignmentWindowsOverlap(candidate, {
        start: new Date('2026-09-15T12:00:00.000Z'),
        end: new Date('2026-09-15T13:00:00.000Z'),
      }),
    ).toBe(false);
    expect(
      equipmentAssignmentWindowsOverlap(candidate, {
        start: new Date('2026-09-15T11:59:59.999Z'),
        end: new Date('2026-09-15T13:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('builds a deterministic fingerprint independent of conflict array order', () => {
    const input = fingerprintInput();
    const reversed = {
      ...input,
      conflicts: [...input.conflicts].reverse(),
      unresolvedReservations: [...input.unresolvedReservations].reverse(),
    };

    expect(createEquipmentAssignmentConflictReviewFingerprint(input)).toMatch(
      /^[a-f0-9]{64}$/u,
    );
    expect(createEquipmentAssignmentConflictReviewFingerprint(input)).toBe(
      createEquipmentAssignmentConflictReviewFingerprint(reversed),
    );
  });

  it.each([
    [
      'candidate Case schedule state',
      (input: ReturnType<typeof fingerprintInput>) => {
        input.candidate.caseUpdatedAt = new Date('2026-09-15T12:01:00.000Z');
      },
    ],
    [
      'Company buffer state',
      (input: ReturnType<typeof fingerprintInput>) => {
        input.buffers.preCaseBufferMinutes = 121;
      },
    ],
    [
      'confirmed conflict state',
      (input: ReturnType<typeof fingerprintInput>) => {
        input.conflicts[0].assignmentUpdatedAt = new Date(
          '2026-09-15T12:01:00.000Z',
        );
      },
    ],
    [
      'unresolved schedule state',
      (input: ReturnType<typeof fingerprintInput>) => {
        input.unresolvedReservations[0].scheduledEnd = new Date(
          '2026-09-15T20:00:00.000Z',
        );
      },
    ],
    [
      'Requirement capacity state',
      (input: ReturnType<typeof fingerprintInput>) => {
        input.requirementCapacity.currentCoverage = 1;
      },
    ],
  ] as const)('changes when %s changes', (_label, mutate) => {
    const before = fingerprintInput();
    const after = fingerprintInput();
    mutate(after);

    expect(createEquipmentAssignmentConflictReviewFingerprint(after)).not.toBe(
      createEquipmentAssignmentConflictReviewFingerprint(before),
    );
  });
});

function fingerprintInput() {
  const timestamp = new Date('2026-09-15T12:00:00.000Z');
  const window = {
    start: new Date('2026-09-15T13:00:00.000Z'),
    end: new Date('2026-09-15T20:00:00.000Z'),
  };

  return {
    companyId: '11111111-1111-4111-8111-111111111111',
    candidate: {
      caseId: '22222222-2222-4222-8222-222222222222',
      equipmentAssetId: '33333333-3333-4333-8333-333333333333',
      requirementId: '44444444-4444-4444-8444-444444444444',
      origin: 'REQUIREMENT',
      window,
      caseUpdatedAt: timestamp,
      equipmentAssetUpdatedAt: timestamp,
    },
    buffers: {
      preCaseBufferMinutes: 120,
      postCaseBufferMinutes: 180,
      source: 'SYSTEM_DEFAULT' as const,
    },
    requirementCapacity: {
      lifecycle: 'ACTIVE',
      requestedQty: 2,
      currentCoverage: 0,
      updatedAt: timestamp,
    },
    conflicts: [
      {
        assignmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        caseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        window,
        assignmentUpdatedAt: timestamp,
        caseUpdatedAt: timestamp,
      },
      {
        assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        caseId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        window,
        assignmentUpdatedAt: timestamp,
        caseUpdatedAt: timestamp,
      },
    ],
    unresolvedReservations: [
      {
        assignmentId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        caseId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        assignmentUpdatedAt: timestamp,
        caseUpdatedAt: timestamp,
        scheduledStart: timestamp,
        scheduledEnd: null,
      },
      {
        assignmentId: '77777777-7777-4777-8777-777777777777',
        caseId: '88888888-8888-4888-8888-888888888888',
        assignmentUpdatedAt: timestamp,
        caseUpdatedAt: timestamp,
        scheduledStart: null,
        scheduledEnd: null,
      },
    ],
  };
}
