import {
  ExecutionContext,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EquipmentCondition,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareRequirementLifecycle,
  HealthcareRequirementType,
  IdempotencyScope,
  Prisma,
  ProductInventoryTracking,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guards';
import { HealthcareCompanyLockTimeoutError } from '../src/healthcare/common/healthcare-company-lock-timeout.error';
import { deriveHealthcareCompanyLockKey } from '../src/healthcare/common/healthcare-company-lock-key';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import {
  classifyHealthcareTransactionError,
  HEALTHCARE_TRANSACTION_ERROR_KINDS,
} from '../src/healthcare/common/healthcare-transaction-error-classification';
import { HealthcareEquipmentAssignmentsController } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.controller';
import { HealthcareEquipmentAssignmentsRepository } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { HealthcareRequirementsService } from '../src/healthcare/requirements/healthcare-requirements.service';
import { NoopRequirementOperationalEvidencePolicy } from '../src/healthcare/requirements/requirement-operational-evidence-policy';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30_000);

const RUN_FLAG = 'RUN_HC_LOCK_2H_POSTGRES_TESTS';
const CONNECTION_VARIABLE = 'HC_LOCK_2H_DATABASE_URL';
const EXPECTED_DATABASE = 'zaping_spike_test';
const EXPECTED_USER = 'zaping_hc_lock_2h';
const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_HOST_PORT = '5434';
const EXPECTED_SERVER_PORT = 5432;
const CLIENT_COUNT = 8;
const OPERATION_TIMEOUT_MS = 12_000;
const CLEANUP_TIMEOUT_MS = 15_000;
const DISCONNECT_TIMEOUT_MS = 8_000;

const requiredTables = [
  'Company',
  'User',
  'Product',
  'HealthcareCase',
  'HealthcareCaseRequirement',
  'EquipmentAsset',
  'HealthcareEquipmentAssignment',
  'HealthcareEquipmentAssignmentConflictOverride',
  'HealthcareEquipmentRequirementCoverageNote',
  'HealthcareEquipmentAssignmentSettings',
  'IdempotencyRecord',
] as const;

const requiredRowLockPrivileges = [
  { tableName: 'EquipmentAsset', lockColumn: 'id' },
  { tableName: 'HealthcareCase', lockColumn: 'id' },
  { tableName: 'HealthcareCaseRequirement', lockColumn: 'id' },
  { tableName: 'HealthcareEquipmentAssignment', lockColumn: 'id' },
  {
    tableName: 'HealthcareEquipmentAssignmentSettings',
    lockColumn: 'companyId',
  },
  { tableName: 'Product', lockColumn: 'id' },
] as const;

const runPostgreSqlTests = process.env[RUN_FLAG] === '1';
const explicitConnectionUrl = runPostgreSqlTests
  ? requireExplicitConnectionUrl()
  : null;
const describePostgreSql = runPostgreSqlTests ? describe : describe.skip;

type RawQueryClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

type DatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  serverAddress: string;
  serverPort: number;
  serverVersionNumber: string;
  currentSchema: string;
  backendPid: number;
};

type Scenario = {
  companyId: string;
  userId: string;
  productIds: string[];
  caseId: string;
  requirementIds: string[];
  equipmentAssetIds: string[];
};

type ControlledTransaction = {
  pid: number;
  release: () => void;
  done: Promise<void>;
};

type RunFixtureRegistry = {
  companyIds: Set<string>;
  userIds: Set<string>;
  productIds: Set<string>;
  caseIds: Set<string>;
  requirementIds: Set<string>;
  equipmentAssetIds: Set<string>;
  assignmentIds: Set<string>;
  idempotencyKeys: Set<string>;
};

class ExplicitPrismaService extends PrismaService {
  constructor(datasourceUrl: string) {
    super({ datasourceUrl });
  }
}

