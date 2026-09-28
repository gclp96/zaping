/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import 'reflect-metadata';

import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseKitItemLifecycle,
  HealthcareCaseKitStatus,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareRequirementLifecycle,
  ProductInventoryTracking,
} from '@prisma/client';

import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { HealthcareCompanyLockTimeoutError } from '../common/healthcare-company-lock-timeout.error';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import { HealthcareCaseKitItemSourceType } from './dto/add-healthcare-case-kit-item.dto';
import { HealthcareCaseKitsRepository } from './healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from './healthcare-case-kits.service';

jest.mock('../common/healthcare-company-lock');
jest.mock('../common/healthcare-subsequent-transaction-timeouts');

const companyId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const kitId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const requirementId = '55555555-5555-4555-8555-555555555555';
const assignmentId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-09-27T12:00:00.000Z');
const transaction = {};

function kitRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: kitId,
    companyId,
    caseId,
    status: HealthcareCaseKitStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
    healthcareCase: { status: HealthcareCaseStatus.SCHEDULED },
    createdBy: { id: userId, firstName: 'Ana', lastName: 'López' },
    items: [],
    ...overrides,
  };
}

function itemRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-id',
    companyId,
    caseId,
    caseKitId: kitId,
    requirementId,
    equipmentAssignmentId: null,
    preparedQuantity: 2,
    lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
    createdAt: now,
    addedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
    excludedBy: null,
    excludedAt: null,
    exclusionReason: null,
    requirement: {
      id: requirementId,
      productId: 'product-id',
      requestedQty: 3,
      lifecycle: HealthcareRequirementLifecycle.ACTIVE,
      product: {
        id: 'product-id',
        sku: 'MAT-1',
        name: 'Material',
        isActive: true,
        inventoryTracking: ProductInventoryTracking.QUANTITY,
      },
    },
    equipmentAssignment: null,
    caseKit: {
      id: kitId,
      status: HealthcareCaseKitStatus.DRAFT,
      healthcareCase: { status: HealthcareCaseStatus.SCHEDULED },
    },
    ...overrides,
  };
}

