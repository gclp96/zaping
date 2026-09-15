import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import {
  EquipmentCondition,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
  HealthcareEquipmentRequirementCoverageNoteKind,
  HealthcareRequirementType,
  Prisma,
  UserRole,
} from '@prisma/client';

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
  productId: string;
  requirementId: string;
  equipmentAssetIds: string[];
};

const releasedAt = new Date('2026-09-15T01:00:00.000Z');
const replacedAt = new Date('2026-09-15T02:00:00.000Z');
const windowStart = new Date('2026-09-15T03:00:00.000Z');
const windowEnd = new Date('2026-09-15T04:00:00.000Z');
const conflictingWindowStart = new Date('2026-09-15T03:30:00.000Z');
const conflictingWindowEnd = new Date('2026-09-15T04:30:00.000Z');

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
      prisma.healthcareEquipmentAssignmentSettings.deleteMany({
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
      if (!isMissingCleanupTable(error)) {
        cleanupErrors.push(error);
      }
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      'Healthcare Equipment Assignment persistence fixture cleanup failed.',
    );
  }
}

function isMissingCleanupTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

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

(runDbIntegrityTests ? describe : describe.skip)(
  'Healthcare Equipment Assignment PostgreSQL persistence integrity',
  () => {
    const prisma = new PrismaService();
    const fixture = buildFixture();
    let databaseConnected = false;

    const userForCompany = (companyId: string): string =>
      companyId === fixture.companyAId ? fixture.userAId : fixture.userBId;

    const createScenario = async (
      companyId: string,
      options: { assetCount?: number; requestedQty?: number } = {},
    ): Promise<Scenario> => {
      const userId = userForCompany(companyId);
      const productId = randomUUID();
      const caseId = randomUUID();
      const requirementId = randomUUID();
      const assetCount = options.assetCount ?? 1;
      const equipmentAssetIds = Array.from({ length: assetCount }, () =>
        randomUUID(),
      );

      await prisma.product.create({
        data: {
          id: productId,
          companyId,
          sku: `HC-EA-${productId}`,
          name: `Equipment Assignment Product ${productId}`,
        },
      });
      await prisma.healthcareCase.create({
        data: {
          id: caseId,
          companyId,
          folio: `HC-EA-${caseId}`,
          title: `Equipment Assignment Case ${caseId}`,
          createdById: userId,
        },
      });
      await prisma.healthcareCaseRequirement.create({
        data: {
          id: requirementId,
          companyId,
          caseId,
          productId,
          requestedQty: options.requestedQty ?? assetCount,
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
          assetCode: `HC-EA-${id}`,
          condition: EquipmentCondition.GOOD,
        })),
      });

      return {
        companyId,
        userId,
        caseId,
        productId,
        requirementId,
        equipmentAssetIds,
      };
    };

    const createCase = async (companyId: string): Promise<string> => {
      const id = randomUUID();

      await prisma.healthcareCase.create({
        data: {
          id,
          companyId,
          folio: `HC-EA-${id}`,
          title: `Equipment Assignment Case ${id}`,
          createdById: userForCompany(companyId),
        },
      });

      return id;
    };

    const buildAssignmentData = (
      scenario: Scenario,
      overrides: Partial<Prisma.HealthcareEquipmentAssignmentUncheckedCreateInput> = {},
    ): Prisma.HealthcareEquipmentAssignmentUncheckedCreateInput => ({
      id: randomUUID(),
      companyId: scenario.companyId,
      caseId: scenario.caseId,
      equipmentAssetId: scenario.equipmentAssetIds[0],
      requirementId: scenario.requirementId,
      origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
      createdById: scenario.userId,
      ...overrides,
    });

    const expectAssignmentRejected = async (
      data: Prisma.HealthcareEquipmentAssignmentUncheckedCreateInput,
    ): Promise<void> => {
      const id = data.id ?? randomUUID();

      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: { ...data, id },
        }),
      ).rejects.toBeDefined();
      await expect(
        prisma.healthcareEquipmentAssignment.findUnique({ where: { id } }),
      ).resolves.toBeNull();
    };

    const buildOverrideData = (
      assignmentId: string,
      conflictingAssignmentId: string,
      overrides: Partial<Prisma.HealthcareEquipmentAssignmentConflictOverrideUncheckedCreateInput> = {},
    ): Prisma.HealthcareEquipmentAssignmentConflictOverrideUncheckedCreateInput => ({
      id: randomUUID(),
      companyId: fixture.companyAId,
      assignmentId,
      conflictingAssignmentId,
      assignmentWindowStart: windowStart,
      assignmentWindowEnd: windowEnd,
      conflictingWindowStart,
      conflictingWindowEnd,
      approvedById: fixture.userAId,
      reason: 'Approved operational overlap',
      ...overrides,
    });

    beforeAll(async () => {
      await prisma.$connect();
      databaseConnected = true;

      const suffix = randomUUID();

      await prisma.company.createMany({
        data: [
          {
            id: fixture.companyAId,
            name: `HC-EA Company A ${suffix}`,
            rfc: `EAA${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
          {
            id: fixture.companyBId,
            name: `HC-EA Company B ${suffix}`,
            rfc: `EAB${suffix.replaceAll('-', '').slice(0, 10)}`,
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          {
            id: fixture.userAId,
            companyId: fixture.companyAId,
            firstName: 'Equipment',
            lastName: 'Assignment User A',
            email: `hc-ea-a-${suffix}@example.test`,
            passwordHash: 'not-used-by-persistence-test',
            role: UserRole.ADMIN,
          },
          {
            id: fixture.userBId,
            companyId: fixture.companyBId,
            firstName: 'Equipment',
            lastName: 'Assignment User B',
            email: `hc-ea-b-${suffix}@example.test`,
            passwordHash: 'not-used-by-persistence-test',
            role: UserRole.ADMIN,
          },
        ],
      });
    });

    afterAll(async () => {
      try {
        if (databaseConnected) {
          await cleanupFixture(prisma, fixture);
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it('acepta una Assignment REQUIREMENT RESERVED same-tenant', async () => {
      const scenario = await createScenario(fixture.companyAId);

      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario),
        }),
      ).resolves.toMatchObject({
        companyId: fixture.companyAId,
        caseId: scenario.caseId,
        equipmentAssetId: scenario.equipmentAssetIds[0],
        requirementId: scenario.requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      });
    });

    it('rechaza un Case de otra Company', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyBId);

      await expectAssignmentRejected(
        buildAssignmentData(scenarioA, { caseId: scenarioB.caseId }),
      );
    });

    it('rechaza un EquipmentAsset de otra Company', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyBId);

      await expectAssignmentRejected(
        buildAssignmentData(scenarioA, {
          equipmentAssetId: scenarioB.equipmentAssetIds[0],
        }),
      );
    });

    it('rechaza una Requirement de otra Company', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyBId);

      await expectAssignmentRejected(
        buildAssignmentData(scenarioA, {
          requirementId: scenarioB.requirementId,
        }),
      );
    });

    it('rechaza una Requirement de otro Case dentro de la misma Company', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyAId);

      await expectAssignmentRejected(
        buildAssignmentData(scenarioA, {
          requirementId: scenarioB.requirementId,
        }),
      );
    });

    it('rechaza createdBy de otra Company', async () => {
      const scenario = await createScenario(fixture.companyAId);

      await expectAssignmentRejected(
        buildAssignmentData(scenario, { createdById: fixture.userBId }),
      );
    });

    it('aplica la consistencia REQUIREMENT/DIRECT', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 5,
      });
      const invalidAssignments = [
        buildAssignmentData(scenario, { requirementId: null }),
        buildAssignmentData(scenario, { directAssignmentReason: 'Unexpected' }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[2],
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
          requirementId: null,
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[3],
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
          requirementId: null,
          directAssignmentReason: '   ',
        }),
      ];

      for (const data of invalidAssignments) {
        await expectAssignmentRejected(data);
      }

      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario, {
            equipmentAssetId: scenario.equipmentAssetIds[4],
            origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
            requirementId: null,
            directAssignmentReason: 'Urgent backup asset',
          }),
        }),
      ).resolves.toMatchObject({
        origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        requirementId: null,
        directAssignmentReason: 'Urgent backup asset',
      });
    });

    it('acepta RELEASED con metadata completa y causa interna sin reason', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 2,
      });

      await expect(
        prisma.healthcareEquipmentAssignment.createMany({
          data: [
            buildAssignmentData(scenario, {
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
              releasedAt,
              releasedById: fixture.userAId,
              releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
              releaseReason: 'No longer needed',
            }),
            buildAssignmentData(scenario, {
              equipmentAssetId: scenario.equipmentAssetIds[1],
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
              releasedAt,
              releasedById: fixture.userAId,
              releaseCause:
                HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
            }),
          ],
        }),
      ).resolves.toMatchObject({ count: 2 });
    });

    it('rechaza metadata RELEASED incompleta, blank o cross-tenant', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 4,
      });
      const invalidAssignments = [
        buildAssignmentData(scenario, {
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releasedById: fixture.userAId,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason: 'Missing timestamp',
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releasedAt,
          releasedById: fixture.userAId,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[2],
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releasedAt,
          releasedById: fixture.userAId,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason: '   ',
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[3],
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releasedAt,
          releasedById: fixture.userBId,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
        }),
      ];

      for (const data of invalidAssignments) {
        await expectAssignmentRejected(data);
      }
    });

    it('acepta REPLACED completo y rechaza audit inválido', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 4,
      });

      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario, {
            lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
            replacedAt,
            replacedById: fixture.userAId,
            replacementReason: 'Use calibrated unit',
          }),
        }),
      ).resolves.toMatchObject({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
      });

      const invalidAssignments = [
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacedAt,
          replacedById: fixture.userAId,
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[2],
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacedAt,
          replacedById: fixture.userAId,
          replacementReason: '   ',
        }),
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[3],
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacedAt,
          replacedById: fixture.userBId,
          replacementReason: 'Cross tenant actor',
        }),
      ];

      for (const data of invalidAssignments) {
        await expectAssignmentRejected(data);
      }
    });

    it('rechaza metadata terminal en una Assignment RESERVED', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 2,
      });

      await expectAssignmentRejected(
        buildAssignmentData(scenario, {
          releasedAt,
          releasedById: fixture.userAId,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason: 'Invalid reserved audit',
        }),
      );
      await expectAssignmentRejected(
        buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacedAt,
          replacedById: fixture.userAId,
          replacementReason: 'Invalid reserved audit',
        }),
      );
    });

    it('impide dos RESERVED del mismo EquipmentAsset y Case', async () => {
      const scenario = await createScenario(fixture.companyAId);

      await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenario),
      });
      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario, {
            origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
            requirementId: null,
            directAssignmentReason: 'Second reservation',
          }),
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('permite el mismo EquipmentAsset RESERVED en Cases distintos', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const secondCaseId = await createCase(fixture.companyAId);

      await expect(
        prisma.healthcareEquipmentAssignment.createMany({
          data: [
            buildAssignmentData(scenario),
            buildAssignmentData(scenario, {
              caseId: secondCaseId,
              origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
              requirementId: null,
              directAssignmentReason:
                'Separate Case overlap is service-reviewed',
            }),
          ],
        }),
      ).resolves.toMatchObject({ count: 2 });
    });

    it('permite nueva RESERVED después de historia RELEASED', async () => {
      const scenario = await createScenario(fixture.companyAId);

      await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenario, {
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releasedAt,
          releasedById: fixture.userAId,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason: 'Completed reservation',
        }),
      });
      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario),
        }),
      ).resolves.toMatchObject({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      });
    });

    it('no codifica over-coverage dinámica como constraint SQL', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 2,
        requestedQty: 1,
      });

      await expect(
        prisma.healthcareEquipmentAssignment.createMany({
          data: scenario.equipmentAssetIds.map((equipmentAssetId) =>
            buildAssignmentData(scenario, { equipmentAssetId }),
          ),
        }),
      ).resolves.toMatchObject({ count: 2 });
    });

    it('preserva lineage same-tenant y permite una sola sucesora directa', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 3,
      });
      const predecessor = await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenario, {
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacedAt,
          replacedById: fixture.userAId,
          replacementReason: 'Replace original asset',
        }),
      });

      await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenario, {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacesAssignmentId: predecessor.id,
        }),
      });
      await expect(
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario, {
            equipmentAssetId: scenario.equipmentAssetIds[2],
            replacesAssignmentId: predecessor.id,
          }),
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rechaza lineage self-reference y cross-tenant', async () => {
      const scenarioA = await createScenario(fixture.companyAId, {
        assetCount: 2,
      });
      const scenarioB = await createScenario(fixture.companyBId);
      const foreignPredecessor =
        await prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenarioB),
        });
      const selfId = randomUUID();

      await expectAssignmentRejected(
        buildAssignmentData(scenarioA, {
          id: selfId,
          replacesAssignmentId: selfId,
        }),
      );
      await expectAssignmentRejected(
        buildAssignmentData(scenarioA, {
          equipmentAssetId: scenarioA.equipmentAssetIds[1],
          replacesAssignmentId: foreignPredecessor.id,
        }),
      );
    });

    it('acepta un ConflictOverride same-tenant con snapshots válidos', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const secondCaseId = await createCase(fixture.companyAId);
      const assignments = await Promise.all([
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario),
        }),
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario, {
            caseId: secondCaseId,
            origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
            requirementId: null,
            directAssignmentReason: 'Cross-Case reservation',
          }),
        }),
      ]);

      await expect(
        prisma.healthcareEquipmentAssignmentConflictOverride.create({
          data: buildOverrideData(assignments[0].id, assignments[1].id),
        }),
      ).resolves.toMatchObject({
        assignmentId: assignments[0].id,
        conflictingAssignmentId: assignments[1].id,
        approvedById: fixture.userAId,
      });
    });

    it('rechaza ConflictOverride self, blank o con ventanas inválidas', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const secondCaseId = await createCase(fixture.companyAId);
      const assignments = await Promise.all([
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario),
        }),
        prisma.healthcareEquipmentAssignment.create({
          data: buildAssignmentData(scenario, {
            caseId: secondCaseId,
            origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
            requirementId: null,
            directAssignmentReason: 'Cross-Case reservation',
          }),
        }),
      ]);
      const invalidOverrides = [
        buildOverrideData(assignments[0].id, assignments[0].id),
        buildOverrideData(assignments[0].id, assignments[1].id, {
          reason: '   ',
        }),
        buildOverrideData(assignments[0].id, assignments[1].id, {
          assignmentWindowEnd: windowStart,
        }),
        buildOverrideData(assignments[0].id, assignments[1].id, {
          conflictingWindowEnd: conflictingWindowStart,
        }),
      ];

      for (const data of invalidOverrides) {
        await expect(
          prisma.healthcareEquipmentAssignmentConflictOverride.create({ data }),
        ).rejects.toBeDefined();
      }
    });

    it('rechaza relaciones y actor cross-tenant en ConflictOverride', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioA2 = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyBId);
      const assignmentA = await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenarioA),
      });
      const assignmentA2 = await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenarioA2),
      });
      const assignmentB = await prisma.healthcareEquipmentAssignment.create({
        data: buildAssignmentData(scenarioB),
      });

      await expect(
        prisma.healthcareEquipmentAssignmentConflictOverride.create({
          data: buildOverrideData(assignmentA.id, assignmentB.id),
        }),
      ).rejects.toBeDefined();
      await expect(
        prisma.healthcareEquipmentAssignmentConflictOverride.create({
          data: buildOverrideData(assignmentA.id, assignmentA2.id, {
            approvedById: fixture.userBId,
          }),
        }),
      ).rejects.toBeDefined();
    });

    it('acepta CoverageNote abierta y resuelta con actores same-tenant', async () => {
      const scenario = await createScenario(fixture.companyAId);

      await expect(
        prisma.healthcareEquipmentRequirementCoverageNote.createMany({
          data: [
            {
              id: randomUUID(),
              companyId: fixture.companyAId,
              requirementId: scenario.requirementId,
              kind: HealthcareEquipmentRequirementCoverageNoteKind.UNAVAILABLE,
              comment: 'No eligible unit currently available',
              recordedById: fixture.userAId,
            },
            {
              id: randomUUID(),
              companyId: fixture.companyAId,
              requirementId: scenario.requirementId,
              kind: HealthcareEquipmentRequirementCoverageNoteKind.PARTIAL_CONTEXT,
              comment: 'One unit pending',
              recordedById: fixture.userAId,
              resolvedAt: releasedAt,
              resolvedById: fixture.userAId,
            },
          ],
        }),
      ).resolves.toMatchObject({ count: 2 });
    });

    it('rechaza CoverageNote blank, resolución parcial y relaciones cross-tenant', async () => {
      const scenarioA = await createScenario(fixture.companyAId);
      const scenarioB = await createScenario(fixture.companyBId);
      const base = {
        companyId: fixture.companyAId,
        requirementId: scenarioA.requirementId,
        kind: HealthcareEquipmentRequirementCoverageNoteKind.UNAVAILABLE,
        comment: 'Unavailable',
        recordedById: fixture.userAId,
      } satisfies Omit<
        Prisma.HealthcareEquipmentRequirementCoverageNoteUncheckedCreateInput,
        'id'
      >;
      const invalidNotes: Prisma.HealthcareEquipmentRequirementCoverageNoteUncheckedCreateInput[] =
        [
          { id: randomUUID(), ...base, comment: '   ' },
          { id: randomUUID(), ...base, resolvedAt: releasedAt },
          {
            id: randomUUID(),
            ...base,
            requirementId: scenarioB.requirementId,
          },
          { id: randomUUID(), ...base, recordedById: fixture.userBId },
          {
            id: randomUUID(),
            ...base,
            resolvedAt: releasedAt,
            resolvedById: fixture.userBId,
          },
        ];

      for (const data of invalidNotes) {
        await expect(
          prisma.healthcareEquipmentRequirementCoverageNote.create({ data }),
        ).rejects.toBeDefined();
      }
    });

    it('permite una sola CoverageNote abierta por Requirement y kind', async () => {
      const scenario = await createScenario(fixture.companyAId);
      const buildNote = (
        overrides: Partial<Prisma.HealthcareEquipmentRequirementCoverageNoteUncheckedCreateInput> = {},
      ): Prisma.HealthcareEquipmentRequirementCoverageNoteUncheckedCreateInput => ({
        id: randomUUID(),
        companyId: fixture.companyAId,
        requirementId: scenario.requirementId,
        kind: HealthcareEquipmentRequirementCoverageNoteKind.UNAVAILABLE,
        comment: 'Unavailable',
        recordedById: fixture.userAId,
        ...overrides,
      });

      await prisma.healthcareEquipmentRequirementCoverageNote.create({
        data: buildNote(),
      });
      await expect(
        prisma.healthcareEquipmentRequirementCoverageNote.create({
          data: buildNote(),
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.healthcareEquipmentRequirementCoverageNote.create({
          data: buildNote({
            resolvedAt: releasedAt,
            resolvedById: fixture.userAId,
          }),
        }),
      ).resolves.toBeDefined();
    });

    it('acepta settings no negativos sin defaults persistidos', async () => {
      await expect(
        prisma.healthcareEquipmentAssignmentSettings.create({
          data: {
            companyId: fixture.companyAId,
            preCaseBufferMinutes: 0,
            postCaseBufferMinutes: 0,
          },
        }),
      ).resolves.toMatchObject({
        companyId: fixture.companyAId,
        preCaseBufferMinutes: 0,
        postCaseBufferMinutes: 0,
      });
      await expect(
        prisma.healthcareEquipmentAssignmentSettings.create({
          data: {
            companyId: fixture.companyAId,
            preCaseBufferMinutes: 10,
            postCaseBufferMinutes: 10,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it.each([
      { preCaseBufferMinutes: -1, postCaseBufferMinutes: 0 },
      { preCaseBufferMinutes: 0, postCaseBufferMinutes: -1 },
    ])('rechaza settings negativos: %o', async (buffers) => {
      const companyId = randomUUID();

      await prisma.company.create({
        data: {
          id: companyId,
          name: `HC-EA Settings ${companyId}`,
          rfc: `EAS${companyId.replaceAll('-', '').slice(0, 10)}`,
        },
      });

      try {
        await expect(
          prisma.healthcareEquipmentAssignmentSettings.create({
            data: { companyId, ...buffers },
          }),
        ).rejects.toBeDefined();
      } finally {
        await prisma.healthcareEquipmentAssignmentSettings.deleteMany({
          where: { companyId },
        });
        await prisma.company.delete({ where: { id: companyId } });
      }
    });

    it('instala enums, CHECKs, unique/index y FKs RESTRICT esperados', async () => {
      const enumNames = [
        'HealthcareEquipmentAssignmentLifecycle',
        'HealthcareEquipmentAssignmentOrigin',
        'HealthcareEquipmentAssignmentReleaseCause',
        'HealthcareEquipmentRequirementCoverageNoteKind',
      ];
      const checkNames = [
        'HealthcareEquipmentAssignmentConflictOverride_distinct_check',
        'HealthcareEquipmentAssignmentConflictOverride_reason_check',
        'HealthcareEquipmentAssignmentConflictOverride_windows_check',
        'HealthcareEquipmentAssignmentSettings_buffers_nonnegative_check',
        'HealthcareEquipmentAssignment_lifecycle_audit_check',
        'HealthcareEquipmentAssignment_origin_check',
        'HealthcareEquipmentAssignment_replaces_not_self_check',
        'HealthcareEquipmentRequirementCoverageNote_comment_check',
        'HealthcareEquipmentRequirementCoverageNote_resolution_check',
      ];
      const foreignKeyNames = [
        'HealthcareEquipmentAssignment_caseId_companyId_fkey',
        'HealthcareEquipmentAssignment_companyId_fkey',
        'HealthcareEquipmentAssignment_createdById_companyId_fkey',
        'HealthcareEquipmentAssignment_equipmentAssetId_companyId_fkey',
        'HealthcareEquipmentAssignment_releasedById_companyId_fkey',
        'HealthcareEquipmentAssignment_replacedById_companyId_fkey',
        'HealthcareEquipmentAssignment_replacesAssignmentId_company_fkey',
        'HealthcareEquipmentAssignment_requirementId_companyId_case_fkey',
        'HealthcareEquipmentAssignmentConflictOverride_approvedById_fkey',
        'HealthcareEquipmentAssignmentConflictOverride_assignmentId_fkey',
        'HealthcareEquipmentAssignmentConflictOverride_companyId_fkey',
        'HealthcareEquipmentAssignmentConflictOverride_conflictingA_fkey',
        'HealthcareEquipmentAssignmentSettings_companyId_fkey',
        'HealthcareEquipmentRequirementCoverageNote_companyId_fkey',
        'HealthcareEquipmentRequirementCoverageNote_recordedById_co_fkey',
        'HealthcareEquipmentRequirementCoverageNote_requirementId_c_fkey',
        'HealthcareEquipmentRequirementCoverageNote_resolvedById_co_fkey',
      ];
      const indexNames = [
        'HealthcareCaseRequirement_id_companyId_caseId_key',
        'HealthcareEquipmentAssignment_companyId_caseId_lifecycle_idx',
        'HealthcareEquipmentAssignment_companyId_equipmentAssetId_li_idx',
        'HealthcareEquipmentAssignment_companyId_replacesAssignmentI_key',
        'HealthcareEquipmentAssignment_companyId_requirementId_lifec_idx',
        'HealthcareEquipmentAssignment_id_companyId_key',
        'HealthcareEquipmentAssignment_reserved_case_asset_key',
        'HealthcareEquipmentAssignmentConflictOverride_companyId_ass_idx',
        'HealthcareEquipmentAssignmentConflictOverride_companyId_con_idx',
        'HealthcareEquipmentAssignmentConflictOverride_id_companyId_key',
        'HealthcareEquipmentRequirementCoverageNote_companyId_requir_idx',
        'HealthcareEquipmentRequirementCoverageNote_id_companyId_key',
        'HealthcareEquipmentRequirementCoverageNote_open_kind_key',
      ];
      const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
        SELECT typname
        FROM pg_type
        WHERE typname = ANY(${enumNames})
        ORDER BY typname
      `;
      const idempotencyScopeValues = await prisma.$queryRaw<
        Array<{ enumlabel: string }>
      >`
        SELECT enumlabel
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'IdempotencyScope'
        ORDER BY enumsortorder
      `;
      const checks = await prisma.$queryRaw<Array<{ conname: string }>>`
        SELECT conname
        FROM pg_constraint
        WHERE conname = ANY(${checkNames})
        ORDER BY conname
      `;
      const foreignKeys = await prisma.$queryRaw<
        Array<{ conname: string; confdeltype: string }>
      >`
        SELECT conname, confdeltype::text
        FROM pg_constraint
        WHERE conname = ANY(${foreignKeyNames})
        ORDER BY conname
      `;
      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE indexname = ANY(${indexNames})
        ORDER BY indexname
      `;

      expect(enums.map(({ typname }) => typname)).toEqual(
        [...enumNames].sort(),
      );
      expect(idempotencyScopeValues.map(({ enumlabel }) => enumlabel)).toEqual(
        expect.arrayContaining([
          'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE',
          'HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE',
          'HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE',
        ]),
      );
      expect(checks.map(({ conname }) => conname)).toEqual(
        [...checkNames].sort(),
      );
      expect(foreignKeys.map(({ conname }) => conname)).toEqual(
        [...foreignKeyNames].sort(),
      );
      expect(foreignKeys.every(({ confdeltype }) => confdeltype === 'r')).toBe(
        true,
      );
      expect(indexes.map(({ indexname }) => indexname)).toEqual(
        [...indexNames].sort(),
      );
    });
  },
);
