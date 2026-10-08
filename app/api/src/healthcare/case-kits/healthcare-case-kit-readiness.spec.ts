import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseKitItemLifecycle,
  HealthcareCaseKitStatus,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareRequirementLifecycle,
  HealthcareRequirementType,
  ProductInventoryTracking,
} from '@prisma/client';

import { evaluateHealthcareCaseKitReadiness } from './healthcare-case-kit-readiness';
import { HealthcareCaseKitRecord } from './healthcare-case-kits.repository';

const now = new Date('2026-09-28T12:00:00.000Z');

function requirement(
  id: string,
  inventoryTracking: ProductInventoryTracking,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    requestedQty: 1,
    type: HealthcareRequirementType.REQUIRED,
    lifecycle: HealthcareRequirementLifecycle.ACTIVE,
    product: { inventoryTracking },
    ...overrides,
  };
}

function quantityItem(
  requirementId: string,
  preparedQuantity: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `item-${requirementId}`,
    companyId: 'company-id',
    caseId: 'case-id',
    caseKitId: 'kit-id',
    requirementId,
    equipmentAssignmentId: null,
    preparedQuantity,
    lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
    createdAt: now,
    addedBy: { id: 'user-id', firstName: 'Ana', lastName: 'López' },
    excludedBy: null,
    excludedAt: null,
    exclusionReason: null,
    requirement: {
      id: requirementId,
      productId: 'product-id',
      requestedQty: 1,
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
    ...overrides,
  };
}

function assetItem(
  assignmentId: string,
  requirementId: string | null,
  origin: HealthcareEquipmentAssignmentOrigin,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `item-${assignmentId}`,
    companyId: 'company-id',
    caseId: 'case-id',
    caseKitId: 'kit-id',
    requirementId: null,
    equipmentAssignmentId: assignmentId,
    preparedQuantity: null,
    lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
    createdAt: now,
    addedBy: { id: 'user-id', firstName: 'Ana', lastName: 'López' },
    excludedBy: null,
    excludedAt: null,
    exclusionReason: null,
    requirement: null,
    equipmentAssignment: {
      id: assignmentId,
      origin,
      requirementId,
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
    ...overrides,
  };
}

function kit(
  requirements: unknown[] = [],
  items: unknown[] = [],
  caseOverrides: Record<string, unknown> = {},
): HealthcareCaseKitRecord {
  return {
    id: 'kit-id',
    companyId: 'company-id',
    caseId: 'case-id',
    status: HealthcareCaseKitStatus.DRAFT,
    preparedBy: null,
    preparedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: { id: 'user-id', firstName: 'Ana', lastName: 'López' },
    healthcareCase: {
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: now,
      scheduledEnd: new Date('2026-09-28T14:00:00.000Z'),
      requirements,
      ...caseOverrides,
    },
    items,
  } as unknown as HealthcareCaseKitRecord;
}

