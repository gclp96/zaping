import 'dotenv/config';

import {
  EquipmentCondition,
  HealthcareCaseStatus,
  HealthcareRequirementType,
  Prisma,
  ProductInventoryTracking,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import {
  equipmentAssignmentSettingsAdvisoryLockKey,
  HealthcareEquipmentAssignmentsRepository,
} from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
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
  productId: string;
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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function getBackendPid(
  transaction: Prisma.TransactionClient,
): Promise<number> {
  const rows = await transaction.$queryRaw<Array<{ pid: number }>>(Prisma.sql`
    SELECT pg_backend_pid()::int AS "pid"
  `);

  const row = rows[0];

  if (!row) {
    throw new Error('Could not resolve PostgreSQL backend PID.');
  }

  return row.pid;
}

async function waitUntilBlockedBy(
  prisma: PrismaService,
  blockedPid: number,
  blockerPid: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await prisma.$queryRaw<Array<{ blocked: boolean }>>(Prisma.sql`
      SELECT
      CAST(${blockerPid} AS integer)
        = ANY(
            pg_blocking_pids(CAST(${blockedPid} AS integer))
          ) AS "blocked"
        `);

    if (rows[0]?.blocked === true) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `PostgreSQL backend ${blockedPid} was not blocked by ${blockerPid}.`,
  );
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
        productId,
        caseId,
        requirementId,
        equipmentAssetIds,
      };
    };

    const createRelatedCase = async (
      scenario: Scenario,
      options: { completeSchedule?: boolean } = {},
    ) => {
      const caseId = randomUUID();
      const requirementId = randomUUID();
      const completeSchedule = options.completeSchedule ?? true;

      await prisma.healthcareCase.create({
        data: {
          id: caseId,
          companyId: scenario.companyId,
          folio: `HC-EA-BE-${caseId}`,
          title: `Equipment Assignment Related Case ${caseId}`,
          scheduledStart: new Date('2026-09-16T16:00:00.000Z'),
          scheduledEnd: completeSchedule
            ? new Date('2026-09-16T18:00:00.000Z')
            : null,
          createdById: scenario.userId,
        },
      });
      await prisma.healthcareCaseRequirement.create({
        data: {
          id: requirementId,
          companyId: scenario.companyId,
          caseId,
          productId: scenario.productId,
          requestedQty: 1,
          type: HealthcareRequirementType.REQUIRED,
          sortOrder: 10,
          createdById: scenario.userId,
        },
      });

      return { caseId, requirementId };
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

      if (created.outcome !== 'CREATED' || replay.outcome !== 'CREATED') {
        throw new Error('Expected persisted create outcomes');
      }

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

      if (result.outcome !== 'CREATED') {
        throw new Error('Expected persisted create outcome');
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

    it('serializes overlapping same-asset creates so only one succeeds silently', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        requestedQty: 1,
        assetCount: 1,
      });
      const related = await createRelatedCase(scenario);
      const keys = [`asset-a-${randomUUID()}`, `asset-b-${randomUUID()}`];

      const results = await Promise.all([
        service.create(scenario.companyId, scenario.userId, keys[0], {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Caso concurrente A',
        }),
        service.create(scenario.companyId, scenario.userId, keys[1], {
          caseId: related.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Caso concurrente B',
        }),
      ]);

      expect(results.map((result) => result.outcome).sort()).toEqual([
        'CONFLICT_REVIEW_REQUIRED',
        'CREATED',
      ]);
      await expect(
        prisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
          },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.idempotencyRecord.count({
          where: { companyId: scenario.companyId, key: { in: keys } },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.healthcareEquipmentAssignmentConflictOverride.count({
          where: { companyId: scenario.companyId },
        }),
      ).resolves.toBe(0);
    });

    it('serializes concurrent Requirement creates so requestedQty cannot be exceeded', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        requestedQty: 1,
        assetCount: 2,
      });

      const results = await Promise.allSettled(
        scenario.equipmentAssetIds.map((equipmentAssetId) =>
          service.create(
            scenario.companyId,
            scenario.userId,
            `capacity-${randomUUID()}`,
            {
              caseId: scenario.caseId,
              equipmentAssetId,
              requirementId: scenario.requirementId,
            },
          ),
        ),
      );
      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: { response: { code: 'REQUIREMENT_OVER_COVERAGE' } },
      });
      await expect(
        prisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            requirementId: scenario.requirementId,
          },
        }),
      ).resolves.toBe(1);
    });

    it('makes a pending confirmation stale when the conflicting Case schedule changes', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });
      const candidate = await createRelatedCase(scenario);
      await service.create(
        scenario.companyId,
        scenario.userId,
        `existing-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Reserva existente',
        },
      );
      const reviewKey = `stale-${randomUUID()}`;
      const review = await service.create(
        scenario.companyId,
        scenario.userId,
        reviewKey,
        {
          caseId: candidate.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Reserva candidata',
        },
      );

      if (review.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected conflict review');
      }

      let releaseAssetLock!: () => void;
      let reportAssetLock!: () => void;
      const assetLocked = new Promise<void>((resolve) => {
        reportAssetLock = resolve;
      });
      const waitForRelease = new Promise<void>((resolve) => {
        releaseAssetLock = resolve;
      });
      const blocker = prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          SELECT "id"
          FROM "EquipmentAsset"
          WHERE "id" = ${scenario.equipmentAssetIds[0]}
            AND "companyId" = ${scenario.companyId}
          FOR UPDATE
        `);
        reportAssetLock();
        await waitForRelease;
      });
      await assetLocked;
      const confirmation = service.create(
        scenario.companyId,
        scenario.userId,
        reviewKey,
        {
          caseId: candidate.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Reserva candidata',
          confirmConflictOverride: true,
          conflictReviewFingerprint: review.conflictReviewFingerprint,
          conflictOverrideReason: 'Riesgo controlado',
        },
      );

      await prisma.healthcareCase.update({
        where: { id: scenario.caseId },
        data: {
          scheduledStart: new Date('2026-09-17T16:00:00.000Z'),
          scheduledEnd: new Date('2026-09-17T18:00:00.000Z'),
        },
      });
      releaseAssetLock();
      await blocker;
      const refreshed = await confirmation;

      expect(refreshed).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        overrideRequired: false,
        conflicts: [],
      });
      await expect(
        prisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            caseId: candidate.caseId,
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.idempotencyRecord.count({
          where: { companyId: scenario.companyId, key: reviewKey },
        }),
      ).resolves.toBe(0);
    });

    it('holds the candidate Case FOR SHARE until the protected transaction releases it', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });

      const holderReady = deferred<{
        pid: number;
        lockedCaseIds: string[];
      }>();
      const releaseHolder = deferred<void>();

      const holder = prisma.$transaction(async (transaction) => {
        const pid = await getBackendPid(transaction);

        const lockedCaseIds = await repository.lockHealthcareCasesForShare(
          transaction,
          scenario.companyId,
          [scenario.caseId],
        );

        holderReady.resolve({ pid, lockedCaseIds });
        await releaseHolder.promise;
      });

      const { pid: holderPid, lockedCaseIds } = await holderReady.promise;

      expect(lockedCaseIds).toEqual([scenario.caseId]);

      const updaterReady = deferred<number>();

      const updater = prisma.$transaction(async (transaction) => {
        const pid = await getBackendPid(transaction);
        updaterReady.resolve(pid);

        return transaction.healthcareCase.update({
          where: { id: scenario.caseId },
          data: {
            scheduledStart: new Date('2026-09-18T10:00:00.000Z'),
            scheduledEnd: new Date('2026-09-18T12:00:00.000Z'),
          },
        });
      });

      const updaterPid = await updaterReady.promise;

      try {
        await waitUntilBlockedBy(prisma, updaterPid, holderPid);
      } finally {
        releaseHolder.resolve(undefined);
      }

      await holder;
      await updater;

      await expect(
        prisma.healthcareCase.findUnique({
          where: { id: scenario.caseId },
          select: { scheduledStart: true },
        }),
      ).resolves.toEqual({
        scheduledStart: new Date('2026-09-18T10:00:00.000Z'),
      });
    });

    it('holds a related RESERVED Assignment Case FOR SHARE while evaluating availability', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });

      const related = await createRelatedCase(scenario, {
        completeSchedule: false,
      });

      const existing = await service.create(
        scenario.companyId,
        scenario.userId,
        `related-lock-existing-${randomUUID()}`,
        {
          caseId: related.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Reserva relacionada para lock test',
        },
      );

      expect(existing.outcome).toBe('CREATED');

      const references = await repository.findReservedAssignmentCaseIdsForAsset(
        scenario.companyId,
        scenario.equipmentAssetIds[0],
      );

      expect(references.map((reference) => reference.caseId)).toContain(
        related.caseId,
      );

      const holderReady = deferred<number>();
      const releaseHolder = deferred<void>();

      const holder = prisma.$transaction(async (transaction) => {
        const pid = await getBackendPid(transaction);

        await repository.lockHealthcareCasesForShare(
          transaction,
          scenario.companyId,
          references.map((reference) => reference.caseId),
        );

        holderReady.resolve(pid);
        await releaseHolder.promise;
      });

      const holderPid = await holderReady.promise;
      const updaterReady = deferred<number>();

      const updater = prisma.$transaction(async (transaction) => {
        const pid = await getBackendPid(transaction);
        updaterReady.resolve(pid);

        return transaction.healthcareCase.update({
          where: { id: related.caseId },
          data: {
            scheduledEnd: new Date('2026-09-16T18:00:00.000Z'),
          },
        });
      });

      const updaterPid = await updaterReady.promise;

      try {
        await waitUntilBlockedBy(prisma, updaterPid, holderPid);
      } finally {
        releaseHolder.resolve(undefined);
      }

      await holder;
      await updater;
    });

    it('protects an existing Equipment Assignment settings row during final evaluation', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });

      await prisma.healthcareEquipmentAssignmentSettings.deleteMany({
        where: { companyId: scenario.companyId },
      });

      await prisma.healthcareEquipmentAssignmentSettings.create({
        data: {
          companyId: scenario.companyId,
          preCaseBufferMinutes: 120,
          postCaseBufferMinutes: 180,
        },
      });

      const holderReady = deferred<number>();
      const releaseHolder = deferred<void>();

      const holder = prisma.$transaction(async (transaction) => {
        await repository.acquireSettingsSharedAdvisoryLock(
          transaction,
          scenario.companyId,
        );

        const settings = await repository.findSettingsForShare(
          transaction,
          scenario.companyId,
        );

        expect(settings).toEqual({
          preCaseBufferMinutes: 120,
          postCaseBufferMinutes: 180,
        });

        holderReady.resolve(await getBackendPid(transaction));
        await releaseHolder.promise;
      });

      const holderPid = await holderReady.promise;
      const updaterReady = deferred<number>();

      const updater = prisma.$transaction(async (transaction) => {
        const pid = await getBackendPid(transaction);
        updaterReady.resolve(pid);

        return transaction.healthcareEquipmentAssignmentSettings.update({
          where: { companyId: scenario.companyId },
          data: {
            preCaseBufferMinutes: 45,
            postCaseBufferMinutes: 60,
          },
        });
      });

      const updaterPid = await updaterReady.promise;

      try {
        await waitUntilBlockedBy(prisma, updaterPid, holderPid);
      } finally {
        releaseHolder.resolve(undefined);
      }

      await holder;
      await updater;

      await expect(
        prisma.healthcareEquipmentAssignmentSettings.findUnique({
          where: { companyId: scenario.companyId },
          select: {
            preCaseBufferMinutes: true,
            postCaseBufferMinutes: true,
          },
        }),
      ).resolves.toEqual({
        preCaseBufferMinutes: 45,
        postCaseBufferMinutes: 60,
      });

      await prisma.healthcareEquipmentAssignmentSettings.delete({
        where: { companyId: scenario.companyId },
      });
    });

    it('protects the absent settings state with the shared advisory lock contract', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });

      await prisma.healthcareEquipmentAssignmentSettings.deleteMany({
        where: { companyId: scenario.companyId },
      });

      const lockKey = equipmentAssignmentSettingsAdvisoryLockKey(
        scenario.companyId,
      );

      const holderReady = deferred<number>();
      const releaseHolder = deferred<void>();

      const holder = prisma.$transaction(async (transaction) => {
        await repository.acquireSettingsSharedAdvisoryLock(
          transaction,
          scenario.companyId,
        );

        holderReady.resolve(await getBackendPid(transaction));
        await releaseHolder.promise;
      });

      const holderPid = await holderReady.promise;
      const updaterReady = deferred<number>();

      const futureSettingsMutation = prisma.$transaction(
        async (transaction) => {
          const pid = await getBackendPid(transaction);
          updaterReady.resolve(pid);

          await transaction.$queryRaw<Array<{ lock: string }>>(Prisma.sql`
      SELECT pg_advisory_xact_lock(${lockKey})::text AS "lock"
    `);

          return transaction.healthcareEquipmentAssignmentSettings.create({
            data: {
              companyId: scenario.companyId,
              preCaseBufferMinutes: 30,
              postCaseBufferMinutes: 30,
            },
          });
        },
      );

      const updaterPid = await updaterReady.promise;

      try {
        await waitUntilBlockedBy(prisma, updaterPid, holderPid);
      } finally {
        releaseHolder.resolve(undefined);
      }

      await holder;
      await futureSettingsMutation;

      await expect(
        prisma.healthcareEquipmentAssignmentSettings.findUnique({
          where: { companyId: scenario.companyId },
          select: {
            preCaseBufferMinutes: true,
            postCaseBufferMinutes: true,
          },
        }),
      ).resolves.toEqual({
        preCaseBufferMinutes: 30,
        postCaseBufferMinutes: 30,
      });

      await prisma.healthcareEquipmentAssignmentSettings.delete({
        where: { companyId: scenario.companyId },
      });
    });

    it('uses the latest Case schedule committed before protected Case locking', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });

      const assetLocked = deferred<void>();
      const releaseAssetLock = deferred<void>();

      const blocker = prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "EquipmentAsset"
      WHERE "id" = ${scenario.equipmentAssetIds[0]}
        AND "companyId" = ${scenario.companyId}
      FOR UPDATE
    `);

        assetLocked.resolve(undefined);
        await releaseAssetLock.promise;
      });

      await assetLocked.promise;

      const create = service.create(
        scenario.companyId,
        scenario.userId,
        `authoritative-reread-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Prueba de reread autoritativo',
        },
      );

      await prisma.healthcareCase.update({
        where: { id: scenario.caseId },
        data: {
          scheduledEnd: null,
        },
      });

      releaseAssetLock.resolve(undefined);
      await blocker;

      const result = await create;

      expect(result.outcome).toBe('CREATED');

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

    it('observes a Case cancellation committed before protected reread and rejects Create', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });

      const assetLocked = deferred<void>();
      const releaseAssetLock = deferred<void>();

      const blocker = prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "EquipmentAsset"
      WHERE "id" = ${scenario.equipmentAssetIds[0]}
        AND "companyId" = ${scenario.companyId}
      FOR UPDATE
    `);

        assetLocked.resolve(undefined);
        await releaseAssetLock.promise;
      });

      await assetLocked.promise;

      const create = service.create(
        scenario.companyId,
        scenario.userId,
        `cancelled-reread-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'No debe persistir',
        },
      );

      await prisma.healthcareCase.update({
        where: { id: scenario.caseId },
        data: {
          status: HealthcareCaseStatus.CANCELLED,
          cancelledAt: new Date('2026-09-16T19:00:00.000Z'),
          cancelledById: scenario.userId,
          cancellationReason: 'Cancelación concurrente para prueba C3',
        },
      });

      releaseAssetLock.resolve(undefined);
      await blocker;

      await expect(create).rejects.toMatchObject({
        response: { code: 'CASE_EQUIPMENT_ASSIGNMENTS_READ_ONLY' },
      });

      await expect(
        prisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            caseId: scenario.caseId,
          },
        }),
      ).resolves.toBe(0);
    });

    it('rolls back Assignment, override audit and claim when atomic completion fails', async () => {
      const scenario = await createScenario(fixture.companyAId, {
        assetCount: 1,
      });
      const candidate = await createRelatedCase(scenario);
      await service.create(
        scenario.companyId,
        scenario.userId,
        `rollback-existing-${randomUUID()}`,
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Reserva existente',
        },
      );
      const key = `rollback-confirm-${randomUUID()}`;
      const review = await service.create(
        scenario.companyId,
        scenario.userId,
        key,
        {
          caseId: candidate.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'Reserva candidata',
        },
      );

      if (review.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected conflict review');
      }

      const completion = jest
        .spyOn(repository, 'completeIdempotencyClaim')
        .mockRejectedValueOnce(new Error('forced atomic rollback'));

      try {
        await expect(
          service.create(scenario.companyId, scenario.userId, key, {
            caseId: candidate.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            directAssignmentReason: 'Reserva candidata',
            confirmConflictOverride: true,
            conflictReviewFingerprint: review.conflictReviewFingerprint,
            conflictOverrideReason: 'Riesgo controlado',
          }),
        ).rejects.toThrow('forced atomic rollback');
      } finally {
        completion.mockRestore();
      }

      await expect(
        prisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            caseId: candidate.caseId,
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.healthcareEquipmentAssignmentConflictOverride.count({
          where: {
            companyId: scenario.companyId,
            assignment: { caseId: candidate.caseId },
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.idempotencyRecord.count({
          where: { companyId: scenario.companyId, key },
        }),
      ).resolves.toBe(0);
    });
  },
);
