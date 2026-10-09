import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, UserRole } from '@prisma/client';
import supertest from 'supertest';
import { App } from 'supertest/types';

import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../../src/healthcare/common/healthcare-company-transaction-timeout.config';
import { HealthcareEquipmentAssignmentsController } from '../../src/healthcare/equipment-assignments/healthcare-equipment-assignments.controller';
import { HealthcareEquipmentAssignmentsRepository } from '../../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from '../../src/healthcare/equipment-assignments/healthcare-equipment-assignments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const database = 'zaping_spike_test';
const role = 'zaping_hc_c5b';
const writableTables = [
  'Company',
  'User',
  'Product',
  'HealthcareCase',
  'HealthcareCaseRequirement',
  'EquipmentAsset',
  'HealthcareEquipmentAssignment',
  'IdempotencyRecord',
] as const;
const overrideTable = 'HealthcareEquipmentAssignmentConflictOverride';
const insertTables: readonly string[] = [...writableTables, overrideTable];
const settingsTable = 'HealthcareEquipmentAssignmentSettings';
const tables: readonly string[] = [
  ...writableTables,
  overrideTable,
  settingsTable,
];
const updates: Readonly<Record<string, readonly string[]>> = {
  EquipmentAsset: ['id'],
  HealthcareCaseRequirement: ['id'],
  HealthcareCase: ['scheduledStart', 'scheduledEnd', 'updatedAt'],
  HealthcareEquipmentAssignmentSettings: ['companyId'],
  IdempotencyRecord: ['resourceId', 'updatedAt'],
};

// These messages contain only code-owned stage/object identifiers. Never attach
// raw Prisma, HTTP or URL errors as cause: Jest recursively prints Error causes.
class C5bError extends Error {
  constructor(
    message: string,
    readonly diagnosticStage?: string,
  ) {
    super(message);
  }
}
function requireC5b(
  ok: unknown,
  code: string,
  diagnosticStage?: string,
): asserts ok {
  if (!ok) throw new C5bError(`C5B ${code}`, diagnosticStage);
}
const diagnosticStages: Readonly<Record<string, string>> = {
  URL: 'preflight.url-target',
  'client construction': 'connection.client',
  connect: 'connection.authentication',
  identity: 'preflight.identity',
  role: 'preflight.role',
  schema: 'preflight.schema',
  ACL: 'preflight.acl',
  'ACL positive': 'preflight.acl.positive',
  'ACL prohibited': 'preflight.acl.prohibited',
  functions: 'preflight.functions-catalog',
  'exclusive preflight': 'preflight.sessions',
  'first INSERT boundary': 'preflight.sessions.before-insert',
  'fixture boundary': 'fixtures.sessions',
  'collision checks': 'preflight.collisions',
  'Company INSERT': 'fixtures.company',
  'User INSERT': 'fixtures.user',
  'Company accreditation': 'ownership.accreditation',
  'fixture setup': 'fixtures.setup',
  'JWT setup boundary': 'jwt.sessions',
  'JWT setup': 'jwt.setup',
  'persisted JWT actor': 'jwt.actor',
  'JWT sign': 'jwt.sign',
  'Nest compile': 'nest.compile',
  'Nest setup': 'nest.setup',
  'Nest init': 'nest.init',
  'HTTP boundary': 'http.sessions',
  'authenticated smoke': 'http.authenticated-smoke',
  'operation boundary': 'operation.sessions',
  'post-HTTP boundary': 'http.sessions.after',
  'functional/setup': 'functional',
  'app close': 'app.close',
  'ownership recheck': 'cleanup.ownership',
  'cleanup boundary': 'cleanup.sessions',
  cleanup: 'cleanup',
  residue: 'cleanup.zero-residue',
  disconnect: 'prisma.disconnect',
};
function safeStage(name: string): string {
  if (Object.hasOwn(diagnosticStages, name)) return diagnosticStages[name];
  for (const table of [...tables, 'Assignments', 'ConflictOverrides']) {
    if (name === `cleanup ${table}`) return `cleanup.${table}`;
    if (name === `residue ${table}`) return `cleanup.zero-residue.${table}`;
  }
  return 'functional';
}
class C5bStageError extends Error {}
// Original objects are never attached as cause or enumerable properties: Jest
// and inspect() may print them. Keep them privately for in-process debugging.
const originalDiagnostics = new WeakMap<Error, unknown>();
export function c5bDiagnostic(error: unknown, stageName: string): Error {
  if (error instanceof C5bStageError) return error;
  let kind = error instanceof Error ? 'Error' : 'NonError';
  let prismaCode: string | undefined;
  let postgresCode: string | undefined;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    kind = 'PrismaClientKnownRequestError';
    if (/^P\d{4}$/.test(error.code)) prismaCode = error.code;
    const code: unknown = error.meta?.code;
    if (
      typeof code === 'string' &&
      /^(?:\d{5}|42P01|42P07|40P01|55P03|57P01|57P02|57P03|08P01)$/.test(code)
    )
      postgresCode = code;
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    kind = 'PrismaClientInitializationError';
    if (error.errorCode && /^P\d{4}$/.test(error.errorCode))
      prismaCode = error.errorCode;
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    kind = 'PrismaClientValidationError';
  } else if (error instanceof TypeError) kind = 'TypeError';
  else if (error instanceof RangeError) kind = 'RangeError';
  const trusted = error instanceof C5bError;
  const label = safeStage(
    trusted ? (error.diagnosticStage ?? stageName) : stageName,
  );
  const codes = [prismaCode, postgresCode].filter(Boolean).join('/');
  const message = trusted
    ? error.message
    : 'operation failed; raw diagnostics suppressed';
  const result = new C5bStageError(
    `[${label}] ${trusted ? 'HarnessCheck' : kind}${codes ? ` ${codes}` : ''}: ${message}`,
  );
  originalDiagnostics.set(result, error);
  return result;
}
const sanitized = c5bDiagnostic;

type TeardownStatus =
  | 'PASS'
  | 'FAIL'
  | 'SKIPPED_NO_APP'
  | 'SKIPPED_NO_FIXTURES'
  | 'SKIPPED_NO_OWNERS'
  | 'SKIPPED_BOUNDARY'
  | 'SKIPPED_NO_CLIENT';
type TeardownReport = Record<
  'app.close' | 'cleanup' | 'cleanup.zero-residue' | 'prisma.disconnect',
  TeardownStatus
