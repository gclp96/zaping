import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthcareEquipmentCoverageService } from './healthcare-equipment-coverage.service';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';
import {
  HealthcareEquipmentAssignmentRecord,
  HealthcareEquipmentAssignmentsRepository,
  coverageNotePublicSelect,
} from './healthcare-equipment-assignments.repository';

describe('Requirement coverage read snapshot', () => {
  const product = {
    id: 'product',
    name: 'Equipment',
    sku: 'EQ',
    isActive: true,
  };
  const tx = {
    healthcareCase: { findFirst: jest.fn() },
    healthcareCaseRequirement: {
      findMany: jest.fn<
        Promise<unknown[]>,
        [Prisma.HealthcareCaseRequirementFindManyArgs]
      >(),
      findFirst: jest.fn(),
    },
    healthcareEquipmentAssignment: {
      findMany: jest.fn<
        Promise<unknown[]>,
        [Prisma.HealthcareEquipmentAssignmentFindManyArgs]
      >(),
    },
    healthcareEquipmentAssignmentSettings: { findUnique: jest.fn() },
    healthcareEquipmentRequirementCoverageNote: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const prisma = { $transaction: jest.fn() };
  // Only the repository can open the snapshot. The root stub deliberately has
  // no model delegates; any material read escaping tx makes these tests fail.
  const repository = new HealthcareEquipmentAssignmentsRepository(
    prisma as unknown as PrismaService,
  );
  const evaluator = {
    evaluateCoverageAssignment: jest.fn<
      ReturnType<
        HealthcareEquipmentAssignmentsService['evaluateCoverageAssignment']
      >,
      Parameters<
        HealthcareEquipmentAssignmentsService['evaluateCoverageAssignment']
      >
    >(),
  };
  const service = new HealthcareEquipmentCoverageService(
    repository,
    evaluator as unknown as HealthcareEquipmentAssignmentsService,
  );
  const note = {
    id: 'note',
    requirementId: 'requirement',
    kind: 'UNAVAILABLE',
    comment: 'No disponible',
    createdAt: new Date(0),
    resolvedAt: null,
    recordedBy: { id: 'actor', firstName: 'A', lastName: 'B' },
    resolvedBy: null,
  };
  const requirement = (notes: unknown[] = [], qty = 2) => ({
    id: 'requirement',
    product,
    requestedQty: qty,
    equipmentCoverageNotes: notes,
  });
  const record = (
    id: string,
    lifecycle = 'ACTIVE',
    condition = 'GOOD',
    productId = 'product',
  ) => ({
    id,
    requirementId: 'requirement',
    equipmentAsset: { id, productId, lifecycle, condition },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (read: (transaction: typeof tx) => Promise<unknown>) => read(tx),
    );
    tx.healthcareCase.findFirst.mockResolvedValue({ id: 'case' });
    tx.healthcareCaseRequirement.findMany.mockResolvedValue([requirement()]);
    tx.healthcareCaseRequirement.findFirst.mockResolvedValue({
      id: 'requirement',
    });
    tx.healthcareEquipmentAssignment.findMany.mockResolvedValue([]);
    tx.healthcareEquipmentAssignmentSettings.findUnique.mockResolvedValue(null);
    evaluator.evaluateCoverageAssignment.mockReturnValue({
      availability: { fullyVerifiable: true, conflictFree: true, warnings: [] },
      currentConflicts: [],
    });
  });
  it('reads all inputs under one RepeatableRead transaction and returns only public fields', async () => {
    tx.healthcareCaseRequirement.findMany.mockResolvedValue([
      requirement([note]),
    ]);
    const response = await service.findCoverage('tenant', 'case');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(tx.healthcareCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case', companyId: 'tenant' },
      }),
    );
    expect(tx.healthcareCaseRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'tenant',
          caseId: 'case',
          lifecycle: 'ACTIVE',
          product: { inventoryTracking: 'ASSET' },
        },
      }),
    );
    expect(response.items[0]).toEqual({
      requirementId: 'requirement',
      product,
      requestedQty: 2,
      nominalAssignedQty: 0,
      assignedQty: 0,
      missingQty: 2,
      quantityState: 'UNAVAILABLE',
      activeNotes: [note],
      availability: {
        fullyVerifiable: false,
        conflictFree: null,
        warnings: [],
      },
    });
    expect(
      tx.healthcareCaseRequirement.findMany.mock.calls[0][0].select!
        .equipmentCoverageNotes,
    ).toMatchObject({
      where: { companyId: 'tenant', resolvedAt: null },
      select: coverageNotePublicSelect,
    });
    expect(JSON.stringify(response)).not.toMatch(
      /companyId|recordedById|resolvedById|conflictOverrides/,
    );
  });
  it('counts incompatible/ineligible nominal rows without leaking their availability', async () => {
    const eligible = record('valid');
    tx.healthcareEquipmentAssignment.findMany
      .mockResolvedValueOnce([
        eligible,
        record('inactive', 'RETIRED'),
        record('bad', 'ACTIVE', 'DAMAGED'),
        record('wrong', 'ACTIVE', 'GOOD', 'other'),
      ])
      .mockResolvedValueOnce([]);
    const result = await service.findCoverage('tenant', 'case');
    expect(result.items[0]).toMatchObject({
      nominalAssignedQty: 4,
      assignedQty: 1,
      missingQty: 1,
      quantityState: 'PARTIAL',
    });
    expect(evaluator.evaluateCoverageAssignment).toHaveBeenCalledTimes(1);
    expect(evaluator.evaluateCoverageAssignment.mock.calls[0][0]).toBe(
      eligible,
    );
    expect(
      tx.healthcareEquipmentAssignment.findMany.mock.calls[0][0].where,
    ).toEqual({
      companyId: 'tenant',
      caseId: 'case',
      requirementId: { in: ['requirement'] },
      origin: 'REQUIREMENT',
      lifecycle: 'RESERVED',
    });
    expect(
      tx.healthcareEquipmentAssignment.findMany.mock.calls[1][0].where,
    ).toEqual({
      companyId: 'tenant',
      equipmentAssetId: { in: ['valid'] },
      lifecycle: 'RESERVED',
    });
  });
  it('keeps stale notes visible and certainty independent of COVERED', async () => {
    tx.healthcareCaseRequirement.findMany.mockResolvedValue([
      requirement(
        [note, { ...note, id: 'partial', kind: 'PARTIAL_CONTEXT' }],
        1,
      ),
    ]);
    tx.healthcareEquipmentAssignment.findMany
      .mockResolvedValueOnce([record('valid')])
      .mockResolvedValueOnce([]);
    evaluator.evaluateCoverageAssignment.mockReturnValue({
      availability: {
        fullyVerifiable: false,
        conflictFree: null,
        warnings: [],
      },
      currentConflicts: [],
    });
    const result = await service.findCoverage('tenant', 'case');
    expect(result.items[0]).toMatchObject({
      quantityState: 'COVERED',
      missingQty: 0,
      activeNotes: [note, expect.objectContaining({ kind: 'PARTIAL_CONTEXT' })],
      availability: { fullyVerifiable: false, conflictFree: null },
    });
  });
  it('recomputes each read after assignment eligibility changes', async () => {
    tx.healthcareEquipmentAssignment.findMany
      .mockResolvedValueOnce([record('valid')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([record('valid', 'RETIRED')]);
    expect(
      (await service.findCoverage('tenant', 'case')).items[0].assignedQty,
    ).toBe(1);
    expect(
      (await service.findCoverage('tenant', 'case')).items[0],
    ).toMatchObject({
      assignedQty: 0,
      nominalAssignedQty: 1,
      quantityState: 'PENDING',
    });
  });
  it('returns an empty projection for a case with no active equipment requirements', async () => {
    tx.healthcareCaseRequirement.findMany.mockResolvedValue([]);
    expect(await service.findCoverage('tenant', 'case')).toEqual({ items: [] });
  });
  it.each(['coverage', 'history'])(
    'uses identical missing/foreign case 404 for %s',
    async (route) => {
      tx.healthcareCase.findFirst.mockResolvedValue(null);
      const read =
        route === 'coverage'
          ? service.findCoverage('tenant', 'foreign')
          : service.findNotes('tenant', 'foreign', 'requirement', {
              page: 1,
              pageSize: 25,
            });
      await expect(read).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'CASE_NOT_FOUND',
        }) as unknown,
      });
      expect(tx.healthcareCaseRequirement.findMany).not.toHaveBeenCalled();
    },
  );
  it('rejects missing/foreign/unrelated requirements using the tenant+case predicate', async () => {
    tx.healthcareCaseRequirement.findFirst.mockResolvedValue(null);
    await expect(
      service.findNotes('tenant', 'case', 'foreign', { page: 1, pageSize: 25 }),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({
        code: 'REQUIREMENT_NOT_FOUND',
      }) as unknown,
    });
    expect(tx.healthcareCaseRequirement.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', companyId: 'tenant', caseId: 'case' },
      select: { id: true },
    });
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.findMany,
    ).not.toHaveBeenCalled();
  });
  it('paginates active and resolved history with an explicit tie breaker', async () => {
    tx.healthcareEquipmentRequirementCoverageNote.count.mockResolvedValue(3);
    const resolved = {
      ...note,
      resolvedAt: new Date(1),
      resolvedBy: note.recordedBy,
    };
    tx.healthcareEquipmentRequirementCoverageNote.findMany.mockResolvedValue([
      resolved,
    ]);
    expect(
      await service.findNotes('tenant', 'case', 'requirement', {
        page: 2,
        pageSize: 2,
      }),
    ).toEqual({
      items: [resolved],
      pagination: { page: 2, pageSize: 2, totalItems: 3, totalPages: 2 },
    });
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.findMany,
    ).toHaveBeenCalledWith({
      where: { companyId: 'tenant', requirementId: 'requirement' },
      select: coverageNotePublicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 2,
      take: 2,
    });
  });
  it('sanitizes persistence failures', async () => {
    tx.healthcareCase.findFirst.mockRejectedValue(
      new Error('private database details'),
    );
    await expect(service.findCoverage('tenant', 'case')).rejects.toMatchObject({
      status: 500,
      response: expect.objectContaining({
        code: 'HEALTHCARE_PERSISTENCE_ERROR',
      }) as unknown,
    });
  });
  it('injects the existing repository and preserves a single snapshot for each GET', async () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        HealthcareEquipmentCoverageService,
      ),
    ).toEqual([
      HealthcareEquipmentAssignmentsRepository,
      HealthcareEquipmentAssignmentsService,
    ]);
    tx.healthcareEquipmentAssignment.findMany
      .mockResolvedValueOnce([record('valid')])
      .mockResolvedValueOnce([]);
    await service.findCoverage('tenant', 'case');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.healthcareCase.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.healthcareCaseRequirement.findMany).toHaveBeenCalledTimes(1);
    expect(tx.healthcareEquipmentAssignment.findMany).toHaveBeenCalledTimes(2);
    expect(
      tx.healthcareEquipmentAssignmentSettings.findUnique,
    ).toHaveBeenCalledTimes(1);
    tx.healthcareEquipmentRequirementCoverageNote.count.mockResolvedValue(0);
    tx.healthcareEquipmentRequirementCoverageNote.findMany.mockResolvedValue(
      [],
    );
    await service.findNotes('tenant', 'case', 'requirement', {
      page: 1,
      pageSize: 25,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.healthcareCaseRequirement.findFirst).toHaveBeenCalledTimes(1);
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.count,
    ).toHaveBeenCalledTimes(1);
    expect(
      tx.healthcareEquipmentRequirementCoverageNote.findMany,
    ).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });
});

