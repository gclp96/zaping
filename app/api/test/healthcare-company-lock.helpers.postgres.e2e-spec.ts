import { Prisma, PrismaClient } from '@prisma/client';

import { HealthcareCompanyLockTimeoutError } from '../src/healthcare/common/healthcare-company-lock-timeout.error';
import { deriveHealthcareCompanyLockKey } from '../src/healthcare/common/healthcare-company-lock-key';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../src/healthcare/common/healthcare-company-transaction-timeout-policy';
import { applyHealthcareSubsequentTransactionTimeouts } from '../src/healthcare/common/healthcare-subsequent-transaction-timeouts';

jest.setTimeout(25_000);

const RUN_FLAG = 'RUN_HC_LOCK_2C_POSTGRES_TESTS';
const CONNECTION_VARIABLE = 'HC_LOCK_2C_DATABASE_URL';
const EXPECTED_DATABASE = 'zaping_spike_test';
const EXPECTED_USER = 'zaping_hc_lock_2c';
const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_HOST_PORT = '5434';
const EXPECTED_SERVER_PORT = 5432;
const CLIENT_COUNT = 4;

const companyAId = '10000000-0000-4000-8000-000000000001';
const companyBId = '10000000-0000-4000-8000-000000000002';
const companyRollbackId = '10000000-0000-4000-8000-000000000003';
const companyTimeoutId = '10000000-0000-4000-8000-000000000004';
const companySubsequentLockId = '10000000-0000-4000-8000-000000000005';

const testPolicy: HealthcareCompanyTransactionTimeoutPolicy = {
  companyLockAcquisitionTimeoutMs: 900,
  subsequentLockTimeoutMs: 1_200,
  subsequentStatementTimeoutMs: 3_000,
  prismaMaxWaitMs: 3_000,
  prismaTransactionTimeoutMs: 12_000,
};

const transactionOptions = {
  maxWait: testPolicy.prismaMaxWaitMs,
  timeout: testPolicy.prismaTransactionTimeoutMs,
};
const CONTROLLED_OPERATION_CLEANUP_TIMEOUT_MS =
  testPolicy.prismaTransactionTimeoutMs + 1_000;
const CLIENT_DISCONNECT_TIMEOUT_MS = 5_000;

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
  backendPid: number;
};

type TimeoutSettings = {
  lockTimeout: string;
  lockTimeoutMilliseconds: number;
  statementTimeout: string;
  statementTimeoutMilliseconds: number;
};

type ControlledLockHolder = {
  pid: number;
  release: () => void;
  done: Promise<void>;
  rollbackError: Error | null;
};

type ControlledLockWaiter = {
  pid: number;
  done: Promise<void>;
};