>;
export function c5bFailure(
  errors: readonly unknown[],
  teardown: TeardownReport,
): AggregateError {
  const safeErrors = errors.map((error) =>
    sanitized(error, 'functional/setup'),
  );
  const statuses: readonly string[] = [
    'PASS',
    'FAIL',
    'SKIPPED_NO_APP',
    'SKIPPED_NO_FIXTURES',
    'SKIPPED_NO_OWNERS',
    'SKIPPED_BOUNDARY',
    'SKIPPED_NO_CLIENT',
  ];
  const lines = (
    [
      'app.close',
      'cleanup',
      'cleanup.zero-residue',
      'prisma.disconnect',
    ] as const
  ).map(
    (name) =>
      `[${name}] ${statuses.includes(teardown[name]) ? teardown[name] : 'UNKNOWN'}`,
  );
  return new AggregateError(
    safeErrors,
    `C5B harness failed:\n${safeErrors.map((error) => error.message).join('\n')}\nTeardown:\n${lines.join('\n')}`,
  );
}
async function stage<T>(name: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw sanitized(error, name);
  }
}

export function c5bConnectionUrl(value: string | undefined): string {
  try {
    requireC5b(value, 'dedicated URL required');
    const url = new URL(value);
    requireC5b(
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
        url.hostname === '127.0.0.1' &&
        url.port === '5434' &&
        url.pathname === `/${database}` &&
        decodeURIComponent(url.username) === role &&
        decodeURIComponent(url.password).trim().length > 0 &&
        !value.includes('?') &&
        !value.includes('#') &&
        !url.search &&
        !url.hash,
      'URL contract mismatch',
    );
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('connect_timeout', '5');
    url.searchParams.set('pool_timeout', '5');
    url.searchParams.set('socket_timeout', '10');
    url.searchParams.set('schema', 'public');
    return url.toString();
  } catch {
    throw new C5bError('C5B invalid dedicated URL');
  }
}

// The harness exclusively owns connection lifetime. Nest receives this exact
// object; its lifecycle hooks deliberately cannot reconnect/disconnect it.
class C5bPrisma extends PrismaService {
  constructor(url: string) {
    super({ datasourceUrl: url, log: [] });
  }
  override onModuleInit(): Promise<void> {
    return Promise.resolve();
  }
  override onModuleDestroy(): Promise<void> {
    return Promise.resolve();
  }
}

type Identity = {
  database: string;
  user: string;
  sessionUser: string;
  schema: string | null;
  address: string | null;
  port: number;
  version: string;
  pid: number;
};
async function identity(prisma: PrismaService): Promise<Identity> {
  const rows = await prisma.$queryRaw<Identity[]>(Prisma.sql`
    SELECT current_database() AS database, current_user AS "user",
      session_user AS "sessionUser", current_schema() AS schema,
      inet_server_addr()::text AS address, inet_server_port()::int AS port,
      current_setting('server_version_num') AS version, pg_backend_pid()::int AS pid
  `);
  return c5bValidateIdentity(rows);
}

// inet_server_addr()::text can report an inet prefix (IPv4 /32, IPv6 /128).
// This is the server's internal address, not the external URL endpoint. Keep
// the original value for the existing same-backend comparison within a run.
function validServerAddress(value: string | null): boolean {
  if (!value || value.trim() !== value || value.includes('%')) return false;
  const [address, prefix, ...extra] = value.split('/');
  const family = isIP(address);
  if (!family || extra.length) return false;
  return (
    prefix === undefined ||
    (/^(0|[1-9]\d{0,2})$/.test(prefix) &&
      Number(prefix) <= (family === 4 ? 32 : 128))
  );
}

export function c5bValidateIdentity(rows: readonly Identity[]): Identity {
  const row = rows[0];
  requireC5b(
    rows.length === 1 &&
      row.database === database &&
      row.user === role &&
      row.sessionUser === role &&
      row.schema === 'public' &&
      validServerAddress(row.address) &&
      row.port === 5432 &&
      /^16\d{4}$/.test(row.version) &&
      Number.isSafeInteger(row.pid) &&
      row.pid > 0,
    'connected identity mismatch',
  );
  return row;
}
type RegisteredClient = { prisma: C5bPrisma; identity?: Identity };
type SessionMetadata = {
  pid: unknown;
  role: unknown;
  backendType: unknown;
  state: unknown;
  backendStart: unknown;
};

// Classification is diagnostic only. Even a dedicated-role/internal/idle row
// selected by the unchanged conflict predicate must still fail the boundary.
export function c5bRejectUnexpectedSessions(
  foreign: readonly SessionMetadata[],
): void {
  if (foreign.length === 0) return;
  const details = foreign.map((row) => ({
    pid:
      Number.isSafeInteger(row.pid) && (row.pid as number) > 0
        ? row.pid
        : 'unavailable',
    pidClassification: 'unexpected',
    role:
      typeof row.role !== 'string' || row.role.length === 0
        ? 'unavailable'
        : row.role === role
          ? 'dedicated_role'
          : 'other_role',
    backendType:
      row.backendType === 'client backend'
        ? 'client_backend'
        : [
              'autovacuum launcher',
              'autovacuum worker',
              'logical replication launcher',
              'logical replication worker',
              'parallel worker',
              'background writer',
              'checkpointer',
              'archiver',
              'startup',
              'walreceiver',
              'walsender',
              'walwriter',
            ].includes(row.backendType as string)
          ? 'postgres_internal'
          : row.backendType === 'standalone backend'
            ? 'other_known'
            : 'unavailable',
    state:
      row.state === 'active'
        ? 'active'
        : row.state === 'idle'
          ? 'idle'
          : row.state === 'idle in transaction'
            ? 'idle_in_transaction'
            : [
                  'idle in transaction (aborted)',
                  'fastpath function call',
                  'disabled',
                ].includes(row.state as string)
              ? 'other_known'
              : 'unavailable',
    backendStart:
      row.backendStart instanceof Date &&
      Number.isFinite(row.backendStart.getTime())
        ? row.backendStart.toISOString()
        : 'unavailable',
  }));
  throw new C5bError(
    `C5B target has unowned or unknown sessions\nSession metadata: ${JSON.stringify(details)}`,
  );
}

export function c5bAssertSessionIdentity(
  current: Identity,
  accreditedIdentity: Identity | undefined,
): void {
  requireC5b(
    JSON.stringify(current) === JSON.stringify(accreditedIdentity),
    'backend identity changed',
  );
}

