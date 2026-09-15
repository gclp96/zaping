import 'dotenv/config';

import {
  EquipmentCondition,
  HealthcareRequirementType,
  Prisma,
  ProductInventoryTracking,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { HealthcareEquipmentAssignmentsRepository } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { PrismaService } from '../src/prisma/prisma.service';

type Fixture = {
  companyAId: string;
  companyBId: string;
  userAId: string;
  userBId: string;
};

type Scenario = {
  companyId: string;
  userId: string;
  caseId: string;
  requirementId: string;
  equipmentAssetIds: string[];
};

const safeDatabaseNamePattern =
  /(?:^|[_-])(?:test|testing|integration|ci|qa|ephemeral)(?:[_-]|$)/i;
const productionDatabaseNamePattern =
  /(?:^|[_-])(?:prod|production)(?:[_-]|$)/i;

function assertSafeDbIntegrityDatabase(): void {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    throw new Error('DATABASE_URL is required when RUN_DB_INTEGRITY_TESTS=1.');
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL URL for integrity tests.',
    );
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error(
      'DATABASE_URL must use the postgres: or postgresql: protocol for integrity tests.',
    );
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('DATABASE_URL contains an invalid encoded database name.');
  }

  if (!databaseName || databaseName.includes('/')) {
    throw new Error(
      'DATABASE_URL must identify one PostgreSQL integrity-test database.',
    );
  }

  if (
    productionDatabaseNamePattern.test(databaseName) ||
    !safeDatabaseNamePattern.test(databaseName)
  ) {
    throw new Error(
      `Database "${databaseName}" is not explicitly marked as a safe integration/test database.`,
    );
  }

  if (process.env.DB_INTEGRITY_TEST_SAFE !== '1') {
    throw new Error(
      'DB_INTEGRITY_TEST_SAFE=1 is required to run database integrity tests.',
    );
  }
}

const runDbIntegrityTests = process.env.RUN_DB_INTEGRITY_TESTS === '1';

if (runDbIntegrityTests) {
  assertSafeDbIntegrityDatabase();
}

function buildFixture(): Fixture {
  return {
    companyAId: randomUUID(),
    companyBId: randomUUID(),
    userAId: randomUUID(),
    userBId: randomUUID(),
  };
}

async function cleanupFixture(
  prisma: PrismaService,
  fixture: Fixture,
): Promise<void> {
  const companyIds = [fixture.companyAId, fixture.companyBId];
  const cleanupOperations: Array<() => Promise<unknown>> = [
    () =>
      prisma.healthcareEquipmentAssignmentConflictOverride.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareEquipmentRequirementCoverageNote.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareEquipmentAssignment.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.idempotencyRecord.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareCaseRequirement.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareCase.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.equipmentAsset.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.product.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.user.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.company.deleteMany({
        where: { id: { in: companyIds } },
      }),
  ];
  const cleanupErrors: unknown[] = [];

  for (const cleanup of cleanupOperations) {
    try {
      await cleanup();
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      )) {
        cleanupErrors.push(error);
      }
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      'Healthcare Equipment Assignment backend fixture cleanup failed.',
    );
  }
}