describePostgreSql('Healthcare Company lock helpers — PostgreSQL', () => {
  const clients: PrismaClient[] = [];
  let observer: PrismaClient;
  let holderClient: PrismaClient;
  let contenderClient: PrismaClient;
  let secondaryClient: PrismaClient;

  beforeAll(async () => {
    if (!explicitConnectionUrl) {
      throw new Error(`${CONNECTION_VARIABLE} is required when ${RUN_FLAG}=1.`);
    }

    for (let index = 0; index < CLIENT_COUNT; index += 1) {
      try {
        const client = createIsolatedClient(explicitConnectionUrl);
        clients.push(client);
        await client.$connect();
      } catch {
        throw new Error(
          'Could not create or connect an HC-LOCK-02 Prisma test client.',
        );
      }
    }

    [observer, holderClient, contenderClient, secondaryClient] = clients;

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
          'HC-LOCK-02 test clients did not reach one PostgreSQL server identity.',
        );
      }
    }

    await assertExclusiveTargetAvailability(observer, clients);
  }, 20_000);

  beforeEach(async () => {
    await assertExclusiveTargetAvailability(observer, clients);
  });

  afterAll(async () => {
    const results = await withTimeout(
      Promise.allSettled(clients.map((client) => client.$disconnect())),
      CLIENT_DISCONNECT_TIMEOUT_MS,
      'Prisma test client disconnection',
    );
    const failedClientIndexes = results.flatMap((result, index) =>
      result.status === 'rejected' ? [index] : [],
    );

    if (failedClientIndexes.length > 0) {
      throw new Error(
        `Failed to disconnect Prisma test client index(es): ${failedClientIndexes.join(', ')}.`,
      );
    }
  });

  it('serializes the same Company and releases the lock on commit', async () => {
    const holder = await startCompanyLockHolder(holderClient, companyAId);
    const waiter = await startCompanyLockWaiter(contenderClient, companyAId);

    await runWithBoundedCleanup(
      async () => {
        await waitUntilBlockedBy(observer, waiter.pid, holder.pid);
        holder.release();

        await withTimeout(
          Promise.all([holder.done, waiter.done]),
          8_000,
          'Same-Company commit serialization',
        );
      },
      async () => {
        holder.release();
        await settleControlledOperationsForCleanup(
          [
            {
              label: 'holder.done',
              promise: holder.done,
              expectFulfilled: true,
            },
            {
              label: 'waiter.done',
              promise: waiter.done,
              expectFulfilled: true,
            },
          ],
          'Same-Company commit serialization',
        );
      },
      'Same-Company commit serialization',
    );
  });

  it('does not serialize independent Companies', async () => {
    const holder = await startCompanyLockHolder(holderClient, companyAId);

    await runWithBoundedCleanup(
      async () => {
        await withTimeout(
          contenderClient.$transaction(async (transaction) => {
            await acquireHealthcareCompanyLock(transaction, companyBId, {
              acquisitionTimeoutMs: 5_000,
            });
          }, transactionOptions),
          3_000,
          'Independent-Company acquisition',
        );
        holder.release();
        await withTimeout(
          holder.done,
          5_000,
          'Independent-Company holder completion',
        );
      },
      async () => {
        holder.release();
        await settleControlledOperationsForCleanup(
          [
            {
              label: 'holder.done',
              promise: holder.done,
              expectFulfilled: true,
            },
          ],
          'Independent-Company acquisition',
        );
      },
      'Independent-Company acquisition',
    );
  });

  it('releases the Company lock on rollback', async () => {
    const holder = await startCompanyLockHolder(
      holderClient,
      companyRollbackId,
      true,
    );
    const waiter = await startCompanyLockWaiter(
      contenderClient,
      companyRollbackId,
    );

    await runWithBoundedCleanup(
      async () => {
        await waitUntilBlockedBy(observer, waiter.pid, holder.pid);
        holder.release();

        const holderError = await withTimeout(
          captureError(holder.done),
          5_000,
          'Controlled rollback',
        );
        expect(holderError).toBe(holder.rollbackError);
        await withTimeout(waiter.done, 5_000, 'Post-rollback acquisition');
      },
      async () => {
        holder.release();
        await settleControlledOperationsForCleanup(
          [
            { label: 'holder.done', promise: holder.done },
            {
              label: 'waiter.done',
              promise: waiter.done,
              expectFulfilled: true,
            },
          ],
          'Controlled rollback',
        );
      },
      'Controlled rollback',
    );
  });

  it.each([
    ['unlimited', '0', 500],
    ['stricter', '125ms', 500],
    ['looser', '2s', 500],
  ] as const)(
    'restores an inherited %s acquisition lock_timeout after success',
    async (_label, inheritedLockTimeout, acquisitionTimeoutMs) => {
      await contenderClient.$transaction(async (transaction) => {
        await setTransactionLocalSetting(
          transaction,
          'lock_timeout',
          inheritedLockTimeout,
        );
        const before = await readTimeoutSettings(transaction);

        await acquireHealthcareCompanyLock(transaction, companyBId, {
          acquisitionTimeoutMs,
        });

        const after = await readTimeoutSettings(transaction);
        expect(after.lockTimeout).toBe(before.lockTimeout);
        expect(after.lockTimeoutMilliseconds).toBe(
          before.lockTimeoutMilliseconds,
        );
      }, transactionOptions);
    },
  );

  it('surfaces the verified Prisma/SQLSTATE shape for acquisition timeout', async () => {
    const baseline = await readTimeoutSettings(contenderClient);
    const holder = await startCompanyLockHolder(holderClient, companyTimeoutId);
    const waiter = await startCompanyLockWaiter(
      contenderClient,
      companyTimeoutId,
      testPolicy.companyLockAcquisitionTimeoutMs,
    );

    await runWithBoundedCleanup(
      async () => {
        await waitUntilBlockedBy(observer, waiter.pid, holder.pid);
        const error = await withTimeout(
          captureError(waiter.done),
          4_000,
          'Company-lock acquisition timeout',
        );

        expect(error).toBeInstanceOf(HealthcareCompanyLockTimeoutError);
        const cause = (error as HealthcareCompanyLockTimeoutError).cause;
        expect(cause).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
        expect(cause).toHaveProperty('code', 'P2010');
        expect(cause).toHaveProperty('meta.code', '55P03');
        holder.release();
        await withTimeout(
          holder.done,
          5_000,
          'Acquisition-timeout holder completion',
        );
      },
      async () => {
        holder.release();
        await settleControlledOperationsForCleanup(
          [
            {
              label: 'holder.done',
              promise: holder.done,
              expectFulfilled: true,
            },
            { label: 'waiter.done', promise: waiter.done },
          ],
          'Company-lock acquisition timeout',
        );
      },
      'Company-lock acquisition timeout',
    );

    expect(await readTimeoutSettings(contenderClient)).toEqual(baseline);

    await contenderClient.$transaction(async (transaction) => {
      await acquireHealthcareCompanyLock(transaction, companyTimeoutId, {
        acquisitionTimeoutMs: 5_000,
      });
    }, transactionOptions);
  });

  it('applies only tighter subsequent limits and keeps them transaction-local', async () => {
    const baseline = await readTimeoutSettings(secondaryClient);

    const unlimited = await secondaryClient.$transaction(
      async (transaction) => {
        await setTransactionLocalSetting(transaction, 'lock_timeout', '0');
        await setTransactionLocalSetting(transaction, 'statement_timeout', '0');
        await applyHealthcareSubsequentTransactionTimeouts(
          transaction,
          testPolicy,
        );
        return readTimeoutSettings(transaction);
      },
      transactionOptions,
    );
    expect(unlimited.lockTimeoutMilliseconds).toBe(
      testPolicy.subsequentLockTimeoutMs,
    );
    expect(unlimited.statementTimeoutMilliseconds).toBe(
      testPolicy.subsequentStatementTimeoutMs,
    );
    expect(await readTimeoutSettings(secondaryClient)).toEqual(baseline);

    const stricter = await secondaryClient.$transaction(async (transaction) => {
      await setTransactionLocalSetting(transaction, 'lock_timeout', '200ms');
      await setTransactionLocalSetting(
        transaction,
        'statement_timeout',
        '400ms',
      );
      await applyHealthcareSubsequentTransactionTimeouts(
        transaction,
        testPolicy,
      );
      return readTimeoutSettings(transaction);
    }, transactionOptions);
    expect(stricter.lockTimeoutMilliseconds).toBe(200);
    expect(stricter.statementTimeoutMilliseconds).toBe(400);
    expect(await readTimeoutSettings(secondaryClient)).toEqual(baseline);

    const looser = await secondaryClient.$transaction(async (transaction) => {
      await setTransactionLocalSetting(transaction, 'lock_timeout', '5s');
      await setTransactionLocalSetting(transaction, 'statement_timeout', '6s');
      await applyHealthcareSubsequentTransactionTimeouts(
        transaction,
        testPolicy,
      );
      return readTimeoutSettings(transaction);
    }, transactionOptions);
    expect(looser.lockTimeoutMilliseconds).toBe(
      testPolicy.subsequentLockTimeoutMs,
    );
    expect(looser.statementTimeoutMilliseconds).toBe(
      testPolicy.subsequentStatementTimeoutMs,
    );
    expect(await readTimeoutSettings(secondaryClient)).toEqual(baseline);
  });

  it('enforces the subsequent transaction-local lock_timeout', async () => {
    const baseline = await readTimeoutSettings(contenderClient);
    const holder = await startCompanyLockHolder(
      holderClient,
      companySubsequentLockId,
    );
    const ready = deferred<number>();
    const lockKey = deriveHealthcareCompanyLockKey(companySubsequentLockId);
    const blocked = contenderClient.$transaction(async (transaction) => {
      await applyHealthcareSubsequentTransactionTimeouts(
        transaction,
        testPolicy,
      );
      ready.resolve(await getBackendPid(transaction));
      await transaction.$queryRaw<Array<{ lock: string }>>(Prisma.sql`
        SELECT pg_advisory_xact_lock(${lockKey}::bigint)::text AS "lock"
      `);
    }, transactionOptions);
    void blocked.catch((error: unknown) => ready.reject(error));
    const blockedPid = await withTimeout(
      ready.promise,
      3_000,
      'Subsequent lock waiter setup',
    );

    await runWithBoundedCleanup(
      async () => {
        await waitUntilBlockedBy(observer, blockedPid, holder.pid);
        const error = await withTimeout(
          captureError(blocked),
          5_000,
          'Subsequent lock timeout',
        );

        expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
        expect(error).toHaveProperty('code', 'P2010');
        expect(error).toHaveProperty('meta.code', '55P03');
        holder.release();
        await withTimeout(
          holder.done,
          5_000,
          'Subsequent-timeout holder completion',
        );
      },
      async () => {
        holder.release();
        await settleControlledOperationsForCleanup(
          [
            {
              label: 'holder.done',
              promise: holder.done,
              expectFulfilled: true,
            },
            { label: 'blocked operation', promise: blocked },
          ],
          'Subsequent lock timeout',
        );
      },
      'Subsequent lock timeout',
    );

    expect(await readTimeoutSettings(contenderClient)).toEqual(baseline);
  });

  it('enforces the subsequent transaction-local statement_timeout', async () => {
    const baseline = await readTimeoutSettings(secondaryClient);
    const operation = secondaryClient.$transaction(async (transaction) => {
      await applyHealthcareSubsequentTransactionTimeouts(
        transaction,
        testPolicy,
      );
      await transaction.$queryRaw(Prisma.sql`SELECT pg_sleep(6)::text`);
    }, transactionOptions);
    const error = await withTimeout(
      captureError(operation),
      7_000,
      'Subsequent statement timeout',
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error).toHaveProperty('code', 'P2010');
    expect(error).toHaveProperty('meta.code', '57014');
    expect(await readTimeoutSettings(secondaryClient)).toEqual(baseline);
  });
});

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
    databaseUser !== EXPECTED_USER
  ) {
    throw new Error(
      `${CONNECTION_VARIABLE} does not identify the authorized HC-LOCK-02 target.`,
    );
  }

  for (const forbiddenRoutingParameter of [
    'host',
    'hostaddr',
    'port',
    'database',
    'dbname',
    'user',
    'socket',
  ]) {
    if (connectionUrl.searchParams.has(forbiddenRoutingParameter)) {
      throw new Error(
        `${CONNECTION_VARIABLE} must not override connection routing parameters.`,
      );
    }
  }

  return connectionUrl;
}