async function boundary(clients: readonly RegisteredClient[]): Promise<void> {
  requireC5b(clients.length === 1, 'one registered client required');
  const owned = clients.map((client) => client.identity?.pid);
  requireC5b(
    owned.every((pid) => Number.isSafeInteger(pid) && pid! > 0) &&
      new Set(owned).size === clients.length,
    'invalid owned PID registry',
  );
  const client = clients[0];
  const current = await identity(client.prisma);
  c5bAssertSessionIdentity(current, client.identity);
  const foreign = await client.prisma.$queryRaw<SessionMetadata[]>(Prisma.sql`
    SELECT pid::int AS pid, usename AS role, backend_type AS "backendType",
      state, backend_start AS "backendStart" FROM pg_catalog.pg_stat_activity
    WHERE datname = ${database} AND (pid IS NULL OR pid NOT IN (${Prisma.join(owned)}))
  `);
  c5bRejectUnexpectedSessions(foreign);
}

async function checkRole(prisma: PrismaService): Promise<void> {
  const [result] = await prisma.$queryRaw<Array<{ safe: boolean }>>(Prisma.sql`
    SELECT rolcanlogin AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datdba = r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner = r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relowner = r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE proowner = r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type WHERE typowner = r.oid)
      AS safe FROM pg_catalog.pg_roles r WHERE rolname = current_user
  `);
  // No membership is part of the approved dedicated-role manifest, including
  // SET ROLE-only memberships and pg_read_all_stats. Ownership enables DDL.
  requireC5b(
    result?.safe,
    'role attributes, memberships or ownership exceed manifest',
  );
}

const functionSignatures = [
  'btrim(text)',
  'current_setting(text)',
  'set_config(text,text,boolean)',
  'pg_advisory_xact_lock(bigint)',
  'pg_advisory_xact_lock_shared(bigint)',
  'current_database()',
  'current_schema()',
  'inet_server_addr()',
  'inet_server_port()',
  'pg_backend_pid()',
  'to_regprocedure(text)',
  'pg_get_expr(pg_node_tree,oid)',
  'has_database_privilege(name,oid,text)',
  'has_schema_privilege(name,oid,text)',
  'has_table_privilege(name,oid,text)',
  'has_column_privilege(name,oid,smallint,text)',
  'has_sequence_privilege(name,oid,text)',
  'has_function_privilege(name,oid,text)',
];
async function checkFunctions(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ allowed: boolean | null }>
  >(Prisma.sql`
    SELECT has_function_privilege(current_user, to_regprocedure(f.signature), 'EXECUTE') AS allowed
    FROM (VALUES ${Prisma.join(functionSignatures.map((s) => Prisma.sql`(${'pg_catalog.' + s})`))}) f(signature)
  `);
  requireC5b(
    rows.length === functionSignatures.length &&
      rows.every((r) => r.allowed === true),
    'required function EXECUTE missing',
  );
  const settings = await prisma.$queryRaw<
    Array<{
      name: string;
      milliseconds: number;
      unit: string;
      effective: string;
    }>
  >(Prisma.sql`
    SELECT name, setting::int AS milliseconds, unit, current_setting(name) AS effective
    FROM pg_catalog.pg_settings WHERE name IN ('lock_timeout', 'statement_timeout')
  `);
  requireC5b(
    settings.length === 2 &&
      new Set(settings.map((s) => s.name)).size === 2 &&
      settings.every(
        (s) =>
          Number.isInteger(s.milliseconds) &&
          s.milliseconds >= 0 &&
          s.unit === 'ms' &&
          typeof s.effective === 'string' &&
          s.effective.length > 0,
      ),
    'runtime timeout catalog access invalid',
  );
  // Catalog access is also exercised by each preflight query, not assumed from
  // a blanket monitoring role or silently repaired with grants.
}

async function checkAcl(prisma: PrismaService): Promise<void> {
  const [base] = await prisma.$queryRaw<
    Array<{ safe: boolean; positive: boolean }>
  >(Prisma.sql`
    SELECT has_database_privilege(current_user, d.oid, 'CONNECT')
      AND NOT has_database_privilege(current_user, d.oid, 'CREATE')
      AND NOT has_database_privilege(current_user, d.oid, 'TEMPORARY')
      AND NOT has_database_privilege(current_user, d.oid, 'CONNECT WITH GRANT OPTION')
      AND has_schema_privilege(current_user, n.oid, 'USAGE')
      AND NOT has_schema_privilege(current_user, n.oid, 'USAGE WITH GRANT OPTION')
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace s
        WHERE has_schema_privilege(current_user, s.oid, 'CREATE')) AS safe,
      has_database_privilege(current_user, d.oid, 'CONNECT')
        AND has_schema_privilege(current_user, n.oid, 'USAGE') AS positive
    FROM pg_catalog.pg_database d CROSS JOIN pg_catalog.pg_namespace n
    WHERE d.datname = ${database} AND n.nspname = 'public'
  `);
  // The old C5-A PUBLIC TEMPORARY exception was not approved for C5-B.
  requireC5b(
    base?.safe,
    base?.positive
      ? 'prohibited database/schema privilege'
      : 'required database/schema privilege missing',
    base?.positive ? 'ACL prohibited' : 'ACL positive',
  );
  const rows = await prisma.$queryRaw<
    Array<{
      schema: string;
      table: string;
      privilege: string;
      allowed: boolean;
      delegable: boolean;
    }>
  >(Prisma.sql`
    SELECT n.nspname AS schema, c.relname AS table, p.privilege,
      has_table_privilege(current_user, c.oid, p.privilege) AS allowed,
      has_table_privilege(current_user, c.oid, p.privilege || ' WITH GRANT OPTION') AS delegable
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
  `);
  for (const row of rows) {
    const scoped = row.schema === 'public' && tables.includes(row.table);
    const expected =
      scoped &&
      (row.privilege === 'SELECT' ||
        (row.privilege === 'DELETE' && row.table !== settingsTable) ||
        (row.privilege === 'INSERT' && insertTables.includes(row.table)));
    requireC5b(
      row.allowed === expected && !row.delegable,
      'table ACL differs from exact manifest',
      expected && !row.allowed ? 'ACL positive' : 'ACL prohibited',
    );
  }
  for (const table of tables)
    requireC5b(
      rows.filter((r) => r.schema === 'public' && r.table === table).length ===
        7,
      `ACL table missing: ${table}`,
      'ACL positive',
    );
  const columns = await prisma.$queryRaw<
    Array<{
      schema: string;
      table: string;
      column: string;
      privilege: string;
      allowed: boolean;
      delegable: boolean;
    }>
  >(Prisma.sql`
    SELECT n.nspname AS schema, c.relname AS table, a.attname AS column, p.privilege,
      has_column_privilege(current_user, c.oid, a.attnum, p.privilege) AS allowed,
      has_column_privilege(current_user, c.oid, a.attnum, p.privilege || ' WITH GRANT OPTION') AS delegable
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) p(privilege)
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
  `);
  for (const row of columns) {
    const scoped = row.schema === 'public' && tables.includes(row.table);
    const expected =
      scoped &&
      (row.privilege === 'SELECT' ||
        (row.privilege === 'INSERT' && insertTables.includes(row.table)) ||
        (row.privilege === 'UPDATE' &&
          (updates[row.table] ?? []).includes(row.column)));
    requireC5b(
      row.allowed === expected && !row.delegable,
      'column ACL differs from exact manifest',
      expected && !row.allowed ? 'ACL positive' : 'ACL prohibited',
    );
  }
  const sequences = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >(Prisma.sql`
    SELECT has_sequence_privilege(current_user, c.oid, 'USAGE,SELECT,UPDATE') AS allowed
    FROM pg_catalog.pg_class c WHERE c.relkind = 'S'
  `);
  requireC5b(
    sequences.every((r) => !r.allowed),
    'sequence privileges prohibited',
    'ACL prohibited',
  );
  const definers = await prisma.$queryRaw<
    Array<{ unsafe: boolean }>
  >(Prisma.sql`
    SELECT true AS unsafe FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND has_function_privilege(current_user, p.oid, 'EXECUTE')
  `);
  requireC5b(
    definers.length === 0,
    'executable security-definer function exceeds manifest',
    'ACL prohibited',
  );
}

