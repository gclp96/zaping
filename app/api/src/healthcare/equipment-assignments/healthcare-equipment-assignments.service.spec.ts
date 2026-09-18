import 'reflect-metadata';

import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
  HealthcareRequirementLifecycle,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import { HealthcareEquipmentAssignmentListStatus } from './dto/healthcare-equipment-assignment-list-query.dto';
import { createHealthcareEquipmentAssignmentRequestHash } from './healthcare-equipment-assignment-request-hash';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const caseId = '44444444-4444-4444-8444-444444444444';
const otherCaseId = '55555555-5555-4555-8555-555555555555';
const requirementId = '66666666-6666-4666-8666-666666666666';
const equipmentAssetId = '77777777-7777-4777-8777-777777777777';
const productId = '88888888-8888-4888-8888-888888888888';
const assignmentId = '99999999-9999-4999-8999-999999999999';
const conflictingAssignmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const createdAt = new Date('2026-09-15T15:00:00.000Z');
const updatedAt = new Date('2026-09-15T15:05:00.000Z');
const completeCase = {
  id: caseId,
  folio: 'HC-000001',
  status: HealthcareCaseStatus.DRAFT,
  scheduledStart: new Date('2026-09-16T15:00:00.000Z'),
  scheduledEnd: new Date('2026-09-16T17:00:00.000Z'),
  updatedAt,
};
const requirement = {
  id: requirementId,
  caseId,
  productId,
  requestedQty: 2,
  lifecycle: HealthcareRequirementLifecycle.ACTIVE,
  updatedAt,
  product: {
    inventoryTracking: ProductInventoryTracking.ASSET,
  },
};
const equipmentAsset = {
  id: equipmentAssetId,
  productId,
  assetCode: 'EQ-000001',
  serialNumber: 'SN-001',
  lifecycle: EquipmentLifecycle.ACTIVE,
  condition: EquipmentCondition.GOOD,
  updatedAt,
  product: {
    id: productId,
    sku: 'EQ-PRODUCT-01',
    name: 'Equipo clínico',
    isActive: true,
  },
};
const baseRecord = {
  id: assignmentId,
  companyId,
  caseId,
  requirementId,
  origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
  lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
  directAssignmentReason: null,
  replacesAssignmentId: null,
  releasedAt: null,
  releaseCause: null,
  releaseReason: null,
  replacedAt: null,
  replacementReason: null,
  createdAt,
  updatedAt,
  healthcareCase: {
    folio: completeCase.folio,
    scheduledStart: completeCase.scheduledStart,
    scheduledEnd: completeCase.scheduledEnd,
    updatedAt,
  },
  equipmentAsset: {
    id: equipmentAssetId,
    productId,
    assetCode: 'EQ-000001',
    serialNumber: 'SN-001',
    lifecycle: EquipmentLifecycle.ACTIVE,
    condition: EquipmentCondition.GOOD,
    product: {
      id: productId,
      sku: 'EQ-PRODUCT-01',
      name: 'Equipo clínico',
      isActive: true,
    },
  },
  createdBy: {
    id: userId,
    firstName: 'Ana',
    lastName: 'Pérez',
  },
  releasedBy: null,
  replacedBy: null,
  replacementAssignments: [],
  conflictOverrides: [],
};

const releasedAt = new Date('2026-09-17T18:00:00.000Z');

const releasedRecord = {
  ...baseRecord,
  lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
  releasedAt,
  releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
  releaseReason: 'Equipo ya no requerido',
  releasedBy: {
    id: userId,
    firstName: 'Ana',
    lastName: 'Pérez',
  },
  updatedAt: releasedAt,
};

const requirementDto = {
  caseId,
  equipmentAssetId,
  requirementId,
};

const directDto = {
  caseId,
  equipmentAssetId,
  directAssignmentReason: '  Respaldo urgente  ',
};

const overlappingReservation = {
  id: conflictingAssignmentId,
  caseId: otherCaseId,
  updatedAt,
  healthcareCase: {
    id: otherCaseId,
    folio: 'HC-000002',
    scheduledStart: new Date('2026-09-16T16:00:00.000Z'),
    scheduledEnd: new Date('2026-09-16T18:00:00.000Z'),
    updatedAt,
  },
};

const unresolvedReservation = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  caseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  updatedAt,
  healthcareCase: {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    folio: 'HC-000003',
    scheduledStart: new Date('2026-09-16T20:00:00.000Z'),
    scheduledEnd: null,
    updatedAt,
  },
};

function knownPrismaError(code: string, target?: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '6.19.3',
    meta: target ? { target } : undefined,
  });
}