describePostgreSql(
  'Healthcare Company lock consumers — integrated PostgreSQL',
  () => {
    const policy = healthcareCompanyTransactionTimeoutConfiguration();
    const runId = randomUUID();
    const companyAId = randomUUID();
    const companyBId = randomUUID();
    const userAId = randomUUID();
    const userBId = randomUUID();
    const registry: RunFixtureRegistry = {
      companyIds: new Set([companyAId, companyBId]),
      userIds: new Set([userAId, userBId]),
      productIds: new Set(),
      caseIds: new Set(),
      requirementIds: new Set(),
      equipmentAssetIds: new Set(),
      assignmentIds: new Set(),
      idempotencyKeys: new Set(),
    };
    const clients: ExplicitPrismaService[] = [];

    let setupPrisma: ExplicitPrismaService;
    let observerPrisma: ExplicitPrismaService;
    let blockerPrisma: ExplicitPrismaService;
    let assignmentPrisma: ExplicitPrismaService;
    let requirementPrisma: ExplicitPrismaService;
    let httpPrisma: ExplicitPrismaService;
    let deadlockAPrisma: ExplicitPrismaService;
    let deadlockBPrisma: ExplicitPrismaService;
    let assignmentRepository: HealthcareEquipmentAssignmentsRepository;
    let assignmentService: HealthcareEquipmentAssignmentsService;
    let requirementService: HealthcareRequirementsService;
    let httpRepository: HealthcareEquipmentAssignmentsRepository;
    let httpService: HealthcareEquipmentAssignmentsService;
    let httpApp: INestApplication<App> | null = null;
    let databaseReady = false;
    let fixturesStarted = false;

    const userForCompany = (companyId: string): string => {
      if (companyId === companyAId) {
        return userAId;
      }
      if (companyId === companyBId) {
        return userBId;
      }
      throw new Error('Unknown run-owned Company ID.');
    };

    const trackKey = (prefix: string): string => {
      const key = `${prefix}-${randomUUID()}`;
      registry.idempotencyKeys.add(key);
      return key;
    };

    beforeAll(async () => {
      if (!explicitConnectionUrl) {
        throw new Error(
          `${CONNECTION_VARIABLE} is required when ${RUN_FLAG}=1.`,
        );
      }

      for (let index = 0; index < CLIENT_COUNT; index += 1) {
        try {
          const client = createIsolatedClient(explicitConnectionUrl);
          clients.push(client);
          await client.$connect();
        } catch {
          throw new Error(
            'Could not create or connect an isolated HC-LOCK-02 2H Prisma client.',
          );
        }
      }

      [
        setupPrisma,
        observerPrisma,
        blockerPrisma,
        assignmentPrisma,
        requirementPrisma,
        httpPrisma,
        deadlockAPrisma,
        deadlockBPrisma,
      ] = clients;

      const identities = await Promise.all(
        clients.map((client) => readAndValidateDatabaseIdentity(client)),
      );
      const [expectedIdentity] = identities;
      for (const identity of identities.slice(1)) {
        if (
          identity.serverAddress !== expectedIdentity.serverAddress ||
          identity.serverPort !== expectedIdentity.serverPort ||
          identity.serverVersionNumber !== expectedIdentity.serverVersionNumber
        ) {
          throw new Error(
            'HC-LOCK-02 2H clients did not reach one PostgreSQL server identity.',
          );
        }
      }

      await assertExpectedSchema(setupPrisma);
      await assertRequiredRowLockPrivileges(setupPrisma);
      await assertExclusiveTargetAvailability(observerPrisma, clients);
      databaseReady = true;

      assignmentRepository = new HealthcareEquipmentAssignmentsRepository(
        assignmentPrisma,
      );
      assignmentService = new HealthcareEquipmentAssignmentsService(
        assignmentRepository,
        policy,
      );
      requirementService = new HealthcareRequirementsService(
        requirementPrisma,
        new NoopRequirementOperationalEvidencePolicy(),
        policy,
      );
      httpRepository = new HealthcareEquipmentAssignmentsRepository(httpPrisma);
      httpService = new HealthcareEquipmentAssignmentsService(
        httpRepository,
        policy,
      );

      fixturesStarted = true;
      await createRunOwners();
      await createHttpHarness();
    }, 25_000);

    beforeEach(async () => {
      await assertExclusiveTargetAvailability(observerPrisma, clients);
    });

    afterEach(async () => {
      if (databaseReady && fixturesStarted) {
        await refreshRunFixtureRegistry(setupPrisma, registry);
      }
    });

    afterAll(async () => {
      const errors: unknown[] = [];

      if (httpApp) {
        try {
          await withTimeout(
            httpApp.close(),
            DISCONNECT_TIMEOUT_MS,
            'HTTP app close',
          );
        } catch (error) {
          errors.push(error);
        } finally {
          httpApp = null;
        }
      }

      if (databaseReady && fixturesStarted) {
        try {
          await withTimeout(
            cleanupRunFixtures(setupPrisma, registry),
            CLEANUP_TIMEOUT_MS,
            '2H fixture cleanup',
          );
          await assertNoRunOwnedRecords(setupPrisma, registry);
        } catch (error) {
          errors.push(error);
        }
      }

      try {
        await disconnectEveryClient(clients);
      } catch (error) {
        errors.push(error);
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, 'HC-LOCK-02 2H suite cleanup failed.');
      }
    });

    async function createRunOwners(): Promise<void> {
      await setupPrisma.company.createMany({
        data: [
          {
            id: companyAId,
            name: `HC-LOCK-02 2H Company A ${runId}`,
            rfc: `L2A${runId.replaceAll('-', '').slice(0, 10)}`,
          },
          {
            id: companyBId,
            name: `HC-LOCK-02 2H Company B ${runId}`,
            rfc: `L2B${runId.replaceAll('-', '').slice(0, 10)}`,
          },
        ],
      });
      await setupPrisma.user.createMany({
        data: [
          {
            id: userAId,
            companyId: companyAId,
            firstName: 'HC-LOCK-02',
            lastName: '2H User A',
            email: `hc-lock-2h-a-${runId}@example.test`,
            passwordHash: 'not-used-by-test-owned-authentication',
            role: UserRole.ADMIN,
          },
          {
            id: userBId,
            companyId: companyBId,
            firstName: 'HC-LOCK-02',
            lastName: '2H User B',
            email: `hc-lock-2h-b-${runId}@example.test`,
            passwordHash: 'not-used-by-test-owned-authentication',
            role: UserRole.ADMIN,
          },
        ],
      });
    }

    async function createHttpHarness(): Promise<void> {
      const authenticatedUser = {
        id: userAId,
        companyId: companyAId,
        role: UserRole.ADMIN,
      };
      const testAuthGuard = {
        canActivate(context: ExecutionContext): boolean {
          const request = context.switchToHttp().getRequest<{
            user?: typeof authenticatedUser;
          }>();
          request.user = authenticatedUser;
          return true;
        },
      };
      const moduleRef = await Test.createTestingModule({
        controllers: [HealthcareEquipmentAssignmentsController],
        providers: [
          {
            provide: HealthcareEquipmentAssignmentsService,
            useValue: httpService,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(testAuthGuard)
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

      httpApp = moduleRef.createNestApplication();
      httpApp.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await httpApp.init();
    }

    async function createScenario(
      companyId: string,
      options: {
        requestedQty?: number;
        assetCount?: number;
        requirementCount?: number;
      } = {},
    ): Promise<Scenario> {
      const userId = userForCompany(companyId);
      const caseId = randomUUID();
      const requirementCount = options.requirementCount ?? 1;
      const productIds = Array.from({ length: requirementCount }, () =>
        randomUUID(),
      );
      const requirementIds = Array.from({ length: requirementCount }, () =>
        randomUUID(),
      );
      const equipmentAssetIds = Array.from(
        { length: options.assetCount ?? 2 },
        () => randomUUID(),
      );

      productIds.forEach((id) => registry.productIds.add(id));
      requirementIds.forEach((id) => registry.requirementIds.add(id));
      equipmentAssetIds.forEach((id) => registry.equipmentAssetIds.add(id));
      registry.caseIds.add(caseId);

      await setupPrisma.product.createMany({
        data: productIds.map((id, index) => ({
          id,
          companyId,
          sku: `HC-L2H-${id}`,
          name: `HC-LOCK-02 2H Product ${index}`,
          inventoryTracking: ProductInventoryTracking.ASSET,
        })),
      });
      await setupPrisma.healthcareCase.create({
        data: {
          id: caseId,
          companyId,
          folio: `HC-L2H-${caseId}`,
          title: `HC-LOCK-02 2H Case ${caseId}`,
          scheduledStart: new Date('2026-09-22T15:00:00.000Z'),
          scheduledEnd: new Date('2026-09-22T17:00:00.000Z'),
          createdById: userId,
        },
      });
      await setupPrisma.healthcareCaseRequirement.createMany({
        data: requirementIds.map((id, index) => ({
          id,
          companyId,
          caseId,
          productId: productIds[index],
          requestedQty: index === 0 ? (options.requestedQty ?? 2) : 1,
          type: HealthcareRequirementType.REQUIRED,
          sortOrder: (index + 1) * 10,
          createdById: userId,
        })),
      });
      await setupPrisma.equipmentAsset.createMany({
        data: equipmentAssetIds.map((id) => ({
          id,
          companyId,
          productId: productIds[0],
          assetCode: `HC-L2H-${id}`,
          condition: EquipmentCondition.GOOD,
        })),
      });

      return {
        companyId,
        userId,
        productIds,
        caseId,
        requirementIds,
        equipmentAssetIds,
      };
    }

    async function createRelatedCase(
      scenario: Scenario,
    ): Promise<{ caseId: string; requirementId: string }> {
      const caseId = randomUUID();
      const requirementId = randomUUID();
      registry.caseIds.add(caseId);
      registry.requirementIds.add(requirementId);

      await setupPrisma.healthcareCase.create({
        data: {
          id: caseId,
          companyId: scenario.companyId,
          folio: `HC-L2H-${caseId}`,
          title: `HC-LOCK-02 2H Related Case ${caseId}`,
          scheduledStart: new Date('2026-09-22T16:00:00.000Z'),
          scheduledEnd: new Date('2026-09-22T18:00:00.000Z'),
          createdById: scenario.userId,
        },
      });
      await setupPrisma.healthcareCaseRequirement.create({
        data: {
          id: requirementId,
          companyId: scenario.companyId,
          caseId,
          productId: scenario.productIds[0],
          requestedQty: 1,
          type: HealthcareRequirementType.REQUIRED,
          sortOrder: 10,
          createdById: scenario.userId,
        },
      });

      return { caseId, requirementId };
    }

    async function createDirectSource(
      scenario: Scenario,
      service = assignmentService,
    ) {
      const result = await service.create(
        scenario.companyId,
        scenario.userId,
        trackKey('direct-source'),
        {
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          directAssignmentReason: 'HC-LOCK-02 2H controlled direct source',
        },
      );
      if (result.outcome !== 'CREATED') {
        throw new Error('Expected a direct source Assignment.');
      }
      registry.assignmentIds.add(result.data.id);
      return result.data;
    }

    async function runSerializedCrossConsumerRace<TFirst, TSecond>(
      assetId: string,
      companyId: string,
      first: () => Promise<TFirst>,
      second: () => Promise<TSecond>,
    ): Promise<[TFirst, TSecond]> {
      const firstPid = await getBackendPid(assignmentPrisma);
      const secondPid = await getBackendPid(requirementPrisma);
      const blocker = await startAssetRowBlocker(
        blockerPrisma,
        companyId,
        assetId,
      );
      let firstOperation: Promise<TFirst> | null = null;
      let secondOperation: Promise<TSecond> | null = null;

      try {
        firstOperation = first();
        await waitUntilBlockedBy(observerPrisma, firstPid, blocker.pid);
        secondOperation = second();
        await waitUntilBlockedBy(observerPrisma, secondPid, firstPid);
        blocker.release();

        return await withTimeout(
          Promise.all([firstOperation, secondOperation]),
          OPERATION_TIMEOUT_MS,
          'serialized cross-consumer race',
        );
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          ...(firstOperation ? [firstOperation] : []),
          ...(secondOperation ? [secondOperation] : []),
        ]);
        throwWithCleanupErrors(error, cleanupErrors, 'cross-consumer race');
      }
    }

    it('serializes Create before Requirement Update in the same Company', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 1,
      });
      const key = trackKey('create-update');
      const [created, updated] = await runSerializedCrossConsumerRace(
        scenario.equipmentAssetIds[0],
        scenario.companyId,
        () =>
          assignmentService.create(scenario.companyId, scenario.userId, key, {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            requirementId: scenario.requirementIds[0],
          }),
        () =>
          requirementService.update(
            scenario.companyId,
            scenario.requirementIds[0],
            { requestedQty: 2 },
          ),
      );

      expect(created.outcome).toBe('CREATED');
      expect(updated.requestedQty).toBe(2);
      if (created.outcome === 'CREATED') {
        registry.assignmentIds.add(created.data.id);
      }
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            requirementId: scenario.requirementIds[0],
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          },
        }),
      ).resolves.toBe(1);
    });

    it('serializes Create before Requirement Retire without derived release', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 1,
      });
      const [created, retired] = await runSerializedCrossConsumerRace(
        scenario.equipmentAssetIds[0],
        scenario.companyId,
        () =>
          assignmentService.create(
            scenario.companyId,
            scenario.userId,
            trackKey('create-retire'),
            {
              caseId: scenario.caseId,
              equipmentAssetId: scenario.equipmentAssetIds[0],
              requirementId: scenario.requirementIds[0],
            },
          ),
        () =>
          requirementService.retire(
            scenario.companyId,
            scenario.userId,
            scenario.requirementIds[0],
            { retirementReason: 'HC-LOCK-02 2H controlled retirement' },
          ),
      );

      expect(created.outcome).toBe('CREATED');
      expect(retired.lifecycle).toBe(HealthcareRequirementLifecycle.RETIRED);
      if (created.outcome === 'CREATED') {
        registry.assignmentIds.add(created.data.id);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUnique({
            where: { id: created.data.id },
            select: { lifecycle: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        });
      }
    });

    it('serializes Replace before Requirement Reactivate', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 2 });
      const source = await createDirectSource(scenario);
      await requirementService.retire(
        scenario.companyId,
        scenario.userId,
        scenario.requirementIds[0],
        { retirementReason: 'Prepare controlled reactivation' },
      );
      const replacementReason = 'HC-LOCK-02 2H controlled replacement';
      const [replacement, reactivated] = await runSerializedCrossConsumerRace(
        scenario.equipmentAssetIds[1],
        scenario.companyId,
        () =>
          assignmentService.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            trackKey('replace-reactivate'),
            {
              equipmentAssetId: scenario.equipmentAssetIds[1],
              replacementReason,
            },
          ),
        () =>
          requirementService.reactivate(
            scenario.companyId,
            scenario.userId,
            scenario.requirementIds[0],
          ),
      );

      expect(replacement.outcome).toBe('REPLACED');
      expect(reactivated.lifecycle).toBe(HealthcareRequirementLifecycle.ACTIVE);
      if (replacement.outcome === 'REPLACED') {
        const replacementId = replacement.data.replacementAssignment.id;
        registry.assignmentIds.add(replacementId);
        expect(replacement.data.replacedAssignment).toMatchObject({
          id: source.id,
          status: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacement: {
            successorAssignmentId: replacementId,
            reason: replacementReason,
          },
        });
        expect(replacement.data.replacementAssignment).toMatchObject({
          id: replacementId,
          caseId: scenario.caseId,
          requirementId: null,
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
          status: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          replacesAssignmentId: source.id,
          equipmentAsset: { id: scenario.equipmentAssetIds[1] },
        });

        const [persistedSource, persistedReplacement, persistedRequirement] =
          await Promise.all([
            setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
              where: { id: source.id },
              select: {
                lifecycle: true,
                replacedAt: true,
                replacedById: true,
                replacementReason: true,
                replacementAssignments: { select: { id: true } },
              },
            }),
            setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
              where: { id: replacementId },
              select: {
                companyId: true,
                caseId: true,
                equipmentAssetId: true,
                requirementId: true,
                origin: true,
                lifecycle: true,
                directAssignmentReason: true,
                replacesAssignmentId: true,
                createdById: true,
              },
            }),
            setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
              where: { id: scenario.requirementIds[0] },
              select: {
                lifecycle: true,
                reactivatedAt: true,
                reactivatedById: true,
              },
            }),
          ]);

        expect(persistedSource).toMatchObject({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacedById: scenario.userId,
          replacementReason,
          replacementAssignments: [{ id: replacementId }],
        });
        expect(persistedSource.replacedAt).toBeInstanceOf(Date);
        expect(persistedReplacement).toEqual({
          companyId: scenario.companyId,
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[1],
          requirementId: null,
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          directAssignmentReason: source.directAssignmentReason,
          replacesAssignmentId: source.id,
          createdById: scenario.userId,
        });
        expect(persistedRequirement).toMatchObject({
          lifecycle: HealthcareRequirementLifecycle.ACTIVE,
          reactivatedById: scenario.userId,
        });
        expect(persistedRequirement.reactivatedAt).toBeInstanceOf(Date);
      }
    });

    it('serializes Replace before Requirement Reorder', async () => {
      const scenario = await createScenario(companyAId, {
        assetCount: 2,
        requirementCount: 2,
      });
      const source = await createDirectSource(scenario);
      const [replacement, reordered] = await runSerializedCrossConsumerRace(
        scenario.equipmentAssetIds[1],
        scenario.companyId,
        () =>
          assignmentService.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            trackKey('replace-reorder'),
            {
              equipmentAssetId: scenario.equipmentAssetIds[1],
              replacementReason: 'HC-LOCK-02 2H controlled reorder race',
            },
          ),
        () =>
          requirementService.reorder(scenario.companyId, scenario.caseId, {
            items: [
              { requirementId: scenario.requirementIds[0], sortOrder: 20 },
              { requirementId: scenario.requirementIds[1], sortOrder: 10 },
            ],
          }),
      );

      expect(replacement.outcome).toBe('REPLACED');
      expect(
        reordered.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
      ).toEqual([
        { id: scenario.requirementIds[1], sortOrder: 10 },
        { id: scenario.requirementIds[0], sortOrder: 20 },
      ]);
      if (replacement.outcome === 'REPLACED') {
        registry.assignmentIds.add(replacement.data.replacementAssignment.id);
      }
    });

    it('does not serialize independent Companies', async () => {
      const scenarioA = await createScenario(companyAId, { assetCount: 1 });
      const scenarioB = await createScenario(companyBId, { assetCount: 1 });
      const assignmentPid = await getBackendPid(assignmentPrisma);
      const blocker = await startAssetRowBlocker(
        blockerPrisma,
        scenarioA.companyId,
        scenarioA.equipmentAssetIds[0],
      );
      const blockedCreate = assignmentService.create(
        scenarioA.companyId,
        scenarioA.userId,
        trackKey('independent-company-create'),
        {
          caseId: scenarioA.caseId,
          equipmentAssetId: scenarioA.equipmentAssetIds[0],
          requirementId: scenarioA.requirementIds[0],
        },
      );

      try {
        await waitUntilBlockedBy(observerPrisma, assignmentPid, blocker.pid);
        const updated = await withTimeout(
          requirementService.update(
            scenarioB.companyId,
            scenarioB.requirementIds[0],
            { requestedQty: 3 },
          ),
          1_000,
          'different-Company Requirement Update',
        );
        expect(updated.requestedQty).toBe(3);
        await waitUntilBlockedBy(observerPrisma, assignmentPid, blocker.pid);
        blocker.release();
        const created = await withTimeout(
          blockedCreate,
          OPERATION_TIMEOUT_MS,
          'different-Company Create completion',
        );
        expect(created.outcome).toBe('CREATED');
        if (created.outcome === 'CREATED') {
          registry.assignmentIds.add(created.data.id);
        }
        await blocker.done;
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          blockedCreate,
        ]);
        throwWithCleanupErrors(error, cleanupErrors, 'different-Company race');
      }
    });

    it('replays Create without additional Assignment or claim writes', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 1 });
      const key = trackKey('create-replay');
      const dto = {
        caseId: scenario.caseId,
        equipmentAssetId: scenario.equipmentAssetIds[0],
        requirementId: scenario.requirementIds[0],
      };

      const first = await assignmentService.create(
        scenario.companyId,
        scenario.userId,
        key,
        dto,
      );
      const replay = await assignmentService.create(
        scenario.companyId,
        scenario.userId,
        key,
        dto,
      );

      expect(first.outcome).toBe('CREATED');
      expect(replay.outcome).toBe('CREATED');
      if (first.outcome === 'CREATED' && replay.outcome === 'CREATED') {
        registry.assignmentIds.add(first.data.id);
        expect(replay.data.id).toBe(first.data.id);
      }
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: { companyId: scenario.companyId, caseId: scenario.caseId },
        }),
      ).resolves.toBe(1);
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
            key,
          },
        }),
      ).resolves.toBe(1);
    });

    it('replays Replace after the source is already REPLACED', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 2 });
      const source = await createDirectSource(scenario);
      const key = trackKey('replace-replay');
      const dto = {
        equipmentAssetId: scenario.equipmentAssetIds[1],
        replacementReason: 'HC-LOCK-02 2H replay',
      };
      const first = await assignmentService.replace(
        scenario.companyId,
        scenario.userId,
        source.id,
        key,
        dto,
      );
      const stateBeforeReplay =
        await setupPrisma.healthcareEquipmentAssignment.findMany({
          where: {
            companyId: scenario.companyId,
            OR: [{ id: source.id }, { replacesAssignmentId: source.id }],
          },
          orderBy: { id: 'asc' },
        });
      const claimBeforeReplay = await setupPrisma.idempotencyRecord.findUnique({
        where: {
          companyId_scope_key: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
            key,
          },
        },
      });
      const replay = await assignmentService.replace(
        scenario.companyId,
        scenario.userId,
        source.id,
        key,
        dto,
      );

      expect(first.outcome).toBe('REPLACED');
      expect(replay.outcome).toBe('REPLACED');
      if (first.outcome === 'REPLACED' && replay.outcome === 'REPLACED') {
        registry.assignmentIds.add(first.data.replacementAssignment.id);
        expect(replay.data.replacementAssignment.id).toBe(
          first.data.replacementAssignment.id,
        );
      }
      await expect(
        setupPrisma.healthcareEquipmentAssignment.findMany({
          where: {
            companyId: scenario.companyId,
            OR: [{ id: source.id }, { replacesAssignmentId: source.id }],
          },
          orderBy: { id: 'asc' },
        }),
      ).resolves.toEqual(stateBeforeReplay);
      await expect(
        setupPrisma.idempotencyRecord.findUnique({
          where: {
            companyId_scope_key: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          },
        }),
      ).resolves.toEqual(claimBeforeReplay);
    });

    it('returns Replace conflict review with zero writes', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 2 });
      const source = await createDirectSource(scenario);
      const related = await createRelatedCase(scenario);
      const conflict = await assignmentService.create(
        scenario.companyId,
        scenario.userId,
        trackKey('conflict-reservation'),
        {
          caseId: related.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[1],
          directAssignmentReason: 'HC-LOCK-02 2H conflict reservation',
        },
      );
      if (conflict.outcome !== 'CREATED') {
        throw new Error('Expected a conflicting Assignment.');
      }
      registry.assignmentIds.add(conflict.data.id);
      const sourceBefore =
        await setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: source.id },
        });
      const key = trackKey('replace-zero-write');
      const review = await assignmentService.replace(
        scenario.companyId,
        scenario.userId,
        source.id,
        key,
        {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'HC-LOCK-02 2H review only',
        },
      );

      expect(review).toMatchObject({
        outcome: 'CONFLICT_REVIEW_REQUIRED',
        sourceAssignmentId: source.id,
        overrideRequired: true,
        conflicts: [{ assignmentId: conflict.data.id }],
      });
      await expect(
        setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: source.id },
        }),
      ).resolves.toEqual(sourceBefore);
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            replacesAssignmentId: source.id,
          },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.healthcareEquipmentAssignmentConflictOverride.count({
          where: { companyId: scenario.companyId, assignmentId: source.id },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
            key,
          },
        }),
      ).resolves.toBe(0);
    });

    it('rolls back Create atomically when claim completion fails', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 1 });
      const key = trackKey('create-rollback');
      const completion = jest
        .spyOn(assignmentRepository, 'completeIdempotencyClaim')
        .mockRejectedValueOnce(new Error('forced 2H Create rollback'));

      try {
        await expect(
          assignmentService.create(scenario.companyId, scenario.userId, key, {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            requirementId: scenario.requirementIds[0],
          }),
        ).rejects.toThrow('forced 2H Create rollback');
      } finally {
        completion.mockRestore();
      }

      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: { companyId: scenario.companyId, caseId: scenario.caseId },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: { companyId: scenario.companyId, key },
        }),
      ).resolves.toBe(0);
    });

    it('rolls back the Replace source, successor, override and claim atomically', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 2 });
      const source = await createDirectSource(scenario);
      const related = await createRelatedCase(scenario);
      const conflict = await assignmentService.create(
        scenario.companyId,
        scenario.userId,
        trackKey('replace-rollback-conflict'),
        {
          caseId: related.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[1],
          directAssignmentReason: 'HC-LOCK-02 2H rollback conflict',
        },
      );
      if (conflict.outcome !== 'CREATED') {
        throw new Error('Expected a conflict for Replace rollback.');
      }
      registry.assignmentIds.add(conflict.data.id);
      const key = trackKey('replace-rollback');
      const dto = {
        equipmentAssetId: scenario.equipmentAssetIds[1],
        replacementReason: 'HC-LOCK-02 2H forced rollback',
      };
      const review = await assignmentService.replace(
        scenario.companyId,
        scenario.userId,
        source.id,
        key,
        dto,
      );
      if (review.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
        throw new Error('Expected Replace conflict review before rollback.');
      }
      const completion = jest
        .spyOn(assignmentRepository, 'completeIdempotencyClaim')
        .mockRejectedValueOnce(new Error('forced 2H Replace rollback'));

      try {
        await expect(
          assignmentService.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            key,
            {
              ...dto,
              confirmConflictOverride: true,
              conflictReviewFingerprint: review.conflictReviewFingerprint,
              conflictOverrideReason: 'HC-LOCK-02 2H controlled override',
            },
          ),
        ).rejects.toThrow('forced 2H Replace rollback');
      } finally {
        completion.mockRestore();
      }

      await expect(
        setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: source.id },
          select: {
            lifecycle: true,
            replacedAt: true,
            replacedById: true,
            replacementReason: true,
          },
        }),
      ).resolves.toEqual({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        replacedAt: null,
        replacedById: null,
        replacementReason: null,
      });
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            replacesAssignmentId: source.id,
          },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.healthcareEquipmentAssignmentConflictOverride.count({
          where: {
            companyId: scenario.companyId,
            conflictingAssignmentId: conflict.data.id,
          },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
            key,
          },
        }),
      ).resolves.toBe(0);
    });

    it('preserves tenant isolation and business-error precedence', async () => {
      const scenarioA = await createScenario(companyAId, { assetCount: 2 });
      const scenarioB = await createScenario(companyBId, { assetCount: 1 });
      const key = trackKey('tenant-isolation');

      await expect(
        assignmentService.create(companyAId, userAId, key, {
          caseId: scenarioB.caseId,
          equipmentAssetId: scenarioA.equipmentAssetIds[0],
          directAssignmentReason: 'Must not cross Companies',
        }),
      ).rejects.toMatchObject({ response: { code: 'CASE_NOT_FOUND' } });
      await expect(
        requirementService.update(companyBId, scenarioA.requirementIds[0], {
          requestedQty: 4,
        }),
      ).rejects.toMatchObject({ response: { code: 'REQUIREMENT_NOT_FOUND' } });
      await expect(
        requirementService.reorder(companyBId, scenarioA.caseId, {
          items: [
            { requirementId: scenarioA.requirementIds[0], sortOrder: 50 },
          ],
        }),
      ).rejects.toMatchObject({ response: { code: 'CASE_NOT_FOUND' } });
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: { companyId: companyAId, caseId: scenarioB.caseId },
        }),
      ).resolves.toBe(0);

      const valid = await assignmentService.create(
        scenarioA.companyId,
        scenarioA.userId,
        key,
        {
          caseId: scenarioA.caseId,
          equipmentAssetId: scenarioA.equipmentAssetIds[0],
          requirementId: scenarioA.requirementIds[0],
        },
      );
      expect(valid.outcome).toBe('CREATED');
      await expect(
        assignmentService.create(scenarioA.companyId, scenarioA.userId, key, {
          caseId: scenarioA.caseId,
          equipmentAssetId: scenarioA.equipmentAssetIds[1],
          requirementId: scenarioA.requirementIds[0],
        }),
      ).rejects.toMatchObject({
        response: { code: 'IDEMPOTENCY_KEY_REUSED' },
      });
    });

    it('maps only verified Company acquisition timeout to sanitized HTTP 503 and later retries', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 1 });
      const holder = await startCompanyLockHolder(
        blockerPrisma,
        scenario.companyId,
      );
      const httpPid = await getBackendPid(httpPrisma);
      const key = trackKey('http-company-timeout');
      const request = supertest(requireHttpApp().getHttpServer())
        .post('/healthcare/equipment-assignments')
        .set('Idempotency-Key', key)
        .send({
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          requirementId: scenario.requirementIds[0],
        });
      let responsePromise: Promise<supertest.Response> | null = null;

      try {
        responsePromise = request.then((response) => response);
        await waitUntilBlockedBy(observerPrisma, httpPid, holder.pid);
        const response = await withTimeout(
          responsePromise,
          6_000,
          'HTTP Company acquisition timeout',
        );

        expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.body).toEqual({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          code: 'HEALTHCARE_CONCURRENCY_TIMEOUT',
          message:
            'La operación no pudo iniciar por concurrencia. Intenta nuevamente',
        });
        const publicBody = JSON.stringify(response.body);
        expect(publicBody).not.toContain('P2010');
        expect(publicBody).not.toContain('55P03');
        expect(publicBody).not.toContain('pg_advisory');
        expect(publicBody).not.toContain(
          deriveHealthcareCompanyLockKey(scenario.companyId).toString(),
        );
        await assertNoCreateWrites(scenario.companyId, scenario.caseId, key);

        holder.release();
        await holder.done;
        const retry = await supertest(requireHttpApp().getHttpServer())
          .post('/healthcare/equipment-assignments')
          .set('Idempotency-Key', key)
          .send({
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            requirementId: scenario.requirementIds[0],
          })
          .expect(HttpStatus.CREATED);
        expect(retry.body).toMatchObject({ outcome: 'CREATED' });
      } catch (error) {
        holder.release();
        const cleanupErrors = await settleForCleanup([
          holder.done,
          ...(responsePromise ? [responsePromise] : []),
        ]);
        throwWithCleanupErrors(error, cleanupErrors, 'HTTP Company timeout');
      }
    });

    it('keeps a subsequent row-lock timeout distinct from Company HTTP 503', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 1 });
      const blocker = await startAssetRowBlocker(
        blockerPrisma,
        scenario.companyId,
        scenario.equipmentAssetIds[0],
      );
      const httpPid = await getBackendPid(httpPrisma);
      const key = trackKey('http-row-timeout');
      let observedPersistenceError: unknown = null;
      const originalLockEquipmentAsset = httpRepository.lockEquipmentAsset.bind(
        httpRepository,
      ) as (
        transaction: Prisma.TransactionClient,
        companyId: string,
        equipmentAssetId: string,
      ) => Promise<boolean>;
      const lockEquipmentAsset = jest
        .spyOn(httpRepository, 'lockEquipmentAsset')
        .mockImplementation(
          async (transaction, companyId, equipmentAssetId) => {
            try {
              return await originalLockEquipmentAsset(
                transaction,
                companyId,
                equipmentAssetId,
              );
            } catch (error) {
              observedPersistenceError = error;
              throw error;
            }
          },
        );
      const responsePromise = supertest(requireHttpApp().getHttpServer())
        .post('/healthcare/equipment-assignments')
        .set('Idempotency-Key', key)
        .send({
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          requirementId: scenario.requirementIds[0],
        })
        .then((response) => response);

      try {
        await waitUntilBlockedBy(observerPrisma, httpPid, blocker.pid);
        const response = await withTimeout(
          responsePromise,
          5_000,
          'HTTP subsequent row-lock timeout',
        );
        expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'HEALTHCARE_PERSISTENCE_ERROR',
        });
        expect(response.body).not.toMatchObject({
          code: 'HEALTHCARE_CONCURRENCY_TIMEOUT',
        });
        expect(observedPersistenceError).toBeInstanceOf(
          Prisma.PrismaClientKnownRequestError,
        );
        expect(observedPersistenceError).toHaveProperty('code', 'P2010');
        expect(observedPersistenceError).toHaveProperty('meta.code', '55P03');
        await assertNoCreateWrites(scenario.companyId, scenario.caseId, key);
        blocker.release();
        await blocker.done;
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          responsePromise,
        ]);
        throwWithCleanupErrors(error, cleanupErrors, 'HTTP row timeout');
      } finally {
        lockEquipmentAsset.mockRestore();
      }
    });

    it('keeps a real inherited statement timeout distinct from Company HTTP 503', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 1 });
      const baseline = await readStatementTimeout(httpPrisma);
      const blocker = await startAssetRowBlocker(
        blockerPrisma,
        scenario.companyId,
        scenario.equipmentAssetIds[0],
      );
      const httpPid = await getBackendPid(httpPrisma);
      const key = trackKey('http-statement-timeout');
      let responsePromise: Promise<supertest.Response> | null = null;
      let operationError: unknown = null;
      let observedPersistenceError: unknown = null;
      const originalLockEquipmentAsset = httpRepository.lockEquipmentAsset.bind(
        httpRepository,
      ) as (
        transaction: Prisma.TransactionClient,
        companyId: string,
        equipmentAssetId: string,
      ) => Promise<boolean>;
      const lockEquipmentAsset = jest
        .spyOn(httpRepository, 'lockEquipmentAsset')
        .mockImplementation(
          async (transaction, companyId, equipmentAssetId) => {
            try {
              return await originalLockEquipmentAsset(
                transaction,
                companyId,
                equipmentAssetId,
              );
            } catch (error) {
              observedPersistenceError = error;
              throw error;
            }
          },
        );

      try {
        await setSessionStatementTimeout(httpPrisma, '250ms');
        responsePromise = supertest(requireHttpApp().getHttpServer())
          .post('/healthcare/equipment-assignments')
          .set('Idempotency-Key', key)
          .send({
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            requirementId: scenario.requirementIds[0],
          })
          .then((response) => response);
        await waitUntilBlockedBy(observerPrisma, httpPid, blocker.pid);
        const response = await withTimeout(
          responsePromise,
          3_000,
          'HTTP subsequent statement timeout',
        );
        expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'HEALTHCARE_PERSISTENCE_ERROR',
        });
        expect(response.body).not.toMatchObject({
          code: 'HEALTHCARE_CONCURRENCY_TIMEOUT',
        });
        expect(observedPersistenceError).toBeInstanceOf(
          Prisma.PrismaClientKnownRequestError,
        );
        expect(observedPersistenceError).toHaveProperty('code', 'P2010');
        expect(observedPersistenceError).toHaveProperty('meta.code', '57014');
        await assertNoCreateWrites(scenario.companyId, scenario.caseId, key);
      } catch (error) {
        operationError = error;
      }

      blocker.release();
      const cleanupErrors = await settleForCleanup([
        blocker.done,
        ...(responsePromise ? [responsePromise] : []),
      ]);
      try {
        await setSessionStatementTimeout(httpPrisma, baseline);
      } catch (error) {
        cleanupErrors.push(error);
      }
      lockEquipmentAsset.mockRestore();

      if (operationError !== null) {
        throwWithCleanupErrors(
          operationError,
          cleanupErrors,
          'HTTP statement timeout',
        );
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          'Statement-timeout cleanup failed.',
        );
      }
    });

    it('observes artificial PostgreSQL deadlock evidence without classifying it as Company timeout', async () => {
      const scenario = await createScenario(companyAId, { assetCount: 2 });
      const aLocked = deferred<void>();
      const bLocked = deferred<void>();
      const transactionOptions = {
        maxWait: policy.prismaMaxWaitMs,
        timeout: policy.prismaTransactionTimeoutMs,
      };
      const operationA = deadlockAPrisma.$transaction(async (transaction) => {
        await lockAsset(
          transaction,
          scenario.companyId,
          scenario.equipmentAssetIds[0],
        );
        aLocked.resolve(undefined);
        await bLocked.promise;
        await lockAsset(
          transaction,
          scenario.companyId,
          scenario.equipmentAssetIds[1],
        );
      }, transactionOptions);
      const operationB = deadlockBPrisma.$transaction(async (transaction) => {
        await lockAsset(
          transaction,
          scenario.companyId,
          scenario.equipmentAssetIds[1],
        );
        bLocked.resolve(undefined);
        await aLocked.promise;
        await lockAsset(
          transaction,
          scenario.companyId,
          scenario.equipmentAssetIds[0],
        );
      }, transactionOptions);
      const settlements = await withTimeout(
        Promise.allSettled([operationA, operationB]),
        8_000,
        'artificial PostgreSQL deadlock',
      );
      const failures = settlements.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      expect(failures).toHaveLength(1);
      const deadlockError = failures[0].reason as unknown;
      expect(deadlockError).toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      expect(deadlockError).toHaveProperty('code', 'P2010');
      expect(deadlockError).toHaveProperty('meta.code', '40P01');
      expect(deadlockError).not.toBeInstanceOf(
        HealthcareCompanyLockTimeoutError,
      );
      expect(classifyHealthcareTransactionError(deadlockError)).toBe(
        HEALTHCARE_TRANSACTION_ERROR_KINDS.deadlock,
      );
    });

    async function assertNoCreateWrites(
      companyId: string,
      caseId: string,
      key: string,
    ): Promise<void> {
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: { companyId, caseId },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
            key,
          },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.healthcareEquipmentAssignmentConflictOverride.count({
          where: { companyId },
        }),
      ).resolves.toBe(0);
    }

    function requireHttpApp(): INestApplication<App> {
      if (!httpApp) {
        throw new Error(
          'The isolated HTTP test application is not initialized.',
        );
      }
      return httpApp;
    }
  },
);