// Compare boolean structure, preserving AND/OR grouping. PostgreSQL adds
// parentheses and casts to CHECK expressions. Removing every parenthesis would
// accept materially different audit constraints, so only redundant outer ones
// and casts on literal values are normalized.
export function c5bCheckShape(expression: string): string {
  const normalized = expression.replace(
    /'((?:[^']|'')*)'::(?:public\.)?(?:"HealthcareEquipmentAssignmentOrigin"|"HealthcareEquipmentAssignmentLifecycle"|"HealthcareEquipmentAssignmentReleaseCause"|"HealthcareRequirementLifecycle"|text)/g,
    "'$1'",
  );
  const tokens =
    normalized.match(
      /'(?:[^']|'')*'|"[^"]+"|[A-Za-z_][A-Za-z_0-9]*|<>|>=|<=|[()=<>]|\d+/g,
    ) ?? [];
  requireC5b(
    tokens.join('').replace(/\s/g, '') === normalized.replace(/\s/g, ''),
    'unsupported CHECK syntax',
  );
  function shape(input: string[]): string {
    while (input[0] === '(' && input[input.length - 1] === ')') {
      let depth = 0;
      const wraps = input.every((token, i) => {
        depth += token === '(' ? 1 : token === ')' ? -1 : 0;
        return depth !== 0 || i === input.length - 1;
      });
      if (!wraps) break;
      input = input.slice(1, -1);
    }
    for (const operator of ['OR', 'AND']) {
      let depth = 0;
      let start = 0;
      const parts: string[] = [];
      input.forEach((token, i) => {
        depth += token === '(' ? 1 : token === ')' ? -1 : 0;
        if (depth === 0 && token === operator) {
          parts.push(shape(input.slice(start, i)));
          start = i + 1;
        }
      });
      if (parts.length) {
        parts.push(shape(input.slice(start)));
        return `${operator}[${parts.join('|')}]`;
      }
    }
    return input
      .map((token) => (token.startsWith('"') ? token.slice(1, -1) : token))
      .join(' ');
  }
  return shape(tokens);
}

