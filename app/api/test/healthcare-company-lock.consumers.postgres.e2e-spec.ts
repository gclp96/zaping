import {
  ExecutionContext,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentRetirementReason,
  HealthcareCaseKitItemLifecycle,
  HealthcareCaseKitStatus,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
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
import { HealthcareCaseFolioService } from '../src/healthcare/cases/healthcare-case-folio.service';
import { HealthcareCaseService } from '../src/healthcare/cases/healthcare-case.service';
import { HealthcareCasesController } from '../src/healthcare/cases/healthcare-cases.controller';
import { HealthcareCaseKitItemSourceType } from '../src/healthcare/case-kits/dto/add-healthcare-case-kit-item.dto';
import { HealthcareCaseKitsRepository } from '../src/healthcare/case-kits/healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from '../src/healthcare/case-kits/healthcare-case-kits.service';
import { HealthcareEquipmentAssignmentsController } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.controller';
import { HealthcareEquipmentAssignmentsRepository } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { HealthcareRequirementsController } from '../src/healthcare/requirements/healthcare-requirements.controller';
import { HealthcareRequirementsService } from '../src/healthcare/requirements/healthcare-requirements.service';
import { NoopRequirementOperationalEvidencePolicy } from '../src/healthcare/requirements/requirement-operational-evidence-policy';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductsService } from '../src/products/products.service';
import { EquipmentService } from '../src/equipment/equipment.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';

jest.setTimeout(30_000);

const RUN_FLAG = 'RUN_HC_LOCK_2H_POSTGRES_TESTS';
const CONNECTION_VARIABLE = 'HC_LOCK_2H_DATABASE_URL';
const EXPECTED_DATABASE = 'zaping_spike_test';
const EXPECTED_USER = 'zaping_hc_lock_2h';
const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_HOST_PORT = '5434';
const EXPECTED_SERVER_PORT = 5432;
const CLIENT_COUNT = 9;
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
  'HealthcareCaseKit',
  'HealthcareCaseKitItem',
  'InventoryBatch',
  'InventoryMovement',
] as const;

// Setup/service inserts; every entry is also deleted by run-owned cleanup.
const requiredFixtureInsertTables = [
  'Company',
  'User',
  'Product',
  'HealthcareCase',
  'HealthcareCaseRequirement',
  'EquipmentAsset',
  'HealthcareEquipmentAssignment',
  'HealthcareEquipmentAssignmentConflictOverride',
  'IdempotencyRecord',
] as const;

// Settings and coverage notes are read/cleaned up, but never inserted here.
const requiredFixtureReadDeleteTables = [
  ...requiredFixtureInsertTables,
  'HealthcareEquipmentRequirementCoverageNote',
  'HealthcareEquipmentAssignmentSettings',
] as const;

const requiredSuiteUpdateColumns = {
  Product: ['isActive', 'updatedAt'],
  EquipmentAsset: [
    'lifecycle',
    'retiredAt',
    'retiredById',
    'retiredReason',
    'retirementNotes',
    'updatedAt',
  ],
  IdempotencyRecord: ['resourceId', 'updatedAt'],
  HealthcareCaseRequirement: [
    'requestedQty',
    'lifecycle',
    'retiredAt',
    'retiredById',
    'retirementReason',
    'reactivatedAt',
    'reactivatedById',
    'sortOrder',
    'updatedAt',
  ],
  HealthcareEquipmentAssignment: [
    'lifecycle',
    'releasedAt',
    'releasedById',
    'releaseCause',
    'releaseReason',
    'replacedAt',
    'replacedById',
    'replacementReason',
    'updatedAt',
  ],
} as const;

// Assertion projection plus predicate columns; no inventory DML is needed.
const requiredInventoryMovementSelectColumns = [
  'id',
  'companyId',
  'productId',
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
  { tableName: 'HealthcareCaseKit', lockColumn: 'id' },
  { tableName: 'HealthcareCaseKitItem', lockColumn: 'id' },
] as const;

const requiredCaseKitDmlTables = [
  'HealthcareCaseKit',
  'HealthcareCaseKitItem',
] as const;

const requiredCaseKitItemUpdateColumns = [
  'id',
  'lifecycle',
  'excludedById',
  'excludedAt',
  'exclusionReason',
] as const;

const requiredCaseKitUpdateColumns = [
  'id',
  'status',
  'preparedById',
  'preparedAt',
  'updatedAt',
] as const;

const requiredCaseKitTypes = [
  'HealthcareCaseKitStatus',
  'HealthcareCaseKitItemLifecycle',
] as const;