function requireExplicitConnectionUrl(): URL {
  const rawConnectionUrl = process.env[CONNECTION_VARIABLE];
  if (!rawConnectionUrl) {
    throw new Error(`${CONNECTION_VARIABLE} is required when ${RUN_FLAG}=1.`);
  }

  let connectionUrl: URL;
  try {
    connectionUrl = new URL(rawConnectionUrl);
  } catch {
    throw new Error(`${CONNECTION_VARIABLE} must be a valid PostgreSQL URL.`);
  }

  let databaseName: string;
  let databaseUser: string;
  try {
    databaseName = decodeURIComponent(
      connectionUrl.pathname.replace(/^\/+/, ''),
    );
    databaseUser = decodeURIComponent(connectionUrl.username);
  } catch {
    throw new Error(
      `${CONNECTION_VARIABLE} contains invalid percent-encoding.`,
    );
  }

  if (
    !['postgres:', 'postgresql:'].includes(connectionUrl.protocol) ||
    connectionUrl.hostname !== EXPECTED_HOST ||
    connectionUrl.port !== EXPECTED_HOST_PORT ||
    databaseName !== EXPECTED_DATABASE ||
    databaseUser !== EXPECTED_USER ||
    !connectionUrl.password
  ) {
    throw new Error(
      `${CONNECTION_VARIABLE} does not identify the authorized HC-LOCK-02 2H target.`,
    );
  }

  if (connectionUrl.search.length > 0 || connectionUrl.hash.length > 0) {
    throw new Error(
      `${CONNECTION_VARIABLE} must not contain routing or connection-option overrides.`,
    );
  }

  return connectionUrl;
}