function createIsolatedClient(connectionUrl: URL): PrismaClient {
  const clientUrl = new URL(connectionUrl.toString());
  clientUrl.searchParams.set('connection_limit', '1');
  clientUrl.searchParams.set('pool_timeout', '5');
  clientUrl.searchParams.set('connect_timeout', '5');

  return new PrismaClient({ datasourceUrl: clientUrl.toString() });
}

async function readAndValidateDatabaseIdentity(
  client: PrismaClient,
): Promise<DatabaseIdentity> {
  const [identity] = await client.$queryRaw<DatabaseIdentity[]>(Prisma.sql`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser",
      inet_server_addr()::text AS "serverAddress",
      inet_server_port()::int AS "serverPort",
      current_setting('server_version_num') AS "serverVersionNumber",
      pg_backend_pid()::int AS "backendPid"
  `);
  const serverVersionNumber = Number(identity?.serverVersionNumber);

  if (
    !identity ||
    identity.databaseName !== EXPECTED_DATABASE ||
    identity.databaseUser !== EXPECTED_USER ||
    identity.serverPort !== EXPECTED_SERVER_PORT ||
    !Number.isInteger(serverVersionNumber) ||
    serverVersionNumber < 160_000 ||
    serverVersionNumber >= 170_000
  ) {
    throw new Error(
      'Connected PostgreSQL identity does not match the authorized HC-LOCK-02 target.',
    );
  }

  return identity;
}

