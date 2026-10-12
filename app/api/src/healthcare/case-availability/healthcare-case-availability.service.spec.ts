import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EquipmentCondition,
  HealthcareEquipmentAssignmentLifecycle,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HealthcareCaseKitsRepository,
  HealthcareCaseKitRecord,
} from '../case-kits/healthcare-case-kits.repository';
import { evaluateHealthcareCaseKitReadiness } from '../case-kits/healthcare-case-kit-readiness';
import {
  HealthcareEquipmentAssignmentRecord,
  HealthcareEquipmentAssignmentsRepository,
} from '../equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../equipment-assignments/healthcare-equipment-assignments.service';
import { HealthcareEquipmentCoverageService } from '../equipment-assignments/healthcare-equipment-coverage.service';
import { HealthcareCaseAvailabilityRepository } from './healthcare-case-availability.repository';
import { HealthcareCaseAvailabilityService } from './healthcare-case-availability.service';
import { HealthcareCaseAvailabilityModule } from './healthcare-case-availability.module';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';

@Global()
@Module({
  providers: [
    {
      provide: healthcareCompanyTransactionTimeoutConfiguration.KEY,
      useValue: {},
    },
  ],
  exports: [healthcareCompanyTransactionTimeoutConfiguration.KEY],
})
class ReadOnlyTestConfigurationModule {}