(runDbIntegrityTests ? describe : describe.skip)(
  'Healthcare Equipment Assignment backend PostgreSQL integration',
  () => {
    const prisma = new PrismaService();
    const repository = new HealthcareEquipmentAssignmentsRepository(prisma);
    const service = new HealthcareEquipmentAssignmentsService(repository);
    const fixture = buildFixture();
    let databaseConnected = false;

    const userForCompany = (companyId: string): string =>
      companyId === fixture.companyAId ? fixture.userAId : fixture.userBId;

    const createScenario = async (
      companyId: string,
      options: {
        requestedQty?: number;
        assetCount?: number;
        completeSchedule?: boolean;
      } = {},
    ): Promise<Scenario> => {
      const userId = userForCompany(companyId);
      const productId = randomUUID();
      const caseId = randomUUID();
      const requirementId = randomUUID();
      const equipmentAssetIds = Array.from(
        { length: options.assetCount ?? 2 },
        () => randomUUID(),
      );
      const completeSchedule = options.completeSchedule ?? true;

      await prisma.product.create({
        data: {
          id: productId,
          companyId,
          sku: `HC-EA-BE-${productId}`,
          name: `Equipment Assignment Backend Product ${productId}`,
          inventoryTracking: ProductInventoryTracking.ASSET,
        },
      });
      await prisma.healthcareCase.create({
        data: {
          id: caseId,
          companyId,
          folio: `HC-EA-BE-${caseId}`,
          title: `Equipment Assignment Backend Case ${caseId}`,
          scheduledStart: new Date('2026-09-16T15:00:00.000Z'),
          scheduledEnd: completeSchedule
            ? new Date('2026-09-16T17:00:00.000Z')
            : null,
          createdById: userId,
        },
      });
      await prisma.healthcareCaseRequirement.create({
        data: {
          id: requirementId,
          companyId,
          caseId,
          productId,
          requestedQty: options.requestedQty ?? 2,
          type: HealthcareRequirementType.REQUIRED,
          sortOrder: 10,
          createdById: userId,
        },
      });
      await prisma.equipmentAsset.createMany({
        data: equipmentAssetIds.map((id) => ({
          id,
          companyId,
          productId,
          assetCode: `HC-EA-BE-${id}`,
          condition: EquipmentCondition.GOOD,
        })),
      });

      return {
        companyId,
        userId,
        caseId,
        requirementId,
        equipmentAssetIds,
      };
    };

    beforeAll(async () => {
      await prisma.$connect();
      databaseConnected = true;
      const suffix = randomUUID();

      await prisma.company.createMany({
        data: [
          {
            id: fixture.companyAId,
            name: `HC-EA Backend Company A ${suffix}`,
            rfc: `ECA${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
          {
            id: fixture.companyBId,
            name: `HC-EA Backend Company B ${suffix}`,
            rfc: `ECB${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          {
            id: fixture.userAId,
            companyId: fixture.companyAId,
            firstName: 'Equipment',
            lastName: 'Backend User A',
            email: `hc-ea-backend-a-${suffix}@example.test`,
            passwordHash: 'not-used-by-backend-test',
            role: UserRole.ADMIN,
          },
          {
            id: fixture.userBId,
            companyId: fixture.companyBId,
            firstName: 'Equipment',
            lastName: 'Backend User B',
            email: `hc-ea-backend-b-${suffix}@example.test`,
            passwordHash: 'not-used-by-backend-test',
            role: UserRole.ADMIN,
          },
        ],
      });
    });

    afterAll(async () => {
      if (!databaseConnected) {
        return;
      }

      try {
        await cleanupFixture(prisma, fixture);
      } finally {
        await prisma.$disconnect();
      }
    });

    it('atomically persists and replays one Assignment identity', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const dto = {
        caseId: scenario.caseId,
        equipmentAssetId: scenario.equipmentAssetIds[0],
        requirementId: scenario.requirementId,
      };
      const key = `create-${randomUUID()}`;

      const created = await service.create(
        scenario.companyId,
        scenario.userId,
        key,
        dto,
      );
      const replay = await service.create(
        scenario.companyId,
        scenario.userId,
        key,
        dto,
      );

      expect(replay.data.id).toBe(created.data.id);
      await expect(
        prisma.healthcareEquipmentAssignment.count({
          where: { companyId: scenario.companyId, caseId: scenario.caseId },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.idempotencyRecord.findUnique({
          where: {
            companyId_scope_key: {
              companyId: scenario.companyId,
              scope: 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE',
              key,
            },
          },
          select: { resourceId: true },
        }),
      ).resolves.toEqual({ resourceId: created.data.id });
    });

    it('rejects a reused key with a different normalized command', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const key = `mismatch-${randomUUID()}`;

      await service.create(scenario.companyId, scenario.userId, key, {
        caseId: scenario.caseId,
        equipmentAssetId: scenario.equipmentAssetIds[0],
        requirementId: scenario.requirementId,
      });

      await expect(
        service.create(scenario.companyId, scenario.userId, key, {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[1],
          requirementId: scenario.requirementId,
        }),
      ).rejects.toMatchObject({
        response: { code: 'IDEMPOTENCY_KEY_REUSED' },
      });
    });

    it('prevents sequential over-coverage without counting DIRECT rows', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        requestedQty: 1,
        assetCount: 3,
      });

      await service.create(
        scenario.companyId,
        scenario.userId,
        `coverage-first-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          requirementId: scenario.requirementId,
        },
      );
      await service.create(
        scenario.companyId,
        scenario.userId,
        `direct-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[1],
          directAssignmentReason: 'Unidad adicional de respaldo',
        },
      );

      await expect(
        service.create(
          scenario.companyId,
          scenario.userId,
          `coverage-second-${randomUUID()}`,
          {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[2],
            requirementId: scenario.requirementId,
          },
        ),
      ).rejects.toMatchObject({
        response: { code: 'REQUIREMENT_OVER_COVERAGE' },
      });
    });

    it('returns the stable duplicate error for a RESERVED same-Case asset', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const dto = {
        caseId: scenario.caseId,
        equipmentAssetId: scenario.equipmentAssetIds[0],
        requirementId: scenario.requirementId,
      };

      await service.create(
        scenario.companyId,
        scenario.userId,
        `duplicate-first-${randomUUID()}`,
        dto,
      );

      await expect(
        service.create(
          scenario.companyId,
          scenario.userId,
          `duplicate-second-${randomUUID()}`,
          dto,
        ),
      ).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_ALREADY_RESERVED' },
      });
    });

    it('keeps foreign Case, Requirement and EquipmentAsset indistinguishable from missing', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyBId);

      await expect(
        service.create(
          fixture.companyAId,
          fixture.userAId,
          `foreign-case-${randomUUID()}`,
          {
            caseId: scenarioB.caseId,
            equipmentAssetId: scenarioA.equipmentAssetIds[0],
            directAssignmentReason: 'No debe persistir',
          },
        ),
      ).rejects.toMatchObject({ response: { code: 'CASE_NOT_FOUND' } });
      await expect(
        service.create(
          fixture.companyAId,
          fixture.userAId,
          `foreign-asset-${randomUUID()}`,
          {
            caseId: scenarioA.caseId,
            equipmentAssetId: scenarioB.equipmentAssetIds[0],
            directAssignmentReason: 'No debe persistir',
          },
        ),
      ).rejects.toMatchObject({
        response: { code: 'EQUIPMENT_ASSET_NOT_FOUND' },
      });
      await expect(
        service.create(
          fixture.companyAId,
          fixture.userAId,
          `foreign-requirement-${randomUUID()}`,
          {
            caseId: scenarioA.caseId,
            equipmentAssetId: scenarioA.equipmentAssetIds[0],
            requirementId: scenarioB.requirementId,
          },
        ),
      ).rejects.toMatchObject({
        response: { code: 'REQUIREMENT_NOT_FOUND' },
      });
    });

    it('returns the incomplete-schedule warning from persisted PostgreSQL data', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        completeSchedule: false,
      });

      const result = await service.create(
        scenario.companyId,
        scenario.userId,
        `incomplete-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          requirementId: scenario.requirementId,
        },
      );

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
  },
);