function createIsolatedClient(connectionUrl: URL): ExplicitPrismaService {
  const clientUrl = new URL(connectionUrl.toString());
  clientUrl.searchParams.set('connection_limit', '1');
  clientUrl.searchParams.set('pool_timeout', '5');
  clientUrl.searchParams.set('connect_timeout', '5');

  try {
    return new ExplicitPrismaService(clientUrl.toString());
  } catch {
    throw new Error(
      'Could not construct an isolated HC-LOCK-02 2H Prisma client.',
    );
  }
}

async function readAndValidateDatabaseIdentity(
  client: ExplicitPrismaService,
): Promise<DatabaseIdentity> {
  const [identity] = await client.$queryRaw<DatabaseIdentity[]>(Prisma.sql`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser",
      inet_server_addr()::text AS "serverAddress",
      inet_server_port()::int AS "serverPort",
      current_setting('server_version_num') AS "serverVersionNumber",
      current_schema() AS "currentSchema",
      pg_backend_pid()::int AS "backendPid"
  `);
  const serverVersionNumber = Number(identity?.serverVersionNumber);

  if (
    !identity ||
    identity.databaseName !== EXPECTED_DATABASE ||
    identity.databaseUser !== EXPECTED_USER ||
    identity.serverPort !== EXPECTED_SERVER_PORT ||
    identity.currentSchema !== 'public' ||
    !Number.isInteger(serverVersionNumber) ||
    serverVersionNumber < 160_000 ||
    serverVersionNumber >= 170_000
  ) {
    throw new Error(
      'Connected PostgreSQL identity does not match the authorized HC-LOCK-02 2H target.',
    );
  }

  assertValidPostgreSqlBackendPid(identity.backendPid, 'backendPid');
  return identity;
}

