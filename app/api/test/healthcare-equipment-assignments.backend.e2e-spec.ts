import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EquipmentCondition,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareRequirementType,
  IdempotencyScope,
  Prisma,
  ProductInventoryTracking,
  UserRole,
} from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import supertest from 'supertest';
import { App } from 'supertest/types';

import { AuthModule } from '../src/auth/auth.module';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { HealthcareEquipmentAssignmentsModule } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.module';
import {
  equipmentAssignmentSettingsAdvisoryLockKey,
  HealthcareEquipmentAssignmentsRepository,
} from '../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { createHealthcareEquipmentAssignmentReplaceRequestHash } from '../src/healthcare/equipment-assignments/healthcare-equipment-assignment-replace-request-hash';
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

const ISOLATED_B4B1_RUN_FLAG = 'RUN_HC_LOCK_B4B1_POSTGRES_TESTS';
const ISOLATED_B4B1_CONNECTION_VARIABLE = 'HC_LOCK_B4B1_DATABASE_URL';
const ISOLATED_B4B1_DATABASE = 'zaping_spike_test';
const ISOLATED_B4B1_USER = 'zaping_hc_lock_b4b1';
const ISOLATED_B4B1_HOST = '127.0.0.1';
const ISOLATED_B4B1_HOST_PORT = '5434';
const ISOLATED_B4B1_SERVER_PORT = 5432;
const ISOLATED_B4B1_REQUIRED_TABLES = [
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
const ISOLATED_B4B1_ROW_LOCK_PRIVILEGES = [
  { tableName: 'EquipmentAsset', lockColumn: 'id' },
  { tableName: 'HealthcareCase', lockColumn: 'id' },
  { tableName: 'HealthcareCaseRequirement', lockColumn: 'id' },
  { tableName: 'HealthcareEquipmentAssignment', lockColumn: 'id' },
  {
    tableName: 'HealthcareEquipmentAssignmentSettings',
    lockColumn: 'companyId',
  },
] as const;
const ISOLATED_B4B1_TABLE_PRIVILEGES = [
  { tableName: 'Company', privileges: ['SELECT', 'INSERT', 'DELETE'] },
  { tableName: 'User', privileges: ['SELECT', 'INSERT', 'DELETE'] },
  { tableName: 'Product', privileges: ['SELECT', 'INSERT', 'DELETE'] },
  {
    tableName: 'HealthcareCase',
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  },
  {
    tableName: 'HealthcareCaseRequirement',
    privileges: ['SELECT', 'INSERT', 'DELETE'],
  },
  {
    tableName: 'EquipmentAsset',
    privileges: ['SELECT', 'INSERT', 'DELETE'],
  },
  {
    tableName: 'HealthcareEquipmentAssignment',
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  },
  {
    tableName: 'HealthcareEquipmentAssignmentConflictOverride',
    privileges: ['SELECT', 'DELETE'],
  },
  {
    tableName: 'HealthcareEquipmentRequirementCoverageNote',
    privileges: ['SELECT', 'DELETE'],
  },
  {
    tableName: 'HealthcareEquipmentAssignmentSettings',
    privileges: ['SELECT', 'DELETE'],
  },
  {
    tableName: 'IdempotencyRecord',
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  },
] as const;

const runIsolatedB4B1Tests = process.env[ISOLATED_B4B1_RUN_FLAG] === '1';

if (!runIsolatedB4B1Tests) {
  loadDotenv(
    process.env.DOTENV_CONFIG_PATH
      ? { path: process.env.DOTENV_CONFIG_PATH }
      : undefined,
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

if (runIsolatedB4B1Tests && runDbIntegrityTests) {
  throw new Error(
    `${ISOLATED_B4B1_RUN_FLAG}=1 cannot be combined with RUN_DB_INTEGRITY_TESTS=1.`,
  );
}

if (runDbIntegrityTests) {
  assertSafeDbIntegrityDatabase();
}

function requireIsolatedB4B1ConnectionUrl(): URL {
  const rawConnectionUrl = process.env[ISOLATED_B4B1_CONNECTION_VARIABLE];

  if (!rawConnectionUrl) {
    throw new Error(
      `${ISOLATED_B4B1_CONNECTION_VARIABLE} is required when ${ISOLATED_B4B1_RUN_FLAG}=1.`,
    );
  }

  let connectionUrl: URL;

  try {
    connectionUrl = new URL(rawConnectionUrl);
  } catch {
    throw new Error(
      `${ISOLATED_B4B1_CONNECTION_VARIABLE} must be a valid PostgreSQL URL.`,
    );
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
      `${ISOLATED_B4B1_CONNECTION_VARIABLE} contains invalid percent-encoding.`,
    );
  }

  if (
    !['postgres:', 'postgresql:'].includes(connectionUrl.protocol) ||
    connectionUrl.hostname !== ISOLATED_B4B1_HOST ||
    connectionUrl.port !== ISOLATED_B4B1_HOST_PORT ||
    databaseName !== ISOLATED_B4B1_DATABASE ||
    databaseUser !== ISOLATED_B4B1_USER ||
    !connectionUrl.password
  ) {
    throw new Error(
      `${ISOLATED_B4B1_CONNECTION_VARIABLE} does not identify the authorized isolated B4-B1 target.`,
    );
  }

  if (connectionUrl.search.length > 0 || connectionUrl.hash.length > 0) {
    throw new Error(
      `${ISOLATED_B4B1_CONNECTION_VARIABLE} must not contain routing or connection-option overrides.`,
    );
  }

  return connectionUrl;
}

const isolatedB4B1ConnectionUrl = runIsolatedB4B1Tests
  ? requireIsolatedB4B1ConnectionUrl()
  : null;

class ExplicitB4B1PrismaService extends PrismaService {
  constructor(datasourceUrl: string) {
    super({ datasourceUrl });
  }
}

function createBackendTestPrisma(): PrismaService {
  if (!isolatedB4B1ConnectionUrl) {
    return new PrismaService();
  }

  const clientUrl = new URL(isolatedB4B1ConnectionUrl.toString());
  clientUrl.searchParams.set('connection_limit', '8');
  clientUrl.searchParams.set('pool_timeout', '5');
  clientUrl.searchParams.set('connect_timeout', '5');

  try {
    return new ExplicitB4B1PrismaService(clientUrl.toString());
  } catch {
    throw new Error('Could not construct the isolated B4-B1 Prisma client.');
  }
}

async function assertConnectedDbIntegrityDatabase(
  prisma: PrismaService,
): Promise<void> {
  const databaseUrl = new URL(process.env.DATABASE_URL as string);
  const expectedDatabaseName = decodeURIComponent(
    databaseUrl.pathname.replace(/^\/+/, ''),
  );
  const expectedDatabaseUser = decodeURIComponent(databaseUrl.username);
  const requiredDatabaseName =
    process.env.DB_INTEGRITY_EXPECTED_DATABASE ?? null;
  const rows = await prisma.$queryRaw<
    Array<{ databaseName: string; databaseUser: string }>
  >(Prisma.sql`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser"
  `);
  const identity = rows[0];

  if (
    !identity ||
    identity.databaseName !== expectedDatabaseName ||
    identity.databaseUser !== expectedDatabaseUser ||
    (requiredDatabaseName !== null &&
      identity.databaseName !== requiredDatabaseName)
  ) {
    throw new Error(
      'Connected PostgreSQL identity does not match the authorized integrity-test destination.',
    );
  }
}

type IsolatedB4B1DatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  serverPort: number;
  serverVersionNumber: string;
  currentSchema: string;
  backendPid: number;
};

type RawQueryClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

async function assertConnectedIsolatedB4B1Database(
  prisma: RawQueryClient,
): Promise<IsolatedB4B1DatabaseIdentity> {
  const [identity] = await prisma.$queryRaw<IsolatedB4B1DatabaseIdentity[]>(
    Prisma.sql`
      SELECT
        current_database() AS "databaseName",
        current_user AS "databaseUser",
        inet_server_port()::int AS "serverPort",
        current_setting('server_version_num') AS "serverVersionNumber",
        current_schema() AS "currentSchema",
        pg_backend_pid()::int AS "backendPid"
    `,
  );
  const serverVersionNumber = Number(identity?.serverVersionNumber);

  if (
    !identity ||
    identity.databaseName !== ISOLATED_B4B1_DATABASE ||
    identity.databaseUser !== ISOLATED_B4B1_USER ||
    identity.serverPort !== ISOLATED_B4B1_SERVER_PORT ||
    identity.currentSchema !== 'public' ||
    !Number.isInteger(serverVersionNumber) ||
    serverVersionNumber < 160_000 ||
    serverVersionNumber >= 170_000 ||
    !Number.isSafeInteger(identity.backendPid) ||
    identity.backendPid <= 0
  ) {
    throw new Error(
      'Connected PostgreSQL identity does not match the authorized isolated B4-B1 target.',
    );
  }

  return identity;
}

async function assertIsolatedB4B1SchemaAndPrivileges(
  prisma: RawQueryClient,
): Promise<void> {
  const tableRows = await prisma.$queryRaw<
    Array<{ tableName: string; tableOid: string | null }>
  >(Prisma.sql`
    SELECT required."tableName", to_regclass(
      format('public.%I', required."tableName")
    )::text AS "tableOid"
    FROM (
      VALUES ${Prisma.join(
        ISOLATED_B4B1_REQUIRED_TABLES.map(
          (tableName) => Prisma.sql`(${tableName})`,
        ),
      )}
    ) AS required("tableName")
  `);
  const missingTables = tableRows
    .filter((row) => row.tableOid === null)
    .map((row) => row.tableName);

  if (
    tableRows.length !== ISOLATED_B4B1_REQUIRED_TABLES.length ||
    missingTables.length > 0
  ) {
    throw new Error(
      `Isolated B4-B1 schema is missing required table(s): ${missingTables.join(', ') || 'unknown'}.`,
    );
  }

  const tablePrivilegeRows = await prisma.$queryRaw<
    Array<{ tableName: string; privilege: string; allowed: boolean }>
  >(Prisma.sql`
    SELECT
      required."tableName",
      required."privilege",
      COALESCE(
        has_table_privilege(
          current_user,
          format('public.%I', required."tableName"),
          required."privilege"
        ),
        false
      ) AS "allowed"
    FROM (
      VALUES ${Prisma.join(
        ISOLATED_B4B1_TABLE_PRIVILEGES.flatMap(({ tableName, privileges }) =>
          privileges.map(
            (privilege) => Prisma.sql`(${tableName}, ${privilege})`,
          ),
        ),
      )}
    ) AS required("tableName", "privilege")
  `);
  const missingTablePrivileges = tablePrivilegeRows
    .filter((row) => !row.allowed)
    .map((row) => `${row.tableName} ${row.privilege}`);

  const rowLockPrivilegeRows = await prisma.$queryRaw<
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
        ISOLATED_B4B1_ROW_LOCK_PRIVILEGES.map(
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
  const missingRowLockPrivileges = rowLockPrivilegeRows
    .filter((row) => !row.canSelect || !row.canUpdateLockColumn)
    .map((row) => `${row.tableName} UPDATE(${row.lockColumn})`);

  if (
    tablePrivilegeRows.length !==
      ISOLATED_B4B1_TABLE_PRIVILEGES.reduce(
        (total, requirement) => total + requirement.privileges.length,
        0,
      ) ||
    missingTablePrivileges.length > 0 ||
    rowLockPrivilegeRows.length !== ISOLATED_B4B1_ROW_LOCK_PRIVILEGES.length ||
    missingRowLockPrivileges.length > 0
  ) {
    throw new Error(
      `Isolated B4-B1 privilege preflight failed for: ${
        [...missingTablePrivileges, ...missingRowLockPrivileges].join(', ') ||
        'unknown target'
      }.`,
    );
  }
}

async function assertIsolatedB4B1ExclusiveAvailability(
  prisma: RawQueryClient,
  ownBackendPid: number,
): Promise<void> {
  const otherSessions = await prisma.$queryRaw<Array<{ pid: number }>>(
    Prisma.sql`
      SELECT pid::int AS "pid"
      FROM pg_stat_activity
      WHERE datname = ${ISOLATED_B4B1_DATABASE}
        AND backend_type = 'client backend'
        AND pid <> ${ownBackendPid}::integer
    `,
  );

  if (otherSessions.length > 0) {
    throw new Error(
      `Isolated B4-B1 target has ${otherSessions.length} unrelated session(s); exclusive availability is required.`,
    );
  }
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireStringField(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string.`);
  }

  return value;
}

type ControlledDatabaseBlocker = {
  pid: number;
  release: () => void;
  done: Promise<void>;
};

async function createControlledDatabaseBlocker(
  prisma: PrismaService,
  acquireLock: (transaction: Prisma.TransactionClient) => Promise<unknown>,
): Promise<ControlledDatabaseBlocker> {
  const ready = deferred<number>();
  const release = deferred<void>();
  const done = prisma.$transaction(async (transaction) => {
    await acquireLock(transaction);
    ready.resolve(await getBackendPid(transaction));
    await release.promise;
  });

  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'Database blocker setup'),
    release: () => release.resolve(undefined),
    done,
  };
}

async function waitForBlockedBackendChain(
  prisma: PrismaService,
  rootBlockerPid: number,
  queryFragment: string,
  expectedCount: number,
): Promise<number[]> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const rows = await prisma.$queryRaw<
      Array<{ pid: number; blockerPids: number[] }>
    >(Prisma.sql`
      SELECT
        activity.pid::int AS "pid",
        pg_blocking_pids(activity.pid)::int[] AS "blockerPids"
      FROM pg_stat_activity AS activity
      WHERE activity.datname = current_database()
        AND activity.wait_event_type = 'Lock'
        AND POSITION(${queryFragment} IN activity.query) > 0
      ORDER BY activity.pid ASC
    `);
    const byPid = new Map(rows.map((row) => [row.pid, row]));
    const reachesRootBlocker = (
      pid: number,
      visited = new Set<number>(),
    ): boolean => {
      if (visited.has(pid)) {
        return false;
      }

      visited.add(pid);
      const row = byPid.get(pid);

      if (!row) {
        return false;
      }

      return row.blockerPids.some(
        (blockerPid) =>
          blockerPid === rootBlockerPid ||
          reachesRootBlocker(blockerPid, visited),
      );
    };
    const blockedPids = rows
      .filter((row) => reachesRootBlocker(row.pid))
      .map((row) => row.pid);

    if (blockedPids.length >= expectedCount) {
      return blockedPids;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `Expected ${expectedCount} backend(s) blocked in query containing "${queryFragment}".`,
  );
}

type BlockingBackendObservation = {
  pid: number;
  blockerPids: number[];
};

type CompanyFirstBlockingChain = {
  rowLockWaiter: BlockingBackendObservation;
  companyLockWaiter: BlockingBackendObservation;
};

async function waitForCompanyFirstBlockingChain(
  prisma: PrismaService,
  rootBlockerPid: number,
  rowLockQueryFragment: string,
  observationBudgetMs: number,
): Promise<CompanyFirstBlockingChain> {
  const deadline = performance.now() + observationBudgetMs;

  while (performance.now() < deadline) {
    const rows = await prisma.$queryRaw<
      Array<BlockingBackendObservation & { queryText: string }>
    >(Prisma.sql`
      SELECT
        activity.pid::int AS "pid",
        activity.query AS "queryText",
        pg_blocking_pids(activity.pid)::int[] AS "blockerPids"
      FROM pg_stat_activity AS activity
      WHERE activity.datname = current_database()
        AND activity.pid <> pg_backend_pid()
        AND activity.wait_event_type = 'Lock'
      ORDER BY activity.pid ASC
    `);
    const rowLockWaiters = rows.filter(
      (row) =>
        row.queryText.includes(rowLockQueryFragment) &&
        row.blockerPids.includes(rootBlockerPid),
    );

    if (rowLockWaiters.length === 1) {
      const rowLockWaiter = rowLockWaiters[0];
      const companyLockWaiters = rows.filter(
        (row) =>
          row.queryText.includes('pg_advisory_xact_lock') &&
          row.blockerPids.includes(rowLockWaiter.pid),
      );

      if (companyLockWaiters.length === 1) {
        return {
          rowLockWaiter,
          companyLockWaiter: companyLockWaiters[0],
        };
      }
    }

    const remainingMs = deadline - performance.now();

    if (remainingMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(25, Math.max(1, remainingMs))),
      );
    }
  }

  throw new Error(
    `Expected one backend blocked by ${rootBlockerPid} in a query containing "${rowLockQueryFragment}" and one backend blocked behind its Company advisory lock.`,
  );
}

async function observeCompanyFirstBlockedRace<T>(
  prisma: PrismaService,
  blocker: ControlledDatabaseBlocker,
  rowLockQueryFragment: string,
  operation: Promise<T>,
  label: string,
  observationBudgetMs: number,
): Promise<CompanyFirstBlockingChain & { result: T }> {
  let blockingChain: CompanyFirstBlockingChain | null = null;
  let observationError: unknown = null;

  try {
    blockingChain = await waitForCompanyFirstBlockingChain(
      prisma,
      blocker.pid,
      rowLockQueryFragment,
      observationBudgetMs,
    );
  } catch (error) {
    observationError = error;
  } finally {
    blocker.release();
  }

  const [blockerSettlement, operationSettlement] = await Promise.allSettled([
    blocker.done,
    withTimeout(operation, 10_000, label),
  ]);
  const errors: unknown[] = [];

  if (observationError !== null) {
    errors.push(observationError);
  }

  if (blockerSettlement.status === 'rejected') {
    errors.push(blockerSettlement.reason as unknown);
  }

  if (operationSettlement.status === 'rejected') {
    errors.push(operationSettlement.reason as unknown);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `${label} failed.`);
  }

  if (operationSettlement.status !== 'fulfilled') {
    throw new Error(`${label} did not settle.`);
  }

  if (blockingChain === null) {
    throw new Error(`${label} did not produce a blocking-chain observation.`);
  }

  return { ...blockingChain, result: operationSettlement.value };
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

async function assertNoRunOwnedFixtures(
  prisma: PrismaService,
  fixture: Fixture,
): Promise<void> {
  const companyIds = [fixture.companyAId, fixture.companyBId];
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
    prisma.healthcareCase.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.equipmentAsset.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.product.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.user.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.company.count({
      where: { id: { in: companyIds } },
    }),
  ]);

  if (counts.some((count) => count !== 0)) {
    throw new Error(
      `Isolated B4-B1 fixture cleanup left run-owned record counts: ${counts.join(', ')}.`,
    );
  }
}

(runDbIntegrityTests || runIsolatedB4B1Tests ? describe : describe.skip)(
  'Healthcare Equipment Assignment backend PostgreSQL integration',
  () => {
    const prisma = createBackendTestPrisma();
    const repository = new HealthcareEquipmentAssignmentsRepository(prisma);
    const companyTransactionTimeoutPolicy =
      healthcareCompanyTransactionTimeoutConfiguration();
    const blockingChainObservationBudgetMs =
      Math.min(
        companyTransactionTimeoutPolicy.companyLockAcquisitionTimeoutMs,
        companyTransactionTimeoutPolicy.subsequentLockTimeoutMs,
      ) - 500;
    const service = new HealthcareEquipmentAssignmentsService(
      repository,
      companyTransactionTimeoutPolicy,
    );
    const fixture = buildFixture();
    const describeB4B1Concurrency = runIsolatedB4B1Tests
      ? describe.only
      : describe;
    const testNonIsolatedB4B1Case = runIsolatedB4B1Tests ? it.skip : it;
    let databaseConnected = false;
    let targetVerified = false;
    let fixturesStarted = false;

    if (blockingChainObservationBudgetMs <= 0) {
      throw new Error(
        'The B4-B1 blocking-chain observation budget must leave a positive safety margin.',
      );
    }

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
      try {
        await prisma.$connect();
      } catch (error) {
        if (runIsolatedB4B1Tests) {
          throw new Error(
            'Could not connect the isolated B4-B1 Prisma client.',
          );
        }

        throw error;
      }

      databaseConnected = true;

      if (runIsolatedB4B1Tests) {
        await prisma.$transaction(async (transaction) => {
          const identity =
            await assertConnectedIsolatedB4B1Database(transaction);
          await assertIsolatedB4B1SchemaAndPrivileges(transaction);
          await assertIsolatedB4B1ExclusiveAvailability(
            transaction,
            identity.backendPid,
          );
        });
      } else {
        await assertConnectedDbIntegrityDatabase(prisma);
      }

      targetVerified = true;
      const suffix = randomUUID();

      fixturesStarted = true;
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

      const errors: unknown[] = [];

      if (targetVerified && fixturesStarted) {
        try {
          await cleanupFixture(prisma, fixture);
        } catch (error) {
          errors.push(error);
        }

        try {
          await assertNoRunOwnedFixtures(prisma, fixture);
        } catch (error) {
          errors.push(error);
        }
      }

      try {
        await prisma.$disconnect();
      } catch (error) {
        errors.push(
          runIsolatedB4B1Tests
            ? new Error(
                'The isolated B4-B1 Prisma client failed to disconnect.',
              )
            : error,
        );
      }

      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          'Healthcare Equipment Assignment backend teardown failed.',
        );
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

    describe('B4-A Replace transactional integrity', () => {
      const createDirectSource = async (
        scenario: Scenario,
        directAssignmentReason: string,
      ) => {
        const result = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4a-source-${randomUUID()}`,
          {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            directAssignmentReason,
          },
        );

        if (result.outcome !== 'CREATED') {
          throw new Error('Expected source Assignment to be created');
        }

        return result.data;
      };

      const createConflictingReservation = async (scenario: Scenario) => {
        const related = await createRelatedCase(scenario);
        const result = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4a-conflict-${randomUUID()}`,
          {
            caseId: related.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[1],
            directAssignmentReason: 'Reserva conflictiva B4-A',
          },
        );

        if (result.outcome !== 'CREATED') {
          throw new Error('Expected conflicting Assignment to be created');
        }

        return result.data;
      };

      it('A persists the successful replacement, inheritance, audit and completed claim', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          requestedQty: 1,
          assetCount: 2,
        });
        const directAssignmentReason = 'Respaldo directo B4-A';
        const source = await createDirectSource(
          scenario,
          directAssignmentReason,
        );
        const key = `b4a-success-${randomUUID()}`;
        const replacementReason = 'Equipo original no disponible';

        const result = await service.replace(
          scenario.companyId,
          scenario.userId,
          source.id,
          key,
          {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason,
          },
        );

        expect(result.outcome).toBe('REPLACED');

        if (result.outcome !== 'REPLACED') {
          throw new Error('Expected successful replacement');
        }

        const persistedSource =
          await prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: {
              caseId: true,
              equipmentAssetId: true,
              requirementId: true,
              origin: true,
              lifecycle: true,
              directAssignmentReason: true,
              replacedAt: true,
              replacedById: true,
              replacementReason: true,
            },
          });
        const successors = await prisma.healthcareEquipmentAssignment.findMany({
          where: {
            companyId: scenario.companyId,
            replacesAssignmentId: source.id,
          },
          select: {
            id: true,
            caseId: true,
            equipmentAssetId: true,
            requirementId: true,
            origin: true,
            lifecycle: true,
            directAssignmentReason: true,
            replacesAssignmentId: true,
            createdById: true,
          },
        });

        expect(persistedSource).toMatchObject({
          caseId: scenario.caseId,
          equipmentAssetId: scenario.equipmentAssetIds[0],
          requirementId: null,
          origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          directAssignmentReason,
          replacedById: scenario.userId,
          replacementReason,
        });
        expect(persistedSource.replacedAt).toBeInstanceOf(Date);
        expect(successors).toEqual([
          {
            id: result.data.replacementAssignment.id,
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[1],
            requirementId: null,
            origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
            lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            directAssignmentReason,
            replacesAssignmentId: source.id,
            createdById: scenario.userId,
          },
        ]);
        expect(result.data.replacedAssignment.id).toBe(source.id);
        await expect(
          prisma.idempotencyRecord.findUnique({
            where: {
              companyId_scope_key: {
                companyId: scenario.companyId,
                scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
                key,
              },
            },
            select: { resourceId: true },
          }),
        ).resolves.toEqual({
          resourceId: result.data.replacementAssignment.id,
        });
      });

      it('B replays the completed replacement without additional writes or audit changes', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 2,
        });
        const source = await createDirectSource(
          scenario,
          'Origen directo para replay B4-A',
        );
        const key = `b4a-replay-${randomUUID()}`;
        const dto = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'Reemplazo estable para replay',
        };
        const first = await service.replace(
          scenario.companyId,
          scenario.userId,
          source.id,
          key,
          dto,
        );

        if (first.outcome !== 'REPLACED') {
          throw new Error('Expected initial replacement');
        }

        const readPersistedState = () =>
          prisma.healthcareEquipmentAssignment.findMany({
            where: {
              companyId: scenario.companyId,
              OR: [{ id: source.id }, { replacesAssignmentId: source.id }],
            },
            orderBy: { id: 'asc' },
            select: {
              id: true,
              lifecycle: true,
              equipmentAssetId: true,
              replacesAssignmentId: true,
              replacedAt: true,
              replacedById: true,
              replacementReason: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        const readClaim = () =>
          prisma.idempotencyRecord.findUniqueOrThrow({
            where: {
              companyId_scope_key: {
                companyId: scenario.companyId,
                scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
                key,
              },
            },
            select: {
              requestHash: true,
              resourceId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        const stateBeforeReplay = await readPersistedState();
        const claimBeforeReplay = await readClaim();

        const replay = await service.replace(
          scenario.companyId,
          scenario.userId,
          source.id,
          key,
          dto,
        );

        expect(replay.outcome).toBe('REPLACED');

        if (replay.outcome !== 'REPLACED') {
          throw new Error('Expected replacement replay');
        }

        expect(replay.data.replacedAssignment.id).toBe(source.id);
        expect(replay.data.replacementAssignment.id).toBe(
          first.data.replacementAssignment.id,
        );
        await expect(readPersistedState()).resolves.toEqual(stateBeforeReplay);
        await expect(readClaim()).resolves.toEqual(claimBeforeReplay);
        expect(stateBeforeReplay).toHaveLength(2);
      });

      it('C rejects a reused key with a different payload without mutating the completed operation', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 2,
        });
        const source = await createDirectSource(
          scenario,
          'Origen directo para mismatch B4-A',
        );
        const key = `b4a-mismatch-${randomUUID()}`;
        const first = await service.replace(
          scenario.companyId,
          scenario.userId,
          source.id,
          key,
          {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Motivo original B4-A',
          },
        );

        if (first.outcome !== 'REPLACED') {
          throw new Error('Expected initial replacement');
        }

        const readAssignments = () =>
          prisma.healthcareEquipmentAssignment.findMany({
            where: {
              companyId: scenario.companyId,
              OR: [{ id: source.id }, { replacesAssignmentId: source.id }],
            },
            orderBy: { id: 'asc' },
          });
        const readClaim = () =>
          prisma.idempotencyRecord.findUniqueOrThrow({
            where: {
              companyId_scope_key: {
                companyId: scenario.companyId,
                scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
                key,
              },
            },
          });
        const assignmentsBefore = await readAssignments();
        const claimBefore = await readClaim();

        await expect(
          service.replace(scenario.companyId, scenario.userId, source.id, key, {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Payload diferente B4-A',
          }),
        ).rejects.toMatchObject({
          response: { code: 'IDEMPOTENCY_KEY_REUSED' },
        });

        await expect(readAssignments()).resolves.toEqual(assignmentsBefore);
        await expect(readClaim()).resolves.toEqual(claimBefore);
      });

      it('D rolls back source transition, successor, override and claim after an intermediate failure', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 2,
        });
        const source = await createDirectSource(
          scenario,
          'Origen directo para rollback B4-A',
        );
        const conflictingAssignment =
          await createConflictingReservation(scenario);
        const key = `b4a-rollback-${randomUUID()}`;
        const baseDto = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'Reemplazo con rollback controlado',
        };
        const review = await service.replace(
          scenario.companyId,
          scenario.userId,
          source.id,
          key,
          baseDto,
        );

        if (review.outcome !== 'CONFLICT_REVIEW_REQUIRED') {
          throw new Error('Expected replacement conflict review');
        }

        const completion = jest
          .spyOn(repository, 'completeIdempotencyClaim')
          .mockRejectedValueOnce(new Error('forced Replace atomic rollback'));

        try {
          await expect(
            service.replace(
              scenario.companyId,
              scenario.userId,
              source.id,
              key,
              {
                ...baseDto,
                confirmConflictOverride: true,
                conflictReviewFingerprint: review.conflictReviewFingerprint,
                conflictOverrideReason: 'Riesgo controlado B4-A',
              },
            ),
          ).rejects.toThrow('forced Replace atomic rollback');
        } finally {
          completion.mockRestore();
        }

        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
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
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.healthcareEquipmentAssignmentConflictOverride.count({
            where: {
              companyId: scenario.companyId,
              conflictingAssignmentId: conflictingAssignment.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('E returns conflict review with zero writes', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 2,
        });
        const source = await createDirectSource(
          scenario,
          'Origen directo para revisión B4-A',
        );
        const conflictingAssignment =
          await createConflictingReservation(scenario);
        const sourceBefore =
          await prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
          });
        const key = `b4a-review-${randomUUID()}`;

        const review = await service.replace(
          scenario.companyId,
          scenario.userId,
          source.id,
          key,
          {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Revisión sin escrituras B4-A',
          },
        );

        expect(review).toMatchObject({
          outcome: 'CONFLICT_REVIEW_REQUIRED',
          sourceAssignmentId: source.id,
          overrideRequired: true,
          conflicts: [{ assignmentId: conflictingAssignment.id }],
        });
        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
          }),
        ).resolves.toEqual(sourceBefore);
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.healthcareEquipmentAssignmentConflictOverride.count({
            where: {
              companyId: scenario.companyId,
              conflictingAssignmentId: conflictingAssignment.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('F replaces a fully covered Requirement without increasing net coverage', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          requestedQty: 1,
          assetCount: 2,
        });
        const sourceResult = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4a-coverage-source-${randomUUID()}`,
          {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            requirementId: scenario.requirementId,
          },
        );

        if (sourceResult.outcome !== 'CREATED') {
          throw new Error('Expected Requirement source Assignment');
        }

        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              requirementId: scenario.requirementId,
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            },
          }),
        ).resolves.toBe(1);

        const replacement = await service.replace(
          scenario.companyId,
          scenario.userId,
          sourceResult.data.id,
          `b4a-coverage-replace-${randomUUID()}`,
          {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Sustitución netamente neutra',
          },
        );

        expect(replacement.outcome).toBe('REPLACED');

        if (replacement.outcome !== 'REPLACED') {
          throw new Error('Expected covered Requirement replacement');
        }

        const requirementAssignments =
          await prisma.healthcareEquipmentAssignment.findMany({
            where: {
              companyId: scenario.companyId,
              requirementId: scenario.requirementId,
            },
            select: {
              id: true,
              caseId: true,
              requirementId: true,
              origin: true,
              lifecycle: true,
              equipmentAssetId: true,
              directAssignmentReason: true,
              replacesAssignmentId: true,
            },
          });

        expect(requirementAssignments).toHaveLength(2);
        expect(requirementAssignments).toEqual(
          expect.arrayContaining([
            {
              id: sourceResult.data.id,
              caseId: scenario.caseId,
              requirementId: scenario.requirementId,
              origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
              lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
              equipmentAssetId: scenario.equipmentAssetIds[0],
              directAssignmentReason: null,
              replacesAssignmentId: null,
            },
            {
              id: replacement.data.replacementAssignment.id,
              caseId: scenario.caseId,
              requirementId: scenario.requirementId,
              origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
              equipmentAssetId: scenario.equipmentAssetIds[1],
              directAssignmentReason: null,
              replacesAssignmentId: sourceResult.data.id,
            },
          ]),
        );
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              requirementId: scenario.requirementId,
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            },
          }),
        ).resolves.toBe(1);
      });
    });

    describeB4B1Concurrency('B4-B1 Replace PostgreSQL concurrency', () => {
      const createDirectAssignment = async (
        scenario: Scenario,
        caseId: string,
        equipmentAssetId: string,
        directAssignmentReason: string,
      ) => {
        const result = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4b1-source-${randomUUID()}`,
          {
            caseId,
            equipmentAssetId,
            directAssignmentReason,
          },
        );

        if (result.outcome !== 'CREATED') {
          throw new Error('Expected B4-B1 source Assignment to be created');
        }

        return result.data;
      };

      it('A/D serializes identical concurrent requests and replays the completed claim', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 2,
        });
        const source = await createDirectAssignment(
          scenario,
          scenario.caseId,
          scenario.equipmentAssetIds[0],
          'Fuente para carrera idempotente B4-B1',
        );
        const key = `b4b1-identical-${randomUUID()}`;
        const dto = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'Reemplazo concurrente idéntico',
        };
        const blocker = await createControlledDatabaseBlocker(
          prisma,
          (transaction) =>
            transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "EquipmentAsset"
              WHERE "id" = ${scenario.equipmentAssetIds[1]}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
        );
        const operation = Promise.all([
          service.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            key,
            dto,
          ),
          service.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            key,
            dto,
          ),
        ]);
        const race = await observeCompanyFirstBlockedRace(
          prisma,
          blocker,
          'FROM "EquipmentAsset"',
          operation,
          'Identical Replace race',
          blockingChainObservationBudgetMs,
        );

        expect(race.rowLockWaiter.blockerPids).toContain(blocker.pid);
        expect(race.companyLockWaiter.blockerPids).toContain(
          race.rowLockWaiter.pid,
        );
        expect(race.companyLockWaiter.pid).not.toBe(race.rowLockWaiter.pid);
        expect(race.result.map((result) => result.outcome)).toEqual([
          'REPLACED',
          'REPLACED',
        ]);

        const [first, second] = race.result;

        if (first.outcome !== 'REPLACED' || second.outcome !== 'REPLACED') {
          throw new Error(
            'Expected both identical requests to return REPLACED',
          );
        }

        expect(second.data.replacedAssignment.id).toBe(
          first.data.replacedAssignment.id,
        );
        expect(second.data.replacementAssignment.id).toBe(
          first.data.replacementAssignment.id,
        );
        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, replacementAssignments: true },
          }),
        ).resolves.toMatchObject({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
          replacementAssignments: [{ id: first.data.replacementAssignment.id }],
        });
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
              resourceId: first.data.replacementAssignment.id,
            },
          }),
        ).resolves.toBe(1);
      }, 20_000);

      it('B allows only one successor for concurrent distinct keys on the same source', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 3,
        });
        const source = await createDirectAssignment(
          scenario,
          scenario.caseId,
          scenario.equipmentAssetIds[0],
          'Fuente para claves distintas B4-B1',
        );
        const keys = [
          `b4b1-distinct-a-${randomUUID()}`,
          `b4b1-distinct-b-${randomUUID()}`,
        ];
        const blocker = await createControlledDatabaseBlocker(
          prisma,
          (transaction) =>
            transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "HealthcareEquipmentAssignment"
              WHERE "id" = ${source.id}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
        );
        const operation = Promise.allSettled([
          service.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            keys[0],
            {
              equipmentAssetId: scenario.equipmentAssetIds[1],
              replacementReason: 'Candidato concurrente A',
            },
          ),
          service.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            keys[1],
            {
              equipmentAssetId: scenario.equipmentAssetIds[2],
              replacementReason: 'Candidato concurrente B',
            },
          ),
        ]);
        const race = await observeCompanyFirstBlockedRace(
          prisma,
          blocker,
          'FROM "HealthcareEquipmentAssignment"',
          operation,
          'Distinct-key same-source Replace race',
          blockingChainObservationBudgetMs,
        );
        const fulfilled = race.result.filter(
          (result) => result.status === 'fulfilled',
        );
        const rejected = race.result.filter(
          (result) => result.status === 'rejected',
        );

        expect(race.rowLockWaiter.blockerPids).toContain(blocker.pid);
        expect(race.companyLockWaiter.blockerPids).toContain(
          race.rowLockWaiter.pid,
        );
        expect(race.companyLockWaiter.pid).not.toBe(race.rowLockWaiter.pid);
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(fulfilled[0]).toMatchObject({
          value: { outcome: 'REPLACED' },
        });
        expect(rejected[0]).toMatchObject({
          reason: {
            response: { code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED' },
          },
        });

        const successors = await prisma.healthcareEquipmentAssignment.findMany({
          where: {
            companyId: scenario.companyId,
            replacesAssignmentId: source.id,
          },
          select: { id: true, equipmentAssetId: true, lifecycle: true },
        });

        expect(successors).toHaveLength(1);
        expect(successors[0]?.lifecycle).toBe(
          HealthcareEquipmentAssignmentLifecycle.RESERVED,
        );
        await expect(
          prisma.idempotencyRecord.findMany({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key: { in: keys },
            },
            select: { resourceId: true },
          }),
        ).resolves.toEqual([{ resourceId: successors[0]?.id }]);
      }, 20_000);

      it('C rejects concurrent reuse of one key for different commands', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 3,
        });
        const source = await createDirectAssignment(
          scenario,
          scenario.caseId,
          scenario.equipmentAssetIds[0],
          'Fuente para payloads distintos B4-B1',
        );
        const key = `b4b1-mismatched-${randomUUID()}`;
        const blocker = await createControlledDatabaseBlocker(
          prisma,
          (transaction) =>
            transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "HealthcareEquipmentAssignment"
              WHERE "id" = ${source.id}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
        );
        const operation = Promise.allSettled([
          service.replace(scenario.companyId, scenario.userId, source.id, key, {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Payload concurrente A',
          }),
          service.replace(scenario.companyId, scenario.userId, source.id, key, {
            equipmentAssetId: scenario.equipmentAssetIds[2],
            replacementReason: 'Payload concurrente B',
          }),
        ]);
        const race = await observeCompanyFirstBlockedRace(
          prisma,
          blocker,
          'FROM "HealthcareEquipmentAssignment"',
          operation,
          'Mismatched same-key Replace race',
          blockingChainObservationBudgetMs,
        );
        const fulfilled = race.result.filter(
          (result) => result.status === 'fulfilled',
        );
        const rejected = race.result.filter(
          (result) => result.status === 'rejected',
        );

        expect(race.rowLockWaiter.blockerPids).toContain(blocker.pid);
        expect(race.companyLockWaiter.blockerPids).toContain(
          race.rowLockWaiter.pid,
        );
        expect(race.companyLockWaiter.pid).not.toBe(race.rowLockWaiter.pid);
        expect(fulfilled).toHaveLength(1);
        expect(fulfilled[0]).toMatchObject({
          value: { outcome: 'REPLACED' },
        });
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({
          reason: { response: { code: 'IDEMPOTENCY_KEY_REUSED' } },
        });
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(1);
      }, 20_000);

      testNonIsolatedB4B1Case(
        'D observes a completed claim after a real unique-index collision',
        async () => {
          const scenario = await createScenario(fixture.companyAId, {
            assetCount: 2,
          });
          const source = await createDirectAssignment(
            scenario,
            scenario.caseId,
            scenario.equipmentAssetIds[0],
            'Fuente para visibilidad de claim B4-B1',
          );
          const key = `b4b1-claim-visibility-${randomUUID()}`;
          const dto = {
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Visibilidad de claim completado',
          };
          const requestHash =
            createHealthcareEquipmentAssignmentReplaceRequestHash(
              source.id,
              dto,
            );
          const blocker = await createControlledDatabaseBlocker(
            prisma,
            (transaction) =>
              transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "User"
              WHERE "id" = ${scenario.userId}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
          );
          const winner = service.replace(
            scenario.companyId,
            scenario.userId,
            source.id,
            key,
            dto,
          );
          let collisionError: unknown = null;
          let recoveredPromise: ReturnType<typeof service.replace> | null =
            null;
          let winnerBlockedPids: number[] = [];
          let claimantBlockedPids: number[] = [];
          let observationError: unknown = null;

          try {
            winnerBlockedPids = await waitForBlockedBackendChain(
              prisma,
              blocker.pid,
              '"HealthcareEquipmentAssignment"',
              1,
            );
            const winnerPid = winnerBlockedPids[0];

            if (winnerPid === undefined) {
              throw new Error('Could not identify the winning backend PID.');
            }

            const collisionAttempt = repository.runInTransaction(
              (transaction) =>
                repository.createIdempotencyClaim(
                  transaction,
                  scenario.companyId,
                  key,
                  IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
                  requestHash,
                ),
            );

            recoveredPromise = collisionAttempt.then(
              () => {
                throw new Error(
                  'Expected a real idempotency unique collision.',
                );
              },
              (error: unknown) => {
                collisionError = error;
                return service.replace(
                  scenario.companyId,
                  scenario.userId,
                  source.id,
                  key,
                  dto,
                );
              },
            );
            claimantBlockedPids = await waitForBlockedBackendChain(
              prisma,
              winnerPid,
              '"IdempotencyRecord"',
              1,
            );
          } catch (error) {
            observationError = error;
          } finally {
            blocker.release();
          }

          const [, winnerResult, recoveredResult] = await Promise.all([
            blocker.done,
            withTimeout(winner, 10_000, 'Claim visibility winner'),
            recoveredPromise
              ? withTimeout(
                  recoveredPromise,
                  10_000,
                  'Claim visibility recovery',
                )
              : Promise.resolve(null),
          ]);

          if (observationError !== null) {
            throw new AggregateError(
              [observationError],
              'Claim visibility race observation failed.',
            );
          }

          expect(winnerBlockedPids).toHaveLength(1);
          expect(claimantBlockedPids).toHaveLength(1);
          expect(collisionError).toBeInstanceOf(
            Prisma.PrismaClientKnownRequestError,
          );
          expect(collisionError).toMatchObject({ code: 'P2002' });
          expect(winnerResult.outcome).toBe('REPLACED');
          expect(recoveredResult).not.toBeNull();

          if (
            winnerResult.outcome !== 'REPLACED' ||
            recoveredResult === null ||
            recoveredResult.outcome !== 'REPLACED'
          ) {
            throw new Error('Expected winner and recovered REPLACED results');
          }

          expect(recoveredResult.data.replacedAssignment.id).toBe(source.id);
          expect(recoveredResult.data.replacementAssignment.id).toBe(
            winnerResult.data.replacementAssignment.id,
          );
          await expect(
            prisma.idempotencyRecord.count({
              where: {
                companyId: scenario.companyId,
                scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
                key,
                resourceId: winnerResult.data.replacementAssignment.id,
              },
            }),
          ).resolves.toBe(1);
        },
        20_000,
      );

      it('E rereads an overlapping same-asset winner and requires conflict review', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 3,
        });
        const related = await createRelatedCase(scenario);
        const sources = await Promise.all([
          createDirectAssignment(
            scenario,
            scenario.caseId,
            scenario.equipmentAssetIds[0],
            'Fuente solapada A B4-B1',
          ),
          createDirectAssignment(
            scenario,
            related.caseId,
            scenario.equipmentAssetIds[1],
            'Fuente solapada B B4-B1',
          ),
        ]);
        const keys = [
          `b4b1-overlap-a-${randomUUID()}`,
          `b4b1-overlap-b-${randomUUID()}`,
        ];
        const blocker = await createControlledDatabaseBlocker(
          prisma,
          (transaction) =>
            transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "EquipmentAsset"
              WHERE "id" = ${scenario.equipmentAssetIds[2]}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
        );
        const operation = Promise.all(
          sources.map((source, index) =>
            service.replace(
              scenario.companyId,
              scenario.userId,
              source.id,
              keys[index],
              {
                equipmentAssetId: scenario.equipmentAssetIds[2],
                replacementReason: `Contención solapada ${index}`,
              },
            ),
          ),
        );
        const race = await observeCompanyFirstBlockedRace(
          prisma,
          blocker,
          'FROM "EquipmentAsset"',
          operation,
          'Overlapping same-asset Replace race',
          blockingChainObservationBudgetMs,
        );

        expect(race.rowLockWaiter.blockerPids).toContain(blocker.pid);
        expect(race.companyLockWaiter.blockerPids).toContain(
          race.rowLockWaiter.pid,
        );
        expect(race.companyLockWaiter.pid).not.toBe(race.rowLockWaiter.pid);
        expect(race.result.map((result) => result.outcome).sort()).toEqual([
          'CONFLICT_REVIEW_REQUIRED',
          'REPLACED',
        ]);

        const review = race.result.find(
          (result) => result.outcome === 'CONFLICT_REVIEW_REQUIRED',
        );
        const successors = await prisma.healthcareEquipmentAssignment.findMany({
          where: {
            companyId: scenario.companyId,
            replacesAssignmentId: { in: sources.map((source) => source.id) },
          },
          select: { id: true, equipmentAssetId: true },
        });

        expect(successors).toHaveLength(1);
        expect(typeof successors[0]?.id).toBe('string');
        expect(successors[0]?.equipmentAssetId).toBe(
          scenario.equipmentAssetIds[2],
        );
        expect(review).toMatchObject({
          overrideRequired: true,
          conflicts: [{ assignmentId: successors[0]?.id }],
        });
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key: { in: keys },
            },
          }),
        ).resolves.toBe(1);
      }, 20_000);

      it('E allows concurrent same-asset replacements when Case windows do not overlap', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          assetCount: 3,
        });
        const related = await createRelatedCase(scenario);

        await prisma.healthcareCase.update({
          where: { id: related.caseId },
          data: {
            scheduledStart: new Date('2026-09-17T16:00:00.000Z'),
            scheduledEnd: new Date('2026-09-17T18:00:00.000Z'),
          },
        });

        const sources = await Promise.all([
          createDirectAssignment(
            scenario,
            scenario.caseId,
            scenario.equipmentAssetIds[0],
            'Fuente no solapada A B4-B1',
          ),
          createDirectAssignment(
            scenario,
            related.caseId,
            scenario.equipmentAssetIds[1],
            'Fuente no solapada B B4-B1',
          ),
        ]);
        const keys = [
          `b4b1-no-overlap-a-${randomUUID()}`,
          `b4b1-no-overlap-b-${randomUUID()}`,
        ];
        const blocker = await createControlledDatabaseBlocker(
          prisma,
          (transaction) =>
            transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "EquipmentAsset"
              WHERE "id" = ${scenario.equipmentAssetIds[2]}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
        );
        const operation = Promise.all(
          sources.map((source, index) =>
            service.replace(
              scenario.companyId,
              scenario.userId,
              source.id,
              keys[index],
              {
                equipmentAssetId: scenario.equipmentAssetIds[2],
                replacementReason: `Contención no solapada ${index}`,
              },
            ),
          ),
        );
        const race = await observeCompanyFirstBlockedRace(
          prisma,
          blocker,
          'FROM "EquipmentAsset"',
          operation,
          'Non-overlapping same-asset Replace race',
          blockingChainObservationBudgetMs,
        );

        expect(race.rowLockWaiter.blockerPids).toContain(blocker.pid);
        expect(race.companyLockWaiter.blockerPids).toContain(
          race.rowLockWaiter.pid,
        );
        expect(race.companyLockWaiter.pid).not.toBe(race.rowLockWaiter.pid);
        expect(race.result.map((result) => result.outcome)).toEqual([
          'REPLACED',
          'REPLACED',
        ]);
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              equipmentAssetId: scenario.equipmentAssetIds[2],
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            },
          }),
        ).resolves.toBe(2);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key: { in: keys },
            },
          }),
        ).resolves.toBe(2);
      }, 20_000);

      it('F serializes Replace and Create on one fully covered Requirement', async () => {
        const scenario = await createScenario(fixture.companyAId, {
          requestedQty: 1,
          assetCount: 3,
        });
        const sourceResult = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4b1-capacity-source-${randomUUID()}`,
          {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            requirementId: scenario.requirementId,
          },
        );

        if (sourceResult.outcome !== 'CREATED') {
          throw new Error('Expected covered Requirement source');
        }

        const replaceKey = `b4b1-capacity-replace-${randomUUID()}`;
        const createKey = `b4b1-capacity-create-${randomUUID()}`;
        const blocker = await createControlledDatabaseBlocker(
          prisma,
          (transaction) =>
            transaction.$queryRaw(Prisma.sql`
              SELECT "id"
              FROM "HealthcareCaseRequirement"
              WHERE "id" = ${scenario.requirementId}
                AND "companyId" = ${scenario.companyId}
              FOR UPDATE
            `),
        );
        const operation = Promise.allSettled([
          service.replace(
            scenario.companyId,
            scenario.userId,
            sourceResult.data.id,
            replaceKey,
            {
              equipmentAssetId: scenario.equipmentAssetIds[1],
              replacementReason: 'Reemplazo concurrente de cobertura',
            },
          ),
          service.create(scenario.companyId, scenario.userId, createKey, {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[2],
            requirementId: scenario.requirementId,
          }),
        ]);
        const race = await observeCompanyFirstBlockedRace(
          prisma,
          blocker,
          'FROM "HealthcareCaseRequirement"',
          operation,
          'Replace/Create Requirement-capacity race',
          blockingChainObservationBudgetMs,
        );

        expect(race.rowLockWaiter.blockerPids).toContain(blocker.pid);
        expect(race.companyLockWaiter.blockerPids).toContain(
          race.rowLockWaiter.pid,
        );
        expect(race.companyLockWaiter.pid).not.toBe(race.rowLockWaiter.pid);
        expect(race.result[0]).toMatchObject({
          status: 'fulfilled',
          value: { outcome: 'REPLACED' },
        });
        expect(race.result[1]).toMatchObject({
          status: 'rejected',
          reason: { response: { code: 'REQUIREMENT_OVER_COVERAGE' } },
        });
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              requirementId: scenario.requirementId,
              lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              requirementId: scenario.requirementId,
            },
          }),
        ).resolves.toBe(2);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key: replaceKey,
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE,
              key: createKey,
            },
          }),
        ).resolves.toBe(0);
      }, 20_000);
    });

    describe('B4-B2 Replace HTTP with real JWT and PostgreSQL', () => {
      const companyARoles = [
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.SALES,
        UserRole.WAREHOUSE,
      ] as const;
      type CompanyARole = (typeof companyARoles)[number];

      const httpUserIds: Record<CompanyARole, string> = {
        [UserRole.ADMIN]: fixture.userAId,
        [UserRole.MANAGER]: randomUUID(),
        [UserRole.SALES]: randomUUID(),
        [UserRole.WAREHOUSE]: randomUUID(),
      };
      const companyBAdminId = fixture.userBId;
      const httpEmails: Record<CompanyARole, string> = {
        [UserRole.ADMIN]: `hc-ea-http-admin-${httpUserIds.ADMIN}@qa.example.test`,
        [UserRole.MANAGER]: `hc-ea-http-manager-${httpUserIds.MANAGER}@qa.example.test`,
        [UserRole.SALES]: `hc-ea-http-sales-${httpUserIds.SALES}@qa.example.test`,
        [UserRole.WAREHOUSE]: `hc-ea-http-warehouse-${httpUserIds.WAREHOUSE}@qa.example.test`,
      };
      const companyBAdminEmail = `hc-ea-http-admin-b-${companyBAdminId}@qa.example.test`;
      const qaCredentialEmails: Record<CompanyARole, string> = {
        [UserRole.ADMIN]: 'admin.a@qa.example.test',
        [UserRole.MANAGER]: 'manager.a@qa.example.test',
        [UserRole.SALES]: 'sales.a@qa.example.test',
        [UserRole.WAREHOUSE]: 'warehouse.a@qa.example.test',
      };
      const tokens: Partial<Record<CompanyARole, string>> = {};
      let companyBToken = '';
      let httpApp: INestApplication<App> | null = null;

      const tokenFor = (role: CompanyARole): string => {
        const token = tokens[role];

        if (!token) {
          throw new Error(`Missing HTTP token for ${role}.`);
        }

        return token;
      };

      const login = async (
        email: string,
        password: string,
        expectedRole: UserRole,
        expectedCompanyId: string,
      ): Promise<string> => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const response = await supertest(httpApp.getHttpServer())
          .post('/auth/login')
          .send({ email, password })
          .expect(HttpStatus.CREATED);
        const body = requireRecord(response.body as unknown, 'Login response');
        const user = requireRecord(body.user, 'Login user');

        expect(user.role).toBe(expectedRole);
        expect(user.companyId).toBe(expectedCompanyId);

        return requireStringField(body, 'token');
      };

      const createHttpSource = async (
        companyId = fixture.companyAId,
        assetCount = 2,
      ) => {
        const scenario = await createScenario(companyId, { assetCount });
        const source = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4b2-source-${randomUUID()}`,
          {
            caseId: scenario.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[0],
            directAssignmentReason: 'Fuente HTTP B4-B2',
          },
        );

        if (source.outcome !== 'CREATED') {
          throw new Error('Expected HTTP source Assignment');
        }

        return { scenario, source: source.data };
      };

      beforeAll(async () => {
        const qaPassword = process.env.QA_PASSWORD;

        if (!qaPassword || qaPassword.length < 12) {
          throw new Error('QA_PASSWORD is required for real HTTP login tests.');
        }

        const credentialSources = await prisma.user.findMany({
          where: {
            email: {
              in: [
                ...Object.values(qaCredentialEmails),
                'admin.b@qa.example.test',
              ],
            },
          },
          select: {
            email: true,
            role: true,
            isActive: true,
            passwordHash: true,
            company: { select: { name: true } },
          },
        });
        const credentialByEmail = new Map(
          credentialSources.map((user) => [user.email, user]),
        );
        const credentialFor = (email: string, expectedRole: UserRole) => {
          const credential = credentialByEmail.get(email);
          const expectedCompanyName = email.includes('.b@')
            ? 'Zaping QA Company B'
            : 'Zaping QA Company A';

          if (
            !credential ||
            !credential.isActive ||
            credential.role !== expectedRole ||
            credential.company.name !== expectedCompanyName
          ) {
            throw new Error('QA authentication fixture identity mismatch.');
          }

          return credential;
        };

        await prisma.$transaction(async (transaction) => {
          const adminCredential = credentialFor(
            qaCredentialEmails.ADMIN,
            UserRole.ADMIN,
          );
          const companyBAdminCredential = credentialFor(
            'admin.b@qa.example.test',
            UserRole.ADMIN,
          );

          await transaction.user.update({
            where: { id: httpUserIds.ADMIN },
            data: {
              email: httpEmails.ADMIN,
              passwordHash: adminCredential.passwordHash,
              isActive: true,
              authVersion: 0,
            },
          });
          await transaction.user.update({
            where: { id: companyBAdminId },
            data: {
              email: companyBAdminEmail,
              passwordHash: companyBAdminCredential.passwordHash,
              isActive: true,
              authVersion: 0,
            },
          });
          await transaction.user.createMany({
            data: [UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE].map(
              (role) => ({
                id: httpUserIds[role],
                companyId: fixture.companyAId,
                firstName: 'Equipment HTTP',
                lastName: role,
                email: httpEmails[role],
                passwordHash: credentialFor(qaCredentialEmails[role], role)
                  .passwordHash,
                role,
                isActive: true,
                authVersion: 0,
              }),
            ),
          });
        });

        const moduleRef: TestingModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              ignoreEnvFile: true,
              load: [healthcareCompanyTransactionTimeoutConfiguration],
            }),
            AuthModule,
            HealthcareEquipmentAssignmentsModule,
          ],
        }).compile();

        httpApp = moduleRef.createNestApplication();
        httpApp.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
          }),
        );
        await httpApp.init();
        await assertConnectedDbIntegrityDatabase(moduleRef.get(PrismaService));

        for (const role of companyARoles) {
          tokens[role] = await login(
            httpEmails[role],
            qaPassword,
            role,
            fixture.companyAId,
          );
        }

        companyBToken = await login(
          companyBAdminEmail,
          qaPassword,
          UserRole.ADMIN,
          fixture.companyBId,
        );

        for (const role of companyARoles) {
          await supertest(httpApp.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${tokenFor(role)}`)
            .expect(HttpStatus.OK);
        }

        await supertest(httpApp.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${companyBToken}`)
          .expect(HttpStatus.OK);
      }, 20_000);

      afterAll(async () => {
        if (httpApp) {
          await httpApp.close();
          httpApp = null;
        }
      });

      it('A rejects missing and invalid JWTs before any Replace write', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource();
        const key = `b4b2-auth-${randomUUID()}`;
        const body = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'No debe ejecutarse sin JWT válido',
        };

        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Idempotency-Key', key)
          .send(body)
          .expect(HttpStatus.UNAUTHORIZED);
        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', 'Bearer invalid-qa-token')
          .set('Idempotency-Key', key)
          .send(body)
          .expect(HttpStatus.UNAUTHORIZED);

        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, replacementAssignments: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          replacementAssignments: [],
        });
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('B allows MANAGER and WAREHOUSE with their real JWT identities', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        for (const role of [UserRole.MANAGER, UserRole.WAREHOUSE] as const) {
          const { scenario, source } = await createHttpSource();
          const response = await supertest(httpApp.getHttpServer())
            .post(`/healthcare/equipment-assignments/${source.id}/replace`)
            .set('Authorization', `Bearer ${tokenFor(role)}`)
            .set('Idempotency-Key', `b4b2-role-${role}-${randomUUID()}`)
            .send({
              equipmentAssetId: scenario.equipmentAssetIds[1],
              replacementReason: `Reemplazo autorizado para ${role}`,
            })
            .expect(HttpStatus.OK);
          const body = requireRecord(
            response.body as unknown,
            `${role} Replace response`,
          );
          const data = requireRecord(body.data, `${role} Replace data`);
          const replacement = requireRecord(
            data.replacementAssignment,
            `${role} replacement Assignment`,
          );
          const replacementId = requireStringField(replacement, 'id');

          expect(body.outcome).toBe('REPLACED');
          await expect(
            prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
              where: { id: replacementId },
              select: { createdById: true, replacesAssignmentId: true },
            }),
          ).resolves.toEqual({
            createdById: httpUserIds[role],
            replacesAssignmentId: source.id,
          });
        }
      });

      it('B returns 403 for SALES and keeps the source unchanged', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource();
        const sourceBefore =
          await prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
          });
        const key = `b4b2-sales-${randomUUID()}`;

        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${tokenFor(UserRole.SALES)}`)
          .set('Idempotency-Key', key)
          .send({
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'SALES no puede reemplazar',
          })
          .expect(HttpStatus.FORBIDDEN);

        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
          }),
        ).resolves.toEqual(sourceBefore);
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });

      it('C/D performs and replays one ADMIN Replace through the full HTTP pipeline', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource();
        const key = `b4b2-success-${randomUUID()}`;
        const body = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'Reemplazo HTTP confirmado',
        };
        const firstResponse = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
          .set('Idempotency-Key', key)
          .send(body)
          .expect(HttpStatus.OK);
        const firstBody = requireRecord(
          firstResponse.body as unknown,
          'First Replace response',
        );
        const firstData = requireRecord(firstBody.data, 'First Replace data');
        const firstReplaced = requireRecord(
          firstData.replacedAssignment,
          'First replaced Assignment',
        );
        const firstReplacement = requireRecord(
          firstData.replacementAssignment,
          'First replacement Assignment',
        );
        const replacementId = requireStringField(firstReplacement, 'id');

        expect(firstBody.outcome).toBe('REPLACED');
        expect(firstReplaced.id).toBe(source.id);

        const persistedBeforeReplay =
          await prisma.healthcareEquipmentAssignment.findMany({
            where: {
              companyId: scenario.companyId,
              OR: [{ id: source.id }, { replacesAssignmentId: source.id }],
            },
            orderBy: { id: 'asc' },
          });
        const replayResponse = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
          .set('Idempotency-Key', key)
          .send(body)
          .expect(HttpStatus.OK);
        const replayBody = requireRecord(
          replayResponse.body as unknown,
          'Replay response',
        );
        const replayData = requireRecord(replayBody.data, 'Replay data');
        const replayReplacement = requireRecord(
          replayData.replacementAssignment,
          'Replay replacement Assignment',
        );

        expect(replayBody.outcome).toBe('REPLACED');
        expect(requireStringField(replayReplacement, 'id')).toBe(replacementId);
        await expect(
          prisma.healthcareEquipmentAssignment.findMany({
            where: {
              companyId: scenario.companyId,
              OR: [{ id: source.id }, { replacesAssignmentId: source.id }],
            },
            orderBy: { id: 'asc' },
          }),
        ).resolves.toEqual(persistedBeforeReplay);
        expect(persistedBeforeReplay).toHaveLength(2);
        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: replacementId },
            select: {
              companyId: true,
              lifecycle: true,
              replacesAssignmentId: true,
              createdById: true,
            },
          }),
        ).resolves.toEqual({
          companyId: fixture.companyAId,
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          replacesAssignmentId: source.id,
          createdById: httpUserIds.ADMIN,
        });
      });

      it('E returns conflict review zero-write and confirms the override through HTTP', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource(
          fixture.companyAId,
          2,
        );
        const related = await createRelatedCase(scenario);
        const conflicting = await service.create(
          scenario.companyId,
          scenario.userId,
          `b4b2-conflict-source-${randomUUID()}`,
          {
            caseId: related.caseId,
            equipmentAssetId: scenario.equipmentAssetIds[1],
            directAssignmentReason: 'Reserva conflictiva HTTP',
          },
        );

        if (conflicting.outcome !== 'CREATED') {
          throw new Error('Expected HTTP conflicting Assignment');
        }

        const key = `b4b2-conflict-${randomUUID()}`;
        const body = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'Conflicto HTTP controlado',
        };
        const reviewResponse = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
          .set('Idempotency-Key', key)
          .send(body)
          .expect(HttpStatus.OK);
        const reviewBody = requireRecord(
          reviewResponse.body as unknown,
          'Conflict review response',
        );
        const fingerprint = requireStringField(
          reviewBody,
          'conflictReviewFingerprint',
        );

        expect(reviewBody).toMatchObject({
          outcome: 'CONFLICT_REVIEW_REQUIRED',
          sourceAssignmentId: source.id,
          overrideRequired: true,
          conflicts: [{ assignmentId: conflicting.data.id }],
        });
        expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.healthcareEquipmentAssignmentConflictOverride.count({
            where: {
              companyId: scenario.companyId,
              conflictingAssignmentId: conflicting.data.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);

        const confirmationResponse = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
          .set('Idempotency-Key', key)
          .send({
            ...body,
            confirmConflictOverride: true,
            conflictReviewFingerprint: fingerprint,
            conflictOverrideReason: 'Riesgo aceptado por HTTP',
          })
          .expect(HttpStatus.OK);
        const confirmationBody = requireRecord(
          confirmationResponse.body as unknown,
          'Conflict confirmation response',
        );
        const confirmationData = requireRecord(
          confirmationBody.data,
          'Conflict confirmation data',
        );
        const replacement = requireRecord(
          confirmationData.replacementAssignment,
          'Confirmed replacement Assignment',
        );
        const replacementId = requireStringField(replacement, 'id');

        expect(confirmationBody.outcome).toBe('REPLACED');
        await expect(
          prisma.healthcareEquipmentAssignmentConflictOverride.findMany({
            where: {
              companyId: scenario.companyId,
              assignmentId: replacementId,
            },
            select: {
              conflictingAssignmentId: true,
              approvedById: true,
              reason: true,
            },
          }),
        ).resolves.toEqual([
          {
            conflictingAssignmentId: conflicting.data.id,
            approvedById: httpUserIds.ADMIN,
            reason: 'Riesgo aceptado por HTTP',
          },
        ]);
      });

      it('F rejects invalid headers, params and bodies with HTTP 400 and zero writes', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource();
        const token = tokenFor(UserRole.ADMIN);
        const longKey = 'x'.repeat(129);
        const invalidParamKey = `b4b2-invalid-param-${randomUUID()}`;
        const invalidBodyKey = `b4b2-invalid-body-${randomUUID()}`;
        const validBody = {
          equipmentAssetId: scenario.equipmentAssetIds[1],
          replacementReason: 'Payload válido de control',
        };

        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${token}`)
          .send(validBody)
          .expect(HttpStatus.BAD_REQUEST);
        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', longKey)
          .send(validBody)
          .expect(HttpStatus.BAD_REQUEST);
        await supertest(httpApp.getHttpServer())
          .post('/healthcare/equipment-assignments/not-a-uuid/replace')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', invalidParamKey)
          .send(validBody)
          .expect(HttpStatus.BAD_REQUEST);
        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', invalidBodyKey)
          .send({
            equipmentAssetId: 'not-a-uuid',
            replacementReason: '   ',
          })
          .expect(HttpStatus.BAD_REQUEST);

        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
            select: { lifecycle: true, replacementAssignments: true },
          }),
        ).resolves.toEqual({
          lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
          replacementAssignments: [],
        });
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              companyId: scenario.companyId,
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key: { in: [longKey, invalidParamKey, invalidBodyKey] },
            },
          }),
        ).resolves.toBe(0);
      });

      it('F maps key reuse and non-RESERVED source errors to the domain HTTP contract', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource(
          fixture.companyAId,
          3,
        );
        const token = tokenFor(UserRole.ADMIN);
        const key = `b4b2-errors-${randomUUID()}`;

        await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key)
          .send({
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'Comando original HTTP',
          })
          .expect(HttpStatus.OK);
        const reusedResponse = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key)
          .send({
            equipmentAssetId: scenario.equipmentAssetIds[2],
            replacementReason: 'Comando diferente HTTP',
          })
          .expect(HttpStatus.CONFLICT);
        const stateResponse = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `b4b2-state-${randomUUID()}`)
          .send({
            equipmentAssetId: scenario.equipmentAssetIds[2],
            replacementReason: 'Fuente ya reemplazada',
          })
          .expect(HttpStatus.CONFLICT);

        expect(reusedResponse.body).toMatchObject({
          statusCode: HttpStatus.CONFLICT,
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
        expect(stateResponse.body).toMatchObject({
          statusCode: HttpStatus.CONFLICT,
          code: 'EQUIPMENT_ASSIGNMENT_NOT_RESERVED',
        });
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(1);
      });

      it('G hides Company A Assignments from a valid Company B JWT', async () => {
        if (!httpApp) {
          throw new Error('HTTP test application is not initialized.');
        }

        const { scenario, source } = await createHttpSource();
        const sourceBefore =
          await prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
          });
        const key = `b4b2-tenant-${randomUUID()}`;
        const response = await supertest(httpApp.getHttpServer())
          .post(`/healthcare/equipment-assignments/${source.id}/replace`)
          .set('Authorization', `Bearer ${companyBToken}`)
          .set('Idempotency-Key', key)
          .send({
            equipmentAssetId: scenario.equipmentAssetIds[1],
            replacementReason: 'No debe cruzar compañías',
          })
          .expect(HttpStatus.NOT_FOUND);

        expect(response.body).toMatchObject({
          statusCode: HttpStatus.NOT_FOUND,
          code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
        });
        await expect(
          prisma.healthcareEquipmentAssignment.findUniqueOrThrow({
            where: { id: source.id },
          }),
        ).resolves.toEqual(sourceBefore);
        await expect(
          prisma.healthcareEquipmentAssignment.count({
            where: {
              companyId: scenario.companyId,
              replacesAssignmentId: source.id,
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.idempotencyRecord.count({
            where: {
              scope: IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE,
              key,
            },
          }),
        ).resolves.toBe(0);
      });
    });
  },
);