async function assertExclusiveTargetAvailability(
  observer: PrismaClient,
  clients: PrismaClient[],
): Promise<void> {
  const ownedPids = await Promise.all(clients.map(getBackendPid));
  const otherSessions = await observer.$queryRaw<Array<{ pid: number }>>(
    Prisma.sql`
      SELECT pid::int AS "pid"
      FROM pg_stat_activity
      WHERE datname = ${EXPECTED_DATABASE}
        AND pid NOT IN (${Prisma.join(ownedPids)})
    `,
  );

  if (otherSessions.length > 0) {
    throw new Error(
      `HC-LOCK-02 target has ${otherSessions.length} unrelated session(s); exclusive availability is required.`,
    );
  }
}

async function startCompanyLockHolder(
  client: PrismaClient,
  companyId: string,
  rollback = false,
): Promise<ControlledLockHolder> {
  const ready = deferred<number>();
  const release = deferred<void>();
  const rollbackError = rollback
    ? new Error('Controlled HC-LOCK-02 rollback.')
    : null;
  const done = client.$transaction(async (transaction) => {
    await acquireHealthcareCompanyLock(transaction, companyId, {
      acquisitionTimeoutMs: 5_000,
    });
    ready.resolve(await getBackendPid(transaction));
    await release.promise;

    if (rollbackError) {
      throw rollbackError;
    }
  }, transactionOptions);
  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'Company lock holder setup'),
    release: () => release.resolve(undefined),
    done,
    rollbackError,
  };
}

