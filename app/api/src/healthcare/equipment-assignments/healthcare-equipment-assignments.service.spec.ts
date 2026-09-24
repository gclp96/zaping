import 'reflect-metadata';

import { HttpException } from '@nestjs/common';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
  HealthcareRequirementLifecycle,
  IdempotencyScope,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { HealthcareCompanyLockTimeoutError } from '../common/healthcare-company-lock-timeout.error';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../common/healthcare-company-transaction-timeout-policy';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import { HealthcareEquipmentAssignmentListStatus } from './dto/healthcare-equipment-assignment-list-query.dto';
import { createHealthcareEquipmentAssignmentReleaseRequestHash } from './healthcare-equipment-assignment-release-request-hash';
import { createHealthcareEquipmentAssignmentReplaceRequestHash } from './healthcare-equipment-assignment-replace-request-hash';
import { createHealthcareEquipmentAssignmentRequestHash } from './healthcare-equipment-assignment-request-hash';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';

jest.mock('../common/healthcare-company-lock');
jest.mock('../common/healthcare-subsequent-transaction-timeouts');

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const caseId = '44444444-4444-4444-8444-444444444444';
const otherCaseId = '55555555-5555-4555-8555-555555555555';
const requirementId = '66666666-6666-4666-8666-666666666666';
const equipmentAssetId = '77777777-7777-4777-8777-777777777777';
const replacementEquipmentAssetId = '12121212-1212-4212-8212-121212121212';
const productId = '88888888-8888-4888-8888-888888888888';
const assignmentId = '99999999-9999-4999-8999-999999999999';
const transactionTimeoutPolicy = {
  companyLockAcquisitionTimeoutMs: 2_500,
  subsequentLockTimeoutMs: 1_500,
  subsequentStatementTimeoutMs: 4_000,
  prismaMaxWaitMs: 3_000,
  prismaTransactionTimeoutMs: 20_000,
} satisfies HealthcareCompanyTransactionTimeoutPolicy;
const conflictingAssignmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const replacementAssignmentId = '13131313-1313-4313-8313-131313131313';
const replacedAt = new Date('2026-09-18T18:00:00.000Z');
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
const replacementEquipmentAsset = {
  ...equipmentAsset,
  id: replacementEquipmentAssetId,
  assetCode: 'EQ-000002',
  serialNumber: 'SN-002',
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
const replacementSourceSnapshot = {
  id: assignmentId,
  companyId,
  caseId,
  equipmentAssetId,
  requirementId,
  origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
  lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
  directAssignmentReason: null,
  updatedAt,
};
const replacementRecord = {
  ...baseRecord,
  id: replacementAssignmentId,
  replacesAssignmentId: assignmentId,
  equipmentAsset: {
    ...baseRecord.equipmentAsset,
    id: replacementEquipmentAssetId,
    assetCode: 'EQ-000002',
    serialNumber: 'SN-002',
  },
  createdAt: replacedAt,
  updatedAt: replacedAt,
};

const replacedRecord = {
  ...baseRecord,
  lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
  replacedAt,
  replacementReason: 'Equipo original no disponible',
  replacedBy: {
    id: userId,
    firstName: 'Ana',
    lastName: 'Pérez',
  },
  replacementAssignments: [
    {
      id: replacementAssignmentId,
    },
  ],
  updatedAt: replacedAt,
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

const replaceDto = {
  equipmentAssetId: replacementEquipmentAssetId,
  replacementReason: 'Equipo original no disponible',
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

function knownPrismaRawQueryError(sqlState: string) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code: 'P2010',
    clientVersion: '6.19.3',
    meta: { code: sqlState },
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
    lockReservedRequirementAssignments: jest.fn(),
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
    findAssignmentReleaseSource: jest.fn(),
    countAssignments: jest.fn(),
    findAssignments: jest.fn(),
    findAssignmentReplacementSource: jest.fn(),
    replaceAssignment: jest.fn(),
  };
  let service: HealthcareEquipmentAssignmentsService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(acquireHealthcareCompanyLock).mockResolvedValue(undefined);
    jest
      .mocked(applyHealthcareSubsequentTransactionTimeouts)
      .mockResolvedValue(undefined);
    repository.runInTransaction.mockImplementation(
      (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );

    repository.replaceAssignment.mockResolvedValue({
      count: 1,
    });

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
    repository.lockReservedRequirementAssignments.mockResolvedValue([]);

    repository.findAssignmentReplacementSource.mockResolvedValue(
      replacementSourceSnapshot,
    );
    repository.findAssignmentReleaseSource.mockResolvedValue({
      id: assignmentId,
      equipmentAssetId,
    });

    repository.findEquipmentAsset.mockImplementation(
      (_companyId: string, assetId: string) => {
        if (assetId === replacementEquipmentAssetId) {
          return Promise.resolve(replacementEquipmentAsset);
        }

        return Promise.resolve(equipmentAsset);
      },
    );

    repository.lockAssignment.mockResolvedValue({
      id: assignmentId,
      companyId,
      caseId,
      equipmentAssetId,
      requirementId,
      origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      directAssignmentReason: null,
      releasedAt: null,
      releasedById: null,
      releaseCause: null,
      releaseReason: null,
      updatedAt,
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
    service = new HealthcareEquipmentAssignmentsService(
      repository as never,
      transactionTimeoutPolicy,
    );
  });

  describe('release', () => {
    it('uses the canonical Company, timeout, source Asset and Assignment lock order', async () => {
      const calls: string[] = [];
      repository.findAssignmentReleaseSource.mockImplementation(() => {
        calls.push('asset-discovery');
        return Promise.resolve({ id: assignmentId, equipmentAssetId });
      });
      jest.mocked(acquireHealthcareCompanyLock).mockImplementation(() => {
        calls.push('company');
        return Promise.resolve();
      });
      jest
        .mocked(applyHealthcareSubsequentTransactionTimeouts)
        .mockImplementation(() => {
          calls.push('subsequent-timeouts');
          return Promise.resolve();
        });
      repository.lockEquipmentAsset.mockImplementation(() => {
        calls.push('asset');
        return Promise.resolve(true);
      });
      repository.lockAssignment.mockImplementation(() => {
        calls.push('assignment');
        return Promise.resolve({
          ...replacementSourceSnapshot,
          releasedAt: null,
          releasedById: null,
          releaseCause: null,
          releaseReason: null,
        });
      });
      repository.releaseAssignment.mockImplementation(() => {
        calls.push('release');
        return Promise.resolve({ count: 1 });
      });
      repository.findAssignment.mockImplementation(() => {
        calls.push('response-reread');
        return Promise.resolve(releasedRecord);
      });

      await service.release(companyId, userId, assignmentId, {
        reason: '  Equipo ya no requerido  ',
      });

      expect(calls).toEqual([
        'asset-discovery',
        'company',
        'subsequent-timeouts',
        'asset',
        'assignment',
        'release',
        'response-reread',
      ]);
      expect(acquireHealthcareCompanyLock).toHaveBeenCalledWith(
        transaction,
        companyId,
        {
          acquisitionTimeoutMs:
            transactionTimeoutPolicy.companyLockAcquisitionTimeoutMs,
        },
      );
      expect(applyHealthcareSubsequentTransactionTimeouts).toHaveBeenCalledWith(
        transaction,
        transactionTimeoutPolicy,
      );
      expect(repository.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          maxWait: transactionTimeoutPolicy.prismaMaxWaitMs,
          timeout: transactionTimeoutPolicy.prismaTransactionTimeoutMs,
        },
      );
    });

    it('releases a RESERVED assignment with MANUAL cause and no optional key', async () => {
      repository.findAssignment.mockResolvedValue(releasedRecord);

      const result = await service.release(companyId, userId, assignmentId, {
        reason: '  Equipo ya no requerido  ',
      });

      expect(repository.lockAssignment).toHaveBeenCalledWith(
        transaction,
        companyId,
        assignmentId,
      );
      expect(repository.lockEquipmentAsset).toHaveBeenCalledWith(
        transaction,
        companyId,
        equipmentAssetId,
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
      expect(repository.findIdempotencyRecord).not.toHaveBeenCalled();
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();

      expect(result.id).toBe(assignmentId);
      expect(result.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.RELEASED,
      );
      expect(result.release).toMatchObject({
        cause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        reason: 'Equipo ya no requerido',
      });
    });

    it('persists the optional claim, MANUAL release and completion in one transaction', async () => {
      repository.findAssignment.mockResolvedValue(releasedRecord);
      const requestHash = createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Equipo ya no requerido',
      );

      await service.release(
        companyId,
        userId,
        assignmentId,
        { reason: '  Equipo ya no requerido  ' },
        'release-key',
      );

      expect(repository.findIdempotencyRecord).toHaveBeenCalledWith(
        companyId,
        'release-key',
        IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
        transaction,
      );
      expect(repository.createIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        companyId,
        'release-key',
        IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
        requestHash,
      );
      expect(repository.completeIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        'claim-1',
        assignmentId,
      );
    });

    it('rejects release when Asset discovery cannot find the Assignment in the tenant', async () => {
      repository.findAssignmentReleaseSource.mockResolvedValue(null);

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
        },
      });

      expect(repository.runInTransaction).not.toHaveBeenCalled();
      expect(repository.lockEquipmentAsset).not.toHaveBeenCalled();
      expect(repository.lockAssignment).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects release when the Assignment disappears after discovery', async () => {
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

    it('rejects a changed Assignment-to-discovered-Asset relationship without writes', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        equipmentAssetId: replacementEquipmentAssetId,
        releasedAt: null,
        releasedById: null,
        releaseCause: null,
        releaseReason: null,
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

      expect(repository.findIdempotencyRecord).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects release when the discovered source Asset cannot be locked', async () => {
      repository.lockEquipmentAsset.mockResolvedValue(false);

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: { code: 'EQUIPMENT_ASSET_NOT_FOUND' },
      });

      expect(repository.lockAssignment).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('returns the original response for a same-reason MANUAL state replay by another actor', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Equipo ya no requerido',
      });
      repository.findAssignment.mockResolvedValue(releasedRecord);

      const result = await service.release(
        companyId,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        assignmentId,
        { reason: '  Equipo ya no requerido  ' },
      );

      expect(result).toMatchObject({
        id: assignmentId,
        status: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        release: {
          cause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          reason: 'Equipo ya no requerido',
          releasedAt,
          releasedBy: releasedRecord.releasedBy,
        },
      });
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('does not consume a new key for a same-reason MANUAL state replay', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Equipo ya no requerido',
      });
      repository.findAssignment.mockResolvedValue(releasedRecord);

      await service.release(
        companyId,
        userId,
        assignmentId,
        { reason: 'Equipo ya no requerido' },
        'new-state-replay-key',
      );

      expect(repository.findIdempotencyRecord).toHaveBeenCalled();
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects a different reason after MANUAL release without overwriting audit', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Equipo ya no requerido',
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Cambio operativo',
        }),
      ).rejects.toMatchObject({
        response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' },
      });

      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it.each([
      HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
      HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
    ])('rejects an Assignment automatically released by %s', async (cause) => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: cause,
        releaseReason: null,
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' },
      });

      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects an already REPLACED Assignment', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
        releasedAt: null,
        releasedById: null,
        releaseCause: null,
        releaseReason: null,
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' },
      });

      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('rejects an already RELEASED Assignment without matching MANUAL audit metadata', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt: null,
        releasedById: null,
        releaseCause: null,
        releaseReason: null,
      });

      await expect(
        service.release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' },
      });

      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('returns a completed same-key/same-payload replay before state rejection', async () => {
      const requestHash = createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Equipo ya no requerido',
      );
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Equipo ya no requerido',
      });
      repository.findIdempotencyRecord.mockResolvedValue({
        requestHash,
        resourceId: assignmentId,
      });
      repository.findAssignment.mockResolvedValue(releasedRecord);

      const result = await service.release(
        companyId,
        userId,
        assignmentId,
        { reason: 'Equipo ya no requerido' },
        'completed-release-key',
      );

      expect(result).toMatchObject({
        id: assignmentId,
        status: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        release: {
          cause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          reason: 'Equipo ya no requerido',
          releasedAt,
          releasedBy: releasedRecord.releasedBy,
        },
      });
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('checks a claimed key for payload mismatch before same-reason state replay', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt,
        releasedById: userId,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Equipo ya no requerido',
      });
      repository.findIdempotencyRecord.mockResolvedValue({
        requestHash: 'different-request-hash',
        resourceId: assignmentId,
      });

      await expect(
        service.release(
          companyId,
          userId,
          assignmentId,
          { reason: 'Equipo ya no requerido' },
          'reused-release-key',
        ),
      ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });

      expect(repository.findAssignment).not.toHaveBeenCalled();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('recovers a concurrent optional claim collision as a completed replay', async () => {
      const requestHash = createHealthcareEquipmentAssignmentReleaseRequestHash(
        assignmentId,
        'Equipo ya no requerido',
      );
      repository.runInTransaction.mockRejectedValueOnce(
        knownPrismaError('P2002', 'IdempotencyRecord_companyId_scope_key_key'),
      );
      repository.findIdempotencyRecord.mockResolvedValue({
        requestHash,
        resourceId: assignmentId,
      });
      repository.findAssignment.mockResolvedValue(releasedRecord);

      const result = await service.release(
        companyId,
        userId,
        assignmentId,
        { reason: 'Equipo ya no requerido' },
        'concurrent-release-key',
      );

      expect(result).toMatchObject({ id: assignmentId, status: 'RELEASED' });
      expect(repository.findIdempotencyRecord).toHaveBeenCalledWith(
        companyId,
        'concurrent-release-key',
        IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
      );
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
      expect(repository.findAssignmentReleaseSource).not.toHaveBeenCalled();
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

    it('propagates claim-completion failure from the transaction boundary', async () => {
      repository.findAssignment.mockResolvedValue(releasedRecord);
      repository.completeIdempotencyClaim.mockRejectedValueOnce(
        new Error('forced release completion failure'),
      );

      await expect(
        service.release(
          companyId,
          userId,
          assignmentId,
          { reason: 'Equipo ya no requerido' },
          'failing-release-key',
        ),
      ).rejects.toThrow('forced release completion failure');

      expect(repository.createIdempotencyClaim).toHaveBeenCalled();
      expect(repository.releaseAssignment).toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).toHaveBeenCalled();
    });

    it('maps only the dedicated Company-lock acquisition timeout to sanitized HTTP 503', async () => {
      repository.runInTransaction.mockRejectedValueOnce(
        new HealthcareCompanyLockTimeoutError(new Error('internal cause')),
      );

      const error = await service
        .release(companyId, userId, assignmentId, {
          reason: 'Equipo ya no requerido',
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(503);
      expect((error as HttpException).getResponse()).toMatchObject({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'HEALTHCARE_CONCURRENCY_TIMEOUT',
      });
      expect(
        JSON.stringify((error as HttpException).getResponse()),
      ).not.toContain('internal cause');
    });

    it.each([
      ['subsequent lock timeout', knownPrismaRawQueryError('55P03')],
      ['subsequent statement timeout', knownPrismaRawQueryError('57014')],
      ['deadlock', knownPrismaRawQueryError('40P01')],
      ['Prisma transaction error', knownPrismaError('P2028')],
    ])(
      'does not remap a Release %s as a Company-lock timeout',
      async (_name, error) => {
        repository.runInTransaction.mockRejectedValueOnce(error);

        await expect(
          service.release(companyId, userId, assignmentId, {
            reason: 'Equipo ya no requerido',
          }),
        ).rejects.toMatchObject({
          status: 500,
          response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
        });
      },
    );
  });

  describe('Requirement Retire derived release', () => {
    it('delegates the tenant-scoped deterministic lock to the repository', async () => {
      repository.lockReservedRequirementAssignments.mockResolvedValue([
        'assignment-a',
      ]);

      await expect(
        service.lockReservedRequirementAssignments(transaction as never, {
          companyId,
          caseId,
          requirementId,
        }),
      ).resolves.toEqual(['assignment-a']);
      expect(
        repository.lockReservedRequirementAssignments,
      ).toHaveBeenCalledWith(transaction, {
        companyId,
        caseId,
        requirementId,
      });
    });

    it('accepts zero eligible Assignments without writes', async () => {
      await expect(
        service.releaseLockedRequirementAssignments(transaction as never, {
          companyId,
          caseId,
          requirementId,
          assignmentIds: [],
          releasedAt,
          releasedById: userId,
          releaseReason: 'Cambio clínico',
        }),
      ).resolves.toBeUndefined();
      expect(repository.releaseAssignment).not.toHaveBeenCalled();
    });

    it('releases one eligible Assignment with the parent audit', async () => {
      await service.releaseLockedRequirementAssignments(transaction as never, {
        companyId,
        caseId,
        requirementId,
        assignmentIds: [assignmentId],
        releasedAt,
        releasedById: userId,
        releaseReason: 'Cambio clínico',
      });

      expect(repository.releaseAssignment).toHaveBeenCalledTimes(1);
      expect(repository.releaseAssignment).toHaveBeenCalledWith(transaction, {
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
    });

    it('releases unique locked Assignments in ID order with shared audit', async () => {
      repository.releaseAssignment.mockResolvedValue({ count: 1 });

      await service.releaseLockedRequirementAssignments(transaction as never, {
        companyId,
        caseId,
        requirementId,
        assignmentIds: ['assignment-b', 'assignment-a', 'assignment-b'],
        releasedAt,
        releasedById: userId,
        releaseReason: 'Cambio clínico',
      });

      expect(repository.releaseAssignment.mock.calls).toEqual([
        [
          transaction,
          {
            companyId,
            assignmentId: 'assignment-a',
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
          },
        ],
        [
          transaction,
          {
            companyId,
            assignmentId: 'assignment-b',
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
          },
        ],
      ]);
    });

    it('returns RESOURCE_STATE_CHANGED and stops after a conditional miss', async () => {
      repository.releaseAssignment
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await expect(
        service.releaseLockedRequirementAssignments(transaction as never, {
          companyId,
          caseId,
          requirementId,
          assignmentIds: ['assignment-a', 'assignment-b'],
          releasedAt,
          releasedById: userId,
          releaseReason: 'Cambio clínico',
        }),
      ).rejects.toMatchObject({
        response: { code: 'RESOURCE_STATE_CHANGED' },
      });
      expect(repository.releaseAssignment).toHaveBeenCalledTimes(1);
    });
  });

  describe('replace', () => {
    it('replaces a RESERVED Assignment without increasing Requirement coverage', async () => {
      repository.countRequirementCoverage.mockResolvedValue(
        requirement.requestedQty,
      );

      repository.createAssignment.mockResolvedValue(replacementRecord);

      repository.findAssignment
        .mockResolvedValueOnce(replacedRecord)
        .mockResolvedValueOnce(replacementRecord);

      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-1',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: '  Equipo original no disponible  ',
        },
      );

      expect(repository.findAssignmentReplacementSource).toHaveBeenCalledWith(
        companyId,
        assignmentId,
      );

      expect(repository.countRequirementCoverage).toHaveBeenCalledWith(
        companyId,
        requirementId,
        transaction,
      );

      expect(repository.findReservedAssignmentsForAsset).toHaveBeenCalledWith(
        companyId,
        replacementEquipmentAssetId,
        assignmentId,
        transaction,
      );

      expect(repository.createAssignment).toHaveBeenCalledWith(transaction, {
        companyId,
        caseId,
        equipmentAssetId: replacementEquipmentAssetId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        directAssignmentReason: null,
        createdById: userId,
        replacesAssignmentId: assignmentId,
      });

      expect(repository.createIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        companyId,
        'replace-key-1',
        IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
        createHealthcareEquipmentAssignmentReplaceRequestHash(assignmentId, {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: '  Equipo original no disponible  ',
        }),
      );

      expect(repository.completeIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        'claim-1',
        replacementAssignmentId,
      );

      expect(result.outcome).toBe('REPLACED');

      if (result.outcome !== 'REPLACED') {
        throw new Error('Expected REPLACED outcome');
      }

      expect(result.data.replacedAssignment.id).toBe(assignmentId);
      expect(result.data.replacedAssignment.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.REPLACED,
      );

      expect(result.data.replacementAssignment.id).toBe(
        replacementAssignmentId,
      );

      expect(result.data.replacementAssignment.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.RESERVED,
      );

      expect(result.data.replacementAssignment.replacesAssignmentId).toBe(
        assignmentId,
      );
    });

    it('uses the canonical Company, timeout, destination Asset, Requirement, source Assignment, settings and Case lock order', async () => {
      const calls: string[] = [];
      jest.mocked(acquireHealthcareCompanyLock).mockImplementation(() => {
        calls.push('company');
        return Promise.resolve();
      });
      jest
        .mocked(applyHealthcareSubsequentTransactionTimeouts)
        .mockImplementation(() => {
          calls.push('subsequent-timeouts');
          return Promise.resolve();
        });
      repository.lockEquipmentAsset.mockImplementation(() => {
        calls.push('destination-asset');
        return Promise.resolve(true);
      });
      repository.lockRequirement.mockImplementation(() => {
        calls.push('requirement');
        return Promise.resolve(true);
      });
      repository.lockAssignment.mockImplementation(() => {
        calls.push('source-assignment');
        return Promise.resolve(replacementSourceSnapshot);
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
      repository.createAssignment.mockResolvedValue(replacementRecord);
      repository.findAssignment
        .mockResolvedValueOnce(replacedRecord)
        .mockResolvedValueOnce(replacementRecord);

      await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-lock-order-key',
        replaceDto,
      );

      expect(calls).toEqual([
        'company',
        'subsequent-timeouts',
        'destination-asset',
        'requirement',
        'source-assignment',
        'settings-advisory',
        `cases:${caseId},${otherCaseId}`,
        'settings-row',
        'authoritative-case',
      ]);
      expect(acquireHealthcareCompanyLock).toHaveBeenCalledWith(
        transaction,
        companyId,
        {
          acquisitionTimeoutMs:
            transactionTimeoutPolicy.companyLockAcquisitionTimeoutMs,
        },
      );
      expect(applyHealthcareSubsequentTransactionTimeouts).toHaveBeenCalledWith(
        transaction,
        transactionTimeoutPolicy,
      );
      expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
      expect(repository.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          maxWait: transactionTimeoutPolicy.prismaMaxWaitMs,
          timeout: transactionTimeoutPolicy.prismaTransactionTimeoutMs,
        },
      );
    });

    it('maps only the dedicated Company-lock acquisition timeout to the approved HTTP 503 contract', async () => {
      repository.runInTransaction.mockRejectedValueOnce(
        new HealthcareCompanyLockTimeoutError(new Error('internal cause')),
      );

      const result = service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-company-timeout-key',
        replaceDto,
      );
      const error = await result.catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(503);
      expect((error as HttpException).getResponse()).toMatchObject({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'HEALTHCARE_CONCURRENCY_TIMEOUT',
      });
      expect(
        JSON.stringify((error as HttpException).getResponse()),
      ).not.toContain('internal cause');
    });

    it.each([
      ['subsequent lock timeout', knownPrismaRawQueryError('55P03')],
      ['subsequent statement timeout', knownPrismaRawQueryError('57014')],
      ['deadlock', knownPrismaRawQueryError('40P01')],
      ['Prisma transaction error', knownPrismaError('P2028')],
    ])(
      'does not remap a Replace %s as a Company-lock timeout',
      async (_name, error) => {
        repository.runInTransaction.mockRejectedValueOnce(error);

        await expect(
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-other-timeout-key',
            replaceDto,
          ),
        ).rejects.toMatchObject({
          status: 500,
          response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
        });
      },
    );

    it('rejects an empty replacement reason before starting persistence work', async () => {
      await expect(
        service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-key-empty-reason',
          {
            equipmentAssetId: replacementEquipmentAssetId,
            replacementReason: '   ',
          },
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_REPLACEMENT_REASON_REQUIRED',
        },
      });

      expect(repository.findIdempotencyRecord).not.toHaveBeenCalled();
      expect(repository.findAssignmentReplacementSource).not.toHaveBeenCalled();
      expect(repository.runInTransaction).not.toHaveBeenCalled();
    });

    it('rejects replacement with the same EquipmentAsset', async () => {
      await expect(
        service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-key-same-asset',
          {
            equipmentAssetId,
            replacementReason: 'Reemplazo inválido',
          },
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_REPLACEMENT_SAME_ASSET',
        },
      });

      expect(repository.findAssignmentReplacementSource).toHaveBeenCalledWith(
        companyId,
        assignmentId,
      );

      expect(repository.runInTransaction).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
    });

    it('rejects replacement when the source Assignment does not exist in the tenant', async () => {
      repository.findAssignmentReplacementSource.mockResolvedValue(null);

      await expect(
        service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-key-not-found',
          {
            equipmentAssetId: replacementEquipmentAssetId,
            replacementReason: 'Equipo original no disponible',
          },
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
        },
      });

      expect(repository.findAssignmentReplacementSource).toHaveBeenCalledWith(
        companyId,
        assignmentId,
      );

      expect(repository.runInTransaction).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
    });

    it.each([
      HealthcareEquipmentAssignmentLifecycle.RELEASED,
      HealthcareEquipmentAssignmentLifecycle.REPLACED,
    ])(
      'rejects replacement when the source Assignment is %s',
      async (lifecycle) => {
        repository.findAssignmentReplacementSource.mockResolvedValue({
          ...replacementSourceSnapshot,
          lifecycle,
        });

        await expect(
          service.replace(
            companyId,
            userId,
            assignmentId,
            `replace-key-${lifecycle}`,
            {
              equipmentAssetId: replacementEquipmentAssetId,
              replacementReason: 'Equipo original no disponible',
            },
          ),
        ).rejects.toMatchObject({
          response: {
            code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED',
          },
        });

        expect(repository.runInTransaction).not.toHaveBeenCalled();
        expect(repository.createAssignment).not.toHaveBeenCalled();
        expect(repository.replaceAssignment).not.toHaveBeenCalled();
      },
    );

    it('rejects replacement when the source was released before acquiring its lock', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        updatedAt: new Date('2026-09-19T18:00:00.000Z'),
      });

      await expect(
        service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-key-concurrent-release',
          {
            equipmentAssetId: replacementEquipmentAssetId,
            replacementReason: 'Equipo original no disponible',
          },
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED',
        },
      });

      expect(repository.findAssignmentReplacementSource).toHaveBeenCalledWith(
        companyId,
        assignmentId,
      );

      expect(repository.lockAssignment).toHaveBeenCalledWith(
        transaction,
        companyId,
        assignmentId,
      );

      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
    });

    it('rejects replacement when the source snapshot changes before acquiring its lock', async () => {
      repository.lockAssignment.mockResolvedValue({
        ...replacementSourceSnapshot,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        updatedAt: new Date('2026-09-19T18:00:00.000Z'),
      });

      await expect(
        service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-key-source-changed',
          {
            equipmentAssetId: replacementEquipmentAssetId,
            replacementReason: 'Equipo original no disponible',
          },
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'RESOURCE_STATE_CHANGED',
        },
      });

      expect(repository.lockAssignment).toHaveBeenCalledWith(
        transaction,
        companyId,
        assignmentId,
      );

      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
    });

    it('rejects replacement when the guarded source transition affects no row', async () => {
      repository.createAssignment.mockResolvedValue(replacementRecord);

      repository.replaceAssignment.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-key-guarded-transition',
          {
            equipmentAssetId: replacementEquipmentAssetId,
            replacementReason: 'Equipo original no disponible',
          },
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'RESOURCE_STATE_CHANGED',
        },
      });

      expect(repository.replaceAssignment).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          companyId,
          assignmentId,
          replacedById: userId,
          replacementReason: 'Equipo original no disponible',
        }),
      );

      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('replaces with an unresolved related reservation without creating an override for uncertainty', async () => {
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: unresolvedReservation.caseId },
      ]);
      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        unresolvedReservation.caseId,
      ]);
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        unresolvedReservation,
      ]);
      repository.createAssignment.mockResolvedValue(replacementRecord);
      repository.findAssignment
        .mockResolvedValueOnce(replacedRecord)
        .mockResolvedValueOnce(replacementRecord);

      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-unresolved-reservation',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(result).toMatchObject({
        outcome: 'REPLACED',
        data: {
          replacementAssignment: {
            availability: {
              fullyVerifiable: false,
              conflictFree: null,
              warnings: [
                {
                  code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
                  message:
                    'Existe una reserva activa del mismo equipo con horario incompleto; la disponibilidad no puede verificarse completamente.',
                },
              ],
            },
          },
        },
      });
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
    });

    it('requests zero-write review for a confirmed conflict while preserving unresolved-reservation uncertainty', async () => {
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
        { caseId: unresolvedReservation.caseId },
      ]);
      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        otherCaseId,
        unresolvedReservation.caseId,
      ]);
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        unresolvedReservation,
        overlappingReservation,
      ]);

      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-mixed-review',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(result).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        sourceAssignmentId: assignmentId,
        overrideRequired: true,
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
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('keeps C3 availability semantics when the candidate Case schedule is incomplete', async () => {
      repository.findCase.mockResolvedValue({
        ...completeCase,
        scheduledEnd: null,
      });
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
      ]);
      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        otherCaseId,
      ]);
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);
      repository.createAssignment.mockResolvedValue(replacementRecord);
      repository.findAssignment
        .mockResolvedValueOnce(replacedRecord)
        .mockResolvedValueOnce(replacementRecord);

      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-incomplete-candidate',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(result).toMatchObject({
        outcome: 'REPLACED',
        data: {
          replacementAssignment: {
            availability: {
              fullyVerifiable: false,
              conflictFree: null,
              warnings: [
                {
                  code: 'INCOMPLETE_CASE_SCHEDULE',
                  message:
                    'La disponibilidad requiere revisar el horario del caso',
                },
              ],
            },
          },
        },
      });
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
    });

    it.each([
      [
        {
          conflictReviewFingerprint: 'a'.repeat(64),
          conflictOverrideReason: 'Riesgo',
        },
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
    ])(
      'rejects invalid Replace conflict confirmation %# before persistence',
      async (review, code) => {
        await expect(
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-key-invalid-review',
            {
              equipmentAssetId: replacementEquipmentAssetId,
              replacementReason: 'Equipo original no disponible',
              ...review,
            },
          ),
        ).rejects.toMatchObject({ response: { code } });

        expect(
          repository.findAssignmentReplacementSource,
        ).not.toHaveBeenCalled();
        expect(repository.runInTransaction).not.toHaveBeenCalled();
      },
    );

    it('returns a zero-write conflict review when the replacement asset has a confirmed overlap', async () => {
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
      ]);

      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        otherCaseId,
      ]);

      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);

      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-conflict-review',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(result.outcome).toBe('CONFLICT_REVIEW_REQUIRED');

      if (result.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected CONFLICT_REVIEW_REQUIRED outcome');
      }

      expect(result.sourceAssignmentId).toBe(assignmentId);
      expect(result.overrideRequired).toBe(true);
      expect(result.conflictReviewFingerprint).toMatch(/^[a-f0-9]{64}$/u);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].assignmentId).toBe(conflictingAssignmentId);

      expect(result.candidate.equipmentAsset.id).toBe(
        replacementEquipmentAssetId,
      );

      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('confirms a reviewed conflict and creates overrides for the replacement Assignment', async () => {
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
      ]);

      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        otherCaseId,
      ]);

      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);

      repository.createAssignment.mockResolvedValue(replacementRecord);

      repository.findAssignment
        .mockResolvedValueOnce(replacedRecord)
        .mockResolvedValueOnce(replacementRecord);

      // Primera solicitud: obtener la revisión sin ejecutar escrituras.
      const review = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-confirmed-conflict',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(review.outcome).toBe('CONFLICT_REVIEW_REQUIRED');

      if (review.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected CONFLICT_REVIEW_REQUIRED outcome');
      }

      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();

      // Segunda solicitud: confirmar exactamente el conflicto revisado.
      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-confirmed-conflict',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
          confirmConflictOverride: true,
          conflictReviewFingerprint: review.conflictReviewFingerprint,
          conflictOverrideReason: '  Riesgo aceptado por almacén  ',
        },
      );

      expect(result.outcome).toBe('REPLACED');

      if (result.outcome !== 'REPLACED') {
        throw new Error('Expected REPLACED outcome');
      }

      expect(repository.createConflictOverrides).toHaveBeenCalledWith(
        transaction,
        [
          {
            companyId,
            assignmentId: replacementAssignmentId,
            conflictingAssignmentId,
            assignmentWindowStart: review.candidate.operationalWindow.start,
            assignmentWindowEnd: review.candidate.operationalWindow.end,
            conflictingWindowStart: review.conflicts[0].windowStart,
            conflictingWindowEnd: review.conflicts[0].windowEnd,
            approvedById: userId,
            reason: 'Riesgo aceptado por almacén',
          },
        ],
      );

      expect(repository.replaceAssignment).toHaveBeenCalledTimes(1);

      expect(repository.completeIdempotencyClaim).toHaveBeenCalledWith(
        transaction,
        'claim-1',
        replacementAssignmentId,
      );

      expect(result.data.replacedAssignment.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.REPLACED,
      );

      expect(result.data.replacementAssignment.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.RESERVED,
      );

      expect(result.data.replacementAssignment.replacesAssignmentId).toBe(
        assignmentId,
      );
    });

    it('returns a fresh zero-write review when the Replace conflict fingerprint is stale', async () => {
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
      ]);

      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        otherCaseId,
      ]);

      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);

      // Primera solicitud: obtener el fingerprint original.
      const initialReview = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-stale-review',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(initialReview.outcome).toBe('CONFLICT_REVIEW_REQUIRED');

      if (initialReview.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected initial conflict review');
      }

      const originalFingerprint = initialReview.conflictReviewFingerprint;

      // La reserva relacionada cambia después de la primera revisión.
      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        {
          ...overlappingReservation,
          updatedAt: new Date('2026-09-19T18:00:00.000Z'),
        },
      ]);

      // Segunda solicitud: intentar confirmar el fingerprint anterior.
      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-stale-review',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
          confirmConflictOverride: true,
          conflictReviewFingerprint: originalFingerprint,
          conflictOverrideReason: 'Riesgo aceptado por almacén',
        },
      );

      expect(result.outcome).toBe('CONFLICT_REVIEW_REQUIRED');

      if (result.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected fresh conflict review');
      }

      expect(result.sourceAssignmentId).toBe(assignmentId);
      expect(result.overrideRequired).toBe(true);

      expect(result.conflictReviewFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.conflictReviewFingerprint).not.toBe(originalFingerprint);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].assignmentId).toBe(conflictingAssignmentId);

      // Ninguna de las dos solicitudes debe ejecutar escrituras.
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    it('returns a fresh zero-write review when the reviewed Replace conflict disappears', async () => {
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([
        { caseId: otherCaseId },
      ]);

      repository.lockHealthcareCasesForShare.mockResolvedValue([
        caseId,
        otherCaseId,
      ]);

      repository.findReservedAssignmentsForAsset.mockResolvedValue([
        overlappingReservation,
      ]);

      // Primera solicitud: obtener la revisión del conflicto.
      const initialReview = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-conflict-disappeared',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
        },
      );

      expect(initialReview.outcome).toBe('CONFLICT_REVIEW_REQUIRED');

      if (initialReview.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected initial conflict review');
      }

      const originalFingerprint = initialReview.conflictReviewFingerprint;

      // El conflicto desaparece antes de la confirmación.
      repository.findReservedAssignmentCaseIdsForAsset.mockResolvedValue([]);
      repository.lockHealthcareCasesForShare.mockResolvedValue([caseId]);
      repository.findReservedAssignmentsForAsset.mockResolvedValue([]);

      // Segunda solicitud: intentar confirmar el conflicto anterior.
      const result = await service.replace(
        companyId,
        userId,
        assignmentId,
        'replace-key-conflict-disappeared',
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: 'Equipo original no disponible',
          confirmConflictOverride: true,
          conflictReviewFingerprint: originalFingerprint,
          conflictOverrideReason: 'Riesgo aceptado por almacén',
        },
      );

      expect(result.outcome).toBe('CONFLICT_REVIEW_REQUIRED');

      if (result.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected fresh conflict review');
      }

      expect(result.sourceAssignmentId).toBe(assignmentId);
      expect(result.overrideRequired).toBe(false);
      expect(result.conflicts).toHaveLength(0);

      expect(result.conflictReviewFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.conflictReviewFingerprint).not.toBe(originalFingerprint);

      // Ninguna solicitud debe modificar A, crear B ni registrar overrides.
      expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(repository.createConflictOverrides).not.toHaveBeenCalled();
      expect(repository.replaceAssignment).not.toHaveBeenCalled();
      expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
    });

    describe('idempotency and replay', () => {
      it('replays a completed normalized Replace before inspecting the REPLACED source', async () => {
        const replayDto = {
          ...replaceDto,
          replacementReason: '  Equipo original no disponible  ',
        };
        const requestHash =
          createHealthcareEquipmentAssignmentReplaceRequestHash(
            assignmentId,
            replayDto,
          );
        repository.findIdempotencyRecord.mockResolvedValue({
          requestHash,
          resourceId: replacementAssignmentId,
        });
        repository.findAssignment
          .mockResolvedValueOnce(replacementRecord)
          .mockResolvedValueOnce(replacedRecord);

        const result = await service.replace(
          companyId,
          userId,
          assignmentId,
          'replace-replay-key',
          replayDto,
        );

        expect(result).toMatchObject({
          outcome: 'REPLACED',
          data: {
            replacedAssignment: {
              id: assignmentId,
              status: HealthcareEquipmentAssignmentLifecycle.REPLACED,
            },
            replacementAssignment: {
              id: replacementAssignmentId,
              status: HealthcareEquipmentAssignmentLifecycle.RESERVED,
              replacesAssignmentId: assignmentId,
            },
          },
        });
        expect(repository.findIdempotencyRecord).toHaveBeenCalledWith(
          companyId,
          'replace-replay-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
        );
        expect(repository.findAssignment).toHaveBeenNthCalledWith(
          1,
          companyId,
          replacementAssignmentId,
        );
        expect(repository.findAssignment).toHaveBeenNthCalledWith(
          2,
          companyId,
          assignmentId,
        );
        expect(
          repository.findAssignmentReplacementSource,
        ).not.toHaveBeenCalled();
        expect(repository.runInTransaction).not.toHaveBeenCalled();
        expect(repository.createAssignment).not.toHaveBeenCalled();
        expect(repository.replaceAssignment).not.toHaveBeenCalled();
      });

      it('rejects reuse of a Replace key with a different payload', async () => {
        repository.findIdempotencyRecord.mockResolvedValue({
          requestHash: createHealthcareEquipmentAssignmentReplaceRequestHash(
            assignmentId,
            replaceDto,
          ),
          resourceId: replacementAssignmentId,
        });

        await expect(
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-reused-payload-key',
            {
              ...replaceDto,
              replacementReason: 'Equipo dañado',
            },
          ),
        ).rejects.toMatchObject({
          response: { code: 'IDEMPOTENCY_KEY_REUSED' },
        });
        expect(repository.findIdempotencyRecord).toHaveBeenCalledWith(
          companyId,
          'replace-reused-payload-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
        );
        expect(
          repository.findAssignmentReplacementSource,
        ).not.toHaveBeenCalled();
        expect(repository.runInTransaction).not.toHaveBeenCalled();
      });

      it('rejects the same Replace key when the source Assignment changes', async () => {
        repository.findIdempotencyRecord.mockResolvedValue({
          requestHash: createHealthcareEquipmentAssignmentReplaceRequestHash(
            assignmentId,
            replaceDto,
          ),
          resourceId: replacementAssignmentId,
        });

        await expect(
          service.replace(
            companyId,
            userId,
            conflictingAssignmentId,
            'replace-reused-source-key',
            replaceDto,
          ),
        ).rejects.toMatchObject({
          response: { code: 'IDEMPOTENCY_KEY_REUSED' },
        });
        expect(
          repository.findAssignmentReplacementSource,
        ).not.toHaveBeenCalled();
        expect(repository.runInTransaction).not.toHaveBeenCalled();
      });

      it('does not confuse a Create key with the Replace idempotency scope', async () => {
        const createRecord = {
          requestHash:
            createHealthcareEquipmentAssignmentRequestHash(requirementDto),
          resourceId: assignmentId,
        };
        repository.findIdempotencyRecord.mockImplementation(
          (_companyId, _key, scope: IdempotencyScope) =>
            Promise.resolve(
              scope === IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE
                ? createRecord
                : null,
            ),
        );
        repository.createAssignment.mockResolvedValue(replacementRecord);
        repository.findAssignment
          .mockResolvedValueOnce(replacedRecord)
          .mockResolvedValueOnce(replacementRecord);

        const result = await service.replace(
          companyId,
          userId,
          assignmentId,
          'shared-create-replace-key',
          replaceDto,
        );

        expect(result.outcome).toBe('REPLACED');
        expect(repository.findIdempotencyRecord).toHaveBeenNthCalledWith(
          1,
          companyId,
          'shared-create-replace-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
        );
        expect(repository.findIdempotencyRecord).toHaveBeenNthCalledWith(
          2,
          companyId,
          'shared-create-replace-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
          transaction,
        );
        expect(repository.createIdempotencyClaim).toHaveBeenCalledWith(
          transaction,
          companyId,
          'shared-create-replace-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
          expect.any(String),
        );
      });

      it('recovers the losing same-key request from the completed Replace claim', async () => {
        const requestHash =
          createHealthcareEquipmentAssignmentReplaceRequestHash(
            assignmentId,
            replaceDto,
          );
        let completed = false;
        let transactionAttempt = 0;
        let finishWinner!: () => void;
        const winnerFinished = new Promise<void>((resolve) => {
          finishWinner = resolve;
        });

        repository.findIdempotencyRecord.mockImplementation(
          (_companyId, _key, scope: IdempotencyScope) =>
            Promise.resolve(
              completed &&
                scope ===
                  IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE
                ? { requestHash, resourceId: replacementAssignmentId }
                : null,
            ),
        );
        repository.runInTransaction.mockImplementation(
          async (
            operation: (client: typeof transaction) => Promise<unknown>,
          ) => {
            const currentAttempt = transactionAttempt;
            transactionAttempt += 1;

            if (currentAttempt === 0) {
              try {
                return await operation(transaction);
              } finally {
                finishWinner();
              }
            }

            await winnerFinished;
            throw knownPrismaError(
              'P2002',
              'IdempotencyRecord_companyId_scope_key_key',
            );
          },
        );
        repository.createAssignment.mockResolvedValue(replacementRecord);
        repository.completeIdempotencyClaim.mockImplementation(() => {
          completed = true;
          return Promise.resolve({ id: 'claim-1' });
        });
        repository.findAssignment
          .mockResolvedValueOnce(replacedRecord)
          .mockResolvedValueOnce(replacementRecord)
          .mockResolvedValueOnce(replacementRecord)
          .mockResolvedValueOnce(replacedRecord);

        // El mock modela al ganador y al perdedor del índice único. La
        // serialización real de PostgreSQL se valida en B4.
        const [winner, recovered] = await Promise.all([
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-concurrent-key',
            replaceDto,
          ),
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-concurrent-key',
            replaceDto,
          ),
        ]);

        expect(winner.outcome).toBe('REPLACED');
        expect(recovered.outcome).toBe('REPLACED');
        expect(repository.createIdempotencyClaim).toHaveBeenCalledTimes(1);
        expect(repository.createAssignment).toHaveBeenCalledTimes(1);
        expect(repository.replaceAssignment).toHaveBeenCalledTimes(1);
        expect(repository.completeIdempotencyClaim).toHaveBeenCalledTimes(1);
      });

      it('allows only one successor when different keys target the same source after serialized locks', async () => {
        let transactionQueue = Promise.resolve<unknown>(undefined);
        repository.runInTransaction.mockImplementation(
          (operation: (client: typeof transaction) => Promise<unknown>) => {
            const result = transactionQueue.then(() => operation(transaction));
            transactionQueue = result.then(
              () => undefined,
              () => undefined,
            );
            return result;
          },
        );
        repository.lockAssignment
          .mockResolvedValueOnce(replacementSourceSnapshot)
          .mockResolvedValueOnce({
            ...replacementSourceSnapshot,
            lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
            updatedAt: replacedAt,
          });
        repository.createAssignment.mockResolvedValue(replacementRecord);
        repository.findAssignment
          .mockResolvedValueOnce(replacedRecord)
          .mockResolvedValueOnce(replacementRecord);

        // El mock entrega locks en serie; la contención real de filas queda
        // reservada para las pruebas PostgreSQL de B4.
        const results = await Promise.allSettled([
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-distinct-key-1',
            replaceDto,
          ),
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-distinct-key-2',
            replaceDto,
          ),
        ]);

        expect(results[0]).toMatchObject({
          status: 'fulfilled',
          value: { outcome: 'REPLACED' },
        });
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: {
            response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' },
          },
        });
        expect(repository.createIdempotencyClaim).toHaveBeenCalledTimes(1);
        expect(repository.createAssignment).toHaveBeenCalledTimes(1);
        expect(repository.replaceAssignment).toHaveBeenCalledTimes(1);
        expect(repository.completeIdempotencyClaim).toHaveBeenCalledTimes(1);
      });

      it('checks the Replace scope and hash before replaying an idempotency unique violation', async () => {
        repository.findIdempotencyRecord
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            requestHash: 'different-request-hash',
            resourceId: replacementAssignmentId,
          });
        repository.runInTransaction.mockRejectedValueOnce(
          knownPrismaError(
            'P2002',
            'IdempotencyRecord_companyId_scope_key_key',
          ),
        );

        await expect(
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-race-wrong-hash-key',
            replaceDto,
          ),
        ).rejects.toMatchObject({
          response: { code: 'IDEMPOTENCY_KEY_REUSED' },
        });
        expect(repository.findIdempotencyRecord).toHaveBeenCalledTimes(2);
        expect(repository.findIdempotencyRecord).toHaveBeenNthCalledWith(
          1,
          companyId,
          'replace-race-wrong-hash-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
        );
        expect(repository.findIdempotencyRecord).toHaveBeenNthCalledWith(
          2,
          companyId,
          'replace-race-wrong-hash-key',
          IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
        );
        expect(repository.findAssignment).not.toHaveBeenCalled();
      });

      it('does not treat an incomplete Replace idempotency record as completed', async () => {
        const requestHash =
          createHealthcareEquipmentAssignmentReplaceRequestHash(
            assignmentId,
            replaceDto,
          );
        repository.findIdempotencyRecord.mockResolvedValue({
          requestHash,
          resourceId: null,
        });
        repository.runInTransaction.mockRejectedValueOnce(
          knownPrismaError(
            'P2002',
            'IdempotencyRecord_companyId_scope_key_key',
          ),
        );

        await expect(
          service.replace(
            companyId,
            userId,
            assignmentId,
            'replace-incomplete-claim-key',
            replaceDto,
          ),
        ).rejects.toMatchObject({
          response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
        });
        expect(repository.findAssignment).not.toHaveBeenCalled();
        expect(repository.createAssignment).not.toHaveBeenCalled();
        expect(repository.replaceAssignment).not.toHaveBeenCalled();
        expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
      });
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

    it('uses the canonical Company, timeout, asset, Requirement, settings and sorted Case lock order', async () => {
      const calls: string[] = [];
      jest.mocked(acquireHealthcareCompanyLock).mockImplementation(() => {
        calls.push('company');
        return Promise.resolve();
      });
      jest
        .mocked(applyHealthcareSubsequentTransactionTimeouts)
        .mockImplementation(() => {
          calls.push('subsequent-timeouts');
          return Promise.resolve();
        });
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
        'company',
        'subsequent-timeouts',
        'asset',
        'requirement',
        'settings-advisory',
        `cases:${caseId},${otherCaseId}`,
        'settings-row',
        'authoritative-case',
      ]);
      expect(acquireHealthcareCompanyLock).toHaveBeenCalledWith(
        transaction,
        companyId,
        {
          acquisitionTimeoutMs:
            transactionTimeoutPolicy.companyLockAcquisitionTimeoutMs,
        },
      );
      expect(applyHealthcareSubsequentTransactionTimeouts).toHaveBeenCalledWith(
        transaction,
        transactionTimeoutPolicy,
      );
      expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
      expect(repository.runInTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          maxWait: transactionTimeoutPolicy.prismaMaxWaitMs,
          timeout: transactionTimeoutPolicy.prismaTransactionTimeoutMs,
        },
      );
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

    it('maps only the dedicated Company-lock acquisition timeout to the approved HTTP 503 contract', async () => {
      repository.runInTransaction.mockRejectedValueOnce(
        new HealthcareCompanyLockTimeoutError(new Error('internal cause')),
      );

      const result = service.create(
        companyId,
        userId,
        'company-timeout-key',
        requirementDto,
      );
      const error = await result.catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(503);
      expect((error as HttpException).getResponse()).toMatchObject({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'HEALTHCARE_CONCURRENCY_TIMEOUT',
      });
      expect(
        JSON.stringify((error as HttpException).getResponse()),
      ).not.toContain('internal cause');
    });

    it.each([
      ['subsequent lock timeout', knownPrismaRawQueryError('55P03')],
      ['subsequent statement timeout', knownPrismaRawQueryError('57014')],
      ['deadlock', knownPrismaRawQueryError('40P01')],
      ['Prisma transaction error', knownPrismaError('P2028')],
    ])(
      'does not remap a %s as a Company-lock timeout',
      async (_name, error) => {
        repository.runInTransaction.mockRejectedValueOnce(error);

        await expect(
          service.create(
            companyId,
            userId,
            'other-timeout-key',
            requirementDto,
          ),
        ).rejects.toMatchObject({
          status: 500,
          response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
        });
      },
    );
  });
});