const requiredCaseCancelUpdateColumns = [
  'status',
  'cancelledAt',
  'cancelledById',
  'cancellationReason',
  'updatedAt',
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

type CaseKitFixture = {
  scenario: Scenario;
  caseKitId: string;
  itemId: string;
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
    let casePrisma: ExplicitPrismaService;
    let httpPrisma: ExplicitPrismaService;
    let deadlockAPrisma: ExplicitPrismaService;
    let deadlockBPrisma: ExplicitPrismaService;
    let assignmentRepository: HealthcareEquipmentAssignmentsRepository;
    let assignmentService: HealthcareEquipmentAssignmentsService;
    let requirementService: HealthcareRequirementsService;
    let caseService: HealthcareCaseService;
    let caseKitRepositoryA: HealthcareCaseKitsRepository;
    let caseKitRepositoryB: HealthcareCaseKitsRepository;
    let caseKitServiceA: HealthcareCaseKitsService;
    let caseKitServiceB: HealthcareCaseKitsService;
    let httpRepository: HealthcareEquipmentAssignmentsRepository;
    let httpService: HealthcareEquipmentAssignmentsService;
    let httpCaseService: HealthcareCaseService;
    let httpApp: INestApplication<App> | null = null;
    let httpAuthenticatedRole: UserRole | 'UNAUTHORIZED' = UserRole.ADMIN;
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
        casePrisma,
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
      await assertNonAdministrativeRole(setupPrisma);
      await assertRequiredSuitePrivileges(setupPrisma);
      await assertRequiredRowLockPrivileges(setupPrisma);
      await assertRequiredCaseCancelUpdatePrivileges(setupPrisma);
      await assertRequiredCaseKitPrivileges(setupPrisma);
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
        assignmentService,
        new NoopRequirementOperationalEvidencePolicy(),
        policy,
      );
      caseService = new HealthcareCaseService(
        casePrisma,
        createUnusedCaseFolioService(),
        assignmentService,
        policy,
      );
      caseKitRepositoryA = new HealthcareCaseKitsRepository(assignmentPrisma);
      caseKitRepositoryB = new HealthcareCaseKitsRepository(requirementPrisma);
      caseKitServiceA = new HealthcareCaseKitsService(
        caseKitRepositoryA,
        policy,
      );
      caseKitServiceB = new HealthcareCaseKitsService(
        caseKitRepositoryB,
        policy,
      );
      httpRepository = new HealthcareEquipmentAssignmentsRepository(httpPrisma);
      httpService = new HealthcareEquipmentAssignmentsService(
        httpRepository,
        policy,
      );
      httpCaseService = new HealthcareCaseService(
        httpPrisma,
        createUnusedCaseFolioService(),
        httpService,
        policy,
      );

      fixturesStarted = true;
      await createRunOwners();
      await createHttpHarness();
    }, 25_000);

    beforeEach(async () => {
      httpAuthenticatedRole = UserRole.ADMIN;
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
        get role(): UserRole {
          return httpAuthenticatedRole as UserRole;
        },
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
        controllers: [
          HealthcareCasesController,
          HealthcareEquipmentAssignmentsController,
          HealthcareRequirementsController,
        ],
        providers: [
          RolesGuard,
          {
            provide: HealthcareCaseService,
            useValue: httpCaseService,
          },
          {
            provide: HealthcareEquipmentAssignmentsService,
            useValue: httpService,
          },
          {
            provide: HealthcareRequirementsService,
            useValue: requirementService,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(testAuthGuard)
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
        inventoryTracking?: ProductInventoryTracking;
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
          inventoryTracking:
            options.inventoryTracking ?? ProductInventoryTracking.ASSET,
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
      if (equipmentAssetIds.length > 0) {
        await setupPrisma.equipmentAsset.createMany({
          data: equipmentAssetIds.map((id) => ({
            id,
            companyId,
            productId: productIds[0],
            assetCode: `HC-L2H-${id}`,
            condition: EquipmentCondition.GOOD,
          })),
        });
      }

      return {
        companyId,
        userId,
        productIds,
        caseId,
        requirementIds,
        equipmentAssetIds,
      };
    }

    async function createCaseKitFixture(
      service = caseKitServiceA,
    ): Promise<CaseKitFixture> {
      const scenario = await createScenario(companyAId, {
        assetCount: 0,
        inventoryTracking: ProductInventoryTracking.QUANTITY,
      });
      const kit = await service.create(
        scenario.companyId,
        scenario.userId,
        scenario.caseId,
        trackKey('case-kit-create'),
      );
      const item = await service.addItem(
        scenario.companyId,
        scenario.userId,
        kit.data.id,
        trackKey('case-kit-item-add'),
        {
          sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
          requirementId: scenario.requirementIds[0],
          preparedQuantity: 1,
        },
      );

      return {
        scenario,
        caseKitId: kit.data.id,
        itemId: item.data.id,
      };
    }

    async function createReadyCaseKitFixture(
      service = caseKitServiceA,
    ): Promise<CaseKitFixture> {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 0,
        inventoryTracking: ProductInventoryTracking.QUANTITY,
      });
      await setupPrisma.healthcareCase.update({
        where: { id: scenario.caseId },
        data: { status: HealthcareCaseStatus.SCHEDULED },
      });
      const kit = await service.create(
        scenario.companyId,
        scenario.userId,
        scenario.caseId,
        trackKey('case-kit-ready-create'),
      );
      const item = await service.addItem(
        scenario.companyId,
        scenario.userId,
        kit.data.id,
        trackKey('case-kit-ready-item-add'),
        {
          sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
          requirementId: scenario.requirementIds[0],
          preparedQuantity: 1,
        },
      );

      return {
        scenario,
        caseKitId: kit.data.id,
        itemId: item.data.id,
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

    async function createRequirementSource(
      scenario: Scenario,
      equipmentAssetId: string,
      requirementId = scenario.requirementIds[0],
      keyPrefix = 'requirement-source',
    ) {
      const result = await assignmentService.create(
        scenario.companyId,
        scenario.userId,
        trackKey(keyPrefix),
        {
          caseId: scenario.caseId,
          equipmentAssetId,
          requirementId,
        },
      );
      if (result.outcome !== 'CREATED') {
        throw new Error('Expected a Requirement Assignment source.');
      }
      registry.assignmentIds.add(result.data.id);
      return result.data;
    }

    async function createScenarioAsset(
      scenario: Scenario,
      productId = scenario.productIds[0],
    ): Promise<string> {
      const equipmentAssetId = randomUUID();
      registry.equipmentAssetIds.add(equipmentAssetId);
      await setupPrisma.equipmentAsset.create({
        data: {
          id: equipmentAssetId,
          companyId: scenario.companyId,
          productId,
          assetCode: `HC-L2H-${equipmentAssetId}`,
          condition: EquipmentCondition.GOOD,
        },
      });
      return equipmentAssetId;
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

    async function runRetireFirstCrossConsumerRace<TFirst, TSecond>(
      scenario: Scenario,
      first: () => Promise<TFirst>,
      second: () => Promise<TSecond>,
    ): Promise<[PromiseSettledResult<TFirst>, PromiseSettledResult<TSecond>]> {
      const firstPid = await getBackendPid(requirementPrisma);
      const secondPid = await getBackendPid(assignmentPrisma);
      const blocker = await startRequirementRowBlocker(
        blockerPrisma,
        scenario.companyId,
        scenario.caseId,
        scenario.requirementIds[0],
      );
      let firstOperation: Promise<TFirst> | null = null;
      let secondOperation: Promise<TSecond> | null = null;

      try {
        firstOperation = first();
        await waitUntilBlockedBy(observerPrisma, firstPid, blocker.pid);
        secondOperation = second();
        await waitUntilBlockedBy(observerPrisma, secondPid, firstPid);
        blocker.release();

        const results = await withTimeout(
          Promise.allSettled([firstOperation, secondOperation]),
          OPERATION_TIMEOUT_MS,
          'Retire-first cross-consumer race',
        );
        await withTimeout(
          blocker.done,
          OPERATION_TIMEOUT_MS,
          'Requirement blocker completion',
        );
        return results;
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          ...(firstOperation ? [firstOperation] : []),
          ...(secondOperation ? [secondOperation] : []),
        ]);
        throwWithCleanupErrors(
          error,
          cleanupErrors,
          'Retire-first cross-consumer race',
        );
      }
    }

    async function runAssignmentBeforeCancelRace<TFirst, TSecond>(
      assetId: string,
      companyId: string,
      first: () => Promise<TFirst>,
      second: () => Promise<TSecond>,
    ): Promise<[TFirst, TSecond]> {
      const firstPid = await getBackendPid(assignmentPrisma);
      const secondPid = await getBackendPid(casePrisma);
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

        const result = await withTimeout(
          Promise.all([firstOperation, secondOperation]),
          OPERATION_TIMEOUT_MS,
          'Assignment-before-Cancel race',
        );
        await withTimeout(
          blocker.done,
          OPERATION_TIMEOUT_MS,
          'Asset blocker completion',
        );
        return result;
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          ...(firstOperation ? [firstOperation] : []),
          ...(secondOperation ? [secondOperation] : []),
        ]);
        throwWithCleanupErrors(
          error,
          cleanupErrors,
          'Assignment-before-Cancel race',
        );
      }
    }

    async function runCancelBeforeConsumerRace<TFirst, TSecond>(
      scenario: Scenario,
      secondClient: ExplicitPrismaService,
      first: () => Promise<TFirst>,
      second: () => Promise<TSecond>,
    ): Promise<[PromiseSettledResult<TFirst>, PromiseSettledResult<TSecond>]> {
      const firstPid = await getBackendPid(casePrisma);
      const secondPid = await getBackendPid(secondClient);
      const blocker = await startCaseRowBlocker(
        blockerPrisma,
        scenario.companyId,
        scenario.caseId,
      );
      let firstOperation: Promise<TFirst> | null = null;
      let secondOperation: Promise<TSecond> | null = null;

      try {
        firstOperation = first();
        await waitUntilBlockedBy(observerPrisma, firstPid, blocker.pid);
        secondOperation = second();
        await waitUntilBlockedBy(observerPrisma, secondPid, firstPid);
        blocker.release();

        const results = await withTimeout(
          Promise.allSettled([firstOperation, secondOperation]),
          OPERATION_TIMEOUT_MS,
          'Cancel-before-consumer race',
        );
        await withTimeout(
          blocker.done,
          OPERATION_TIMEOUT_MS,
          'Case blocker completion',
        );
        return results;
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          ...(firstOperation ? [firstOperation] : []),
          ...(secondOperation ? [secondOperation] : []),
        ]);
        throwWithCleanupErrors(
          error,
          cleanupErrors,
          'Cancel-before-consumer race',
        );
      }
    }

    async function runRetireBeforeCancelRace<TFirst, TSecond>(
      scenario: Scenario,
      first: () => Promise<TFirst>,
      second: () => Promise<TSecond>,
    ): Promise<[TFirst, TSecond]> {
      const firstPid = await getBackendPid(requirementPrisma);
      const secondPid = await getBackendPid(casePrisma);
      const blocker = await startRequirementRowBlocker(
        blockerPrisma,
        scenario.companyId,
        scenario.caseId,
        scenario.requirementIds[0],
      );
      let firstOperation: Promise<TFirst> | null = null;
      let secondOperation: Promise<TSecond> | null = null;

      try {
        firstOperation = first();
        await waitUntilBlockedBy(observerPrisma, firstPid, blocker.pid);
        secondOperation = second();
        await waitUntilBlockedBy(observerPrisma, secondPid, firstPid);
        blocker.release();

        const result = await withTimeout(
          Promise.all([firstOperation, secondOperation]),
          OPERATION_TIMEOUT_MS,
          'Retire-before-Cancel race',
        );
        await withTimeout(
          blocker.done,
          OPERATION_TIMEOUT_MS,
          'Requirement blocker completion',
        );
        return result;
      } catch (error) {
        blocker.release();
        const cleanupErrors = await settleForCleanup([
          blocker.done,
          ...(firstOperation ? [firstOperation] : []),
          ...(secondOperation ? [secondOperation] : []),
        ]);
        throwWithCleanupErrors(
          error,
          cleanupErrors,
          'Retire-before-Cancel race',
        );
      }
    }

    describe('HC-NEXT-03C4-C1 Requirement Retire integration', () => {
      it.each([0, 1, 3])(
        'retires atomically with %i eligible Requirement Assignment(s)',
        async (assignmentCount) => {
          const scenario = await createScenario(companyAId, {
            requestedQty: Math.max(assignmentCount, 1),
            assetCount: Math.max(assignmentCount, 1),
          });
          const assignments: Array<
            Awaited<ReturnType<typeof createRequirementSource>>
          > = [];
          for (let index = 0; index < assignmentCount; index += 1) {
            assignments.push(
              await createRequirementSource(
                scenario,
                scenario.equipmentAssetIds[index],
                scenario.requirementIds[0],
                `retire-${assignmentCount}-source`,
              ),
            );
          }
          const [claimsBefore, movementsBefore] = await Promise.all([
            setupPrisma.idempotencyRecord.count({
              where: { companyId: scenario.companyId },
            }),
            setupPrisma.inventoryMovement.count({
              where: {
                companyId: scenario.companyId,
                productId: { in: scenario.productIds },
              },
            }),
          ]);

          const retired = await requirementService.retire(
            scenario.companyId,
            scenario.userId,
            scenario.requirementIds[0],
            { retirementReason: '  Cambio   clínico E2E  ' },
          );
          const [persistedRequirement, persistedAssignments] =
            await Promise.all([
              setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
                where: { id: scenario.requirementIds[0] },
                select: {
                  lifecycle: true,
                  retiredAt: true,
                  retiredById: true,
                  retirementReason: true,
                },
              }),
              setupPrisma.healthcareEquipmentAssignment.findMany({
                where: { id: { in: assignments.map(({ id }) => id) } },
                orderBy: { id: 'asc' },
                select: {
                  lifecycle: true,
                  releasedAt: true,
                  releasedById: true,
                  releaseCause: true,
                  releaseReason: true,
                },
              }),
            ]);

          expect(retired.lifecycle).toBe(
            HealthcareRequirementLifecycle.RETIRED,
          );
          expect(persistedRequirement.retiredAt).toBeInstanceOf(Date);
          expect(persistedRequirement).toMatchObject({
            lifecycle: HealthcareRequirementLifecycle.RETIRED,
            retiredById: scenario.userId,
            retirementReason: 'Cambio clínico E2E',
          });
          expect(persistedAssignments).toHaveLength(assignmentCount);
          for (const assignment of persistedAssignments) {
            expect(assignment).toEqual({
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
              releasedAt: persistedRequirement.retiredAt,
              releasedById: scenario.userId,
              releaseCause:
                HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
              releaseReason: 'Cambio clínico E2E',
            });
          }
          await expect(
            setupPrisma.idempotencyRecord.count({
              where: { companyId: scenario.companyId },
            }),
          ).resolves.toBe(claimsBefore);
          await expect(
            setupPrisma.inventoryMovement.count({
              where: {
                companyId: scenario.companyId,
                productId: { in: scenario.productIds },
              },
            }),
          ).resolves.toBe(movementsBefore);
        },
      );

      it('rolls back the Requirement and every derived release after a later release write fails', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 2,
          assetCount: 2,
        });
        const sources: Array<
          Awaited<ReturnType<typeof createRequirementSource>>
        > = [];
        for (const equipmentAssetId of scenario.equipmentAssetIds) {
          sources.push(
            await createRequirementSource(
              scenario,
              equipmentAssetId,
              scenario.requirementIds[0],
              'retire-rollback-source',
            ),
          );
        }
        const claimsBefore = await setupPrisma.idempotencyRecord.count({
          where: { companyId: scenario.companyId },
        });
        type ReleaseAssignment =
          HealthcareEquipmentAssignmentsRepository['releaseAssignment'];
        const originalRelease = assignmentRepository.releaseAssignment.bind(
          assignmentRepository,
        ) as ReleaseAssignment;
        let releaseCalls = 0;
        const releaseWrite = jest
          .spyOn(assignmentRepository, 'releaseAssignment')
          .mockImplementation((...args: Parameters<ReleaseAssignment>) => {
            releaseCalls += 1;
            if (releaseCalls === 2) {
              throw new Error('forced C4-C1 derived release rollback');
            }
            return originalRelease(...args);
          });

        try {
          await expect(
            requirementService.retire(
              scenario.companyId,
              scenario.userId,
              scenario.requirementIds[0],
              { retirementReason: 'Rollback C4-C1' },
            ),
          ).rejects.toThrow('forced C4-C1 derived release rollback');
        } finally {
          releaseWrite.mockRestore();
        }

        expect(releaseCalls).toBe(2);
        await expect(
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: scenario.requirementIds[0] },
            select: {
              lifecycle: true,
              retiredAt: true,
              retiredById: true,
              retirementReason: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareRequirementLifecycle.ACTIVE,
          retiredAt: null,
          retiredById: null,
          retirementReason: null,
        });
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findMany({
            where: { id: { in: sources.map(({ id }) => id) } },
            orderBy: { id: 'asc' },
            select: {
              lifecycle: true,
              releasedAt: true,
              releasedById: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
        ).resolves.toEqual([
          {
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            releasedAt: null,
            releasedById: null,
            releaseCause: null,
            releaseReason: null,
          },
          {
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            releasedAt: null,
            releasedById: null,
            releaseCause: null,
            releaseReason: null,
          },
        ]);
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: { companyId: scenario.companyId },
          }),
        ).resolves.toBe(claimsBefore);
      });

      it('preserves DIRECT, other parents, tenants and historical lifecycles', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 4,
          assetCount: 6,
          requirementCount: 2,
        });
        const otherCompanyScenario = await createScenario(companyBId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const eligible = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
          scenario.requirementIds[0],
          'retire-exclusion-eligible',
        );
        const direct = await createDirectSource({
          ...scenario,
          equipmentAssetIds: [scenario.equipmentAssetIds[1]],
        });
        const manuallyReleased = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[2],
          scenario.requirementIds[0],
          'retire-exclusion-released',
        );
        await assignmentService.release(
          scenario.companyId,
          scenario.userId,
          manuallyReleased.id,
          { reason: 'Liberación manual previa' },
        );
        const replacementSource = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[3],
          scenario.requirementIds[0],
          'retire-exclusion-replaced',
        );
        const replacement = await assignmentService.replace(
          scenario.companyId,
          scenario.userId,
          replacementSource.id,
          trackKey('retire-exclusion-replacement'),
          {
            equipmentAssetId: scenario.equipmentAssetIds[4],
            replacementReason: 'Reemplazo previo al retiro',
          },
        );
        if (replacement.outcome !== 'REPLACED') {
          throw new Error('Expected a replacement before Requirement Retire.');
        }
        const successor = replacement.data.replacementAssignment;
        registry.assignmentIds.add(successor.id);
        const otherRequirementAssetId = await createScenarioAsset(
          scenario,
          scenario.productIds[1],
        );
        const otherRequirement = await createRequirementSource(
          scenario,
          otherRequirementAssetId,
          scenario.requirementIds[1],
          'retire-exclusion-other-requirement',
        );
        const related = await createRelatedCase(scenario);
        const otherCaseResult = await assignmentService.create(
          scenario.companyId,
          scenario.userId,
          trackKey('retire-exclusion-other-case'),
          {
            caseId: related.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[5],
            requirementId: related.requirementId,
          },
        );
        if (otherCaseResult.outcome !== 'CREATED') {
          throw new Error('Expected an Assignment for the related Case.');
        }
        const otherCase = otherCaseResult.data;
        registry.assignmentIds.add(otherCase.id);
        const otherTenant = await createRequirementSource(
          otherCompanyScenario,
          otherCompanyScenario.equipmentAssetIds[0],
          otherCompanyScenario.requirementIds[0],
          'retire-exclusion-other-tenant',
        );
        const manualBefore =
          await setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: manuallyReleased.id },
          });

        await requirementService.retire(
          scenario.companyId,
          scenario.userId,
          scenario.requirementIds[0],
          { retirementReason: 'Retiro con exclusiones' },
        );

        const rows = await setupPrisma.healthcareEquipmentAssignment.findMany({
          where: {
            id: {
              in: [
                eligible.id,
                direct.id,
                manuallyReleased.id,
                replacementSource.id,
                successor.id,
                otherRequirement.id,
                otherCase.id,
                otherTenant.id,
              ],
            },
          },
          select: {
            id: true,
            lifecycle: true,
            releaseCause: true,
            releaseReason: true,
            releasedAt: true,
            releasedById: true,
          },
        });
        const byId = new Map(rows.map((row) => [row.id, row]));

        for (const id of [eligible.id, successor.id]) {
          expect(byId.get(id)).toMatchObject({
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
            releaseCause:
              HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
            releaseReason: 'Retiro con exclusiones',
            releasedById: scenario.userId,
          });
        }
        expect(byId.get(manuallyReleased.id)).toEqual({
          id: manuallyReleased.id,
          lifecycle: manualBefore.lifecycle,
          releaseCause: manualBefore.releaseCause,
          releaseReason: manualBefore.releaseReason,
          releasedAt: manualBefore.releasedAt,
          releasedById: manualBefore.releasedById,
        });
        expect(byId.get(replacementSource.id)).toMatchObject({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          releaseCause: null,
        });
        for (const id of [
          direct.id,
          otherRequirement.id,
          otherCase.id,
          otherTenant.id,
        ]) {
          expect(byId.get(id)).toMatchObject({
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            releaseCause: null,
            releasedAt: null,
          });
        }
      });

      it('replays a RETIRED Requirement with zero writes and does not repair a lagging Assignment', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 2,
          assetCount: 2,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const first = await requirementService.retire(
          scenario.companyId,
          scenario.userId,
          scenario.requirementIds[0],
          { retirementReason: 'Razón original' },
        );
        const laggingId = randomUUID();
        registry.assignmentIds.add(laggingId);
        await setupPrisma.healthcareEquipmentAssignment.create({
          data: {
            id: laggingId,
            companyId: scenario.companyId,
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[1],
            requirementId: scenario.requirementIds[0],
            origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
            createdById: scenario.userId,
          },
        });
        const [requirementBefore, assignmentsBefore, claimsBefore] =
          await Promise.all([
            setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
              where: { id: scenario.requirementIds[0] },
            }),
            setupPrisma.healthcareEquipmentAssignment.findMany({
              where: { id: { in: [source.id, laggingId] } },
              orderBy: { id: 'asc' },
            }),
            setupPrisma.idempotencyRecord.count({
              where: { companyId: scenario.companyId },
            }),
          ]);

        const replay = await requirementService.retire(
          scenario.companyId,
          scenario.userId,
          scenario.requirementIds[0],
          { retirementReason: 'No sobrescribir ni reparar' },
        );

        expect(replay).toEqual(first);
        await expect(
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: scenario.requirementIds[0] },
          }),
        ).resolves.toEqual(requirementBefore);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findMany({
            where: { id: { in: [source.id, laggingId] } },
            orderBy: { id: 'asc' },
          }),
        ).resolves.toEqual(assignmentsBefore);
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: { companyId: scenario.companyId },
          }),
        ).resolves.toBe(claimsBefore);
      });

      it('preserves the direct HTTP response, tenant boundary and Requirement RBAC', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
          scenario.requirementIds[0],
          'retire-http-source',
        );
        let firstBody: Record<string, unknown> | null = null;

        for (const role of [
          UserRole.ADMIN,
          UserRole.MANAGER,
          UserRole.SALES,
          UserRole.WAREHOUSE,
        ]) {
          httpAuthenticatedRole = role;
          const response = await supertest(requireHttpApp().getHttpServer())
            .post(
              `/healthcare/requirements/${scenario.requirementIds[0]}/retire`,
            )
            .send({ retirementReason: '  Retiro   HTTP  ' })
            .expect(HttpStatus.OK);
          expect(response.body).toMatchObject({
            id: scenario.requirementIds[0],
            lifecycle: HealthcareRequirementLifecycle.RETIRED,
            retiredById: scenario.userId,
            retirementReason: 'Retiro HTTP',
          });
          expect(response.body).not.toHaveProperty('data');
          expect(response.body).not.toHaveProperty('outcome');
          firstBody ??= response.body as Record<string, unknown>;
          expect(response.body).toEqual(firstBody);
        }
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, releaseCause: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
        });

        const deniedScenario = await createScenario(companyAId);
        httpAuthenticatedRole = 'UNAUTHORIZED';
        await supertest(requireHttpApp().getHttpServer())
          .post(
            `/healthcare/requirements/${deniedScenario.requirementIds[0]}/retire`,
          )
          .send({ retirementReason: 'No autorizado' })
          .expect(HttpStatus.FORBIDDEN);
        await expect(
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: deniedScenario.requirementIds[0] },
            select: { lifecycle: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        });

        const otherTenantScenario = await createScenario(companyBId);
        httpAuthenticatedRole = UserRole.ADMIN;
        await supertest(requireHttpApp().getHttpServer())
          .post(
            `/healthcare/requirements/${otherTenantScenario.requirementIds[0]}/retire`,
          )
          .send({ retirementReason: 'Cruce de tenant' })
          .expect(HttpStatus.NOT_FOUND);
        await expect(
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: otherTenantScenario.requirementIds[0] },
            select: { lifecycle: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareRequirementLifecycle.ACTIVE,
        });
      });
    });

    describe('HC-NEXT-03C4-C2 Case Cancel integration', () => {
      it.each([0, 1, 4])(
        'cancels atomically with %i eligible DIRECT/REQUIREMENT reservation(s)',
        async (assignmentCount) => {
          const scenario = await createScenario(companyAId, {
            requestedQty: Math.max(assignmentCount, 1),
            assetCount: Math.max(assignmentCount, 1),
          });
          const assignmentIds: string[] = [];
          for (let index = 0; index < assignmentCount; index += 1) {
            const assignment =
              index % 2 === 0
                ? await createDirectSource({
                    ...scenario,
                    equipmentAssetIds: [scenario.equipmentAssetIds[index]],
                  })
                : await createRequirementSource(
                    scenario,
                    scenario.equipmentAssetIds[index],
                    scenario.requirementIds[0],
                    `cancel-${assignmentCount}-requirement-source`,
                  );
            assignmentIds.push(assignment.id);
          }
          const [claimsBefore, movementsBefore] = await Promise.all([
            setupPrisma.idempotencyRecord.count({
              where: { companyId: scenario.companyId },
            }),
            setupPrisma.inventoryMovement.count({
              where: {
                companyId: scenario.companyId,
                productId: { in: scenario.productIds },
              },
            }),
          ]);

          const cancelled = await caseService.cancel(
            scenario.companyId,
            scenario.caseId,
            scenario.userId,
            '  Cancelación   clínica E2E  ',
          );
          const [persistedCase, persistedAssignments] = await Promise.all([
            setupPrisma.healthcareCase.findUniqueOrThrow({
              where: { id: scenario.caseId },
              select: {
                status: true,
                cancelledAt: true,
                cancelledById: true,
                cancellationReason: true,
              },
            }),
            setupPrisma.healthcareEquipmentAssignment.findMany({
              where: { id: { in: assignmentIds } },
              orderBy: { id: 'asc' },
              select: {
                lifecycle: true,
                releasedAt: true,
                releasedById: true,
                releaseCause: true,
                releaseReason: true,
              },
            }),
          ]);

          expect(cancelled.status).toBe(HealthcareCaseStatus.CANCELLED);
          expect(persistedCase.cancelledAt).toBeInstanceOf(Date);
          expect(persistedCase).toMatchObject({
            status: HealthcareCaseStatus.CANCELLED,
            cancelledById: scenario.userId,
            cancellationReason: 'Cancelación   clínica E2E',
          });
          expect(persistedAssignments).toHaveLength(assignmentCount);
          for (const assignment of persistedAssignments) {
            expect(assignment).toEqual({
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
              releasedAt: persistedCase.cancelledAt,
              releasedById: scenario.userId,
              releaseCause:
                HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
              releaseReason: 'Cancelación   clínica E2E',
            });
          }
          await expect(
            setupPrisma.idempotencyRecord.count({
              where: { companyId: scenario.companyId },
            }),
          ).resolves.toBe(claimsBefore);
          await expect(
            setupPrisma.inventoryMovement.count({
              where: {
                companyId: scenario.companyId,
                productId: { in: scenario.productIds },
              },
            }),
          ).resolves.toBe(movementsBefore);
        },
      );

      it('rolls back Case audit and every release after the first release write succeeds', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 2,
          assetCount: 2,
        });
        const direct = await createDirectSource(scenario);
        const requirement = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[1],
          scenario.requirementIds[0],
          'cancel-rollback-requirement-source',
        );
        const caseBefore = await setupPrisma.healthcareCase.findUniqueOrThrow({
          where: { id: scenario.caseId },
          select: {
            status: true,
            cancelledAt: true,
            cancelledById: true,
            cancellationReason: true,
          },
        });
        const claimsBefore = await setupPrisma.idempotencyRecord.count({
          where: { companyId: scenario.companyId },
        });
        type ReleaseAssignment =
          HealthcareEquipmentAssignmentsRepository['releaseAssignment'];
        const originalRelease = assignmentRepository.releaseAssignment.bind(
          assignmentRepository,
        ) as ReleaseAssignment;
        let releaseCalls = 0;
        const releaseWrite = jest
          .spyOn(assignmentRepository, 'releaseAssignment')
          .mockImplementation((...args: Parameters<ReleaseAssignment>) => {
            releaseCalls += 1;
            if (releaseCalls === 2) {
              throw new Error('forced C4-C2 derived release rollback');
            }
            return originalRelease(...args);
          });

        try {
          await expect(
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Rollback C4-C2',
            ),
          ).rejects.toThrow('forced C4-C2 derived release rollback');
        } finally {
          releaseWrite.mockRestore();
        }

        expect(releaseCalls).toBe(2);
        await expect(
          setupPrisma.healthcareCase.findUniqueOrThrow({
            where: { id: scenario.caseId },
            select: {
              status: true,
              cancelledAt: true,
              cancelledById: true,
              cancellationReason: true,
            },
          }),
        ).resolves.toEqual(caseBefore);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findMany({
            where: { id: { in: [direct.id, requirement.id] } },
            orderBy: { id: 'asc' },
            select: {
              lifecycle: true,
              releasedAt: true,
              releasedById: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
        ).resolves.toEqual([
          {
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            releasedAt: null,
            releasedById: null,
            releaseCause: null,
            releaseReason: null,
          },
          {
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            releasedAt: null,
            releasedById: null,
            releaseCause: null,
            releaseReason: null,
          },
        ]);
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: { companyId: scenario.companyId },
          }),
        ).resolves.toBe(claimsBefore);
      });

      it('releases only current Case reservations and preserves tenant, Case and lifecycle exclusions', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 8,
          assetCount: 7,
        });
        const eligibleDirect = await createDirectSource(scenario);
        const eligibleRequirement = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[1],
        );
        const manualSource = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[2],
        );
        await assignmentService.release(
          scenario.companyId,
          scenario.userId,
          manualSource.id,
          { reason: 'Auditoría manual original' },
          trackKey('cancel-exclusion-manual'),
        );
        const replacedSource = await createDirectSource({
          ...scenario,
          equipmentAssetIds: [scenario.equipmentAssetIds[3]],
        });
        const replacement = await assignmentService.replace(
          scenario.companyId,
          scenario.userId,
          replacedSource.id,
          trackKey('cancel-exclusion-replace'),
          {
            equipmentAssetId: scenario.equipmentAssetIds[4],
            replacementReason: 'Preparar histórico REPLACED',
          },
        );
        if (replacement.outcome !== 'REPLACED') {
          throw new Error('Expected the historical replacement fixture.');
        }
        const successorId = replacement.data.replacementAssignment.id;
        registry.assignmentIds.add(successorId);
        const relatedCase = await createRelatedCase(scenario);
        const otherCaseResult = await assignmentService.create(
          scenario.companyId,
          scenario.userId,
          trackKey('cancel-exclusion-other-case'),
          {
            caseId: relatedCase.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[5],
            requirementId: relatedCase.requirementId,
          },
        );
        if (otherCaseResult.outcome !== 'CREATED') {
          throw new Error('Expected the other-Case fixture.');
        }
        registry.assignmentIds.add(otherCaseResult.data.id);
        const otherTenant = await createScenario(companyBId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const otherTenantSource = await createRequirementSource(
          otherTenant,
          otherTenant.equipmentAssetIds[0],
        );

        await caseService.cancel(
          scenario.companyId,
          scenario.caseId,
          scenario.userId,
          'Cancelación selectiva',
        );

        const persisted =
          await setupPrisma.healthcareEquipmentAssignment.findMany({
            where: {
              id: {
                in: [
                  eligibleDirect.id,
                  eligibleRequirement.id,
                  manualSource.id,
                  replacedSource.id,
                  successorId,
                  otherCaseResult.data.id,
                  otherTenantSource.id,
                ],
              },
            },
            select: { id: true, lifecycle: true, releaseCause: true },
          });
        const byId = new Map(persisted.map((record) => [record.id, record]));
        for (const id of [
          eligibleDirect.id,
          eligibleRequirement.id,
          successorId,
        ]) {
          expect(byId.get(id)).toMatchObject({
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
            releaseCause:
              HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
          });
        }
        expect(byId.get(manualSource.id)).toMatchObject({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        });
        expect(byId.get(replacedSource.id)).toMatchObject({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          releaseCause: null,
        });
        for (const id of [otherCaseResult.data.id, otherTenantSource.id]) {
          expect(byId.get(id)).toMatchObject({
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            releaseCause: null,
          });
        }
      });

      it('rejects CANCELLED replay with zero writes and does not repair a lagging reservation', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 2,
          assetCount: 2,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        await caseService.cancel(
          scenario.companyId,
          scenario.caseId,
          scenario.userId,
          'Razón original',
        );
        const laggingId = randomUUID();
        registry.assignmentIds.add(laggingId);
        await setupPrisma.healthcareEquipmentAssignment.create({
          data: {
            id: laggingId,
            companyId: scenario.companyId,
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[1],
            requirementId: scenario.requirementIds[0],
            origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
            createdById: scenario.userId,
          },
        });
        const [caseBefore, assignmentsBefore, claimsBefore] = await Promise.all(
          [
            setupPrisma.healthcareCase.findUniqueOrThrow({
              where: { id: scenario.caseId },
            }),
            setupPrisma.healthcareEquipmentAssignment.findMany({
              where: { id: { in: [source.id, laggingId] } },
              orderBy: { id: 'asc' },
            }),
            setupPrisma.idempotencyRecord.count({
              where: { companyId: scenario.companyId },
            }),
          ],
        );

        await expect(
          caseService.cancel(
            scenario.companyId,
            scenario.caseId,
            scenario.userId,
            'No sobrescribir ni reparar',
          ),
        ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
        await expect(
          setupPrisma.healthcareCase.findUniqueOrThrow({
            where: { id: scenario.caseId },
          }),
        ).resolves.toEqual(caseBefore);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findMany({
            where: { id: { in: [source.id, laggingId] } },
            orderBy: { id: 'asc' },
          }),
        ).resolves.toEqual(assignmentsBefore);
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: { companyId: scenario.companyId },
          }),
        ).resolves.toBe(claimsBefore);
      });

      it('preserves Case Cancel HTTP shape, RBAC and tenant isolation', async () => {
        for (const role of [UserRole.ADMIN, UserRole.MANAGER]) {
          const scenario = await createScenario(companyAId, {
            requestedQty: 1,
            assetCount: 1,
          });
          const source = await createRequirementSource(
            scenario,
            scenario.equipmentAssetIds[0],
            scenario.requirementIds[0],
            'cancel-http-source',
          );
          httpAuthenticatedRole = role;
          const response = await supertest(requireHttpApp().getHttpServer())
            .post(`/healthcare/cases/${scenario.caseId}/cancel`)
            .send({ cancellationReason: '  Cancelación HTTP  ' })
            .expect(HttpStatus.CREATED);
          expect(response.body).toMatchObject({
            id: scenario.caseId,
            status: HealthcareCaseStatus.CANCELLED,
            cancelledById: scenario.userId,
            cancellationReason: 'Cancelación HTTP',
          });
          expect(response.body).not.toHaveProperty('data');
          expect(response.body).not.toHaveProperty('outcome');
          await expect(
            setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
              where: { id: source.id },
              select: { lifecycle: true, releaseCause: true },
            }),
          ).resolves.toEqual({
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
            releaseCause:
              HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
          });
          await supertest(requireHttpApp().getHttpServer())
            .post(`/healthcare/cases/${scenario.caseId}/cancel`)
            .send({ cancellationReason: 'Replay no permitido' })
            .expect(HttpStatus.CONFLICT);
        }

        for (const role of [UserRole.SALES, UserRole.WAREHOUSE]) {
          const denied = await createScenario(companyAId, {
            requestedQty: 1,
            assetCount: 1,
          });
          const deniedSource = await createRequirementSource(
            denied,
            denied.equipmentAssetIds[0],
          );
          httpAuthenticatedRole = role;
          await supertest(requireHttpApp().getHttpServer())
            .post(`/healthcare/cases/${denied.caseId}/cancel`)
            .send({ cancellationReason: 'Rol sin permiso' })
            .expect(HttpStatus.FORBIDDEN);
          await expect(
            setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
              where: { id: deniedSource.id },
              select: { lifecycle: true },
            }),
          ).resolves.toEqual({
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          });
        }

        const otherTenant = await createScenario(companyBId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const otherTenantSource = await createRequirementSource(
          otherTenant,
          otherTenant.equipmentAssetIds[0],
        );
        httpAuthenticatedRole = UserRole.ADMIN;
        await supertest(requireHttpApp().getHttpServer())
          .post(`/healthcare/cases/${otherTenant.caseId}/cancel`)
          .send({ cancellationReason: 'Cruce de tenant' })
          .expect(HttpStatus.NOT_FOUND);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: otherTenantSource.id },
            select: { lifecycle: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        });
      });
    });

    describe('HC-NEXT-03C4-C2 deterministic cross-consumer ordering', () => {
      it('serializes Create before Cancel and releases the committed reservation', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const key = trackKey('create-before-cancel');
        const [created, cancelled] = await runAssignmentBeforeCancelRace(
          scenario.equipmentAssetIds[0],
          scenario.companyId,
          () =>
            assignmentService.create(scenario.companyId, scenario.userId, key, {
              caseId: scenario.caseId,
              equipmentAssetId: scenario.equipmentAssetIds[0],
              requirementId: scenario.requirementIds[0],
            }),
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel after Create',
            ),
        );

        expect(created.outcome).toBe('CREATED');
        expect(cancelled.status).toBe(HealthcareCaseStatus.CANCELLED);
        if (created.outcome !== 'CREATED') {
          throw new Error('Expected Create to commit before Cancel.');
        }
        registry.assignmentIds.add(created.data.id);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: created.data.id },
            select: { lifecycle: true, releaseCause: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
        });
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

      it('serializes Cancel before Create without an Assignment or claim', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const key = trackKey('cancel-before-create');
        const [cancelResult, createResult] = await runCancelBeforeConsumerRace(
          scenario,
          assignmentPrisma,
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel wins before Create',
            ),
          () =>
            assignmentService.create(scenario.companyId, scenario.userId, key, {
              caseId: scenario.caseId,
              equipmentAssetId: scenario.equipmentAssetIds[0],
              requirementId: scenario.requirementIds[0],
            }),
        );

        expect(cancelResult).toMatchObject({
          status: 'fulfilled',
          value: { status: HealthcareCaseStatus.CANCELLED },
        });
        expect(createResult).toMatchObject({
          status: 'rejected',
          reason: {
            response: { code: 'CASE_EQUIPMENT_ASSIGNMENTS_READ_ONLY' },
          },
        });
        await expect(
          setupPrisma.healthcareEquipmentAssignment.count({
            where: { companyId: scenario.companyId, caseId: scenario.caseId },
          }),
        ).resolves.toBe(0);
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('serializes Replace before Cancel and releases only the committed successor', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 2,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const [replacement, cancelled] = await runAssignmentBeforeCancelRace(
          scenario.equipmentAssetIds[1],
          scenario.companyId,
          () =>
            assignmentService.replace(
              scenario.companyId,
              scenario.userId,
              source.id,
              trackKey('replace-before-cancel'),
              {
                equipmentAssetId: scenario.equipmentAssetIds[1],
                replacementReason: 'Replace wins before Cancel',
              },
            ),
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel after Replace',
            ),
        );

        expect(replacement.outcome).toBe('REPLACED');
        expect(cancelled.status).toBe(HealthcareCaseStatus.CANCELLED);
        if (replacement.outcome !== 'REPLACED') {
          throw new Error('Expected Replace to commit before Cancel.');
        }
        const successorId = replacement.data.replacementAssignment.id;
        registry.assignmentIds.add(successorId);
        const [persistedSource, persistedSuccessor] = await Promise.all([
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, releaseCause: true },
          }),
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: successorId },
            select: { lifecycle: true, releaseCause: true },
          }),
        ]);
        expect(persistedSource).toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          releaseCause: null,
        });
        expect(persistedSuccessor).toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
        });
      });

      it('serializes Cancel before Replace without a successor or claim', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 2,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const key = trackKey('cancel-before-replace');
        const [cancelResult, replaceResult] = await runCancelBeforeConsumerRace(
          scenario,
          assignmentPrisma,
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel wins before Replace',
            ),
          () =>
            assignmentService.replace(
              scenario.companyId,
              scenario.userId,
              source.id,
              key,
              {
                equipmentAssetId: scenario.equipmentAssetIds[1],
                replacementReason: 'Must lose after Cancel',
              },
            ),
        );

        expect(cancelResult).toMatchObject({
          status: 'fulfilled',
          value: { status: HealthcareCaseStatus.CANCELLED },
        });
        expect(replaceResult).toMatchObject({
          status: 'rejected',
          reason: { response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' } },
        });
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, releaseCause: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
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
          setupPrisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('serializes Manual Release before Cancel and preserves the manual audit', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const key = trackKey('release-before-cancel');
        const [released, cancelled] = await runAssignmentBeforeCancelRace(
          scenario.equipmentAssetIds[0],
          scenario.companyId,
          () =>
            assignmentService.release(
              scenario.companyId,
              scenario.userId,
              source.id,
              { reason: 'Manual wins before Cancel' },
              key,
            ),
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel after Manual Release',
            ),
        );

        expect(released.status).toBe(
          HealthcareEquipmentAssignmentLifecycle.RELEASED,
        );
        expect(cancelled.status).toBe(HealthcareCaseStatus.CANCELLED);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: {
              lifecycle: true,
              releaseCause: true,
              releaseReason: true,
              releasedById: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason: 'Manual wins before Cancel',
          releasedById: scenario.userId,
        });
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
              key,
            },
          }),
        ).resolves.toBe(1);
      });

      it('serializes Cancel before Manual Release without a release claim', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const key = trackKey('cancel-before-release');
        const [cancelResult, releaseResult] = await runCancelBeforeConsumerRace(
          scenario,
          assignmentPrisma,
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel wins before Manual Release',
            ),
          () =>
            assignmentService.release(
              scenario.companyId,
              scenario.userId,
              source.id,
              { reason: 'Must not overwrite Case audit' },
              key,
            ),
        );

        expect(cancelResult).toMatchObject({
          status: 'fulfilled',
          value: { status: HealthcareCaseStatus.CANCELLED },
        });
        expect(releaseResult).toMatchObject({
          status: 'rejected',
          reason: { response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' } },
        });
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: {
              lifecycle: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
          releaseReason: 'Cancel wins before Manual Release',
        });
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('serializes Requirement Retire before Cancel and preserves the withdrawal audit', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const [retired, cancelled] = await runRetireBeforeCancelRace(
          scenario,
          () =>
            requirementService.retire(
              scenario.companyId,
              scenario.userId,
              scenario.requirementIds[0],
              { retirementReason: 'Retire wins before Cancel' },
            ),
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel after Retire',
            ),
        );

        expect(retired.lifecycle).toBe(HealthcareRequirementLifecycle.RETIRED);
        expect(cancelled.status).toBe(HealthcareCaseStatus.CANCELLED);
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: {
              lifecycle: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
          releaseReason: 'Retire wins before Cancel',
        });
      });

      it('serializes Cancel before Requirement Retire without rewriting either audit', async () => {
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        const source = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const [cancelResult, retireResult] = await runCancelBeforeConsumerRace(
          scenario,
          requirementPrisma,
          () =>
            caseService.cancel(
              scenario.companyId,
              scenario.caseId,
              scenario.userId,
              'Cancel wins before Retire',
            ),
          () =>
            requirementService.retire(
              scenario.companyId,
              scenario.userId,
              scenario.requirementIds[0],
              { retirementReason: 'Must lose after Cancel' },
            ),
        );

        expect(cancelResult).toMatchObject({
          status: 'fulfilled',
          value: { status: HealthcareCaseStatus.CANCELLED },
        });
        expect(retireResult).toMatchObject({
          status: 'rejected',
          reason: { response: { code: 'CASE_REQUIREMENTS_READ_ONLY' } },
        });
        await expect(
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: scenario.requirementIds[0] },
            select: {
              lifecycle: true,
              retiredAt: true,
              retiredById: true,
              retirementReason: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareRequirementLifecycle.ACTIVE,
          retiredAt: null,
          retiredById: null,
          retirementReason: null,
        });
        await expect(
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: {
              lifecycle: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.CASE_CANCELLED,
          releaseReason: 'Cancel wins before Retire',
        });
      });
    });

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

    it('serializes Create before Requirement Retire and releases the committed reservation', async () => {
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
        const [persistedAssignment, persistedRequirement] = await Promise.all([
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: created.data.id },
            select: {
              lifecycle: true,
              releasedAt: true,
              releasedById: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: scenario.requirementIds[0] },
            select: { retiredAt: true },
          }),
        ]);
        expect(persistedAssignment).toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
          releasedAt: persistedRequirement.retiredAt,
          releasedById: scenario.userId,
          releaseCause:
            HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
          releaseReason: 'HC-LOCK-02 2H controlled retirement',
        });
        expect(persistedRequirement.retiredAt).toBeInstanceOf(Date);
      }
    });

    it('serializes Requirement Retire before Create and leaves no orphan reservation or claim', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 1,
      });
      const key = trackKey('retire-before-create');
      const [retireResult, createResult] =
        await runRetireFirstCrossConsumerRace(
          scenario,
          () =>
            requirementService.retire(
              scenario.companyId,
              scenario.userId,
              scenario.requirementIds[0],
              { retirementReason: 'Retire wins before Create' },
            ),
          () =>
            assignmentService.create(scenario.companyId, scenario.userId, key, {
              caseId: scenario.caseId,
              equipmentAssetId: scenario.equipmentAssetIds[0],
              requirementId: scenario.requirementIds[0],
            }),
        );

      expect(retireResult).toMatchObject({
        status: 'fulfilled',
        value: { lifecycle: HealthcareRequirementLifecycle.RETIRED },
      });
      expect(createResult).toMatchObject({
        status: 'rejected',
        reason: { response: { code: 'REQUIREMENT_RETIRED' } },
      });
      await expect(
        setupPrisma.healthcareEquipmentAssignment.count({
          where: {
            companyId: scenario.companyId,
            requirementId: scenario.requirementIds[0],
          },
        }),
      ).resolves.toBe(0);
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
            key,
          },
        }),
      ).resolves.toBe(0);
    });

    it('serializes Replace before Requirement Retire and releases only the successor', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 2,
      });
      const source = await createRequirementSource(
        scenario,
        scenario.equipmentAssetIds[0],
        scenario.requirementIds[0],
        'replace-before-retire-source',
      );
      const [replacement, retired] = await runSerializedCrossConsumerRace(
        scenario.equipmentAssetIds[1],
        scenario.companyId,
        () =>
          assignmentService.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            trackKey('replace-before-retire'),
            {
              equipmentAssetId: scenario.equipmentAssetIds[1],
              replacementReason: 'Replace wins before Retire',
            },
          ),
        () =>
          requirementService.retire(
            scenario.companyId,
            scenario.userId,
            scenario.requirementIds[0],
            { retirementReason: 'Retire after Replace' },
          ),
      );

      expect(replacement.outcome).toBe('REPLACED');
      expect(retired.lifecycle).toBe(HealthcareRequirementLifecycle.RETIRED);
      if (replacement.outcome !== 'REPLACED') {
        throw new Error('Expected Replace to win before Requirement Retire.');
      }
      const successorId = replacement.data.replacementAssignment.id;
      registry.assignmentIds.add(successorId);
      const [persistedSource, persistedSuccessor, persistedRequirement] =
        await Promise.all([
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, releaseCause: true },
          }),
          setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: successorId },
            select: {
              lifecycle: true,
              releasedAt: true,
              releasedById: true,
              releaseCause: true,
              releaseReason: true,
            },
          }),
          setupPrisma.healthcareCaseRequirement.findUniqueOrThrow({
            where: { id: scenario.requirementIds[0] },
            select: { retiredAt: true },
          }),
        ]);
      expect(persistedSource).toEqual({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
        releaseCause: null,
      });
      expect(persistedSuccessor).toEqual({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt: persistedRequirement.retiredAt,
        releasedById: scenario.userId,
        releaseCause:
          HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
        releaseReason: 'Retire after Replace',
      });
    });

    it('serializes Requirement Retire before Replace without a partial successor or claim', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 2,
      });
      const source = await createRequirementSource(
        scenario,
        scenario.equipmentAssetIds[0],
        scenario.requirementIds[0],
        'retire-before-replace-source',
      );
      const key = trackKey('retire-before-replace');
      const [retireResult, replaceResult] =
        await runRetireFirstCrossConsumerRace(
          scenario,
          () =>
            requirementService.retire(
              scenario.companyId,
              scenario.userId,
              scenario.requirementIds[0],
              { retirementReason: 'Retire wins before Replace' },
            ),
          () =>
            assignmentService.replace(
              scenario.companyId,
              scenario.userId,
              source.id,
              key,
              {
                equipmentAssetId: scenario.equipmentAssetIds[1],
                replacementReason: 'Must lose after Retire',
              },
            ),
        );

      expect(retireResult).toMatchObject({
        status: 'fulfilled',
        value: { lifecycle: HealthcareRequirementLifecycle.RETIRED },
      });
      expect(replaceResult).toMatchObject({
        status: 'rejected',
        reason: { response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' } },
      });
      await expect(
        setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: source.id },
          select: { lifecycle: true, releaseCause: true },
        }),
      ).resolves.toEqual({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releaseCause:
          HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
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
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
            key,
          },
        }),
      ).resolves.toBe(0);
    });

    it('serializes Manual Release before Requirement Retire and preserves the manual audit', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 1,
      });
      const source = await createRequirementSource(
        scenario,
        scenario.equipmentAssetIds[0],
        scenario.requirementIds[0],
        'release-before-retire-source',
      );
      const key = trackKey('release-before-retire');
      const [released, retired] = await runSerializedCrossConsumerRace(
        scenario.equipmentAssetIds[0],
        scenario.companyId,
        () =>
          assignmentService.release(
            scenario.companyId,
            scenario.userId,
            source.id,
            { reason: 'Manual gana primero' },
            key,
          ),
        () =>
          requirementService.retire(
            scenario.companyId,
            scenario.userId,
            scenario.requirementIds[0],
            { retirementReason: 'Retiro posterior' },
          ),
      );

      expect(released.status).toBe(
        HealthcareEquipmentAssignmentLifecycle.RELEASED,
      );
      expect(retired.lifecycle).toBe(HealthcareRequirementLifecycle.RETIRED);
      await expect(
        setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: source.id },
          select: {
            lifecycle: true,
            releaseCause: true,
            releaseReason: true,
            releasedById: true,
          },
        }),
      ).resolves.toEqual({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
        releaseReason: 'Manual gana primero',
        releasedById: scenario.userId,
      });
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
            key,
          },
        }),
      ).resolves.toBe(1);
    });

    it('serializes Requirement Retire before Manual Release without a release claim', async () => {
      const scenario = await createScenario(companyAId, {
        requestedQty: 1,
        assetCount: 1,
      });
      const source = await createRequirementSource(
        scenario,
        scenario.equipmentAssetIds[0],
        scenario.requirementIds[0],
        'retire-before-release-source',
      );
      const key = trackKey('retire-before-release');
      const [retireResult, releaseResult] =
        await runRetireFirstCrossConsumerRace(
          scenario,
          () =>
            requirementService.retire(
              scenario.companyId,
              scenario.userId,
              scenario.requirementIds[0],
              { retirementReason: 'Retire wins before Manual Release' },
            ),
          () =>
            assignmentService.release(
              scenario.companyId,
              scenario.userId,
              source.id,
              { reason: 'No debe sobrescribir' },
              key,
            ),
        );

      expect(retireResult).toMatchObject({
        status: 'fulfilled',
        value: { lifecycle: HealthcareRequirementLifecycle.RETIRED },
      });
      expect(releaseResult).toMatchObject({
        status: 'rejected',
        reason: { response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' } },
      });
      await expect(
        setupPrisma.healthcareEquipmentAssignment.findUniqueOrThrow({
          where: { id: source.id },
          select: {
            lifecycle: true,
            releaseCause: true,
            releaseReason: true,
            releasedById: true,
          },
        }),
      ).resolves.toEqual({
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releaseCause:
          HealthcareEquipmentAssignmentReleaseCause.REQUIREMENT_WITHDRAWN,
        releaseReason: 'Retire wins before Manual Release',
        releasedById: scenario.userId,
      });
      await expect(
        setupPrisma.idempotencyRecord.count({
          where: {
            companyId: scenario.companyId,
            scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE,
            key,
          },
        }),
      ).resolves.toBe(0);
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

    describe('HC-OPS-01A.1 CaseKit item exclusion', () => {
      it('enforces ACTIVE-only source uniqueness and permits re-add after exclusion', async () => {
        const fixture = await createCaseKitFixture();
        const indexRows = await setupPrisma.$queryRaw<
          Array<{ indexName: string; indexDefinition: string }>
        >(Prisma.sql`
          SELECT indexname AS "indexName", indexdef AS "indexDefinition"
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN (
              'HealthcareCaseKitItem_requirement_source_key',
              'HealthcareCaseKitItem_assignment_source_key'
            )
          ORDER BY indexname
        `);

        const expectedSourceByIndex = {
          HealthcareCaseKitItem_assignment_source_key: 'equipmentAssignmentId',
          HealthcareCaseKitItem_requirement_source_key: 'requirementId',
        } as const;
        expect(indexRows.map(({ indexName }) => indexName)).toEqual(
          Object.keys(expectedSourceByIndex),
        );
        for (const indexRow of indexRows) {
          const sourceColumn =
            expectedSourceByIndex[
              indexRow.indexName as keyof typeof expectedSourceByIndex
            ];
          const normalizedDefinition = indexRow.indexDefinition
            .replaceAll('"', '')
            .replace(/\s+/gu, ' ')
            .trim();

          expect(normalizedDefinition).toMatch(/\bCREATE UNIQUE INDEX\b/iu);
          expect(normalizedDefinition).toMatch(
            /\bON public\.HealthcareCaseKitItem\b/iu,
          );
          expect(normalizedDefinition).toMatch(
            new RegExp(
              `\\(\\s*companyId\\s*,\\s*caseKitId\\s*,\\s*${sourceColumn}\\s*\\)`,
              'iu',
            ),
          );
          expect(normalizedDefinition).toMatch(
            new RegExp(`${sourceColumn}\\s+IS\\s+NOT\\s+NULL`, 'iu'),
          );
          expect(normalizedDefinition).toMatch(
            /lifecycle\s*=\s*'ACTIVE'(?:::[A-Za-z0-9_.]+)?/iu,
          );
        }

        await expect(
          setupPrisma.healthcareCaseKitItem.create({
            data: {
              id: randomUUID(),
              companyId: fixture.scenario.companyId,
              caseId: fixture.scenario.caseId,
              caseKitId: fixture.caseKitId,
              requirementId: fixture.scenario.requirementIds[0],
              preparedQuantity: 1,
              addedById: fixture.scenario.userId,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2002' });

        await expect(
          caseKitServiceA.excludeItem(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            fixture.itemId,
            trackKey('case-kit-item-exclude'),
            { reason: 'Fuente corregida' },
          ),
        ).resolves.toMatchObject({
          replay: false,
          data: {
            lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
            exclusionReason: 'Fuente corregida',
          },
        });

        const replacement = await caseKitServiceA.addItem(
          fixture.scenario.companyId,
          fixture.scenario.userId,
          fixture.caseKitId,
          trackKey('case-kit-item-readd'),
          {
            sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
            requirementId: fixture.scenario.requirementIds[0],
            preparedQuantity: 1,
          },
        );

        expect(replacement.data.id).not.toBe(fixture.itemId);
        await expect(
          setupPrisma.healthcareCaseKitItem.count({
            where: {
              companyId: fixture.scenario.companyId,
              caseKitId: fixture.caseKitId,
              requirementId: fixture.scenario.requirementIds[0],
              lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          setupPrisma.healthcareCaseKitItem.count({
            where: {
              companyId: fixture.scenario.companyId,
              caseKitId: fixture.caseKitId,
              requirementId: fixture.scenario.requirementIds[0],
              lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
            },
          }),
        ).resolves.toBe(1);
      });

      it('serializes concurrent exclusions and leaves only the winning claim and audit', async () => {
        const fixture = await createCaseKitFixture();
        const firstPid = await getBackendPid(assignmentPrisma);
        const secondPid = await getBackendPid(requirementPrisma);
        const firstReachedCompletion = deferred<void>();
        const allowFirstCompletion = deferred<void>();
        const completion = jest
          .spyOn(caseKitRepositoryA, 'completeIdempotencyClaim')
          .mockImplementation((async (
            transaction: Prisma.TransactionClient,
            claimId: string,
            resourceId: string,
          ) => {
            firstReachedCompletion.resolve(undefined);
            await allowFirstCompletion.promise;
            return transaction.idempotencyRecord.update({
              where: { id: claimId },
              data: { resourceId },
              select: { id: true },
            });
          }) as never);
        const firstKey = trackKey('case-kit-exclude-winner');
        const secondKey = trackKey('case-kit-exclude-replay');
        let first: ReturnType<HealthcareCaseKitsService['excludeItem']> | null =
          null;
        let second: ReturnType<
          HealthcareCaseKitsService['excludeItem']
        > | null = null;

        try {
          first = caseKitServiceA.excludeItem(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            fixture.itemId,
            firstKey,
            { reason: 'Duplicado operativo' },
          );
          await withTimeout(
            firstReachedCompletion.promise,
            5_000,
            'CaseKit exclusion winner reached claim completion',
          );
          second = caseKitServiceB.excludeItem(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            fixture.itemId,
            secondKey,
            { reason: 'Duplicado operativo' },
          );
          await waitUntilBlockedBy(observerPrisma, secondPid, firstPid);
          allowFirstCompletion.resolve(undefined);

          const results = await withTimeout(
            Promise.all([first, second]),
            8_000,
            'concurrent CaseKit exclusions',
          );
          expect(results.map((result) => result.replay).sort()).toEqual([
            false,
            true,
          ]);
          await expect(
            setupPrisma.idempotencyRecord.count({
              where: {
                companyId: fixture.scenario.companyId,
                scope: IdempotencyScope.HEALTHCARE_CASE_KIT_ITEM_EXCLUDE,
                key: { in: [firstKey, secondKey] },
              },
            }),
          ).resolves.toBe(1);
          const persistedItem =
            await setupPrisma.healthcareCaseKitItem.findUnique({
              where: { id: fixture.itemId },
              select: {
                lifecycle: true,
                excludedById: true,
                excludedAt: true,
                exclusionReason: true,
              },
            });
          expect(persistedItem).toMatchObject({
            lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
            excludedById: fixture.scenario.userId,
            exclusionReason: 'Duplicado operativo',
          });
          expect(persistedItem?.excludedAt).toBeInstanceOf(Date);
        } finally {
          allowFirstCompletion.resolve(undefined);
          await Promise.allSettled(
            [first, second].filter(
              (
                operation,
              ): operation is ReturnType<
                HealthcareCaseKitsService['excludeItem']
              > => operation !== null,
            ),
          );
          completion.mockRestore();
        }
      });

      it('rolls back lifecycle, audit and claim when claim completion fails', async () => {
        const fixture = await createCaseKitFixture();
        const key = trackKey('case-kit-exclude-rollback');
        const completion = jest
          .spyOn(caseKitRepositoryA, 'completeIdempotencyClaim')
          .mockRejectedValue(new Error('Injected CaseKit completion failure'));

        try {
          await expect(
            caseKitServiceA.excludeItem(
              fixture.scenario.companyId,
              fixture.scenario.userId,
              fixture.caseKitId,
              fixture.itemId,
              key,
              { reason: 'Rollback controlado' },
            ),
          ).rejects.toThrow('Injected CaseKit completion failure');
        } finally {
          completion.mockRestore();
        }

        await expect(
          setupPrisma.healthcareCaseKitItem.findUnique({
            where: { id: fixture.itemId },
            select: {
              lifecycle: true,
              excludedById: true,
              excludedAt: true,
              exclusionReason: true,
            },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
          excludedById: null,
          excludedAt: null,
          exclusionReason: null,
        });
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: {
              companyId: fixture.scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_CASE_KIT_ITEM_EXCLUDE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });
    });

    describe('HC-OPS-01B CaseKit preparation confirmation', () => {
      async function createSourceRaceFixture(source: 'product' | 'equipment') {
        if (source === 'product') return createReadyCaseKitFixture();
        const scenario = await createScenario(companyAId, {
          requestedQty: 1,
          assetCount: 1,
        });
        await setupPrisma.healthcareCase.update({
          where: { id: scenario.caseId },
          data: { status: HealthcareCaseStatus.SCHEDULED },
        });
        const assignment = await createRequirementSource(
          scenario,
          scenario.equipmentAssetIds[0],
        );
        const kit = await caseKitServiceA.create(
          scenario.companyId,
          scenario.userId,
          scenario.caseId,
          trackKey('case-kit-asset-race-create'),
        );
        const item = await caseKitServiceA.addItem(
          scenario.companyId,
          scenario.userId,
          kit.data.id,
          trackKey('case-kit-asset-race-add'),
          {
            sourceType: HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT,
            equipmentAssignmentId: assignment.id,
          },
        );
        return { scenario, caseKitId: kit.data.id, itemId: item.data.id };
      }

      function invalidateSource(
        source: 'product' | 'equipment',
        scenario: Scenario,
      ): Promise<unknown> {
        if (source === 'product') {
          return new ProductsService(requirementPrisma).remove(
            scenario.companyId,
            scenario.productIds[0],
          );
        }
        const unusedCodes = {
          allocateNextAvailableAssetCode: () => {
            throw new Error('Asset allocation is outside the retirement race.');
          },
        } as unknown as EquipmentAssetCodeService;
        return new EquipmentService(requirementPrisma, unusedCodes).retire(
          scenario.companyId,
          scenario.userId,
          scenario.equipmentAssetIds[0],
          {
            retiredReason: EquipmentRetirementReason.OTHER,
            retirementNotes: 'HC-OPS-01B readiness source race',
          },
        );
      }

      async function physicalState(scenario: Scenario) {
        return Promise.all([
          setupPrisma.product.findMany({
            where: {
              companyId: scenario.companyId,
              id: { in: scenario.productIds },
            },
            select: { id: true, stock: true },
            orderBy: { id: 'asc' },
          }),
          setupPrisma.inventoryBatch.findMany({
            where: {
              companyId: scenario.companyId,
              productId: { in: scenario.productIds },
            },
            select: { id: true, availableQuantity: true },
            orderBy: { id: 'asc' },
          }),
          setupPrisma.inventoryMovement.findMany({
            where: {
              companyId: scenario.companyId,
              productId: { in: scenario.productIds },
            },
            select: { id: true },
            orderBy: { id: 'asc' },
          }),
          setupPrisma.healthcareEquipmentAssignment.findMany({
            where: { companyId: scenario.companyId, caseId: scenario.caseId },
            orderBy: { id: 'asc' },
          }),
        ]);
      }

      it.each(['product', 'equipment'] as const)(
        'revalidates BLOCKED when %s mutation wins after confirmation starts',
        async (source) => {
          const fixture = await createSourceRaceFixture(source);
          const before = await physicalState(fixture.scenario);
          const reachedSources = deferred<void>();
          const allowSources = deferred<void>();
          const original = caseKitRepositoryA.lockActiveItemProducts.bind(
            caseKitRepositoryA,
          ) as HealthcareCaseKitsRepository['lockActiveItemProducts'];
          const gate = jest
            .spyOn(caseKitRepositoryA, 'lockActiveItemProducts')
            .mockImplementation(async (...args) => {
              reachedSources.resolve(undefined);
              await allowSources.promise;
              return original(...args);
            });
          const key = trackKey(`case-kit-${source}-mutation-first`);
          const confirmation = caseKitServiceA.confirmPreparation(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            key,
          );
          void confirmation.catch(() => undefined);
          let mutation: Promise<unknown> | null = null;
          try {
            await withTimeout(
              reachedSources.promise,
              5_000,
              'confirmation before source locks',
            );
            // The production mutation commits while confirmation holds its parent locks.
            mutation = invalidateSource(source, fixture.scenario);
            await withTimeout(
              mutation,
              OPERATION_TIMEOUT_MS,
              'source mutation before preparation',
            );
            allowSources.resolve(undefined);
            await expect(confirmation).rejects.toMatchObject({
              response: {
                code: 'CASE_KIT_PREPARATION_BLOCKED',
                details: {
                  blockers: expect.arrayContaining([
                    expect.objectContaining({
                      code:
                        source === 'product'
                          ? 'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE'
                          : 'CASE_KIT_EQUIPMENT_NOT_ACTIVE',
                    }),
                  ]) as unknown,
                },
              },
            });
            await expect(
              setupPrisma.healthcareCaseKit.findUniqueOrThrow({
                where: { id: fixture.caseKitId },
                select: { status: true, preparedById: true, preparedAt: true },
              }),
            ).resolves.toEqual({
              status: 'DRAFT',
              preparedById: null,
              preparedAt: null,
            });
            await expect(
              setupPrisma.idempotencyRecord.count({
                where: {
                  companyId: fixture.scenario.companyId,
                  scope:
                    IdempotencyScope.HEALTHCARE_CASE_KIT_CONFIRM_PREPARATION,
                  key,
                },
              }),
            ).resolves.toBe(0);
            expect(await physicalState(fixture.scenario)).toEqual(before);
          } finally {
            allowSources.resolve(undefined);
            try {
              await withTimeout(
                Promise.allSettled([
                  confirmation,
                  ...(mutation ? [mutation] : []),
                ]),
                CLEANUP_TIMEOUT_MS,
                'mutation-first confirmation cleanup',
              );
            } finally {
              gate.mockRestore();
            }
          }
        },
      );

      it.each(['product', 'equipment'] as const)(
        'holds %s mutation until the ready confirmation commits',
        async (source) => {
          const fixture = await createSourceRaceFixture(source);
          const before = await physicalState(fixture.scenario);
          const confirmationPid = await getBackendPid(assignmentPrisma);
          const mutationPid = await getBackendPid(requirementPrisma);
          const reachedTransition = deferred<void>();
          const allowTransition = deferred<void>();
          const original = caseKitRepositoryA.confirmPreparation.bind(
            caseKitRepositoryA,
          ) as HealthcareCaseKitsRepository['confirmPreparation'];
          const gate = jest
            .spyOn(caseKitRepositoryA, 'confirmPreparation')
            .mockImplementation((async (
              ...args: Parameters<typeof original>
            ) => {
              reachedTransition.resolve(undefined);
              await allowTransition.promise;
              return original(...args);
            }) as never);
          const confirmation = caseKitServiceA.confirmPreparation(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            trackKey(`case-kit-${source}-confirmation-first`),
          );
          void confirmation.catch(() => undefined);
          let mutation: Promise<unknown> | null = null;
          try {
            await withTimeout(
              reachedTransition.promise,
              5_000,
              'locked readiness before transition',
            );
            mutation = invalidateSource(source, fixture.scenario);
            void mutation.catch(() => undefined);
            // Observe an actual PostgreSQL wait, not elapsed time or a mocked write.
            await waitUntilBlockedBy(
              observerPrisma,
              mutationPid,
              confirmationPid,
            );
            await expect(
              setupPrisma.healthcareCaseKit.findUniqueOrThrow({
                where: { id: fixture.caseKitId },
                select: { status: true },
              }),
            ).resolves.toEqual({ status: 'DRAFT' });
            allowTransition.resolve(undefined);
            const [prepared] = await withTimeout(
              Promise.all([confirmation, mutation]),
              OPERATION_TIMEOUT_MS,
              'confirmation then source mutation',
            );
            expect(prepared).toMatchObject({
              replay: false,
              data: {
                status: 'PREPARED',
                preparationReadiness: { status: 'PASS', blockers: [] },
              },
            });
            const after = await caseKitServiceA.get(
              fixture.scenario.companyId,
              fixture.scenario.caseId,
            );
            expect(after).toMatchObject({
              status: 'PREPARED',
              preparedBy: prepared.data.preparedBy,
              preparedAt: prepared.data.preparedAt,
              preparationReadiness: { status: 'BLOCKED' },
            });
            if (source === 'product') {
              await expect(
                setupPrisma.product.findUniqueOrThrow({
                  where: { id: fixture.scenario.productIds[0] },
                  select: { isActive: true },
                }),
              ).resolves.toEqual({ isActive: false });
            } else {
              await expect(
                setupPrisma.equipmentAsset.findUniqueOrThrow({
                  where: { id: fixture.scenario.equipmentAssetIds[0] },
                  select: { lifecycle: true, condition: true },
                }),
              ).resolves.toEqual({
                lifecycle: EquipmentLifecycle.RETIRED,
                condition: EquipmentCondition.GOOD,
              });
            }
            expect(await physicalState(fixture.scenario)).toEqual(before);
          } finally {
            allowTransition.resolve(undefined);
            try {
              await withTimeout(
                Promise.allSettled([
                  confirmation,
                  ...(mutation ? [mutation] : []),
                ]),
                CLEANUP_TIMEOUT_MS,
                'confirmation-first source cleanup',
              );
            } finally {
              gate.mockRestore();
            }
          }
        },
      );

      it('enforces the PREPARED audit constraint without changing the DRAFT Kit', async () => {
        const fixture = await createReadyCaseKitFixture();

        let constraintError: unknown;
        try {
          await setupPrisma.healthcareCaseKit.update({
            where: { id: fixture.caseKitId },
            data: { status: HealthcareCaseKitStatus.PREPARED },
          });
        } catch (error) {
          constraintError = error;
        }

        expect(constraintError).toBeInstanceOf(
          Prisma.PrismaClientUnknownRequestError,
        );
        const constraintMessage =
          constraintError instanceof Error ? constraintError.message : '';
        expect(constraintMessage).toContain('23514');
        expect(constraintMessage).toContain(
          'HealthcareCaseKit_preparation_audit_check',
        );

        await expect(
          setupPrisma.healthcareCaseKit.findUniqueOrThrow({
            where: { id: fixture.caseKitId },
            select: { status: true, preparedById: true, preparedAt: true },
          }),
        ).resolves.toEqual({
          status: HealthcareCaseKitStatus.DRAFT,
          preparedById: null,
          preparedAt: null,
        });
      });

      it('serializes concurrent confirmations and preserves one winning audit and claim', async () => {
        const fixture = await createReadyCaseKitFixture();
        const firstPid = await getBackendPid(assignmentPrisma);
        const secondPid = await getBackendPid(requirementPrisma);
        const blocker = await startCaseRowBlocker(
          blockerPrisma,
          fixture.scenario.companyId,
          fixture.scenario.caseId,
        );
        const firstKey = trackKey('case-kit-prepare-winner');
        const secondKey = trackKey('case-kit-prepare-replay');
        const stockBefore = await setupPrisma.product.findUniqueOrThrow({
          where: { id: fixture.scenario.productIds[0] },
          select: { stock: true },
        });
        const movementsBefore = await setupPrisma.inventoryMovement.count({
          where: {
            companyId: fixture.scenario.companyId,
            productId: fixture.scenario.productIds[0],
          },
        });
        let first: ReturnType<
          HealthcareCaseKitsService['confirmPreparation']
        > | null = null;
        let second: ReturnType<
          HealthcareCaseKitsService['confirmPreparation']
        > | null = null;

        try {
          first = caseKitServiceA.confirmPreparation(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            firstKey,
          );
          await waitUntilBlockedBy(observerPrisma, firstPid, blocker.pid);
          second = caseKitServiceB.confirmPreparation(
            fixture.scenario.companyId,
            fixture.scenario.userId,
            fixture.caseKitId,
            secondKey,
          );
          await waitUntilBlockedBy(observerPrisma, secondPid, firstPid);
          blocker.release();

          const results = await withTimeout(
            Promise.all([first, second]),
            OPERATION_TIMEOUT_MS,
            'concurrent CaseKit preparation confirmations',
          );
          await withTimeout(
            blocker.done,
            OPERATION_TIMEOUT_MS,
            'CaseKit preparation Case blocker completion',
          );
          expect(results.map((result) => result.replay).sort()).toEqual([
            false,
            true,
          ]);
          expect(results[0].data.preparedBy).toEqual(
            results[1].data.preparedBy,
          );
          expect(results[0].data.preparedAt).toEqual(
            results[1].data.preparedAt,
          );
          await expect(
            setupPrisma.idempotencyRecord.count({
              where: {
                companyId: fixture.scenario.companyId,
                scope: IdempotencyScope.HEALTHCARE_CASE_KIT_CONFIRM_PREPARATION,
                key: { in: [firstKey, secondKey] },
              },
            }),
          ).resolves.toBe(1);
          const persistedKit =
            await setupPrisma.healthcareCaseKit.findUniqueOrThrow({
              where: { id: fixture.caseKitId },
              select: { status: true, preparedById: true, preparedAt: true },
            });
          expect(persistedKit).toMatchObject({
            status: HealthcareCaseKitStatus.PREPARED,
            preparedById: fixture.scenario.userId,
          });
          expect(persistedKit.preparedAt).toBeInstanceOf(Date);
          await expect(
            setupPrisma.product.findUniqueOrThrow({
              where: { id: fixture.scenario.productIds[0] },
              select: { stock: true },
            }),
          ).resolves.toEqual(stockBefore);
          await expect(
            setupPrisma.inventoryMovement.count({
              where: {
                companyId: fixture.scenario.companyId,
                productId: fixture.scenario.productIds[0],
              },
            }),
          ).resolves.toBe(movementsBefore);
        } catch (error) {
          blocker.release();
          const cleanupErrors = await settleForCleanup([
            blocker.done,
            ...[first, second].filter(
              (
                operation,
              ): operation is ReturnType<
                HealthcareCaseKitsService['confirmPreparation']
              > => operation !== null,
            ),
          ]);
          throwWithCleanupErrors(
            error,
            cleanupErrors,
            'concurrent CaseKit preparation confirmations',
          );
        }
      });

      it('rolls back PREPARED audit and claim when claim completion fails', async () => {
        const fixture = await createReadyCaseKitFixture();
        const key = trackKey('case-kit-prepare-rollback');
        const stockBefore = await setupPrisma.product.findUniqueOrThrow({
          where: { id: fixture.scenario.productIds[0] },
          select: { stock: true },
        });
        const movementsBefore = await setupPrisma.inventoryMovement.count({
          where: {
            companyId: fixture.scenario.companyId,
            productId: fixture.scenario.productIds[0],
          },
        });
        const completion = jest
          .spyOn(caseKitRepositoryA, 'completeIdempotencyClaim')
          .mockRejectedValue(
            new Error('Injected CaseKit preparation completion failure'),
          );

        try {
          await expect(
            caseKitServiceA.confirmPreparation(
              fixture.scenario.companyId,
              fixture.scenario.userId,
              fixture.caseKitId,
              key,
            ),
          ).rejects.toThrow('Injected CaseKit preparation completion failure');
        } finally {
          completion.mockRestore();
        }

        await expect(
          setupPrisma.healthcareCaseKit.findUniqueOrThrow({
            where: { id: fixture.caseKitId },
            select: { status: true, preparedById: true, preparedAt: true },
          }),
        ).resolves.toEqual({
          status: HealthcareCaseKitStatus.DRAFT,
          preparedById: null,
          preparedAt: null,
        });
        await expect(
          setupPrisma.idempotencyRecord.count({
            where: {
              companyId: fixture.scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_CASE_KIT_CONFIRM_PREPARATION,
              key,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          setupPrisma.healthcareCaseKitItem.findUniqueOrThrow({
            where: { id: fixture.itemId },
            select: { lifecycle: true, preparedQuantity: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
          preparedQuantity: 1,
        });
        await expect(
          setupPrisma.product.findUniqueOrThrow({
            where: { id: fixture.scenario.productIds[0] },
            select: { stock: true },
          }),
        ).resolves.toEqual(stockBefore);
        await expect(
          setupPrisma.inventoryMovement.count({
            where: {
              companyId: fixture.scenario.companyId,
              productId: fixture.scenario.productIds[0],
            },
          }),
        ).resolves.toBe(movementsBefore);
      });
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

function createUnusedCaseFolioService(): HealthcareCaseFolioService {
  return {
    allocateNextAvailableFolio: () => {
      throw new Error('Case folio allocation is outside C4-C2 E2E scope.');
    },
  } as unknown as HealthcareCaseFolioService;
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

async function assertNonAdministrativeRole(
  client: RawQueryClient,
): Promise<void> {
  const rows = await client
    .$queryRaw<
      Array<{
        rolcanlogin: boolean;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
      }>
    >(
      Prisma.sql`
      SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
             rolreplication, rolbypassrls
      FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolname = ${EXPECTED_USER}
    `,
    )
    .catch(() => {
      throw new Error(
        'HC-LOCK-02 2H role preflight could not verify pg_roles attributes; external role verification is required. No additional catalog grants are authorized.',
      );
    });
  const role = rows[0];
  if (rows.length !== 1 || role?.rolcanlogin !== true) {
    throw new Error(
      'HC-LOCK-02 2H role preflight requires the dedicated LOGIN role.',
    );
  }
  const prohibited = [
    ['SUPERUSER', role.rolsuper],
    ['CREATEDB', role.rolcreatedb],
    ['CREATEROLE', role.rolcreaterole],
    ['REPLICATION', role.rolreplication],
    ['BYPASSRLS', role.rolbypassrls],
  ] as const;
  const invalid = prohibited
    .filter(([, enabled]) => enabled !== false)
    .map(([capability]) => capability);
  if (invalid.length > 0) {
    throw new Error(
      `HC-LOCK-02 2H role preflight requires verified absence of: ${invalid.join(', ')}.`,
    );
  }
}

async function assertRequiredSuitePrivileges(
  client: RawQueryClient,
): Promise<void> {
  const tableChecks = [
    ...requiredFixtureReadDeleteTables.flatMap((tableName) =>
      ['SELECT', 'DELETE'].map((operation) => ({ tableName, operation })),
    ),
    ...requiredFixtureInsertTables.map((tableName) => ({
      tableName,
      operation: 'INSERT',
    })),
    // EquipmentService.retire includes batch: true (all scalar columns).
    { tableName: 'InventoryBatch', operation: 'SELECT' },
  ];
  const columnChecks = [
    ...Object.entries<readonly string[]>(requiredSuiteUpdateColumns).flatMap(
      ([tableName, columns]) =>
        columns.map((columnName) => ({
          tableName,
          columnName,
          operation: 'UPDATE',
        })),
    ),
    ...requiredInventoryMovementSelectColumns.map((columnName) => ({
      tableName: 'InventoryMovement',
      columnName,
      operation: 'SELECT',
    })),
  ];
  const tableRows = await client
    .$queryRaw<
      Array<{ tableName: string; operation: string; allowed: boolean }>
    >(
      Prisma.sql`
      SELECT required."tableName", required.operation,
        COALESCE(pg_catalog.has_table_privilege(
          current_user, relation.oid, required.operation
        ), false) AS allowed
      FROM (VALUES ${Prisma.join(
        tableChecks.map(
          ({ tableName, operation }) =>
            Prisma.sql`(${tableName}, ${operation})`,
        ),
      )}) AS required("tableName", operation)
      LEFT JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.nspname = 'public'
      LEFT JOIN pg_catalog.pg_class AS relation
        ON relation.relnamespace = namespace.oid
        AND relation.relname = required."tableName"
    `,
    )
    .catch(() => {
      throw new Error(
        'HC-LOCK-02 2H fixture/inventory table SELECT/INSERT/DELETE privilege verification failed.',
      );
    });
  const columnRows = await client
    .$queryRaw<
      Array<{
        tableName: string;
        columnName: string;
        operation: string;
        allowed: boolean;
      }>
    >(
      Prisma.sql`
      SELECT required."tableName", required."columnName", required.operation,
        COALESCE(pg_catalog.has_column_privilege(
          current_user, relation.oid, attribute.attnum, required.operation
        ), false) AS allowed
      FROM (VALUES ${Prisma.join(
        columnChecks.map(
          ({ tableName, columnName, operation }) =>
            Prisma.sql`(${tableName}, ${columnName}, ${operation})`,
        ),
      )}) AS required("tableName", "columnName", operation)
      LEFT JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.nspname = 'public'
      LEFT JOIN pg_catalog.pg_class AS relation
        ON relation.relnamespace = namespace.oid
        AND relation.relname = required."tableName"
      LEFT JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = relation.oid
        AND attribute.attname = required."columnName"
        AND attribute.attnum > 0 AND NOT attribute.attisdropped
    `,
    )
    .catch(() => {
      throw new Error(
        'HC-LOCK-02 2H mutation/inventory column UPDATE/SELECT privilege verification failed.',
      );
    });
  const missing = [
    ...tableRows
      .filter((row) => row.allowed !== true)
      .map((row) => `${row.tableName} [${row.operation}]`),
    ...columnRows
      .filter((row) => row.allowed !== true)
      .map((row) => `${row.tableName} [${row.operation}(${row.columnName})]`),
  ];
  if (
    tableRows.length !== tableChecks.length ||
    columnRows.length !== columnChecks.length ||
    missing.length > 0
  ) {
    throw new Error(
      `HC-LOCK-02 2H suite privilege preflight failed for: ${missing.join(', ') || 'incomplete table/column privilege results'}.`,
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

async function assertRequiredCaseCancelUpdatePrivileges(
  client: ExplicitPrismaService,
): Promise<void> {
  const rows = await client.$queryRaw<
    Array<{ columnName: string; canUpdate: boolean }>
  >(Prisma.sql`
    SELECT
      required."columnName",
      COALESCE(
        has_column_privilege(
          current_user,
          relation.oid,
          attribute.attnum,
          'UPDATE'
        ),
        false
      ) AS "canUpdate"
    FROM (
      VALUES ${Prisma.join(
        requiredCaseCancelUpdateColumns.map(
          (columnName) => Prisma.sql`(${columnName})`,
        ),
      )}
    ) AS required("columnName")
    LEFT JOIN pg_namespace AS namespace
      ON namespace.nspname = 'public'
    LEFT JOIN pg_class AS relation
      ON relation.relnamespace = namespace.oid
      AND relation.relname = 'HealthcareCase'
    LEFT JOIN pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attname = required."columnName"
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  `);
  const missing = rows
    .filter((row) => !row.canUpdate)
    .map((row) => row.columnName);

  if (
    rows.length !== requiredCaseCancelUpdateColumns.length ||
    missing.length > 0
  ) {
    throw new Error(
      `HC-NEXT-03C4-C2 Case Cancel UPDATE privilege preflight failed for: ${missing.join(', ') || 'unknown column'}.`,
    );
  }
}

async function assertRequiredCaseKitPrivileges(
  client: ExplicitPrismaService,
): Promise<void> {
  const tableRows = await client.$queryRaw<
    Array<{
      tableName: string;
      canSelect: boolean;
      canInsert: boolean;
      canDelete: boolean;
    }>
  >(Prisma.sql`
    SELECT
      required."tableName",
      COALESCE(
        has_table_privilege(current_user, relation.oid, 'SELECT'), false
      ) AS "canSelect",
      COALESCE(
        has_table_privilege(current_user, relation.oid, 'INSERT'), false
      ) AS "canInsert",
      COALESCE(
        has_table_privilege(current_user, relation.oid, 'DELETE'), false
      ) AS "canDelete"
    FROM (
      VALUES ${Prisma.join(
        requiredCaseKitDmlTables.map((tableName) => Prisma.sql`(${tableName})`),
      )}
    ) AS required("tableName")
    LEFT JOIN pg_namespace AS namespace
      ON namespace.nspname = 'public'
    LEFT JOIN pg_class AS relation
      ON relation.relnamespace = namespace.oid
      AND relation.relname = required."tableName"
  `);
  const missingTablePrivileges = tableRows
    .filter((row) => !row.canSelect || !row.canInsert || !row.canDelete)
    .map((row) => {
      const privileges = [
        ...(row.canSelect ? [] : ['SELECT']),
        ...(row.canInsert ? [] : ['INSERT']),
        ...(row.canDelete ? [] : ['DELETE']),
      ];
      return `${row.tableName} [${privileges.join(', ')}]`;
    });

  const itemUpdateRows = await client.$queryRaw<
    Array<{ columnName: string; canUpdate: boolean }>
  >(Prisma.sql`
    SELECT
      required."columnName",
      COALESCE(
        has_column_privilege(
          current_user,
          relation.oid,
          attribute.attnum,
          'UPDATE'
        ),
        false
      ) AS "canUpdate"
    FROM (
      VALUES ${Prisma.join(
        requiredCaseKitItemUpdateColumns.map(
          (columnName) => Prisma.sql`(${columnName})`,
        ),
      )}
    ) AS required("columnName")
    LEFT JOIN pg_namespace AS namespace
      ON namespace.nspname = 'public'
    LEFT JOIN pg_class AS relation
      ON relation.relnamespace = namespace.oid
      AND relation.relname = 'HealthcareCaseKitItem'
    LEFT JOIN pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attname = required."columnName"
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  `);
  const missingItemUpdatePrivileges = itemUpdateRows
    .filter((row) => !row.canUpdate)
    .map((row) => row.columnName);

  const kitUpdateRows = await client.$queryRaw<
    Array<{ columnName: string; canUpdate: boolean }>
  >(Prisma.sql`
    SELECT
      required."columnName",
      COALESCE(
        has_column_privilege(
          current_user,
          relation.oid,
          attribute.attnum,
          'UPDATE'
        ),
        false
      ) AS "canUpdate"
    FROM (
      VALUES ${Prisma.join(
        requiredCaseKitUpdateColumns.map(
          (columnName) => Prisma.sql`(${columnName})`,
        ),
      )}
    ) AS required("columnName")
    LEFT JOIN pg_namespace AS namespace
      ON namespace.nspname = 'public'
    LEFT JOIN pg_class AS relation
      ON relation.relnamespace = namespace.oid
      AND relation.relname = 'HealthcareCaseKit'
    LEFT JOIN pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attname = required."columnName"
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  `);
  const missingKitUpdatePrivileges = kitUpdateRows
    .filter((row) => !row.canUpdate)
    .map((row) => row.columnName);

  const typeRows = await client.$queryRaw<
    Array<{ typeName: string; canUse: boolean }>
  >(Prisma.sql`
    SELECT
      required."typeName",
      COALESCE(
        has_type_privilege(current_user, type.oid, 'USAGE'), false
      ) AS "canUse"
    FROM (
      VALUES ${Prisma.join(
        requiredCaseKitTypes.map((typeName) => Prisma.sql`(${typeName})`),
      )}
    ) AS required("typeName")
    LEFT JOIN pg_namespace AS namespace
      ON namespace.nspname = 'public'
    LEFT JOIN pg_type AS type
      ON type.typnamespace = namespace.oid
      AND type.typname = required."typeName"
  `);
  const missingTypePrivileges = typeRows
    .filter((row) => !row.canUse)
    .map((row) => row.typeName);

  if (
    tableRows.length !== requiredCaseKitDmlTables.length ||
    missingTablePrivileges.length > 0 ||
    itemUpdateRows.length !== requiredCaseKitItemUpdateColumns.length ||
    missingItemUpdatePrivileges.length > 0 ||
    kitUpdateRows.length !== requiredCaseKitUpdateColumns.length ||
    missingKitUpdatePrivileges.length > 0 ||
    typeRows.length !== requiredCaseKitTypes.length ||
    missingTypePrivileges.length > 0
  ) {
    throw new Error(
      `HC-OPS-01A.1/01B CaseKit privilege preflight failed for tables: ${missingTablePrivileges.join(', ') || 'none'}; item UPDATE columns: ${missingItemUpdatePrivileges.join(', ') || 'none'}; kit UPDATE columns: ${missingKitUpdatePrivileges.join(', ') || 'none'}; types: ${missingTypePrivileges.join(', ') || 'none'}.`,
    );
  }
}

async function assertExclusiveTargetAvailability(
  observer: ExplicitPrismaService,
  clients: ExplicitPrismaService[],
): Promise<void> {
  if (clients.length !== CLIENT_COUNT || !clients.includes(observer)) {
    throw new Error(
      'HC-LOCK-02 2H exclusivity requires the complete run-owned client set, including the observer.',
    );
  }
  const ownedPids = await Promise.all(clients.map(getBackendPid));
  if (new Set(ownedPids).size !== CLIENT_COUNT) {
    throw new Error(
      'HC-LOCK-02 2H exclusivity requires distinct run-owned backend PIDs.',
    );
  }
  // Foreign activity details may be NULL for the restricted role. Only
  // database identity and explicitly owned PIDs can exempt a visible row.
  const otherSessions = await observer.$queryRaw<
    Array<{ pid: number | null }>
  >(Prisma.sql`
    SELECT pid::int AS "pid"
    FROM pg_stat_activity
    WHERE datname = ${EXPECTED_DATABASE}
      AND (pid IS NULL OR pid NOT IN (${Prisma.join(ownedPids)}))
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

async function startRequirementRowBlocker(
  client: ExplicitPrismaService,
  companyId: string,
  caseId: string,
  requirementId: string,
): Promise<ControlledTransaction> {
  const ready = deferred<number>();
  const release = deferred<void>();
  const done = client.$transaction(
    async (transaction) => {
      await lockRequirement(transaction, companyId, caseId, requirementId);
      ready.resolve(await getBackendPid(transaction));
      await release.promise;
    },
    { maxWait: 3_000, timeout: 20_000 },
  );
  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'Requirement blocker setup'),
    release: () => release.resolve(undefined),
    done,
  };
}

async function startCaseRowBlocker(
  client: ExplicitPrismaService,
  companyId: string,
  caseId: string,
): Promise<ControlledTransaction> {
  const ready = deferred<number>();
  const release = deferred<void>();
  const done = client.$transaction(
    async (transaction) => {
      await lockCase(transaction, companyId, caseId);
      ready.resolve(await getBackendPid(transaction));
      await release.promise;
    },
    { maxWait: 3_000, timeout: 20_000 },
  );
  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'Case blocker setup'),
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

async function lockRequirement(
  transaction: Prisma.TransactionClient,
  companyId: string,
  caseId: string,
  requirementId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "HealthcareCaseRequirement"
    WHERE "id" = ${requirementId}
      AND "companyId" = ${companyId}
      AND "caseId" = ${caseId}
    FOR UPDATE
  `);
  if (rows.length !== 1) {
    throw new Error('Controlled HealthcareCaseRequirement row was not found.');
  }
}

async function lockCase(
  transaction: Prisma.TransactionClient,
  companyId: string,
  caseId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "HealthcareCase"
    WHERE "id" = ${caseId} AND "companyId" = ${companyId}
    FOR UPDATE
  `);
  if (rows.length !== 1) {
    throw new Error('Controlled HealthcareCase row was not found.');
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
      prisma.healthcareCaseKitItem.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
    () =>
      prisma.healthcareCaseKit.deleteMany({
        where: { companyId: { in: companyIds } },
      }),
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
    prisma.healthcareCaseKitItem.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareCaseKit.count({
      where: { companyId: { in: companyIds } },
    }),
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