async function checkSchema(prisma: PrismaService): Promise<void> {
  // Prisma's generated metadata is read-only: no client, migration or generator
  // is invoked. This validates types/nullability and tenant relation key order,
  // not just names. CHECK/index expressions below are pinned to this baseline.
  const models = Prisma.dmmf.datamodel.models.filter((m) =>
    tables.includes(m.name),
  );
  requireC5b(
    models.length === tables.length,
    'generated schema contract missing',
  );
  const columns = await prisma.$queryRaw<
    Array<{
      table: string;
      column: string;
      type: string;
      typeSchema: string;
      required: boolean;
      ordinary: boolean;
      secured: boolean;
    }>
  >(Prisma.sql`
    SELECT c.relname AS table, a.attname AS column, t.typname AS type, tn.nspname AS "typeSchema",
      a.attnotnull AS required, c.relkind = 'r' AS ordinary,
      c.relrowsecurity OR c.relforcerowsecurity AS secured
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
    JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
    WHERE n.nspname = 'public' AND c.relname IN (${Prisma.join(tables)})
  `);
  const scalarTypes: Record<string, string> = {
    String: 'text',
    Int: 'int4',
    Float: 'float8',
    Boolean: 'bool',
    DateTime: 'timestamp',
  };
  for (const model of models) {
    for (const field of model.fields.filter((f) => f.kind !== 'object')) {
      const actual = columns.find(
        (c) => c.table === model.name && c.column === field.name,
      );
      requireC5b(
        actual &&
          actual.ordinary &&
          !actual.secured &&
          actual.required === field.isRequired &&
          actual.type ===
            (field.kind === 'enum' ? field.type : scalarTypes[field.type]) &&
          actual.typeSchema ===
            (field.kind === 'enum' ? 'public' : 'pg_catalog'),
        `column definition mismatch: ${model.name}.${field.name}`,
      );
    }
  }
  const enumNames = [
    ...new Set(
      models.flatMap((m) =>
        m.fields.filter((f) => f.kind === 'enum').map((f) => f.type),
      ),
    ),
  ];
  const enums = await prisma.$queryRaw<
    Array<{ name: string; label: string }>
  >(Prisma.sql`
    SELECT t.typname AS name, e.enumlabel AS label FROM pg_catalog.pg_enum e
    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname IN (${Prisma.join(enumNames)})
  `);
  for (const name of enumNames) {
    const required =
      name === 'IdempotencyScope'
        ? ['HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE']
        : Prisma.dmmf.datamodel.enums
            .find((e) => e.name === name)
            ?.values.map((v) => v.name);
    requireC5b(
      required?.length &&
        required.every((label) =>
          enums.some((e) => e.name === name && e.label === label),
        ),
      `enum labels missing: ${name}`,
    );
  }
  const fks = await prisma.$queryRaw<
    Array<{
      table: string;
      target: string;
      targetSchema: string;
      source: string[];
      destination: string[];
      deletion: string;
      update: string;
      valid: boolean;
      deferred: boolean;
    }>
  >(Prisma.sql`
    SELECT c.relname AS table, target.relname AS target, tn.nspname AS "targetSchema",
      ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY x(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = x.num ORDER BY x.ord) AS source,
      ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY x(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = target.oid AND a.attnum = x.num ORDER BY x.ord) AS destination,
      k.confdeltype::text AS deletion, k.confupdtype::text AS update,
      k.convalidated AS valid, k.condeferrable AS deferred
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_class target ON target.oid = k.confrelid
    JOIN pg_catalog.pg_namespace tn ON tn.oid = target.relnamespace
    WHERE k.contype = 'f' AND n.nspname = 'public' AND c.relname IN (${Prisma.join(tables)})
  `);
  for (const model of models) {
    for (const relation of model.fields.filter(
      (f) =>
        f.kind === 'object' &&
        f.relationFromFields?.length &&
        tables.includes(f.type),
    )) {
      const deletion =
        relation.relationOnDelete ??
        (relation.isRequired ? 'Restrict' : 'SetNull');
      const deletionCode = {
        Restrict: 'r',
        SetNull: 'n',
        Cascade: 'c',
        NoAction: 'a',
        SetDefault: 'd',
      }[deletion];
      requireC5b(
        fks.some(
          (f) =>
            f.table === model.name &&
            f.target === relation.type &&
            f.targetSchema === 'public' &&
            JSON.stringify(f.source) ===
              JSON.stringify(relation.relationFromFields) &&
            JSON.stringify(f.destination) ===
              JSON.stringify(relation.relationToFields) &&
            f.deletion === deletionCode &&
            f.update === 'c' &&
            f.valid &&
            !f.deferred,
        ),
        `tenant FK mismatch: ${model.name}.${relation.name}`,
      );
    }
  }
  const checks = await prisma.$queryRaw<
    Array<{ table: string; name: string; expression: string; valid: boolean }>
  >(Prisma.sql`
    SELECT c.relname AS table, k.conname AS name, pg_get_expr(k.conbin, k.conrelid) AS expression, k.convalidated AS valid
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE k.contype = 'c' AND n.nspname = 'public' AND c.relname IN (${Prisma.join(tables)})
  `);
  for (const required of requiredChecks) {
    requireC5b(
      checks.some(
        (c) =>
          c.table === required.table &&
          c.name === required.name &&
          c.valid &&
          c5bCheckShape(c.expression) === c5bCheckShape(required.expression),
      ),
      `CHECK mismatch: ${required.name}`,
    );
  }
  const indexes = await prisma.$queryRaw<
    Array<{
      table: string;
      name: string;
      columns: string[];
      unique: boolean;
      valid: boolean;
      method: string;
      predicate: string | null;
    }>
  >(Prisma.sql`
    SELECT c.relname AS table, idx.relname AS name,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY x(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = x.num ORDER BY x.ord) AS columns,
      i.indisunique AS unique, i.indisvalid AND i.indisready AND i.indimmediate
        AND i.indexprs IS NULL AND i.indnkeyatts = i.indnatts
        AND NOT i.indnullsnotdistinct
        AND NOT EXISTS (SELECT 1 FROM unnest(i.indclass) x(oid)
          JOIN pg_catalog.pg_opclass op ON op.oid = x.oid WHERE NOT op.opcdefault)
        AND NOT EXISTS (SELECT 1 FROM unnest(i.indoption) x(option) WHERE x.option <> 0) AS valid,
      am.amname AS method, pg_get_expr(i.indpred, i.indrelid) AS predicate
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public' AND c.relname IN (${Prisma.join(tables)})
  `);
  for (const required of requiredIndexes) {
    requireC5b(
      indexes.some(
        (i) =>
          i.table === required.table &&
          (!required.name || i.name === required.name) &&
          i.valid &&
          i.method === 'btree' &&
          i.unique === required.unique &&
          JSON.stringify(i.columns) === JSON.stringify(required.columns) &&
          c5bCheckShape(i.predicate ?? '') ===
            c5bCheckShape(required.predicate ?? ''),
      ),
      `index definition mismatch: ${required.table}`,
    );
  }
}

