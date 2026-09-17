import {
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  IdempotencyScope,
} from '@prisma/client';

import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';

const companyId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const requirementId = '33333333-3333-4333-8333-333333333333';
const equipmentAssetId = '44444444-4444-4444-8444-444444444444';

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
    await repository.findAssignment(companyId, 'assignment-1');

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
        where: { id: 'assignment-1', companyId },
      }),
    );
  });

  it('uses the exact CREATE idempotency identity', async () => {
    await repository.findIdempotencyRecord(
      companyId,
      'request-key',
      IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
    );

    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_scope_key: {
          companyId,
          scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
          key: 'request-key',
        },
      },
      select: { requestHash: true, resourceId: true },
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