async function assertExpectedSchema(
  client: ExplicitPrismaService,
): Promise<void> {
  const rows = await client.$queryRaw<
    Array<{ tableName: string; tableOid: string | null }>
  >(
    Prisma.sql`
      SELECT required."tableName", to_regclass(
        format('public.%I', required."tableName")
      )::text AS "tableOid"
      FROM (
        VALUES ${Prisma.join(
          requiredTables.map((tableName) => Prisma.sql`(${tableName})`),
        )}
      ) AS required("tableName")
    `,
  );
  const missing = rows
    .filter((row) => row.tableOid === null)
    .map((row) => row.tableName);

  if (rows.length !== requiredTables.length || missing.length > 0) {
    throw new Error(
      `Authorized HC-LOCK-02 2H schema is missing required table(s): ${missing.join(', ') || 'unknown'}.`,
    );
  }
}

async function assertRequiredRowLockPrivileges(
  client: ExplicitPrismaService,
): Promise<void> {
  const rows = await client.$queryRaw<
    Array<{
      tableName: string;
      lockColumn: string;
      canSelect: boolean;
      canUpdateLockColumn: boolean;
    }>
  >(Prisma.sql`
    SELECT
      required."tableName",
      required."lockColumn",
      COALESCE(
        has_table_privilege(current_user, relation.oid, 'SELECT'),
        false
      ) AS "canSelect",
      COALESCE(
        has_column_privilege(
          current_user,
          relation.oid,
          attribute.attnum,
          'UPDATE'
        ),
        false
      ) AS "canUpdateLockColumn"
    FROM (
      VALUES ${Prisma.join(
        requiredRowLockPrivileges.map(
          ({ tableName, lockColumn }) =>
            Prisma.sql`(${tableName}, ${lockColumn})`,
        ),
      )}
    ) AS required("tableName", "lockColumn")
    LEFT JOIN pg_namespace AS namespace
      ON namespace.nspname = 'public'
    LEFT JOIN pg_class AS relation
      ON relation.relnamespace = namespace.oid
      AND relation.relname = required."tableName"
    LEFT JOIN pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attname = required."lockColumn"
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  `);
  const missing = rows
    .filter((row) => !row.canSelect || !row.canUpdateLockColumn)
    .map((row) => {
      const privileges = [
        ...(row.canSelect ? [] : ['SELECT']),
        ...(row.canUpdateLockColumn ? [] : [`UPDATE(${row.lockColumn})`]),
      ];
      return `${row.tableName} [${privileges.join(', ')}]`;
    });

  if (rows.length !== requiredRowLockPrivileges.length || missing.length > 0) {
    throw new Error(
      `HC-LOCK-02 2H row-lock privilege preflight failed for: ${missing.join(', ') || 'unknown target'}.`,
    );
  }
}