type Owner = {
  id: string;
  name: string;
  rfc: string;
  userId: string;
  email: string;
};
function fixtureOwners(): Owner[] {
  return ['A', 'B'].map((label) => {
    const id = randomUUID();
    return {
      id,
      name: `HC-C5B-${label}-${id}`,
      rfc: `C5B-${id}`,
      userId: randomUUID(),
      email: `hc-c5b-${label.toLowerCase()}-${id}@example.test`,
    };
  });
}
async function collisions(
  prisma: PrismaService,
  owners: readonly Owner[],
): Promise<void> {
  const ids = owners.map((o) => o.id);
  requireC5b(
    (await prisma.company.count({
      where: {
        OR: [
          { id: { in: ids } },
          { name: { in: owners.map((o) => o.name) } },
          { rfc: { in: owners.map((o) => o.rfc) } },
        ],
      },
    })) === 0,
    'Company marker collision',
  );
  requireC5b(
    (await prisma.user.count({
      where: {
        OR: [
          { id: { in: owners.map((o) => o.userId) } },
          { email: { in: owners.map((o) => o.email) } },
        ],
      },
    })) === 0,
    'User marker collision',
  );
  for (const table of tables.filter((t) => t !== 'Company')) {
    const [row] = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT count(*)::int AS count FROM ${Prisma.raw(`public."${table}"`)} WHERE "companyId" IN (${Prisma.join(ids)})
    `);
    requireC5b(row?.count === 0, `fixture tenant collision: ${table}`);
  }
}
async function accredited(
  prisma: PrismaService,
  owner: Owner,
): Promise<boolean> {
  const row = await prisma.company.findUnique({
    where: { id: owner.id },
    select: { id: true, name: true, rfc: true },
  });
  if (!row) return false;
  requireC5b(
    row.name === owner.name && row.rfc === owner.rfc,
    'Company ownership markers changed',
  );
  return true;
}

async function cleanup(
  prisma: PrismaService,
  owners: readonly Owner[],
  errors: Error[],
): Promise<void> {
  const ids: string[] = [];
  for (const owner of owners) {
    try {
      if (await accredited(prisma, owner)) ids.push(owner.id);
    } catch (error) {
      errors.push(sanitized(error, 'ownership recheck'));
    }
  }
  if (!ids.length) return;
  const attempt = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      errors.push(sanitized(error, name));
    }
  };
  await attempt('cleanup ConflictOverrides', () =>
    prisma.healthcareEquipmentAssignmentConflictOverride.deleteMany({
      where: { companyId: { in: ids } },
    }),
  );
  await attempt('cleanup Assignments', async () => {
    // Successors must be removed before their predecessors. Never chase an
    // external successor or broaden the accredited tenant predicate.
    let pending = await prisma.healthcareEquipmentAssignment.findMany({
      where: { companyId: { in: ids } },
      select: { id: true, replacesAssignmentId: true },
    });
    while (pending.length) {
      const predecessors = new Set(pending.map((a) => a.replacesAssignmentId));
      const leaves = pending
        .filter((a) => !predecessors.has(a.id))
        .map((a) => a.id);
      requireC5b(leaves.length, 'cyclic Assignment cleanup dependencies');
      await prisma.healthcareEquipmentAssignment.deleteMany({
        where: { id: { in: leaves }, companyId: { in: ids } },
      });
      pending = pending.filter((a) => !leaves.includes(a.id));
    }
  });
  for (const table of [
    'IdempotencyRecord',
    'HealthcareCaseRequirement',
    'HealthcareCase',
    'EquipmentAsset',
    'Product',
    'User',
  ]) {
    await attempt(`cleanup ${table}`, () =>
      prisma.$executeRaw(Prisma.sql`
      DELETE FROM ${Prisma.raw(`public."${table}"`)} WHERE "companyId" IN (${Prisma.join(ids)})
    `),
    );
  }
  // The DELETE itself also binds the accredited markers, not merely the UUID.
  for (const owner of owners.filter((o) => ids.includes(o.id))) {
    await attempt('cleanup Company', () =>
      prisma.company.deleteMany({
        where: { id: owner.id, name: owner.name, rfc: owner.rfc },
      }),
    );
  }
}
async function residue(
  prisma: PrismaService,
  attempted: readonly Owner[],
  errors: Error[],
): Promise<void> {
  // Read independently after cleanup errors; UUIDs/markers may authorize a
  // readback, but never authorize DELETE for unaccredited owners.
  if (!attempted.length) return;
  for (const table of tables) {
    try {
      const predicate =
        table === 'Company'
          ? Prisma.sql`"id" IN (${Prisma.join(attempted.map((o) => o.id))}) OR "rfc" IN (${Prisma.join(attempted.map((o) => o.rfc))}) OR "name" IN (${Prisma.join(attempted.map((o) => o.name))})`
          : table === 'User'
            ? Prisma.sql`"companyId" IN (${Prisma.join(attempted.map((o) => o.id))}) OR "id" IN (${Prisma.join(attempted.map((o) => o.userId))}) OR "email" IN (${Prisma.join(attempted.map((o) => o.email))})`
            : Prisma.sql`"companyId" IN (${Prisma.join(attempted.map((o) => o.id))})`;
      const [row] = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT count(*)::int AS count FROM ${Prisma.raw(`public."${table}"`)} WHERE ${predicate}
      `);
      requireC5b(row?.count === 0, `nonzero fixture residue: ${table}`);
    } catch (error) {
      errors.push(sanitized(error, `residue ${table}`));
    }
  }
}

export type C5bHarnessContext = {
  prisma: PrismaService;
  app: INestApplication<App>;
  owners: readonly Readonly<Owner>[];
  token: string;
  checkBoundary: () => Promise<void>;
};