async function startCompanyLockWaiter(
  client: PrismaClient,
  companyId: string,
  acquisitionTimeoutMs = 5_000,
): Promise<ControlledLockWaiter> {
  const ready = deferred<number>();
  const done = client.$transaction(async (transaction) => {
    ready.resolve(await getBackendPid(transaction));
    await acquireHealthcareCompanyLock(transaction, companyId, {
      acquisitionTimeoutMs,
    });
  }, transactionOptions);
  void done.catch((error: unknown) => ready.reject(error));

  return {
    pid: await withTimeout(ready.promise, 5_000, 'Company lock waiter setup'),
    done,
  };
}

async function waitUntilBlockedBy(
  observer: PrismaClient,
  blockedPid: number,
  blockerPid: number,
): Promise<void> {
  assertValidPostgreSqlBackendPid(blockedPid, 'blockedPid');
  assertValidPostgreSqlBackendPid(blockerPid, 'blockerPid');

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const [row] = await observer.$queryRaw<Array<{ blockerPids: number[] }>>(
      Prisma.sql`
        SELECT pg_blocking_pids(${blockedPid}::integer)::int[] AS "blockerPids"
      `,
    );

    if (row?.blockerPids.includes(blockerPid)) {
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
    throw new Error('Could not resolve the PostgreSQL backend PID.');
  }

  assertValidPostgreSqlBackendPid(row.pid, 'backendPid');
  return row.pid;
}

function assertValidPostgreSqlBackendPid(pid: number, label: string): void {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647) {
    throw new RangeError(`${label} must be a positive PostgreSQL integer PID.`);
  }
}

async function readTimeoutSettings(
  client: RawQueryClient,
): Promise<TimeoutSettings> {
  const [settings] = await client.$queryRaw<TimeoutSettings[]>(Prisma.sql`
    SELECT
      current_setting('lock_timeout') AS "lockTimeout",
      lock_settings.setting::int AS "lockTimeoutMilliseconds",
      current_setting('statement_timeout') AS "statementTimeout",
      statement_settings.setting::int AS "statementTimeoutMilliseconds"
    FROM pg_catalog.pg_settings AS lock_settings
    CROSS JOIN pg_catalog.pg_settings AS statement_settings
    WHERE lock_settings.name = 'lock_timeout'
      AND statement_settings.name = 'statement_timeout'
  `);

  if (!settings) {
    throw new Error('Could not read PostgreSQL timeout settings.');
  }

  return settings;
}

async function setTransactionLocalSetting(
  transaction: Prisma.TransactionClient,
  setting: 'lock_timeout' | 'statement_timeout',
  value: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config(${setting}, ${value}, true)::text
  `);
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected operation to reject.');
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const bounded = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} exceeded ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, bounded]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type ControlledCleanupOperation = {
  label: string;
  promise: Promise<unknown>;
  expectFulfilled?: boolean;
};

async function settleControlledOperationsForCleanup(
  operations: ControlledCleanupOperation[],
  label: string,
): Promise<void> {
  const results = await withTimeout(
    Promise.allSettled(operations.map((operation) => operation.promise)),
    CONTROLLED_OPERATION_CLEANUP_TIMEOUT_MS,
    `${label} cleanup`,
  );
  const unexpectedlyRejectedOperations = results.flatMap((result, index) =>
    operations[index].expectFulfilled && result.status === 'rejected'
      ? [operations[index].label]
      : [],
  );

  if (unexpectedlyRejectedOperations.length > 0) {
    throw new Error(
      `${label} cleanup observed unexpected rejection(s): ${unexpectedlyRejectedOperations.join(', ')}.`,
    );
  }
}

async function runWithBoundedCleanup(
  operation: () => Promise<void>,
  cleanup: () => Promise<void>,
  label: string,
): Promise<void> {
  let operationFailed = false;
  let operationError: unknown;

  try {
    await operation();
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }

  let cleanupFailed = false;
  let cleanupError: unknown;

  try {
    await cleanup();
  } catch (error) {
    cleanupFailed = true;
    cleanupError = error;
  }

  if (operationFailed && cleanupFailed) {
    throw new AggregateError(
      [operationError, cleanupError],
      `${label} failed and its cleanup also failed.`,
    );
  }

  if (operationFailed) {
    throw operationError;
  }

  if (cleanupFailed) {
    throw cleanupError;
  }
}