async function assertExclusiveTargetAvailability(
  observer: ExplicitPrismaService,
  clients: ExplicitPrismaService[],
): Promise<void> {
  const ownedPids = await Promise.all(clients.map(getBackendPid));
  const otherSessions = await observer.$queryRaw<
    Array<{ pid: number }>
  >(Prisma.sql`
    SELECT pid::int AS "pid"
    FROM pg_stat_activity
    WHERE datname = ${EXPECTED_DATABASE}
      AND backend_type = 'client backend'
      AND pid NOT IN (${Prisma.join(ownedPids)})
  `);

  if (otherSessions.length > 0) {
    throw new Error(
      `HC-LOCK-02 2H target has ${otherSessions.length} unrelated session(s); exclusive availability is required.`,
    );
  }
}

async function startAssetRowBlocker(
  client: ExplicitPrismaService,
  companyId: string,
  assetId: string,
): Promise<ControlledTransaction> {
  const ready = deferred<number>();
  const release = deferred<void>();
  const done = client.$transaction(
    async (transaction) => {
      await lockAsset(transaction, companyId, assetId);
      ready.resolve(await getBackendPid(transaction));
      await release.promise;
    },
    { maxWait: 3_000, timeout: 20_000 },
  );
  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'asset blocker setup'),
    release: () => release.resolve(undefined),
    done,
  };
}