describe('reused individual availability and conflict instance projection', () => {
  const assignments = new HealthcareEquipmentAssignmentsService(
    {} as never,
    {} as never,
  );
  const buffers = {
    preCaseBufferMinutes: 0,
    postCaseBufferMinutes: 0,
    source: 'COMPANY_SETTINGS' as const,
  };
  const candidate = {
    scheduledStart: new Date(1000),
    scheduledEnd: new Date(4000),
  };
  const conflictWindow = {
    scheduledStart: new Date(2000),
    scheduledEnd: new Date(3000),
  };
  const reservations = ['x', 'y'].map((id) => ({
    id,
    equipmentAssetId: 'asset',
    caseId: id,
    updatedAt: new Date(0),
    healthcareCase: {
      id,
      folio: id,
      updatedAt: new Date(0),
      ...conflictWindow,
    },
  }));
  const override = {
    conflictingAssignmentId: 'x',
    assignmentWindowStart: candidate.scheduledStart,
    assignmentWindowEnd: candidate.scheduledEnd,
    conflictingWindowStart: conflictWindow.scheduledStart,
    conflictingWindowEnd: conflictWindow.scheduledEnd,
  };
  it('preserves any-confirmed individual warnings while exposing a partial set of exact confirmations', () => {
    const record = {
      id: 'assignment',
      healthcareCase: candidate,
      equipmentAsset: { id: 'asset' },
      conflictOverrides: [override],
    } as unknown as HealthcareEquipmentAssignmentRecord;
    const result = assignments.evaluateCoverageAssignment(
      record,
      buffers,
      reservations,
    );
    expect(result.currentConflicts).toEqual([
      { confirmed: true },
      { confirmed: false },
    ]);
    expect(result.availability.warnings.map((w) => w.code)).toEqual([
      'CURRENT_ASSIGNMENT_CONFLICT',
      'CONFLICT_OVERRIDE_CONFIRMED',
    ]);
  });
  it('recomputes stale override after rescheduling', () => {
    const record = {
      id: 'assignment',
      healthcareCase: { ...candidate, scheduledEnd: new Date(5000) },
      equipmentAsset: { id: 'asset' },
      conflictOverrides: [override],
    } as unknown as HealthcareEquipmentAssignmentRecord;
    const result = assignments.evaluateCoverageAssignment(
      record,
      buffers,
      reservations,
    );
    expect(result.currentConflicts).toEqual([
      { confirmed: false },
      { confirmed: false },
    ]);
    expect(result.availability.warnings.map((w) => w.code)).toEqual([
      'CURRENT_ASSIGNMENT_CONFLICT',
    ]);
  });
});