describe('Case Availability: real repositories/derivations in one read-only snapshot', () => {
  const schedule = {
    scheduledStart: new Date(1000),
    scheduledEnd: new Date(4000),
  };
  const tx = {
    healthcareCase: { findFirst: jest.fn() },
    healthcareCaseRequirement: {
      findMany: jest.fn<
        Promise<unknown[]>,
        [Prisma.HealthcareCaseRequirementFindManyArgs]
      >(),
    },
    healthcareEquipmentAssignment: {
      findMany: jest.fn<
        Promise<unknown[]>,
        [Prisma.HealthcareEquipmentAssignmentFindManyArgs]
      >(),
    },
    healthcareEquipmentAssignmentSettings: { findUnique: jest.fn() },
    healthcareCaseKit: { findUnique: jest.fn() },
  };
  // There are no root model delegates, write delegates or raw SQL functions.
  // Any escaping read, mutation or lock makes the endpoint fail these tests.
  const prisma = { $transaction: jest.fn() };
  const root = prisma as unknown as PrismaService;
  const repository = new HealthcareCaseAvailabilityRepository(root);
  const equipment = new HealthcareEquipmentAssignmentsRepository(root);
  const assignments = new HealthcareEquipmentAssignmentsService(
    equipment,
    {} as never,
  );
  const coverage = new HealthcareEquipmentCoverageService(
    equipment,
    assignments,
  );
  const kits = new HealthcareCaseKitsRepository(root);
  const service = new HealthcareCaseAvailabilityService(
    repository,
    coverage,
    assignments,
    equipment,
    kits,
  );
  const requirement = (
    id: string,
    qty = 1,
    type = 'REQUIRED',
    tracking = 'ASSET',
    lifecycle = 'ACTIVE',
  ) => ({
    id,
    companyId: 'tenant',
    caseId: 'case',
    requestedQty: qty,
    type,
    lifecycle,
    product: {
      id,
      sku: id,
      name: id,
      isActive: true,
      inventoryTracking: tracking,
    },
    equipmentCoverageNotes: [] as { kind: string; resolvedAt: Date | null }[],
  });
  const record = (
    id: string,
    requirementId: string | null = null,
    assetId = id,
  ) =>
    ({
      id,
      companyId: 'tenant',
      caseId: 'case',
      requirementId,
      origin: requirementId ? 'REQUIREMENT' : 'DIRECT',
      lifecycle: 'RESERVED',
      equipmentAsset: {
        id: assetId,
        productId: requirementId ?? 'direct-product',
        lifecycle: 'ACTIVE',
        condition: 'GOOD',
      },
      healthcareCase: { ...schedule, id: 'case', folio: 'CASE' },
      conflictOverrides: [],
    }) as unknown as HealthcareEquipmentAssignmentRecord;
  let requirements: ReturnType<typeof requirement>[];
  let records: HealthcareEquipmentAssignmentRecord[];
  let reservations: {
    id: string;
    companyId: string;
    equipmentAssetId: string;
    healthcareCase: typeof schedule;
  }[];

  beforeEach(() => {
    jest.resetAllMocks();
    requirements = [];
    records = [];
    reservations = [];
    prisma.$transaction.mockImplementation(
      (read: (client: typeof tx) => Promise<unknown>) => read(tx),
    );
    tx.healthcareCase.findFirst.mockImplementation(
      ({ where }: Prisma.HealthcareCaseFindFirstArgs) =>
        Promise.resolve(
          where?.companyId === 'tenant' && where.id === 'case'
            ? { id: 'case', status: 'SCHEDULED', ...schedule }
            : null,
        ),
    );
    tx.healthcareCaseRequirement.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        requirements.filter(
          (r) =>
            r.companyId === where?.companyId &&
            r.caseId === where.caseId &&
            r.lifecycle === where.lifecycle &&
            (!where.product || r.product.inventoryTracking === 'ASSET'),
        ),
      ),
    );
    tx.healthcareEquipmentAssignment.findMany.mockImplementation(
      ({ where }) => {
        if (where?.equipmentAssetId) {
          const ids = (where.equipmentAssetId as Prisma.StringFilter)
            .in as string[];
          return Promise.resolve(
            reservations.filter(
              (r) =>
                r.companyId === where.companyId &&
                ids.includes(r.equipmentAssetId),
            ),
          );
        }
        return Promise.resolve(
          records.filter(
            (r) =>
              r.companyId === where?.companyId &&
              r.caseId === where.caseId &&
              r.lifecycle === where.lifecycle &&
              (!where.requirementId ||
                (
                  (where.requirementId as Prisma.StringNullableFilter)
                    .in as string[]
                ).includes(r.requirementId!)),
          ),
        );
      },
    );
    tx.healthcareEquipmentAssignmentSettings.findUnique.mockResolvedValue({
      preCaseBufferMinutes: 0,
      postCaseBufferMinutes: 0,
    });
    tx.healthcareCaseKit.findUnique.mockResolvedValue(null);
  });

  it('wires the real feature module without a circular dependency or database lifecycle', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ReadOnlyTestConfigurationModule,
        HealthcareCaseAvailabilityModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(root)
      .compile();
    try {
      expect(
        (
          await module
            .get(HealthcareCaseAvailabilityService)
            .findAvailability('tenant', 'case')
        ).preparation.caseKitId,
      ).toBeNull();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    } finally {
      await module.close();
    }
  });

  it('returns explicit empty counts/null preparation without any canonical verdict', async () => {
    const result = await service.findAvailability('tenant', 'case');
    expect(result).toEqual({
      caseId: 'case',
      caseStatus: 'SCHEDULED',
      schedule: { ...schedule, complete: true, warnings: [] },
      requirements: { activeCount: 0, requiredCount: 0, backupCount: 0 },
      coverage: {
        requirementCount: 0,
        coveredCount: 0,
        partialCount: 0,
        pendingCount: 0,
        unavailableCount: 0,
        activeNoteCount: 0,
      },
      equipment: {
        reservedAssignmentCount: 0,
        fullyVerifiable: false,
        conflictFree: null,
        warnings: [],
      },
      preparation: { caseKitId: null, status: null, readiness: null },
    });
    expect(Object.keys(result)).toEqual([
      'caseId',
      'caseStatus',
      'schedule',
      'requirements',
      'coverage',
      'equipment',
      'preparation',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /companyId|conflictOverrides|createdBy|availabilityState|notApplicable/,
    );
  });

  it('uses exactly one repository-opened RepeatableRead snapshot for all material inputs', async () => {
    records.push(record('direct'));
    await service.findAvailability('tenant', 'case');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(tx.healthcareCaseKit.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_caseId: { companyId: 'tenant', caseId: 'case' } },
      }),
    );
    expect(tx.healthcareEquipmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'tenant',
          caseId: 'case',
          lifecycle: 'RESERVED',
          origin: { in: ['REQUIREMENT', 'DIRECT'] },
        },
      }),
    );
    expect(tx.healthcareCaseRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'tenant', caseId: 'case', lifecycle: 'ACTIVE' },
      }),
    );
    expect(
      tx.healthcareEquipmentAssignmentSettings.findUnique,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'tenant' } }),
    );
  });

  it.each([null, new Date(4000)])(
    'reports schedule completeness with end=%s, independently of empty equipment',
    async (end) => {
      tx.healthcareCase.findFirst.mockResolvedValue({
        id: 'case',
        status: 'SCHEDULED',
        ...schedule,
        scheduledEnd: end,
      });
      const result = await service.findAvailability('tenant', 'case');
      expect(result.schedule.complete).toBe(end !== null);
      expect(result.schedule.warnings.map((w) => w.code)).toEqual(
        end ? [] : ['INCOMPLETE_CASE_SCHEDULE'],
      );
      expect(result.equipment.warnings).toEqual([]);
    },
  );

  it('counts ACTIVE REQUIRED/BACKUP across tracking, excludes RETIRED and foreign requirements', async () => {
    requirements.push(
      requirement('asset'),
      requirement('quantity', 2, 'BACKUP', 'QUANTITY'),
      requirement('serial', 1, 'REQUIRED', 'SERIALIZED'),
      requirement('retired', 1, 'REQUIRED', 'ASSET', 'RETIRED'),
      { ...requirement('foreign'), companyId: 'other' },
    );
    const result = await service.findAvailability('tenant', 'case');
    expect(result.requirements).toEqual({
      activeCount: 3,
      requiredCount: 2,
      backupCount: 1,
    });
    expect(result.coverage.requirementCount).toBe(1);
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
  });

  it('summarizes all four unchanged R quantity states and active notes', async () => {
    const pending = requirement('pending');
    const unavailable = requirement('unavailable');
    unavailable.equipmentCoverageNotes.push({
      kind: 'UNAVAILABLE',
      resolvedAt: null,
    });
    const partial = requirement('partial', 2);
    partial.equipmentCoverageNotes.push({
      kind: 'PARTIAL_CONTEXT',
      resolvedAt: null,
    });
    const covered = requirement('covered');
    covered.equipmentCoverageNotes.push({
      kind: 'UNAVAILABLE',
      resolvedAt: null,
    }); // stale, still context
    requirements.push(pending, unavailable, partial, covered);
    records.push(
      record('partial-1', 'partial'),
      record('covered-1', 'covered'),
      record('direct'),
    );
    const result = await service.findAvailability('tenant', 'case');
    expect(result.coverage).toEqual({
      requirementCount: 4,
      pendingCount: 1,
      unavailableCount: 1,
      partialCount: 1,
      coveredCount: 1,
      activeNoteCount: 3,
    });
    const read = await coverage.findCoverage('tenant', 'case');
    expect(read.items.map((r) => [r.quantityState, r.assignedQty])).toEqual([
      ['PENDING', 0],
      ['UNAVAILABLE', 0],
      ['PARTIAL', 1],
      ['COVERED', 1],
    ]);
  });

  it.each(['RELEASED', 'REPLACED'] as const)(
    'excludes %s from both populations',
    async (lifecycle) => {
      requirements.push(requirement('r'));
      const excluded = record('excluded', 'r');
      excluded.lifecycle = HealthcareEquipmentAssignmentLifecycle[lifecycle];
      records.push(record('linked', 'r'), record('direct'), excluded);
      const result = await service.findAvailability('tenant', 'case');
      expect(result.equipment.reservedAssignmentCount).toBe(2);
      expect(result.coverage.coveredCount).toBe(1);
    },
  );

  it('DIRECT with a conflict affects equipment but never quantitative Coverage', async () => {
    requirements.push(requirement('r'));
    records.push(record('direct'));
    reservations.push({
      id: 'conflict',
      companyId: 'tenant',
      equipmentAssetId: 'direct',
      healthcareCase: schedule,
    });
    const result = await service.findAvailability('tenant', 'case');
    expect(result.coverage).toMatchObject({ pendingCount: 1, coveredCount: 0 });
    expect(result.equipment).toMatchObject({
      reservedAssignmentCount: 1,
      fullyVerifiable: true,
      conflictFree: false,
    });
    expect(result.equipment.warnings.map((w) => w.code)).toEqual([
      'CURRENT_ASSIGNMENT_CONFLICT',
    ]);
  });

  it('does not apply Asset eligibility to diagnostic population', async () => {
    requirements.push(requirement('r'));
    const damaged = record('damaged', 'r');
    damaged.equipmentAsset.condition = EquipmentCondition.DAMAGED;
    records.push(damaged);
    const result = await service.findAvailability('tenant', 'case');
    expect(result.coverage.pendingCount).toBe(1);
    expect(result.equipment).toMatchObject({
      reservedAssignmentCount: 1,
      fullyVerifiable: true,
      conflictFree: true,
    });
  });

  it('aggregates mixed verifiability and known conflicts without conflation', async () => {
    records.push(record('verified'), record('uncertain'));
    reservations.push(
      {
        id: 'conflict',
        companyId: 'tenant',
        equipmentAssetId: 'verified',
        healthcareCase: schedule,
      },
      {
        id: 'unknown',
        companyId: 'tenant',
        equipmentAssetId: 'uncertain',
        healthcareCase: {
          ...schedule,
          scheduledEnd: null,
        } as unknown as typeof schedule,
      },
    );
    const result = await service.findAvailability('tenant', 'case');
    expect(result.equipment).toMatchObject({
      fullyVerifiable: false,
      conflictFree: false,
    });
    expect(result.equipment.warnings.map((w) => w.code)).toEqual([
      'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
      'CURRENT_ASSIGNMENT_CONFLICT',
    ]);
  });

  it('preserves incomplete candidate Assignment schedule semantics', async () => {
    const direct = record('direct');
    direct.healthcareCase.scheduledEnd = null;
    records.push(direct);
    expect(
      (await service.findAvailability('tenant', 'case')).equipment,
    ).toMatchObject({
      fullyVerifiable: false,
      conflictFree: null,
      warnings: [expect.objectContaining({ code: 'INCOMPLETE_CASE_SCHEDULE' })],
    });
  });

  it.each(['exact', 'partial', 'stale'] as const)(
    'preserves %s current override matching across DIRECT conflicts',
    async (mode) => {
      const direct = record('direct');
      for (const id of ['a', 'b']) {
        reservations.push({
          id,
          companyId: 'tenant',
          equipmentAssetId: 'direct',
          healthcareCase: schedule,
        });
        if (mode === 'partial' && id === 'b') continue;
        direct.conflictOverrides.push({
          conflictingAssignmentId: id,
          assignmentWindowStart: schedule.scheduledStart,
          assignmentWindowEnd:
            mode === 'stale' ? new Date(5000) : schedule.scheduledEnd,
          conflictingWindowStart: schedule.scheduledStart,
          conflictingWindowEnd: schedule.scheduledEnd,
        } as (typeof direct.conflictOverrides)[number]);
      }
      records.push(direct);
      const equipmentResult = (await service.findAvailability('tenant', 'case'))
        .equipment;
      expect(equipmentResult.conflictFree).toBe(false);
      expect(equipmentResult.warnings.map((w) => w.code)).toEqual(
        mode === 'exact'
          ? ['CURRENT_ASSIGNMENT_CONFLICT', 'CONFLICT_OVERRIDE_CONFIRMED']
          : ['CURRENT_ASSIGNMENT_CONFLICT'],
      );
    },
  );

  it.each(['DRAFT', 'PREPARED'] as const)(
    'reuses readiness for kit %s with compact/deduplicated public blockers',
    async (status) => {
      const kit = {
        id: 'kit',
        status,
        healthcareCase: { status: 'SCHEDULED', ...schedule, requirements: [] },
        items: [],
      } as unknown as HealthcareCaseKitRecord;
      tx.healthcareCaseKit.findUnique.mockResolvedValue(kit);
      const result = await service.findAvailability('tenant', 'case');
      expect(result.preparation).toEqual({
        caseKitId: 'kit',
        status,
        readiness: evaluateHealthcareCaseKitReadiness(kit),
      });
    },
  );

  it('preserves PREPARED status with currently BLOCKED readiness', async () => {
    const kit = {
      id: 'kit',
      status: 'PREPARED',
      healthcareCase: { status: 'CANCELLED', ...schedule, requirements: [] },
      items: [],
    } as unknown as HealthcareCaseKitRecord;
    tx.healthcareCaseKit.findUnique.mockResolvedValue(kit);
    const result = await service.findAvailability('tenant', 'case');
    expect(result.preparation).toEqual({
      caseKitId: 'kit',
      status: 'PREPARED',
      readiness: evaluateHealthcareCaseKitReadiness(kit),
    });
    expect(result.preparation.readiness?.status).toBe('BLOCKED');
  });

  it('compacts duplicate item blockers without changing readiness or including EXCLUDED items', async () => {
    const invalid = {
      lifecycle: 'ACTIVE',
      requirementId: 'retired',
      equipmentAssignment: null,
      requirement: {
        lifecycle: 'RETIRED',
        requestedQty: 1,
        product: { isActive: true },
      },
    };
    const kit = {
      id: 'kit',
      status: 'PREPARED',
      healthcareCase: { status: 'SCHEDULED', ...schedule, requirements: [] },
      items: [
        { ...invalid, id: 'a' },
        { ...invalid, id: 'b' },
        {
          ...invalid,
          id: 'history',
          requirementId: 'excluded',
          lifecycle: 'EXCLUDED',
        },
      ],
    } as unknown as HealthcareCaseKitRecord;
    tx.healthcareCaseKit.findUnique.mockResolvedValue(kit);
    const result = await service.findAvailability('tenant', 'case');
    expect(result.preparation).toEqual({
      caseKitId: 'kit',
      status: 'PREPARED',
      readiness: {
        status: evaluateHealthcareCaseKitReadiness(kit).status,
        blockers: [
          { code: 'CASE_KIT_REQUIREMENT_NOT_ACTIVE', requirementId: 'retired' },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /caseKitItemId|history|excluded/,
    );
  });

  it('isolates foreign material rows even for a shared Asset identity', async () => {
    records.push(record('direct'), {
      ...record('foreign'),
      companyId: 'other',
    });
    reservations.push({
      id: 'foreign-conflict',
      companyId: 'other',
      equipmentAssetId: 'direct',
      healthcareCase: schedule,
    });
    expect(
      (await service.findAvailability('tenant', 'case')).equipment,
    ).toMatchObject({ reservedAssignmentCount: 1, conflictFree: true });
  });

  it('returns identical missing/foreign errors before reading material data', async () => {
    const missing = await service
      .findAvailability('tenant', 'missing')
      .catch((error: unknown) => error);
    const foreign = await service
      .findAvailability('other', 'case')
      .catch((error: unknown) => error);
    expect(foreign).toEqual(missing);
    expect(tx.healthcareCaseRequirement.findMany).not.toHaveBeenCalled();
    expect(tx.healthcareCaseKit.findUnique).not.toHaveBeenCalled();
  });

  it('sanitizes read failures instead of silently returning absent facts', async () => {
    tx.healthcareCaseKit.findUnique.mockRejectedValue(
      new Error('private database diagnostic'),
    );
    await expect(
      service.findAvailability('tenant', 'case'),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      service.findAvailability('tenant', 'case'),
    ).rejects.not.toThrow('private database diagnostic');
  });
});