describe('HealthcareCaseKitsService', () => {
  let repository: jest.Mocked<HealthcareCaseKitsRepository>;
  let service: HealthcareCaseKitsService;

  beforeEach(() => {
    repository = {
      runInTransaction: jest.fn(async (operation) =>
        operation(transaction as never),
      ),
      findIdempotencyRecord: jest.fn().mockResolvedValue(null),
      createIdempotencyClaim: jest.fn().mockResolvedValue({ id: 'claim-id' }),
      completeIdempotencyClaim: jest.fn().mockResolvedValue({ id: 'claim-id' }),
      findCase: jest.fn().mockResolvedValue({
        id: caseId,
        status: HealthcareCaseStatus.SCHEDULED,
      }),
      lockCase: jest.fn().mockResolvedValue(true),
      findKitByCase: jest.fn().mockResolvedValue(null),
      findKit: jest.fn().mockResolvedValue(kitRecord()),
      lockKit: jest.fn().mockResolvedValue(true),
      createKit: jest.fn().mockResolvedValue(kitRecord()),
      findItem: jest.fn().mockResolvedValue(itemRecord()),
      lockItem: jest.fn().mockResolvedValue(true),
      lockRequirement: jest.fn().mockResolvedValue(true),
      findRequirement: jest.fn().mockResolvedValue({
        id: requirementId,
        caseId,
        requestedQty: 3,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        product: {
          id: 'product-id',
          isActive: true,
          inventoryTracking: ProductInventoryTracking.QUANTITY,
        },
      }),
      lockAssignment: jest.fn(),
      findAssignment: jest.fn(),
      findDuplicateItem: jest.fn().mockResolvedValue(null),
      excludeItem: jest.fn().mockResolvedValue({ count: 1 }),
      createItem: jest.fn().mockResolvedValue({
        id: 'item-id',
        companyId,
        caseId,
        caseKitId: kitId,
        requirementId,
        equipmentAssignmentId: null,
        preparedQuantity: 2,
        lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
        createdAt: now,
        addedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
        excludedBy: null,
        excludedAt: null,
        exclusionReason: null,
        requirement: {
          id: requirementId,
          productId: 'product-id',
          requestedQty: 3,
          lifecycle: HealthcareRequirementLifecycle.ACTIVE,
          product: {
            id: 'product-id',
            sku: 'MAT-1',
            name: 'Material',
            isActive: true,
            inventoryTracking: ProductInventoryTracking.QUANTITY,
          },
        },
        equipmentAssignment: null,
      }),
    } as unknown as jest.Mocked<HealthcareCaseKitsRepository>;
    service = new HealthcareCaseKitsService(repository, {
      companyLockAcquisitionTimeoutMs: 2500,
      subsequentLockTimeoutMs: 1500,
      subsequentStatementTimeoutMs: 4000,
      prismaMaxWaitMs: 3000,
      prismaTransactionTimeoutMs: 20000,
    });
    jest.clearAllMocks();
  });

  it('creates a DRAFT kit atomically in Company-first order', async () => {
    const result = await service.create(
      companyId,
      userId,
      caseId,
      'create-key',
    );

    expect(result).toMatchObject({
      replay: false,
      data: { id: kitId, status: 'DRAFT' },
    });
    expect(acquireHealthcareCompanyLock).toHaveBeenCalledWith(
      transaction,
      companyId,
      expect.any(Object),
    );
    expect(applyHealthcareSubsequentTransactionTimeouts).toHaveBeenCalled();
    expect(
      repository.createIdempotencyClaim.mock.invocationCallOrder[0],
    ).toBeLessThan(repository.createKit.mock.invocationCallOrder[0]);
    expect(repository.createKit.mock.invocationCallOrder[0]).toBeLessThan(
      repository.completeIdempotencyClaim.mock.invocationCallOrder[0],
    );
  });

  it('returns a completed replay without starting another transaction', async () => {
    repository.findIdempotencyRecord.mockResolvedValue({
      requestHash: expect.anything() as unknown as string,
      resourceId: kitId,
    });
    const firstHash = await import('./healthcare-case-kit-request-hash');
    repository.findIdempotencyRecord.mockResolvedValue({
      requestHash: firstHash.createHealthcareCaseKitRequestHash(caseId),
      resourceId: kitId,
    });

    const result = await service.create(companyId, userId, caseId, 'same-key');

    expect(result.replay).toBe(true);
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a reused key with a different payload before writes', async () => {
    repository.findIdempotencyRecord.mockResolvedValue({
      requestHash: 'different',
      resourceId: kitId,
    });
    await expect(
      service.create(companyId, userId, caseId, 'same-key'),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('adds an eligible QUANTITY requirement and completes its claim', async () => {
    const result = await service.addItem(companyId, userId, kitId, 'item-key', {
      sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
      requirementId,
      preparedQuantity: 2,
    });

    expect(result).toMatchObject({
      replay: false,
      data: { sourceType: 'REQUIREMENT', sourceValid: true },
    });
    expect(repository.lockCase).toHaveBeenCalledWith(
      transaction,
      companyId,
      caseId,
    );
    expect(repository.lockKit).toHaveBeenCalledWith(
      transaction,
      companyId,
      kitId,
    );
    expect(repository.lockKit.mock.invocationCallOrder[0]).toBeLessThan(
      repository.lockRequirement.mock.invocationCallOrder[0],
    );
    expect(repository.createItem.mock.invocationCallOrder[0]).toBeLessThan(
      repository.completeIdempotencyClaim.mock.invocationCallOrder[0],
    );
  });

  it('rejects a duplicate source before claiming the idempotency key', async () => {
    repository.findDuplicateItem.mockResolvedValue({ id: 'existing-item' });
    await expect(
      service.addItem(companyId, userId, kitId, 'new-key', {
        sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
        requirementId,
        preparedQuantity: 2,
      }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_KIT_ITEM_ALREADY_EXISTS' },
    });
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('rejects mutation of a cancelled Case without writes', async () => {
    repository.findKit.mockResolvedValue(
      kitRecord({
        healthcareCase: { status: HealthcareCaseStatus.CANCELLED },
      }) as never,
    );
    await expect(
      service.addItem(companyId, userId, kitId, 'new-key', {
        sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
        requirementId,
        preparedQuantity: 2,
      }),
    ).rejects.toMatchObject({ response: { code: 'CASE_NOT_ELIGIBLE' } });
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('adds an eligible RESERVED equipment assignment', async () => {
    repository.lockAssignment.mockResolvedValue(true);
    repository.findAssignment.mockResolvedValue({
      id: assignmentId,
      caseId,
      lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      equipmentAsset: {
        lifecycle: EquipmentLifecycle.ACTIVE,
        condition: EquipmentCondition.GOOD,
      },
    });
    repository.createItem.mockResolvedValue({
      id: 'equipment-item',
      companyId,
      caseId,
      caseKitId: kitId,
      requirementId: null,
      equipmentAssignmentId: assignmentId,
      preparedQuantity: null,
      lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
      createdAt: now,
      addedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
      excludedBy: null,
      excludedAt: null,
      exclusionReason: null,
      requirement: null,
      equipmentAssignment: {
        id: assignmentId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        equipmentAsset: {
          id: 'asset-id',
          assetCode: 'EQ-1',
          serialNumber: 'SN-1',
          lifecycle: EquipmentLifecycle.ACTIVE,
          condition: EquipmentCondition.GOOD,
          product: {
            id: 'product-id',
            sku: 'EQ-1',
            name: 'Equipo',
            isActive: true,
          },
        },
      },
    });

    const result = await service.addItem(
      companyId,
      userId,
      kitId,
      'equipment-key',
      {
        sourceType: HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT,
        equipmentAssignmentId: assignmentId,
      },
    );

    expect(result.data).toMatchObject({
      sourceType: 'EQUIPMENT_ASSIGNMENT',
      sourceValid: true,
    });
  });

  it('returns stable source validation before transaction or writes', async () => {
    await expect(
      service.addItem(companyId, userId, kitId, 'bad-source', {
        sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
        requirementId: 'not-a-uuid',
        preparedQuantity: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_CASE_KIT_SOURCE' },
    });
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('presents a foreign-tenant Case as missing', async () => {
    repository.findCase.mockResolvedValue(null);
    await expect(service.get('other-company', caseId)).rejects.toMatchObject({
      response: { code: 'CASE_NOT_FOUND' },
    });
    expect(repository.findKitByCase).not.toHaveBeenCalled();
  });

  it('keeps invalidated sources and derives warnings without writes', async () => {
    repository.findKitByCase.mockResolvedValue(
      kitRecord({
        healthcareCase: { status: HealthcareCaseStatus.CANCELLED },
        items: [
          {
            id: 'stale-item',
            companyId,
            caseId,
            caseKitId: kitId,
            requirementId,
            equipmentAssignmentId: null,
            preparedQuantity: 4,
            lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
            createdAt: now,
            addedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
            excludedBy: null,
            excludedAt: null,
            exclusionReason: null,
            requirement: {
              id: requirementId,
              productId: 'product-id',
              requestedQty: 3,
              lifecycle: HealthcareRequirementLifecycle.RETIRED,
              product: {
                id: 'product-id',
                sku: 'MAT-1',
                name: 'Material',
                isActive: false,
                inventoryTracking: ProductInventoryTracking.QUANTITY,
              },
            },
            equipmentAssignment: null,
          },
        ],
      }) as never,
    );

    const response = await service.get(companyId, caseId);

    expect(response.items[0]).toMatchObject({
      sourceValid: false,
      stale: true,
    });
    expect(response.items[0].warnings.map((warning) => warning.code)).toEqual([
      'CASE_KIT_CASE_CANCELLED',
      'CASE_KIT_REQUIREMENT_NOT_ACTIVE',
      'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE',
      'CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED',
    ]);
    expect(repository.createItem).not.toHaveBeenCalled();
  });

  it('excludes an ACTIVE item atomically in Company-first lock order', async () => {
    const excluded = itemRecord({
      lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
      excludedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
      excludedAt: now,
      exclusionReason: 'Selección incorrecta',
    });
    repository.findItem
      .mockResolvedValueOnce(itemRecord() as never)
      .mockResolvedValueOnce(itemRecord() as never)
      .mockResolvedValueOnce(excluded as never);

    const result = await service.excludeItem(
      companyId,
      userId,
      kitId,
      'item-id',
      'exclude-key',
      { reason: '  Selección incorrecta  ' },
    );

    expect(result).toMatchObject({
      replay: false,
      data: {
        lifecycle: 'EXCLUDED',
        exclusionReason: 'Selección incorrecta',
        excludedBy: { id: userId },
      },
    });
    expect(repository.lockCase).toHaveBeenCalledWith(
      transaction,
      companyId,
      caseId,
    );
    expect(repository.lockKit).toHaveBeenCalledWith(
      transaction,
      companyId,
      kitId,
    );
    expect(repository.lockItem).toHaveBeenCalledWith(
      transaction,
      companyId,
      kitId,
      'item-id',
    );
    expect(repository.lockCase.mock.invocationCallOrder[0]).toBeLessThan(
      repository.lockKit.mock.invocationCallOrder[0],
    );
    expect(repository.lockKit.mock.invocationCallOrder[0]).toBeLessThan(
      repository.lockItem.mock.invocationCallOrder[0],
    );
    expect(repository.runInTransaction.mock.calls[0][1]).toEqual({
      maxWait: 3000,
      timeout: 20000,
    });
    expect(repository.excludeItem).toHaveBeenCalledWith(transaction, {
      companyId,
      caseKitId: kitId,
      itemId: 'item-id',
      excludedById: userId,
      excludedAt: repository.excludeItem.mock.calls[0][1].excludedAt,
      exclusionReason: 'Selección incorrecta',
    });
    expect(repository.excludeItem.mock.calls[0][1].excludedAt).toBeInstanceOf(
      Date,
    );
    expect(repository.excludeItem.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createIdempotencyClaim.mock.invocationCallOrder[0],
    );
    expect(
      repository.createIdempotencyClaim.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.completeIdempotencyClaim.mock.invocationCallOrder[0],
    );
  });

  it('rejects an invalid exclusion reason before discovery or writes', async () => {
    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'key', {
        reason: '   ',
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_CASE_KIT_ITEM_EXCLUSION_REASON' },
    });
    expect(repository.findKit).not.toHaveBeenCalled();
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('maps only Company-lock acquisition timeout to the sanitized 503', async () => {
    jest
      .mocked(acquireHealthcareCompanyLock)
      .mockRejectedValueOnce(
        new HealthcareCompanyLockTimeoutError(new Error('internal cause')),
      );

    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'key', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'HEALTHCARE_CONCURRENCY_TIMEOUT' },
    });
    expect(repository.lockCase).not.toHaveBeenCalled();
    expect(repository.excludeItem).not.toHaveBeenCalled();
  });

  it('returns a completed exclusion replay before discovery or writes', async () => {
    const { createHealthcareCaseKitItemExclusionRequestHash } =
      await import('./healthcare-case-kit-request-hash');
    repository.findIdempotencyRecord.mockResolvedValue({
      requestHash: createHealthcareCaseKitItemExclusionRequestHash(
        kitId,
        'item-id',
        'Selección incorrecta',
      ),
      resourceId: 'item-id',
    });
    repository.findItem.mockResolvedValue(
      itemRecord({
        lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
        excludedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
        excludedAt: now,
        exclusionReason: 'Selección incorrecta',
      }) as never,
    );

    const result = await service.excludeItem(
      companyId,
      userId,
      kitId,
      'item-id',
      'exclude-key',
      { reason: 'Selección incorrecta' },
    );

    expect(result.replay).toBe(true);
    expect(result.data).toMatchObject({
      excludedBy: { id: userId },
      excludedAt: now,
      exclusionReason: 'Selección incorrecta',
    });
    expect(repository.runInTransaction).not.toHaveBeenCalled();
    expect(repository.excludeItem).not.toHaveBeenCalled();
    expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('rejects completed-key payload mismatch before state replay', async () => {
    repository.findIdempotencyRecord.mockResolvedValue({
      requestHash: 'different',
      resourceId: 'item-id',
    });
    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'exclude-key', {
        reason: 'Selección incorrecta',
      }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });

  it('replays an already excluded item with the same reason without consuming a new key', async () => {
    repository.findItem.mockResolvedValue(
      itemRecord({
        lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
        excludedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
        excludedAt: now,
        exclusionReason: 'Selección incorrecta',
      }) as never,
    );

    const result = await service.excludeItem(
      companyId,
      'different-user',
      kitId,
      'item-id',
      'new-key',
      { reason: '  Selección incorrecta  ' },
    );

    expect(result.replay).toBe(true);
    expect(result.data).toMatchObject({
      excludedBy: { id: userId },
      excludedAt: now,
      exclusionReason: 'Selección incorrecta',
    });
    expect(repository.excludeItem).not.toHaveBeenCalled();
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
    expect(repository.completeIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('rejects an already excluded item with a different normalized reason', async () => {
    repository.findItem.mockResolvedValue(
      itemRecord({
        lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
        excludedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
        excludedAt: now,
        exclusionReason: 'Razón original',
      }) as never,
    );
    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'new-key', {
        reason: 'Razón distinta',
      }),
    ).rejects.toMatchObject({
      response: { code: 'CASE_KIT_ITEM_ALREADY_EXCLUDED' },
    });
    expect(repository.excludeItem).not.toHaveBeenCalled();
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('rejects a cancelled Case or non-DRAFT Kit before exclusion writes', async () => {
    repository.findItem.mockResolvedValue(
      itemRecord({
        caseKit: {
          id: kitId,
          status: HealthcareCaseKitStatus.DRAFT,
          healthcareCase: { status: HealthcareCaseStatus.CANCELLED },
        },
      }) as never,
    );
    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'key', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({ response: { code: 'CASE_NOT_ELIGIBLE' } });

    repository.findItem.mockResolvedValue(
      itemRecord({
        caseKit: {
          id: kitId,
          status: 'PREPARED' as HealthcareCaseKitStatus,
          healthcareCase: { status: HealthcareCaseStatus.SCHEDULED },
        },
      }) as never,
    );
    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'key-2', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({ response: { code: 'CASE_KIT_NOT_MUTABLE' } });
    expect(repository.excludeItem).not.toHaveBeenCalled();
  });

  it('performs mandatory readback when the conditional exclusion updates zero rows', async () => {
    const excluded = itemRecord({
      lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
      excludedBy: { id: userId, firstName: 'Ana', lastName: 'López' },
      excludedAt: now,
      exclusionReason: 'Ganador',
    });
    repository.findItem
      .mockResolvedValueOnce(itemRecord() as never)
      .mockResolvedValueOnce(itemRecord() as never)
      .mockResolvedValueOnce(excluded as never);
    repository.excludeItem.mockResolvedValue({ count: 0 });

    const result = await service.excludeItem(
      companyId,
      userId,
      kitId,
      'item-id',
      'loser-key',
      { reason: 'Ganador' },
    );

    expect(result.replay).toBe(true);
    expect(repository.findItem).toHaveBeenCalledTimes(3);
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('reports RESOURCE_STATE_CHANGED when zero-row readback has no excluded winner', async () => {
    repository.findItem
      .mockResolvedValueOnce(itemRecord() as never)
      .mockResolvedValueOnce(itemRecord() as never)
      .mockResolvedValueOnce(null);
    repository.excludeItem.mockResolvedValue({ count: 0 });

    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'loser-key', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_STATE_CHANGED' } });
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('presents foreign-tenant or wrong-Kit items as missing', async () => {
    repository.findItem.mockResolvedValue(null);
    await expect(
      service.excludeItem('other-company', userId, kitId, 'item-id', 'key', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({ response: { code: 'CASE_KIT_ITEM_NOT_FOUND' } });
    expect(repository.runInTransaction).not.toHaveBeenCalled();

    repository.findItem.mockResolvedValue(
      itemRecord({ caseKitId: 'other-kit' }) as never,
    );
    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'key-2', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({ response: { code: 'CASE_KIT_ITEM_NOT_FOUND' } });
  });

  it('presents an absent or foreign-tenant Kit as missing before item discovery', async () => {
    repository.findKit.mockResolvedValue(null);

    await expect(
      service.excludeItem(companyId, userId, kitId, 'item-id', 'key', {
        reason: 'Incorrecto',
      }),
    ).rejects.toMatchObject({ response: { code: 'CASE_KIT_NOT_FOUND' } });
    expect(repository.findItem).not.toHaveBeenCalled();
    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });
});