describe('evaluateHealthcareCaseKitReadiness', () => {
  it('passes an empty scheduled Kit when there are no REQUIRED Requirements', () => {
    expect(evaluateHealthcareCaseKitReadiness(kit())).toEqual({
      status: 'PASS',
      blockers: [],
    });
  });

  it.each([
    [{ status: HealthcareCaseStatus.DRAFT }, 'CASE_KIT_CASE_NOT_SCHEDULED'],
    [{ scheduledEnd: null }, 'CASE_KIT_CASE_SCHEDULE_INCOMPLETE'],
  ])('blocks an ineligible schedule', (caseOverrides, code) => {
    expect(
      evaluateHealthcareCaseKitReadiness(kit([], [], caseOverrides)).blockers,
    ).toContainEqual({ code });
  });

  it('requires exact QUANTITY coverage and ignores EXCLUDED history', () => {
    const required = requirement(
      'requirement-1',
      ProductInventoryTracking.QUANTITY,
      {
        requestedQty: 2,
      },
    );
    const partial = quantityItem('requirement-1', 1, {
      requirement: {
        ...quantityItem('requirement-1', 1).requirement,
        requestedQty: 2,
      },
    });
    expect(
      evaluateHealthcareCaseKitReadiness(kit([required], [partial])).blockers,
    ).toContainEqual({
      code: 'CASE_KIT_REQUIRED_QUANTITY_NOT_COVERED',
      requirementId: 'requirement-1',
    });

    const exact = quantityItem('requirement-1', 2, {
      requirement: {
        ...quantityItem('requirement-1', 2).requirement,
        requestedQty: 2,
      },
    });
    const excludedStale = quantityItem('requirement-1', 4, {
      id: 'excluded-item',
      lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
    });
    expect(
      evaluateHealthcareCaseKitReadiness(
        kit([required], [exact, excludedStale]),
      ).status,
    ).toBe('PASS');
  });

  it('counts only valid RESERVED REQUIREMENT Assignments for ASSET coverage', () => {
    const required = requirement(
      'requirement-1',
      ProductInventoryTracking.ASSET,
    );
    const direct = assetItem(
      'assignment-direct',
      null,
      HealthcareEquipmentAssignmentOrigin.DIRECT,
    );
    expect(
      evaluateHealthcareCaseKitReadiness(kit([required], [direct])).blockers,
    ).toContainEqual({
      code: 'CASE_KIT_REQUIRED_ASSET_NOT_COVERED',
      requirementId: 'requirement-1',
    });

    const linked = assetItem(
      'assignment-linked',
      'requirement-1',
      HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
    );
    expect(
      evaluateHealthcareCaseKitReadiness(kit([required], [linked])),
    ).toEqual({ status: 'PASS', blockers: [] });
  });

  it('blocks SERIALIZED REQUIRED but not an absent BACKUP', () => {
    const serialized = requirement(
      'serialized-required',
      ProductInventoryTracking.SERIALIZED,
    );
    const backup = requirement('backup', ProductInventoryTracking.QUANTITY, {
      type: HealthcareRequirementType.BACKUP,
    });
    expect(
      evaluateHealthcareCaseKitReadiness(kit([serialized, backup])).blockers,
    ).toEqual([
      {
        code: 'CASE_KIT_SERIALIZED_REQUIREMENT_UNSUPPORTED',
        requirementId: 'serialized-required',
      },
    ]);
  });

  it('blocks an included invalid BACKUP source', () => {
    const backup = requirement('backup', ProductInventoryTracking.QUANTITY, {
      type: HealthcareRequirementType.BACKUP,
    });
    const stale = quantityItem('backup', 1, {
      requirement: {
        ...quantityItem('backup', 1).requirement,
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
      },
    });
    expect(
      evaluateHealthcareCaseKitReadiness(kit([backup], [stale])).blockers,
    ).toContainEqual({
      code: 'CASE_KIT_REQUIREMENT_NOT_ACTIVE',
      requirementId: 'backup',
      caseKitItemId: 'item-backup',
    });
  });

  it.each([
    HealthcareEquipmentAssignmentLifecycle.RELEASED,
    HealthcareEquipmentAssignmentLifecycle.REPLACED,
  ])(
    'keeps PREPARED as derived BLOCKED after an Assignment becomes %s',
    (lifecycle) => {
      const invalidAssignment = assetItem(
        'assignment-linked',
        'requirement-1',
        HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        {
          equipmentAssignment: {
            ...assetItem(
              'assignment-linked',
              'requirement-1',
              HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
            ).equipmentAssignment,
            lifecycle,
          },
        },
      );
      const record = kit([], [invalidAssignment]);
      (record as { status: HealthcareCaseKitStatus }).status =
        HealthcareCaseKitStatus.PREPARED;

      expect(
        evaluateHealthcareCaseKitReadiness(record).blockers,
      ).toContainEqual(
        expect.objectContaining({ code: 'CASE_KIT_ASSIGNMENT_NOT_RESERVED' }),
      );
      expect(record.status).toBe(HealthcareCaseKitStatus.PREPARED);
    },
  );

  it('keeps PREPARED as derived BLOCKED after a Requirement is retired', () => {
    const retired = quantityItem('requirement-1', 1, {
      requirement: {
        ...quantityItem('requirement-1', 1).requirement,
        lifecycle: HealthcareRequirementLifecycle.RETIRED,
      },
    });
    const record = kit([], [retired]);
    (record as { status: HealthcareCaseKitStatus }).status =
      HealthcareCaseKitStatus.PREPARED;

    expect(evaluateHealthcareCaseKitReadiness(record).blockers).toContainEqual({
      code: 'CASE_KIT_REQUIREMENT_NOT_ACTIVE',
      requirementId: 'requirement-1',
      caseKitItemId: 'item-requirement-1',
    });
    expect(record.status).toBe(HealthcareCaseKitStatus.PREPARED);
  });

  it('keeps PREPARED as derived BLOCKED after Case cancellation', () => {
    const linked = assetItem(
      'assignment-linked',
      'requirement-1',
      HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
    );
    const record = kit([], [linked], {
      status: HealthcareCaseStatus.CANCELLED,
    });
    (record as { status: HealthcareCaseKitStatus }).status =
      HealthcareCaseKitStatus.PREPARED;

    expect(evaluateHealthcareCaseKitReadiness(record).blockers).toContainEqual({
      code: 'CASE_KIT_CASE_CANCELLED',
    });
    expect(record.status).toBe(HealthcareCaseKitStatus.PREPARED);
  });
});
