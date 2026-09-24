import {
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
  IdempotencyScope,
  Prisma,
} from '@prisma/client';

import {
  HealthcareEquipmentAssignmentsRepository,
  healthcareEquipmentAssignmentResponseSelect,
} from './healthcare-equipment-assignments.repository';

const companyId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const requirementId = '33333333-3333-4333-8333-333333333333';
const equipmentAssetId = '44444444-4444-4444-8444-444444444444';
const assignmentId = '55555555-5555-4555-8555-555555555555';
const userId = '66666666-6666-4666-8666-666666666666';

describe('HealthcareEquipmentAssignmentsRepository', () => {
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    idempotencyRecord: {
      findUnique: jest.fn(),
    },
    healthcareCase: {
      findFirst: jest.fn(),
    },
    healthcareCaseRequirement: {
      findFirst: jest.fn(),
    },
    equipmentAsset: {
      findFirst: jest.fn(),
    },
    healthcareEquipmentAssignmentSettings: {
      findUnique: jest.fn(),
    },
    healthcareEquipmentAssignment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    healthcareEquipmentAssignmentConflictOverride: {
      createMany: jest.fn(),
    },
  };
  const repository = new HealthcareEquipmentAssignmentsRepository(
    prisma as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps Case, Requirement, EquipmentAsset and Assignment lookups tenant-scoped', async () => {
    await repository.findCase(companyId, caseId);
    await repository.findRequirement(companyId, requirementId);
    await repository.findEquipmentAsset(companyId, equipmentAssetId);
    await repository.findAssignment(companyId, assignmentId);

    expect(prisma.healthcareCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: caseId, companyId } }),
    );
    expect(prisma.healthcareCaseRequirement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: requirementId, companyId } }),
    );
    expect(prisma.equipmentAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: equipmentAssetId, companyId } }),
    );
    expect(prisma.healthcareEquipmentAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: assignmentId, companyId },
      }),
    );
  });

  it('releases only a tenant-scoped RESERVED assignment', async () => {
    const releasedAt = new Date('2026-09-17T18:00:00.000Z');

    prisma.healthcareEquipmentAssignment.updateMany.mockResolvedValue({
      count: 1,
    });

    await repository.releaseAssignment(prisma as never, {
      companyId,
      assignmentId,
      releasedAt,
      releasedById: userId,
      releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
      releaseReason: 'Equipo ya no requerido',
    });

    expect(
      prisma.healthcareEquipmentAssignment.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: assignmentId,
        companyId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
      data: {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Equipo ya no requerido',
      },
    });
  });

  it('locks only applicable Requirement Assignments in deterministic order', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'assignment-a' },
      { id: 'assignment-b' },
    ]);

    await expect(
      repository.lockReservedRequirementAssignments(prisma as never, {
        companyId,
        caseId,
        requirementId,
      }),
    ).resolves.toEqual(['assignment-a', 'assignment-b']);

    const queryRawMock = prisma.$queryRaw as jest.MockedFunction<
      (query: Prisma.Sql) => Promise<Array<{ id: string }>>
    >;
    const query = queryRawMock.mock.calls[0][0];
    expect(query.values).toEqual([
      companyId,
      caseId,
      requirementId,
      HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      HealthcareEquipmentAssignmentLifecycle.RESERVED,
    ]);
    const sql = query.strings.join(' ');
    expect(sql).toContain('"companyId"');
    expect(sql).toContain('"caseId"');
    expect(sql).toContain('"requirementId"');
    expect(sql).toContain('"origin"');
    expect(sql).toContain('"lifecycle"');
    expect(sql).toContain('ORDER BY "id" ASC');
    expect(sql).toContain('FOR UPDATE');
  });

  it('locks every RESERVED Case Assignment in deterministic order without filtering origin', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'assignment-a' },
      { id: 'assignment-b' },
    ]);

    await expect(
      repository.lockReservedCaseAssignments(prisma as never, {
        companyId,
        caseId,
      }),
    ).resolves.toEqual(['assignment-a', 'assignment-b']);

    const queryRawMock = prisma.$queryRaw as jest.MockedFunction<
      (query: Prisma.Sql) => Promise<Array<{ id: string }>>
    >;
    const query = queryRawMock.mock.calls[0][0];
    expect(query.values).toEqual([
      companyId,
      caseId,
      HealthcareEquipmentAssignmentLifecycle.RESERVED,
    ]);
    const sql = query.strings.join(' ');
    expect(sql).toContain('"companyId"');
    expect(sql).toContain('"caseId"');
    expect(sql).toContain('"lifecycle"');
    expect(sql).not.toContain('"requirementId"');
    expect(sql).not.toContain('"origin"');
    expect(sql).toContain('ORDER BY "id" ASC');
    expect(sql).toContain('FOR UPDATE');
  });

  it('conditionally releases a locked Requirement Assignment with parent context', async () => {
    const releasedAt = new Date('2026-09-17T18:00:00.000Z');

    prisma.healthcareEquipmentAssignment.updateMany.mockResolvedValue({
      count: 1,
    });

    await repository.releaseAssignment(prisma as never, {
      companyId,
      assignmentId,
      releasedAt,
      releasedById: userId,
      releaseCause:
        HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
      releaseReason: 'Cambio clínico',
      expectedContext: {
        caseId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      },
    });

    expect(
      prisma.healthcareEquipmentAssignment.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: assignmentId,
        companyId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        caseId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      },
      data: {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause:
          HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
        releaseReason: 'Cambio clínico',
      },
    });
  });

  it('conditionally releases a locked Case Assignment without restricting its origin', async () => {
    const releasedAt = new Date('2026-09-17T18:00:00.000Z');

    prisma.healthcareEquipmentAssignment.updateMany.mockResolvedValue({
      count: 1,
    });

    await repository.releaseAssignment(prisma as never, {
      companyId,
      assignmentId,
      releasedAt,
      releasedById: userId,
      releaseCause: HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
      releaseReason: 'Caso cancelado',
      expectedContext: {
        caseId,
      },
    });

    expect(
      prisma.healthcareEquipmentAssignment.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: assignmentId,
        companyId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        caseId,
      },
      data: {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
        releaseReason: 'Caso cancelado',
      },
    });
  });

  it('finds a tenant-scoped replacement source with the lightweight select', async () => {
    prisma.healthcareEquipmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
    });

    await repository.findAssignmentReplacementSource(companyId, assignmentId);

    expect(prisma.healthcareEquipmentAssignment.findFirst).toHaveBeenCalledWith(
      {
        where: {
          id: assignmentId,
          companyId,
        },
        select: {
          id: true,
          companyId: true,
          caseId: true,
          equipmentAssetId: true,
          requirementId: true,
          origin: true,
          lifecycle: true,
          directAssignmentReason: true,
          updatedAt: true,
        },
      },
    );
  });

  it('discovers only the tenant-scoped source Asset for Manual Release', async () => {
    prisma.healthcareEquipmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      equipmentAssetId,
    });

    await repository.findAssignmentReleaseSource(companyId, assignmentId);

    expect(prisma.healthcareEquipmentAssignment.findFirst).toHaveBeenCalledWith(
      {
        where: {
          id: assignmentId,
          companyId,
        },
        select: {
          id: true,
          equipmentAssetId: true,
        },
      },
    );
  });

  it('locks a tenant-scoped Assignment with the replacement snapshot fields', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: assignmentId,
        companyId,
        caseId,
        equipmentAssetId,
        requirementId: null,
        origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        directAssignmentReason: 'Urgente',
        releasedAt: null,
        releasedById: null,
        releaseCause: null,
        releaseReason: null,
        updatedAt: new Date('2026-09-18T18:00:00.000Z'),
      },
    ]);

    const result = await repository.lockAssignment(
      prisma as never,
      companyId,
      assignmentId,
    );

    expect(result).toMatchObject({
      id: assignmentId,
      companyId,
      caseId,
      equipmentAssetId,
      lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('creates a replacement Assignment linked to the source Assignment', async () => {
    prisma.healthcareEquipmentAssignment.create.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    await repository.createAssignment(prisma as never, {
      companyId,
      caseId,
      equipmentAssetId,
      requirementId: null,
      origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
      directAssignmentReason: 'Urgente',
      createdById: userId,
      replacesAssignmentId: assignmentId,
    });

    expect(prisma.healthcareEquipmentAssignment.create).toHaveBeenCalledWith({
      data: {
        companyId,
        caseId,
        equipmentAssetId,
        requirementId: null,
        origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        directAssignmentReason: 'Urgente',
        createdById: userId,
        replacesAssignmentId: assignmentId,
      },
      select: healthcareEquipmentAssignmentResponseSelect,
    });
  });

  it.each([
    IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
    IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
    IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
  ])('uses the exact %s idempotency identity', async (scope) => {
    await repository.findIdempotencyRecord(companyId, 'request-key', scope);

    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_scope_key: {
          companyId,
          scope,
          key: 'request-key',
        },
      },
      select: { requestHash: true, resourceId: true },
    });
  });

  it('marks only a tenant-scoped RESERVED Assignment as REPLACED', async () => {
    const replacedAt = new Date('2026-09-18T18:00:00.000Z');

    prisma.healthcareEquipmentAssignment.updateMany.mockResolvedValue({
      count: 1,
    });

    await repository.replaceAssignment(prisma as never, {
      companyId,
      assignmentId,
      replacedAt,
      replacedById: userId,
      replacementReason: 'Equipo original no disponible',
    });

    expect(
      prisma.healthcareEquipmentAssignment.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: assignmentId,
        companyId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
      data: {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
        replacedAt,
        replacedById: userId,
        replacementReason: 'Equipo original no disponible',
      },
    });
  });

  it('counts only active REQUIREMENT-origin coverage inside the tenant', async () => {
    await repository.countRequirementCoverage(companyId, requirementId);

    expect(prisma.healthcareEquipmentAssignment.count).toHaveBeenCalledWith({
      where: {
        companyId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
    });
  });

  it('checks duplicate reservation inside Company, Case and EquipmentAsset', async () => {
    await repository.findReservedAssignmentForCaseAsset(
      companyId,
      caseId,
      equipmentAssetId,
    );

    expect(prisma.healthcareEquipmentAssignment.findFirst).toHaveBeenCalledWith(
      {
        where: {
          companyId,
          caseId,
          equipmentAssetId,
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        },
        select: { id: true },
      },
    );
  });

  it('resolves Company settings without creating a settings row', async () => {
    await repository.findSettings(companyId);

    expect(
      prisma.healthcareEquipmentAssignmentSettings.findUnique,
    ).toHaveBeenCalledWith({
      where: { companyId },
      select: {
        preCaseBufferMinutes: true,
        postCaseBufferMinutes: true,
      },
    });
  });

  it('locks only the tenant-scoped EquipmentAsset and Requirement rows', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: equipmentAssetId }])
      .mockResolvedValueOnce([{ id: requirementId }]);

    await expect(
      repository.lockEquipmentAsset(
        prisma as never,
        companyId,
        equipmentAssetId,
      ),
    ).resolves.toBe(true);
    await expect(
      repository.lockRequirement(prisma as never, companyId, requirementId),
    ).resolves.toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('loads only same-tenant RESERVED reservations for authoritative availability', async () => {
    await repository.findReservedAssignmentsForAsset(
      companyId,
      equipmentAssetId,
      'excluded-assignment',
    );

    expect(prisma.healthcareEquipmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId,
          equipmentAssetId,
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          id: { not: 'excluded-assignment' },
        },
        orderBy: { id: 'asc' },
      }),
    );
  });

  it('bulk-loads RESERVED reservations for list availability without N+1 lookups', async () => {
    await repository.findReservedAssignmentsForAssets(companyId, [
      equipmentAssetId,
      'other-asset',
    ]);

    expect(prisma.healthcareEquipmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId,
          equipmentAssetId: { in: [equipmentAssetId, 'other-asset'] },
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        },
        orderBy: { id: 'asc' },
      }),
    );
  });

  it('creates one same-tenant override row per confirmed conflict', async () => {
    const rows = [
      {
        companyId,
        assignmentId: 'assignment-1',
        conflictingAssignmentId: 'assignment-2',
        assignmentWindowStart: new Date('2026-09-15T10:00:00.000Z'),
        assignmentWindowEnd: new Date('2026-09-15T12:00:00.000Z'),
        conflictingWindowStart: new Date('2026-09-15T11:00:00.000Z'),
        conflictingWindowEnd: new Date('2026-09-15T13:00:00.000Z'),
        approvedById: 'user-1',
        reason: 'Riesgo controlado',
      },
    ];

    await repository.createConflictOverrides(prisma as never, rows);

    expect(
      prisma.healthcareEquipmentAssignmentConflictOverride.createMany,
    ).toHaveBeenCalledWith({ data: rows });
  });

  it('applies AND filters, deterministic ordering and pagination to list', async () => {
    await repository.findAssignments(
      companyId,
      {
        caseId,
        requirementId,
        equipmentAssetId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      },
      2,
      25,
    );

    expect(prisma.healthcareEquipmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId,
          caseId,
          requirementId,
          equipmentAssetId,
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 25,
        take: 25,
      }),
    );
  });

  it('runs mutations through the Prisma transaction boundary', async () => {
    const transaction = { id: 'transaction' };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      repository.runInTransaction((client) => Promise.resolve(client)),
    ).resolves.toBe(transaction);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('forwards optional interactive transaction limits without changing the default call', async () => {
    const transaction = { id: 'transaction' };
    const options = { maxWait: 3_000, timeout: 20_000 };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      repository.runInTransaction((client) => Promise.resolve(client), options),
    ).resolves.toBe(transaction);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      options,
    );
  });
});