describe('HealthcareEquipmentAssignmentsService', () => {
  const transaction = { transaction: true };
  const repository = {
    runInTransaction: jest.fn(),
    findIdempotencyRecord: jest.fn(),
    createIdempotencyClaim: jest.fn(),
    completeIdempotencyClaim: jest.fn(),
    findCase: jest.fn(),
    findRequirement: jest.fn(),
    findEquipmentAsset: jest.fn(),
    findSettings: jest.fn(),
    findSettingsForShare: jest.fn(),
    lockAssignment: jest.fn(),
    lockEquipmentAsset: jest.fn(),
    lockRequirement: jest.fn(),
    acquireSettingsSharedAdvisoryLock: jest.fn(),
    lockHealthcareCasesForShare: jest.fn(),
    countRequirementCoverage: jest.fn(),
    findReservedAssignmentForCaseAsset: jest.fn(),
    findReservedAssignmentCaseIdsForAsset: jest.fn(),
    findReservedAssignmentsForAsset: jest.fn(),
    findReservedAssignmentsForAssets: jest.fn(),
    createAssignment: jest.fn(),
    releaseAssignment: jest.fn(),
    createConflictOverrides: jest.fn(),
    findAssignment: jest.fn(),
    countAssignments: jest.fn(),
    findAssignments: jest.fn(),
  };
  let service: HealthcareEquipmentAssignmentsService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository.runInTransaction.mockImplementation(
      (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
    repository.findIdempotencyRecord.mockResolvedValue(null);
    repository.createIdempotencyClaim.mockResolvedValue({ id: 'claim-1' });
    repository.completeIdempotencyClaim.mockResolvedValue({ id: 'claim-1' });
    repository.findCase.mockResolvedValue(completeCase);
    repository.findRequirement.mockResolvedValue(requirement);
    repository.findEquipmentAsset.mockResolvedValue(equipmentAsset);
    repository.findSettings.mockResolvedValue(null);
    repository.findSettingsForShare.mockResolvedValue(null);
    repository.lockEquipmentAsset.mockResolvedValue(true);
    repository.lockRequirement.mockResolvedValue(true);

    repository.lockAssignment.mockResolvedValue({
      id: assignmentId,
      lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
    });

    repository.releaseAssignment.mockResolvedValue({
      count: 1,
    });
    repository.acquireSettingsSharedAdvisoryLock.mockResolvedValue(undefined);
    repository.lockHealthcareCasesForShare.mockResolvedValue([caseId]);
    repository.countRequirementCoverage.mockResolvedValue(0);
    repository.findReservedAssignmentForCaseAsset.mockResolvedValue(null);
    repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([]);
    repository.findReservedAssignmentsForAsset.mockResolvedValue([]);
    repository.findReservedAssignmentsForAssets.mockResolvedValue([]);
    repository.createAssignment.mockResolvedValue(baseRecord);
    repository.createConflictOverrides.mockResolvedValue({ count: 0 });
    repository.findAssignment.mockResolvedValue(baseRecord);
    repository.countAssignments.mockResolvedValue(1);
    repository.findAssignments.mockResolvedValue([baseRecord]);
    service = new HealthcareEquipmentAssignmentsService(repository as never);
  });

  describe('release', () => {
    it('releases a RESERVED assignment with MANUAL cause', async () => {
      repository.findAssignment.mockResolvedValue(releasedRecord);

      const result = await service.release(companyId, userId, assignmentId, {
        reason: '  Equipo ya no requerido  ',
      });

      expect(repository.lockAssignment).toHaveBeenCalledWith(
        transaction,
        companyId,
        assignmentId,
      );

      expect(repository.releaseAssignment).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          companyId,
          assignmentId,
          releasedById: userId,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason: 'Equipo ya no requerido',
        }),
      );

      expect(repository.findAssignment).toHaveBeenCalledWith(
        companyId,
        assignmentId,
        transaction,
      );

      expect(result.id).toBe(assignmentId);
      expect(result.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.RELEASED,
      );
      expect(result.release).toMatchObject({
        cause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        reason: 'Equipo ya no requerido',
      });
    });

    it('rejects release when the assignment does not exist in the tenant', async () => {
      repository.lockAssignment.mockResolvedValue(null);

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
        },
      });

      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects release when the assignment is already RELEASED', async () => {
      repository.lockAssignment.mockResolvedValue({
        id: assignmentId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED',
        },
      });

      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects release when the assignment is already REPLACED', async () => {
      repository.lockAssignment.mockResolvedValue({
        id: assignmentId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED',
        },
      });

      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects an empty release reason before starting a transaction', async () => {
      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: '   ',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_RELEASE_REASON_REQUIRED',
        },
      });

      expect(repository.runInTransaction).not.toHaveBeenCalled();
      expect(repository.lockAssignment).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects release when the guarded lifecycle update affects no row', async () => {
      repository.releaseAssignment.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'RESOURCE_STATE_CHANGED',
        },
      });

      expect(repository.findAssignment).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('lists RESERVED by default with canonical pagination and response shaping', async () => {
      await expect(service.findAll(companyId, {} as never)).resolves.toEqual({
        items: [
          expect.objectContaining({
            id: assignmentId,
            status: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            assignedAt: createdAt,
            availability: {
              fullyVerifiable: true,
              conflictFree: true,
              warnings: [],
            },
          }),
        ],
        pagination: {
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
        },
      });

      expect(repository.countAssignments).toHaveBeenCalledWith(companyId, {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      });
      expect(repository.findAssignments).toHaveBeenCalledWith(
        companyId,
        { lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED },
        1,
        25,
      );
      const item = (await service.findAll(companyId, {} as never)).items[0];
      expect(item).not.toHaveProperty('companyId');
      expect(item).not.toHaveProperty('createdById');
      expect(item).not.toHaveProperty('lifecycle');
      expect(item).not.toHaveProperty('directAssignmentReason');
    });

    it('validates and combines every relation/status/origin filter', async () => {
      const query = {
        caseId,
        requirementId,
        equipmentAssetId,
        status: HealthcareEquipmentAssignmentListStatus.ALL,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        page: 2,
        pageSize: 50,
      };

      await service.findAll(companyId, query);

      expect(repository.findCase).toHaveBeenCalledWith(companyId, caseId);
      expect(repository.findRequirement).toHaveBeenCalledWith(
        companyId,
        requirementId,
      );
      expect(repository.findEquipmentAsset).toHaveBeenCalledWith(
        companyId,
        equipmentAssetId,
      );
      expect(repository.findAssignments).toHaveBeenCalledWith(
        companyId,
        { caseId, requirementId, equipmentAssetId, origin: 'REQUIREMENT' },
        2,
        50,
      );
    });

    it.each([
      ['caseId', 'CASE_NOT_FOUND', 'findCase'],
      ['requirementId', 'REQUIREMENT_NOT_FOUND', 'findRequirement'],
      ['equipmentAssetId', 'EQUIPMENT_ASSET_NOT_FOUND', 'findEquipmentAsset'],
    ] as const)(
      'returns tenant-safe 404 for a missing/foreign %s filter',
      async (field, code, method) => {
        repository[method].mockResolvedValueOnce(null);

        await expect(
          service.findAll(otherCompanyId, {
            [field]:
              field === 'caseId'
                ? caseId
                : field === 'requirementId'
                  ? requirementId
                  : equipmentAssetId,
          } as never),
        ).rejects.toMatchObject({ response: { code } });
        expect(repository.findAssignments).not.toHaveBeenCalled();
      },
    );

    it('rejects valid same-tenant incompatible relation filters', async () => {
      repository.findRequirement.mockResolvedValueOnce({
        ...requirement,
        caseId: otherCaseId,
      });

      await expect(
        service.findAll(companyId, { caseId, requirementId } as never),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_REQUIREMENT_CASE_MISMATCH' },
      });
    });

    it('returns tenant-safe Assignment detail and historical lifecycle fields', async () => {
      const releasedAt = new Date('2026-09-17T15:00:00.000Z');
      repository.findAssignment.mockResolvedValueOnce({
        ...baseRecord,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedBy: baseRecord.createdBy,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Cambio operativo',
      });

      await expect(service.findOne(companyId, assignmentId)).resolves.toEqual(
        expect.objectContaining({
          status: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          availability: null,
          release: {
            cause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
            reason: 'Cambio operativo',
            releasedAt,
            releasedBy: baseRecord.createdBy,
          },
        }),
      );
      expect(repository.findAssignment).toHaveBeenCalledWith(
        companyId,
        assignmentId,
      );
    });

    it('returns EQUIPMENT_ASSIGNMENT_NOT_FOUND without global lookup', async () => {
      repository.findAssignment.mockResolvedValueOnce(null);

      await expect(
        service.findOne(otherCompanyId, assignmentId),
      ).rejects.toMatchObject({
        response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND' },
      });
      expect(repository.findAssignment).toHaveBeenCalledWith(
        otherCompanyId,
        assignmentId,
      );
    });

    it('derives current conflict availability and recognizes only matching override snapshots', async () => {
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);
      repository.findAssignment.mockResolvedValue({
        ...baseRecord,
        conflictOverrides: [
          {
            conflictingAssignmentId,
            assignmentWindowStart: new Date('2026-09-16T13:00:00.000Z'),
            assignmentWindowEnd: new Date('2026-09-16T20:00:00.000Z'),
            conflictingWindowStart: new Date('2026-09-16T14:00:00.000Z'),
            conflictingWindowEnd: new Date('2026-09-16T21:00:00.000Z'),
            createdAt,
            reason: 'Riesgo controlado',
            approvedBy: baseRecord.createdBy,
          },
        ],
      });

      await expect(service.findOne(companyId, assignmentId)).resolves.toEqual(
        expect.objectContaining({
          availability: {
            fullyVerifiable: true,
            conflictFree: false,
            warnings: [
              expect.objectContaining({ code: 'CURRENT_ASSIGNMENT_CONFLICT' }),
              expect.objectContaining({ code: 'CONFLICT_OVERRIDE_CONFIRMED' }),
            ],
          },
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a REQUIREMENT Assignment and commits its idempotency claim atomically', async () => {
      const result = await service.create(
        companyId,
        userId,
        'requirement-key',
        requirementDto,
      );

      expect(result.outcome).toBe('CREATED');

      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }

      expect(result.data).toMatchObject({
        id: assignmentId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      });

      expect(repository.createIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        companyId,
        'requirement-key',
        'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE',
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      );
      expect(repository.findRequirement).toHaveBeenCalledWith(
        companyId,
        requirementId,
        transaction,
      );
      expect(repository.createAssignment).toHaveBeenCalledWith(transaction, {
        companyId,
        caseId,
        equipmentAssetId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        directAssignmentReason: null,
        createdById: userId,
      });
      expect(repository.completeIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        'claim-1',
        assignmentId,
      );
    });

    it('creates a normalized DIRECT Assignment without touching Requirement coverage', async () => {
      repository.createAssignment.mockResolvedValueOnce({
        ...baseRecord,
        requirementId: null,
        origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        directAssignmentReason: 'Respaldo urgente',
      });

      const result = await service.create(
        companyId,
        userId,
        'direct-key',
        directDto,
      );

      expect(result.outcome).toBe('CREATED');

      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }

      expect(result.data).toMatchObject({
        requirementId: null,
        origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        directAssignmentReason: 'Respaldo urgente',
      });

      expect(repository.findRequirement).not.toHaveBeenCalled();
      expect(repository.countRequirementCoverage).not.toHaveBeenCalled();
      expect(repository.createAssignment).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          requirementId: null,
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
          directAssignmentReason: 'Respaldo urgente',
        }),
      );
    });

    it.each([
      [{ caseId, equipmentAssetId }],
      [{ caseId, equipmentAssetId, directAssignmentReason: '   ' }],
      [
        {
          caseId,
          equipmentAssetId,
          requirementId,
          directAssignmentReason: 'No permitido',
        },
      ],
    ])(
      'rejects inconsistent origin payload %# before any write',
      async (dto) => {
        await expect(
          service.create(companyId, userId, 'invalid-origin-key', dto),
        ).rejects.toMatchObject({
          response: { code: 'INVALID_ASSIGNMENT_ORIGIN' },
        });
        expect(repository.runInTransaction).not.toHaveBeenCalled();
      },
    );

    it('rejects a CANCELLED Case before Equipment lookup or write', async () => {
      repository.findCase.mockResolvedValueOnce({
        ...completeCase,
        status: HealthcareCaseStatus.CANCELLED,
      });

      await expect(
        service.create(companyId, userId, 'cancelled-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'CASE_EQUIPMENT_ASSIGNMENTS_READ_ONLY' },
      });
      expect(repository.findEquipmentAsset).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
    });

    it.each([
      ['findCase', 'CASE_NOT_FOUND'],
      ['findRequirement', 'REQUIREMENT_NOT_FOUND'],
      ['findEquipmentAsset', 'EQUIPMENT_ASSET_NOT_FOUND'],
    ] as const)(
      'returns tenant-safe 404 when %s cannot resolve inside Company',
      async (method, code) => {
        repository[method].mockResolvedValueOnce(null);

        await expect(
          service.create(companyId, userId, `${method}-key`, requirementDto),
        ).rejects.toMatchObject({ response: { code } });
        expect(repository.createAssignment).not.toHaveBeenCalled();
      },
    );

    it('rejects a Requirement owned by another same-tenant Case', async () => {
      repository.findRequirement.mockResolvedValueOnce({
        ...requirement,
        caseId: otherCaseId,
      });

      await expect(
        service.create(companyId, userId, 'wrong-case-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_REQUIREMENT_CASE_MISMATCH' },
      });
    });

    it('rejects a retired Requirement', async () => {
      repository.findRequirement.mockResolvedValueOnce({
        ...requirement,
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
      });

      await expect(
        service.create(companyId, userId, 'retired-key', requirementDto),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_RETIRED' } });
    });

    it.each([
      [{ ...equipmentAsset, productId: otherCaseId }, requirement],
      [
        equipmentAsset,
        {
          ...requirement,
          product: { inventoryTracking: ProductInventoryTracking.QUANTITY },
        },
      ],
    ])('rejects Product/Equipment incompatibility %#', async (asset, need) => {
      repository.findEquipmentAsset.mockResolvedValueOnce(asset);
      repository.findRequirement.mockResolvedValueOnce(need);

      await expect(
        service.create(companyId, userId, 'product-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_PRODUCT_MISMATCH' },
      });
    });

    it.each([
      [EquipmentLifecycle.RETIRED, EquipmentCondition.GOOD],
      [EquipmentLifecycle.ACTIVE, EquipmentCondition.INSPECTION_PENDING],
      [EquipmentLifecycle.ACTIVE, EquipmentCondition.DAMAGED],
      [EquipmentLifecycle.ACTIVE, EquipmentCondition.OUT_OF_SERVICE],
    ])(
      'rejects ineligible EquipmentAsset %s/%s',
      async (lifecycle, condition) => {
        repository.findEquipmentAsset.mockResolvedValueOnce({
          ...equipmentAsset,
          lifecycle,
          condition,
        });

        await expect(
          service.create(companyId, userId, 'ineligible-key', requirementDto),
        ).rejects.toMatchObject({
          response: { code: 'EQUIPMENT_ASSET_NOT_ELIGIBLE' },
        });
      },
    );

    it('prevents obvious sequential Requirement over-coverage', async () => {
      repository.countRequirementCoverage.mockResolvedValueOnce(2);

      await expect(
        service.create(companyId, userId, 'coverage-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'REQUIREMENT_OVER_COVERAGE' },
      });
      expect(repository.createAssignment).not.toHaveBeenCalled();
    });

    it('rejects an existing RESERVED same-Case EquipmentAsset', async () => {
      repository.findReservedAssignmentForCaseAsset.mockResolvedValueOnce({
        id: 'existing-assignment',
      });

      await expect(
        service.create(companyId, userId, 'duplicate-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_ALREADY_RESERVED' },
      });
    });

    it('prioritizes the exact duplicate error before over-coverage', async () => {
      repository.findRequirement.mockResolvedValueOnce({
        ...requirement,
        requestedQty: 1,
      });
      repository.findReservedAssignmentForCaseAsset.mockResolvedValueOnce({
        id: 'existing-assignment',
      });
      repository.countRequirementCoverage.mockResolvedValueOnce(1);

      await expect(
        service.create(
          companyId,
          userId,
          'duplicate-covered-key',
          requirementDto,
        ),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_ALREADY_RESERVED' },
      });
      expect(repository.countRequirementCoverage).not.toHaveBeenCalled();
    });

    it('allows incomplete schedule and returns the canonical warning', async () => {
      repository.findCase.mockResolvedValueOnce({
        ...completeCase,
        scheduledEnd: null,
      });
      repository.createAssignment.mockResolvedValueOnce({
        ...baseRecord,
        healthcareCase: {
          folio: completeCase.folio,
          scheduledStart: completeCase.scheduledStart,
          scheduledEnd: null,
          updatedAt,
        },
      });
      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([
        overlappingReservation,
        unresolvedReservation,
      ]);

      const result = await service.create(
        companyId,
        userId,
        'incomplete-key',
        requirementDto,
      );

      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }

      expect(result.data.availability).toEqual({
        fullyVerifiable: false,
        conflictFree: null,
        warnings: [
          {
            code: 'INCOMPLETE_CASE_SCHEDULE',
            message: 'La disponibilidad requiere revisar el horario del caso',
          },
        ],
      });
    });

    it('declares a complete fully evaluated schedule conflict-free', async () => {
      const result = await service.create(
        companyId,
        userId,
        'complete-key',
        requirementDto,
      );

      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }

      expect(result.data.availability).toEqual({
        fullyVerifiable: true,
        conflictFree: true,
        warnings: [],
      });
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
    });

    it('allows an unresolved related reservation without fabricating a conflict or override', async () => {
      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([
        unresolvedReservation,
      ]);

      const result = await service.create(
        companyId,
        userId,
        'unresolved-key',
        requirementDto,
      );

      expect(result.outcome).toBe('CREATED');
      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }
      expect(result.data.availability).toEqual({
        fullyVerifiable: false,
        conflictFree: null,
        warnings: [
          {
            code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
            message:
              'Existe una reserva activa del mismo equipo con horario incompleto; la disponibilidad no puede verificarse completamente.',
          },
        ],
      });
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
    });

    it('returns a zero-write 200 review for a confirmed overlap', async () => {
      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([
        overlappingReservation,
      ]);

      const result = await service.create(
        companyId,
        userId,
        'review-key',
        requirementDto,
      );

      expect(result).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        overrideRequired: true,
        conflicts: [
          {
            assignmentId: conflictingAssignmentId,
            caseId: otherCaseId,
            caseFolio: 'HC-000002',
          },
        ],
        availability: {
          fullyVerifiable: true,
          conflictFree: false,
          warnings: [
            expect.objectContaining({ code: 'CURRENT_ASSIGNMENT_CONFLICT' }),
          ],
        },
      });
      expect(result).toHaveProperty(
        'conflictReviewFingerprint',
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      );
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('reports confirmed overlaps and unresolved reservations together without auditing uncertainty', async () => {
      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([
        unresolvedReservation,
        overlappingReservation,
      ]);

      const result = await service.create(
        companyId,
        userId,
        'mixed-review-key',
        requirementDto,
      );

      expect(result).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        conflicts: [{ assignmentId: conflictingAssignmentId }],
        unresolvedReservations: [
          {
            assignmentId: unresolvedReservation.id,
            caseId: unresolvedReservation.caseId,
          },
        ],
        availability: {
          fullyVerifiable: false,
          conflictFree: false,
          warnings: [
            expect.objectContaining({ code: 'CURRENT_ASSIGNMENT_CONFLICT' }),
            expect.objectContaining({
              code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
            }),
          ],
        },
      });
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
    });

    it('returns every confirmed overlap in deterministic assignment order', async () => {
      const secondConflict = {
        ...overlappingReservation,
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        caseId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        healthcareCase: {
          ...overlappingReservation.healthcareCase,
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          folio: 'HC-000004',
        },
      };
      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([
        overlappingReservation,
        secondConflict,
      ]);

      const result = await service.create(
        companyId,
        userId,
        'multiple-conflicts-key',
        requirementDto,
      );

      expect(result).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        conflicts: [
          { assignmentId: conflictingAssignmentId },
          { assignmentId: secondConflict.id },
        ],
      });
    });

    it('returns a fresh zero-write review when a confirmation fingerprint is stale', async () => {
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);
      const initial = await service.create(
        companyId,
        userId,
        'stale-review-key',
        requirementDto,
      );
      if (initial.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected CONFLICT_REVIEW_REQUIRED');
      }

      repository.findCase.mockResolvedValue({
        ...completeCase,
        scheduledStart: new Date('2026-09-16T15:30:00.000Z'),
        updatedAt: new Date('2026-09-15T15:06:00.000Z'),
      });
      jest.clearAllMocks();
      repository.findIdempotencyRecord.mockResolvedValue(null);
      repository.lockEquipmentAsset.mockResolvedValue(true);
      repository.lockRequirement.mockResolvedValue(true);
      repository.findCase.mockResolvedValue({
        ...completeCase,
        scheduledStart: new Date('2026-09-16T15:30:00.000Z'),
        updatedAt: new Date('2026-09-15T15:06:00.000Z'),
      });
      repository.findEquipmentAsset.mockResolvedValue(equipmentAsset);
      repository.findRequirement.mockResolvedValue(requirement);
      repository.findReservedAssignmentForCaseAsset.mockResolvedValue(null);
      repository.countRequirementCoverage.mockResolvedValue(0);
      repository.findSettings.mockResolvedValue(null);
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);

      const refreshed = await service.create(
        companyId,
        userId,
        'stale-review-key',
        {
          ...requirementDto,
          confirmConflictOverride: true,
          conflictReviewFingerprint: initial.conflictReviewFingerprint,
          conflictOverrideReason: 'Riesgo controlado',
        },
      );

      expect(refreshed).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        overrideRequired: true,
      });
      expect(refreshed).not.toHaveProperty(
        'conflictReviewFingerprint',
        initial.conflictReviewFingerprint,
      );
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
    });

    it('returns a fresh no-override review when the reviewed conflict disappears', async () => {
      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([
        overlappingReservation,
      ]);
      const initial = await service.create(
        companyId,
        userId,
        'disappeared-review-key',
        requirementDto,
      );
      if (initial.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected CONFLICT_REVIEW_REQUIRED');
      }

      repository.findReservedAssignmentsForAsset.mockResolvedValueOnce([]);
      const refreshed = await service.create(
        companyId,
        userId,
        'disappeared-review-key',
        {
          ...requirementDto,
          confirmConflictOverride: true,
          conflictReviewFingerprint: initial.conflictReviewFingerprint,
          conflictOverrideReason: 'Riesgo controlado',
        },
      );

      expect(refreshed).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        overrideRequired: false,
        conflicts: [],
        availability: {
          fullyVerifiable: true,
          conflictFree: true,
          warnings: [],
        },
      });
      expect(repository.createAssignment).not.toHaveBeenCalled();
    });

    it('persists Assignment, every confirmed override and idempotency completion atomically', async () => {
      const override = {
        conflictingAssignmentId,
        assignmentWindowStart: new Date('2026-09-16T13:00:00.000Z'),
        assignmentWindowEnd: new Date('2026-09-16T20:00:00.000Z'),
        conflictingWindowStart: new Date('2026-09-16T14:00:00.000Z'),
        conflictingWindowEnd: new Date('2026-09-16T21:00:00.000Z'),
        createdAt,
        reason: 'Riesgo controlado',
        approvedBy: baseRecord.createdBy,
      };
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);
      const initial = await service.create(
        companyId,
        userId,
        'override-key',
        requirementDto,
      );
      if (initial.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected CONFLICT_REVIEW_REQUIRED');
      }
      repository.findAssignment.mockResolvedValue({
        ...baseRecord,
        conflictOverrides: [override],
      });

      const result = await service.create(companyId, userId, 'override-key', {
        ...requirementDto,
        confirmConflictOverride: true,
        conflictReviewFingerprint: initial.conflictReviewFingerprint,
        conflictOverrideReason: '  Riesgo controlado  ',
      });

      expect(result).toMatchObject({
        outcome: 'CREATED',
        data: {
          conflictOverrides: [
            {
              conflictingAssignmentId,
              reason: 'Riesgo controlado',
            },
          ],
          availability: {
            fullyVerifiable: true,
            conflictFree: false,
            warnings: [
              expect.objectContaining({ code: 'CURRENT_ASSIGNMENT_CONFLICT' }),
              expect.objectContaining({ code: 'CONFLICT_OVERRIDE_CONFIRMED' }),
            ],
          },
        },
      });
      expect(repository.createConflictOverrides).toHaveBeenCalledWith(
        transaction,
        [
          expect.objectContaining({
            assignmentId,
            conflictingAssignmentId,
            reason: 'Riesgo controlado',
          }),
        ],
      );
      expect(repository.completeIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        'claim-1',
        assignmentId,
      );
    });

    it.each([
      [
        { conflictReviewFingerprint: 'a'.repeat(64) },
        'INVALID_CONFLICT_REVIEW_CONFIRMATION',
      ],
      [
        { confirmConflictOverride: true, conflictOverrideReason: 'Riesgo' },
        'INVALID_CONFLICT_REVIEW_CONFIRMATION',
      ],
      [
        {
          confirmConflictOverride: true,
          conflictReviewFingerprint: 'invalid',
          conflictOverrideReason: 'Riesgo',
        },
        'INVALID_CONFLICT_REVIEW_CONFIRMATION',
      ],
      [
        {
          confirmConflictOverride: true,
          conflictReviewFingerprint: 'a'.repeat(64),
          conflictOverrideReason: '   ',
        },
        'CONFLICT_OVERRIDE_REASON_REQUIRED',
      ],
    ])('rejects invalid conflict confirmation %#', async (review, code) => {
      await expect(
        service.create(companyId, userId, 'invalid-review-key', {
          ...requirementDto,
          ...review,
        }),
      ).rejects.toMatchObject({ response: { code } });
      expect(repository.runInTransaction).not.toHaveBeenCalled();
    });

    it('rejects confirmation when the candidate schedule cannot produce an authoritative review', async () => {
      repository.findCase.mockResolvedValue({
        ...completeCase,
        scheduledEnd: null,
      });

      await expect(
        service.create(companyId, userId, 'incomplete-confirmation-key', {
          ...requirementDto,
          confirmConflictOverride: true,
          conflictReviewFingerprint: 'a'.repeat(64),
          conflictOverrideReason: 'Riesgo controlado',
        }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CONFLICT_REVIEW_CONFIRMATION' },
      });
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
    });

    it('uses the canonical asset, Requirement, settings and sorted Case lock order', async () => {
      const calls: string[] = [];
      repository.lockEquipmentAsset.mockImplementation(() => {
        calls.push('asset');
        return Promise.resolve(true);
      });
      repository.lockRequirement.mockImplementation(() => {
        calls.push('requirement');
        return Promise.resolve(true);
      });
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
        { caseId },
      ]);
      repository.acquireSettingsSharedAdvisoryLock.mockImplementation(() => {
        calls.push('settings-advisory');
        return Promise.resolve();
      });
      repository.lockHealthcareCasesForShare.mockImplementation(
        (_transaction, _companyId, caseIds: string[]) => {
          calls.push(`cases:${caseIds.join(',')}`);
          return Promise.resolve(caseIds);
        },
      );
      repository.findSettingsForShare.mockImplementation(() => {
        calls.push('settings-row');
        return Promise.resolve(null);
      });
      repository.findCase.mockImplementation(() => {
        calls.push('authoritative-case');
        return Promise.resolve(completeCase);
      });

      await service.create(companyId, userId, 'lock-order-key', requirementDto);

      expect(calls).toEqual([
        'asset',
        'requirement',
        'settings-advisory',
        `cases:${caseId},${otherCaseId}`,
        'settings-row',
        'authoritative-case',
      ]);
    });

    it('replays a completed same-payload command under the protected transaction', async () => {
      repository.findIdempotencyRecord.mockResolvedValue({
        requestHash:
          createHealthcareEquipmentAssignmentRequestHash(requirementDto),
        resourceId: assignmentId,
      });

      const result = await service.create(
        companyId,
        userId,
        'replay-key',
        requirementDto,
      );

      expect(result.outcome).toBe('CREATED');

      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }
      expect(result.data).toMatchObject({ id: assignmentId });
      expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
      expect(repository.lockEquipmentAsset).toHaveBeenCalledWith(
        transaction,
        companyId,
        equipmentAssetId,
      );
      expect(repository.acquireSettingsSharedAdvisoryLock).toHaveBeenCalledWith(
        transaction,
        companyId,
      );
      expect(repository.lockHealthcareCasesForShare).toHaveBeenCalledWith(
        transaction,
        companyId,
        [caseId],
      );
      expect(repository.findAssignment).toHaveBeenCalledWith(
        companyId,
        assignmentId,
        transaction,
      );
    });

    it('rejects reuse of the same key with a different payload', async () => {
      repository.findIdempotencyRecord.mockResolvedValueOnce({
        requestHash: 'different-request-hash',
        resourceId: assignmentId,
      });

      await expect(
        service.create(companyId, userId, 'reused-key', requirementDto),
      ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
      expect(repository.runInTransaction).not.toHaveBeenCalled();
    });

    it('recovers a concurrent idempotency claim as a replay', async () => {
      const requestHash =
        createHealthcareEquipmentAssignmentRequestHash(requirementDto);
      repository.findIdempotencyRecord
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ requestHash, resourceId: assignmentId });
      repository.runInTransaction.mockRejectedValueOnce(
        knownPrismaError('P2002', 'IdempotencyRecord_companyId_scope_key_key'),
      );

      const result = await service.create(
        companyId,
        userId,
        'race-key',
        requirementDto,
      );

      expect(result.outcome).toBe('CREATED');
      if (result.outcome !== 'CREATED') {
        throw new Error('Expected CREATED');
      }
      expect(result.data).toMatchObject({ id: assignmentId });
    });

    it('maps the C1 partial unique violation to ASSIGNMENT_ALREADY_RESERVED', async () => {
      repository.runInTransaction.mockRejectedValueOnce(
        knownPrismaError(
          'P2002',
          'HealthcareEquipmentAssignment_reserved_case_asset_key',
        ),
      );

      await expect(
        service.create(companyId, userId, 'unique-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_ALREADY_RESERVED' },
      });
    });

    it('maps related-resource and unclassified persistence failures safely', async () => {
      repository.runInTransaction.mockRejectedValueOnce(
        knownPrismaError('P2003'),
      );
      await expect(
        service.create(companyId, userId, 'fk-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'RELATED_RESOURCE_CHANGED' },
      });

      repository.runInTransaction.mockRejectedValueOnce(
        knownPrismaError('P2025'),
      );
      await expect(
        service.create(companyId, userId, 'persistence-key', requirementDto),
      ).rejects.toMatchObject({
        response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
      });
    });
  });
});