// B1/B2 may reuse this lifetime without inheriting acceptance assertions from B0.
export async function withC5bHarness(
  operation: (context: C5bHarnessContext) => Promise<void>,
): Promise<void> {
  // Defense in depth for direct helper callers; importing it creates no client.
  if (process.env.RUN_HC_C5B_POSTGRES_TESTS !== '1') return;
  const errors: Error[] = [];
  const clients: RegisteredClient[] = [];
  const attempted: Owner[] = [];
  const owned: Owner[] = [];
  let app: INestApplication<App> | undefined;
  let moduleRef: TestingModule | undefined;
  let secretInstalled = false;
  let hadSecret = false;
  let previousSecret: string | undefined;
  let functionalStage = 'URL';
  const teardown: TeardownReport = {
    'app.close': 'SKIPPED_NO_APP',
    cleanup: 'SKIPPED_NO_FIXTURES',
    'cleanup.zero-residue': 'SKIPPED_NO_FIXTURES',
    'prisma.disconnect': 'SKIPPED_NO_CLIENT',
  };
  try {
    const url = c5bConnectionUrl(process.env.HC_C5B_DATABASE_URL);
    const prisma = await stage('client construction', () =>
      Promise.resolve(new C5bPrisma(url)),
    );
    const client: RegisteredClient = { prisma };
    clients.push(client); // Registered before the first connection attempt.
    await stage('connect', () => prisma.$connect());
    client.identity = await stage('identity', () => identity(prisma));
    await stage('role', () => checkRole(prisma));
    await stage('schema', () => checkSchema(prisma));
    await stage('ACL', () => checkAcl(prisma));
    await stage('functions', () => checkFunctions(prisma));
    await stage('exclusive preflight', () => boundary(clients));
    const owners = fixtureOwners();
    await stage('collision checks', () => collisions(prisma, owners));
    await stage('first INSERT boundary', () => boundary(clients));
    for (const owner of owners) {
      await stage('fixture boundary', () => boundary(clients));
      attempted.push(owner);
      // Even an uncertain INSERT result must be followed by accreditation. Both
      // errors are retained; only matching persisted markers authorize cleanup.
      try {
        await stage('Company INSERT', () =>
          prisma.company.create({
            data: { id: owner.id, name: owner.name, rfc: owner.rfc },
          }),
        );
      } catch (error) {
        errors.push(sanitized(error, 'Company INSERT'));
      }
      const isOwned = await stage('Company accreditation', () =>
        accredited(prisma, owner),
      );
      if (isOwned) owned.push(owner);
      requireC5b(
        isOwned && errors.length === 0,
        'Company setup incomplete',
        'fixture setup',
      );
      await stage('User INSERT', () =>
        prisma.user.create({
          data: {
            id: owner.userId,
            companyId: owner.id,
            email: owner.email,
            firstName: 'C5B',
            lastName: 'Smoke',
            passwordHash: 'not-a-login-credential',
            role: UserRole.ADMIN,
            isActive: true,
            authVersion: 0,
          },
        }),
      );
    }
    await stage('JWT setup boundary', () => boundary(clients));
    functionalStage = 'JWT setup';
    hadSecret = Object.hasOwn(process.env, 'JWT_SECRET');
    previousSecret = process.env.JWT_SECRET;
    const secret = `${randomUUID()}${randomUUID()}`;
    process.env.JWT_SECRET = secret;
    secretInstalled = true;
    moduleRef = await stage('Nest compile', () =>
      Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret, signOptions: { expiresIn: '10m' } }),
        ],
        controllers: [HealthcareEquipmentAssignmentsController],
        providers: [
          JwtStrategy,
          HealthcareEquipmentAssignmentsService,
          HealthcareEquipmentAssignmentsRepository,
          { provide: PrismaService, useValue: prisma },
          {
            provide: healthcareCompanyTransactionTimeoutConfiguration.KEY,
            useValue: {
              companyLockAcquisitionTimeoutMs: 2500,
              subsequentLockTimeoutMs: 1500,
              subsequentStatementTimeoutMs: 4000,
              prismaMaxWaitMs: 3000,
              prismaTransactionTimeoutMs: 20000,
            },
          },
        ],
      }).compile(),
    );
    functionalStage = 'Nest setup';
    requireC5b(
      moduleRef.get<PrismaService>(PrismaService) === prisma,
      'Nest Prisma identity mismatch',
      'Nest setup',
    );
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await stage('Nest init', () => app!.init());
    await stage('HTTP boundary', () => boundary(clients));
    const owner = owned[0];
    const user = await stage('persisted JWT actor', () =>
      prisma.user.findFirst({
        where: {
          id: owner.userId,
          companyId: owner.id,
          email: owner.email,
          isActive: true,
        },
        select: {
          id: true,
          companyId: true,
          email: true,
          role: true,
          authVersion: true,
        },
      }),
    );
    requireC5b(
      user && user.role === UserRole.ADMIN && user.authVersion === 0,
      'persisted actor mismatch',
      'persisted JWT actor',
    );
    functionalStage = 'JWT sign';
    const jwt = moduleRef.get(JwtService);
    const token = jwt.sign({
      sub: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role,
      authVersion: user.authVersion,
    });
    functionalStage = 'authenticated smoke';
    await operation({
      prisma,
      app,
      owners: Object.freeze(owned.map((owner) => Object.freeze({ ...owner }))),
      token,
      checkBoundary: () => stage('operation boundary', () => boundary(clients)),
    });
    await stage('post-HTTP boundary', () => boundary(clients));
  } catch (error) {
    errors.push(sanitized(error, functionalStage));
  } finally {
    // Close HTTP first so no in-flight request can race cleanup. The explicit
    // lifecycle overrides keep the one owned connection alive until disconnect.
    try {
      if (app) await app.close();
      else if (moduleRef) await moduleRef.close();
      if (app || moduleRef) teardown['app.close'] = 'PASS';
    } catch (error) {
      teardown['app.close'] = 'FAIL';
      errors.push(sanitized(error, 'app close'));
    } finally {
      if (secretInstalled) {
        if (hadSecret && previousSecret !== undefined)
          process.env.JWT_SECRET = previousSecret;
        else delete process.env.JWT_SECRET;
      }
    }
    const client = clients[0];
    if (client && attempted.length) {
      let safe = false;
      try {
        await boundary(clients);
        safe = true;
      } catch (error) {
        errors.push(sanitized(error, 'cleanup boundary'));
      }
      if (safe) {
        const beforeCleanup = errors.length;
        try {
          await cleanup(client.prisma, owned, errors);
        } catch (error) {
          errors.push(sanitized(error, 'cleanup'));
        }
        teardown.cleanup =
          errors.length > beforeCleanup
            ? 'FAIL'
            : owned.length
              ? 'PASS'
              : 'SKIPPED_NO_OWNERS';
      } else teardown.cleanup = 'SKIPPED_BOUNDARY';
      const beforeResidue = errors.length;
      try {
        await residue(client.prisma, attempted, errors);
      } catch (error) {
        errors.push(sanitized(error, 'residue'));
      }
      teardown['cleanup.zero-residue'] =
        errors.length > beforeResidue ? 'FAIL' : 'PASS';
    }
    if (clients.length) teardown['prisma.disconnect'] = 'PASS';
    for (const client of clients) {
      try {
        await client.prisma.$disconnect();
      } catch (error) {
        teardown['prisma.disconnect'] = 'FAIL';
        errors.push(sanitized(error, 'disconnect'));
      }
    }
  }
  if (errors.length) throw c5bFailure(errors, teardown);
}

export async function runC5bHarnessSmoke(): Promise<void> {
  await withC5bHarness(async ({ app, token }) => {
    const response = await stage('authenticated smoke', () =>
      supertest(app.getHttpServer())
        .get('/healthcare/equipment-assignments')
        .auth(token, { type: 'bearer' })
        .timeout({ response: 10000, deadline: 15000 }),
    );
    requireC5b(
      response.status === 200,
      'JWT smoke did not return HTTP 200',
      'authenticated smoke',
    );
  });
}