async function startCompanyLockHolder(
  client: ExplicitPrismaService,
  companyId: string,
): Promise<ControlledTransaction> {
  const ready = deferred<number>();
  const release = deferred<void>();
  const lockKey = deriveHealthcareCompanyLockKey(companyId);
  const done = client.$transaction(
    async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(${lockKey}::bigint)::text AS "lock"
    `);
      ready.resolve(await getBackendPid(transaction));
      await release.promise;
    },
    { maxWait: 3_000, timeout: 20_000 },
  );
  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'Company lock holder setup'),
    release: () => release.resolve(undefined),
    done,
  };
}

async function lockAsset(
  transaction: Prisma.TransactionClient,
  companyId: string,
  assetId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "EquipmentAsset"
    WHERE "id" = ${assetId} AND "companyId" = ${companyId}
    FOR UPDATE
  `);
  if (rows.length !== 1) {
    throw new Error('Controlled EquipmentAsset row was not found.');
  }
}

async function waitUntilBlockedBy(
  observer: ExplicitPrismaService,
  blockedPid: number,
  blockerPid: number,
): Promise<void> {
  assertValidPostgreSqlBackendPid(blockedPid, 'blockedPid');
  assertValidPostgreSqlBackendPid(blockerPid, 'blockerPid');

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [row] = await observer.$queryRaw<
      Array<{ blocked: boolean }>
    >(Prisma.sql`
      SELECT ${blockerPid}::integer = ANY(
        pg_blocking_pids(${blockedPid}::integer)
      ) AS "blocked"
    `);
    if (row?.blocked === true) {
      return;
    }
    await delay(10);
  }

  throw new Error('Expected PostgreSQL to expose the controlled lock wait.');
}