// Pinned from the checked-in requirement/assignment migrations and current
// Prisma unique keys at 478e0f0; no migration file is loaded during a run.
const requiredChecks = [
  {
    table: 'HealthcareCaseRequirement',
    name: 'HealthcareCaseRequirement_requestedQty_positive_check',
    expression: '"requestedQty" > 0',
  },
  {
    table: 'HealthcareCaseRequirement',
    name: 'HealthcareCaseRequirement_retirement_audit_check',
    expression:
      '( "retiredAt" IS NULL AND "retiredById" IS NULL AND "retirementReason" IS NULL ) OR ( "retiredAt" IS NOT NULL AND "retiredById" IS NOT NULL AND "retirementReason" IS NOT NULL AND btrim("retirementReason") <> \'\' )',
  },
  {
    table: 'HealthcareCaseRequirement',
    name: 'HealthcareCaseRequirement_reactivation_audit_check',
    expression:
      '("reactivatedAt" IS NULL AND "reactivatedById" IS NULL) OR ("reactivatedAt" IS NOT NULL AND "reactivatedById" IS NOT NULL)',
  },
  {
    table: 'HealthcareCaseRequirement',
    name: 'HealthcareRequirement_reactivation_requires_retirement_check',
    expression: '"reactivatedAt" IS NULL OR "retiredAt" IS NOT NULL',
  },
  {
    table: 'HealthcareCaseRequirement',
    name: 'HealthcareCaseRequirement_lifecycle_audit_check',
    expression:
      '( "lifecycle" = \'ACTIVE\' AND ( ( "retiredAt" IS NULL AND "reactivatedAt" IS NULL ) OR ( "retiredAt" IS NOT NULL AND "reactivatedAt" IS NOT NULL AND "reactivatedAt" >= "retiredAt" ) ) ) OR ( "lifecycle" = \'RETIRED\' AND "retiredAt" IS NOT NULL AND ( "reactivatedAt" IS NULL OR "retiredAt" >= "reactivatedAt" ) )',
  },
  {
    table: 'HealthcareEquipmentAssignment',
    name: 'HealthcareEquipmentAssignment_origin_check',
    expression:
      '( "origin" = \'REQUIREMENT\' AND "requirementId" IS NOT NULL AND "directAssignmentReason" IS NULL ) OR ( "origin" = \'DIRECT\' AND "requirementId" IS NULL AND "directAssignmentReason" IS NOT NULL AND btrim("directAssignmentReason") <> \'\' )',
  },
  {
    table: 'HealthcareEquipmentAssignment',
    name: 'HealthcareEquipmentAssignment_lifecycle_audit_check',
    expression:
      '( "lifecycle" = \'RESERVED\' AND "releasedAt" IS NULL AND "releasedById" IS NULL AND "releaseCause" IS NULL AND "releaseReason" IS NULL AND "replacedAt" IS NULL AND "replacedById" IS NULL AND "replacementReason" IS NULL ) OR ( "lifecycle" = \'RELEASED\' AND "releasedAt" IS NOT NULL AND "releasedById" IS NOT NULL AND "releaseCause" IS NOT NULL AND ("releaseReason" IS NULL OR btrim("releaseReason") <> \'\') AND ( "releaseCause" <> \'MANUAL\' OR ( "releaseReason" IS NOT NULL AND btrim("releaseReason") <> \'\' ) ) AND "replacedAt" IS NULL AND "replacedById" IS NULL AND "replacementReason" IS NULL ) OR ( "lifecycle" = \'REPLACED\' AND "releasedAt" IS NULL AND "releasedById" IS NULL AND "releaseCause" IS NULL AND "releaseReason" IS NULL AND "replacedAt" IS NOT NULL AND "replacedById" IS NOT NULL AND "replacementReason" IS NOT NULL AND btrim("replacementReason") <> \'\' )',
  },
  {
    table: 'HealthcareEquipmentAssignment',
    name: 'HealthcareEquipmentAssignment_replaces_not_self_check',
    expression:
      '"replacesAssignmentId" IS NULL OR "replacesAssignmentId" <> "id"',
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    name: 'HealthcareEquipmentAssignmentConflictOverride_distinct_check',
    expression: '"assignmentId" <> "conflictingAssignmentId"',
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    name: 'HealthcareEquipmentAssignmentConflictOverride_windows_check',
    expression:
      '"assignmentWindowStart" < "assignmentWindowEnd" AND "conflictingWindowStart" < "conflictingWindowEnd"',
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    name: 'HealthcareEquipmentAssignmentConflictOverride_reason_check',
    expression: 'btrim("reason") <> \'\'',
  },
  {
    table: 'HealthcareEquipmentAssignmentSettings',
    name: 'HealthcareEquipmentAssignmentSettings_buffers_nonnegative_check',
    expression: '"preCaseBufferMinutes" >= 0 AND "postCaseBufferMinutes" >= 0',
  },
];

const requiredIndexes: Array<{
  table: string;
  name?: string;
  columns: string[];
  unique: boolean;
  predicate: string | null;
}> = [
  {
    table: 'HealthcareCaseRequirement',
    columns: ['companyId', 'caseId', 'lifecycle', 'sortOrder'],
    unique: false,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['companyId', 'caseId', 'lifecycle'],
    unique: false,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['companyId', 'equipmentAssetId', 'lifecycle'],
    unique: false,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['companyId', 'requirementId', 'lifecycle'],
    unique: false,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['companyId', 'caseId', 'equipmentAssetId'],
    name: 'HealthcareEquipmentAssignment_reserved_case_asset_key',
    unique: true,
    predicate: '"lifecycle" = \'RESERVED\'',
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    columns: ['companyId', 'assignmentId', 'createdAt'],
    unique: false,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    columns: ['companyId', 'conflictingAssignmentId', 'createdAt'],
    unique: false,
    predicate: null,
  },
  {
    table: 'Product',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'Product',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'Product',
    columns: ['companyId', 'sku'],
    unique: true,
    predicate: null,
  },
  {
    table: 'Product',
    columns: ['companyId', 'barcode'],
    unique: true,
    predicate: null,
  },
  {
    table: 'Company',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'Company',
    columns: ['rfc'],
    unique: true,
    predicate: null,
  },
  {
    table: 'IdempotencyRecord',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'IdempotencyRecord',
    columns: ['companyId', 'scope', 'key'],
    name: 'IdempotencyRecord_companyId_scope_key_key',
    unique: true,
    predicate: null,
  },
  {
    table: 'User',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'User',
    columns: ['email'],
    unique: true,
    predicate: null,
  },
  {
    table: 'User',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCase',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCase',
    columns: ['companyId', 'folio'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCase',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCaseRequirement',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCaseRequirement',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCaseRequirement',
    columns: ['id', 'companyId', 'caseId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareCaseRequirement',
    columns: ['companyId', 'caseId', 'productId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'EquipmentAsset',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'EquipmentAsset',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'EquipmentAsset',
    columns: ['companyId', 'assetCode'],
    unique: true,
    predicate: null,
  },
  {
    table: 'EquipmentAsset',
    columns: ['companyId', 'productId', 'serialNumberKey'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['id', 'companyId', 'caseId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignment',
    columns: ['companyId', 'replacesAssignmentId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    columns: ['id'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignmentConflictOverride',
    columns: ['id', 'companyId'],
    unique: true,
    predicate: null,
  },
  {
    table: 'HealthcareEquipmentAssignmentSettings',
    columns: ['companyId'],
    unique: true,
    predicate: null,
  },
];