async function getBackendPid(client: RawQueryClient): Promise<number> {
  const [row] = await client.$queryRaw<Array<{ pid: number }>>(Prisma.sql`
    SELECT pg_backend_pid()::int AS "pid"
  `);
  if (!row) {
    throw new Error('Could not resolve PostgreSQL backend PID.');
  }
  assertValidPostgreSqlBackendPid(row.pid, 'backendPid');
  return row.pid;
}

function assertValidPostgreSqlBackendPid(pid: number, label: string): void {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647) {
    throw new RangeError(`${label} must be a positive PostgreSQL integer PID.`);
  }
}

async function readStatementTimeout(client: RawQueryClient): Promise<string> {
  const [row] = await client.$queryRaw<Array<{ value: string }>>(Prisma.sql`
    SELECT current_setting('statement_timeout') AS "value"
  `);
  if (!row?.value) {
    throw new Error('Could not read PostgreSQL statement_timeout.');
  }
  return row.value;
}

async function setSessionStatementTimeout(
  client: RawQueryClient,
  value: string,
): Promise<void> {
  await client.$queryRaw(Prisma.sql`
    SELECT set_config('statement_timeout', ${value}, false)::text AS "value"
  `);
}

async function refreshRunFixtureRegistry(
  prisma: ExplicitPrismaService,
  registry: RunFixtureRegistry,
): Promise<void> {
  const companyIds = [...registry.companyIds];
  const [assignments, claims] = await Promise.all([
    prisma.healthcareEquipmentAssignment.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.idempotencyRecord.findMany({
      where: { companyId: { in: companyIds } },
      select: { key: true },
    }),
  ]);

  assignments.forEach(({ id }) => registry.assignmentIds.add(id));
  claims.forEach(({ key }) => registry.idempotencyKeys.add(key));
}

async function cleanupRunFixtures(
  prisma: ExplicitPrismaService,
  registry: RunFixtureRegistry,
): Promise<void> {
  const companyIds = [...registry.companyIds];
  const operations: Array<() => Promise<unknown>> = [
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
      prisma.product.deleteMany({ where: { companyId: { in: companyIds } } }),
    () => prisma.user.deleteMany({ where: { companyId: { in: companyIds } } }),
    () => prisma.company.deleteMany({ where: { id: { in: companyIds } } }),
  ];
  const errors: unknown[] = [];

  for (const operation of operations) {
    try {
      await operation();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, 'Run-owned fixture cleanup failed.');
  }
}

async function assertNoRunOwnedRecords(
  prisma: ExplicitPrismaService,
  registry: RunFixtureRegistry,
): Promise<void> {
  const companyIds = [...registry.companyIds];
  const counts = await Promise.all([
    prisma.healthcareEquipmentAssignmentConflictOverride.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareEquipmentRequirementCoverageNote.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareEquipmentAssignment.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.idempotencyRecord.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareEquipmentAssignmentSettings.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareCaseRequirement.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareCase.count({ where: { companyId: { in: companyIds } } }),
    prisma.equipmentAsset.count({ where: { companyId: { in: companyIds } } }),
    prisma.product.count({ where: { companyId: { in: companyIds } } }),
    prisma.user.count({ where: { companyId: { in: companyIds } } }),
    prisma.company.count({ where: { id: { in: companyIds } } }),
  ]);

  if (counts.some((count) => count !== 0)) {
    throw new Error(
      `Run-owned fixture cleanup left record counts: ${counts.join(', ')}.`,
    );
  }
}

async function disconnectEveryClient(
  clients: ExplicitPrismaService[],
): Promise<void> {
  const settlements = await withTimeout(
    Promise.allSettled(clients.map((client) => client.$disconnect())),
    DISCONNECT_TIMEOUT_MS,
    'Prisma client disconnection',
  );
  const errors = settlements.flatMap((result, index) =>
    result.status === 'rejected'
      ? [
          new Error(`Prisma client index ${index} failed to disconnect.`, {
            cause: result.reason,
          }),
        ]
      : [],
  );
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      'One or more Prisma clients failed to disconnect.',
    );
  }
}

async function settleForCleanup(
  promises: Promise<unknown>[],
): Promise<unknown[]> {
  try {
    const settlements = await withTimeout(
      Promise.allSettled(promises),
      CLEANUP_TIMEOUT_MS,
      'controlled operation cleanup',
    );
    return settlements.flatMap((result) =>
      result.status === 'rejected' ? [result.reason as unknown] : [],
    );
  } catch (error) {
    return [error as unknown];
  }
}

function throwWithCleanupErrors(
  originalError: unknown,
  cleanupErrors: unknown[],
  label: string,
): never {
  if (cleanupErrors.length === 0) {
    throw originalError;
  }
  throw new AggregateError(
    [originalError, ...cleanupErrors],
    `${label} failed and cleanup also reported errors.`,
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} exceeded ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
