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
  negativeSettingsCompanyIds: readonly [string, string];
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

const C5_RUN_FLAG = 'RUN_HC_C5_POSTGRES_TESTS';
const C5_CONNECTION_VARIABLE = 'HC_C5_DATABASE_URL';
const C5_EXPECTED_DATABASE = 'zaping_spike_test';
const C5_EXPECTED_USER = 'zaping_hc_c5';
const C5_EXPECTED_HOST = '127.0.0.1';
const C5_EXPECTED_HOST_PORT = '5434';
const C5_EXPECTED_SERVER_PORT = 5432;

const C5_REQUIRED_TABLES = [
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
] as const;

const C5_REQUIRED_COLUMNS_BY_TABLE = {
  Company: [
    'id',
    'name',
    'tradeName',
    'rfc',
    'email',
    'phone',
    'language',
    'timezone',
    'currency',
    'createdAt',
    'updatedAt',
  ],
  User: [
    'id',
    'companyId',
    'firstName',
    'lastName',
    'email',
    'passwordHash',
    'authVersion',
    'locale',
    'isActive',
    'role',
    'createdAt',
    'updatedAt',
  ],
  Product: [
    'id',
    'companyId',
    'sku',
    'name',
    'description',
    'brand',
    'categoryId',
    'barcode',
    'cost',
    'price',
    'stock',
    'minStock',
    'isActive',
    'inventoryTracking',
    'lotTracking',
    'createdAt',
    'updatedAt',
  ],
  HealthcareCase: [
    'id',
    'companyId',
    'doctorId',
    'hospitalId',
    'folio',
    'title',
    'procedureDescription',
    'status',
    'scheduledStart',
    'scheduledEnd',
    'responsibleUserId',
    'createdById',
    'cancelledAt',
    'cancelledById',
    'cancellationReason',
    'createdAt',
    'updatedAt',
  ],
  HealthcareCaseRequirement: [
    'id',
    'companyId',
    'caseId',
    'productId',
    'requestedQty',
    'type',
    'notes',
    'sortOrder',
    'lifecycle',
    'createdById',
    'retiredAt',
    'retiredById',
    'retirementReason',
    'reactivatedAt',
    'reactivatedById',
    'createdAt',
    'updatedAt',
  ],
  EquipmentAsset: [
    'id',
    'companyId',
    'productId',
    'assetCode',
    'serialNumber',
    'serialNumberKey',
    'lifecycle',
    'condition',
    'origin',
    'batchId',
    'purchaseReceiptItemId',
    'retiredAt',
    'retiredById',
    'retiredReason',
    'retirementNotes',
    'createdAt',
    'updatedAt',
  ],
  HealthcareEquipmentAssignment: [
    'id',
    'companyId',
    'caseId',
    'equipmentAssetId',
    'requirementId',
    'origin',
    'lifecycle',
    'replacesAssignmentId',
    'directAssignmentReason',
    'createdById',
    'releasedAt',
    'releasedById',
    'releaseCause',
    'releaseReason',
    'replacedAt',
    'replacedById',
    'replacementReason',
    'createdAt',
    'updatedAt',
  ],
  HealthcareEquipmentAssignmentConflictOverride: [
    'id',
    'companyId',
    'assignmentId',
    'conflictingAssignmentId',
    'assignmentWindowStart',
    'assignmentWindowEnd',
    'conflictingWindowStart',
    'conflictingWindowEnd',
    'approvedById',
    'reason',
    'createdAt',
  ],
  HealthcareEquipmentRequirementCoverageNote: [
    'id',
    'companyId',
    'requirementId',
    'kind',
    'comment',
    'recordedById',
    'createdAt',
    'resolvedAt',
    'resolvedById',
  ],
  HealthcareEquipmentAssignmentSettings: [
    'companyId',
    'preCaseBufferMinutes',
    'postCaseBufferMinutes',
    'createdAt',
    'updatedAt',
  ],
} as const;

const C5_REQUIRED_COLUMNS = (
  Object.entries(C5_REQUIRED_COLUMNS_BY_TABLE) as Array<
    [string, readonly string[]]
  >
).flatMap(([tableName, columnNames]) =>
  columnNames.map((columnName) => ({ tableName, columnName })),
);

const C5_REQUIRED_ENUMS = [
  'UserRole',
  'ProductInventoryTracking',
  'ProductLotTracking',
  'HealthcareCaseStatus',
  'HealthcareRequirementType',
  'HealthcareRequirementLifecycle',
  'EquipmentLifecycle',
  'EquipmentCondition',
  'EquipmentOrigin',
  'EquipmentRetirementReason',
  'HealthcareEquipmentAssignmentOrigin',
  'HealthcareEquipmentAssignmentLifecycle',
  'HealthcareEquipmentAssignmentReleaseCause',
  'HealthcareEquipmentRequirementCoverageNoteKind',
] as const;

const C5_ASSERTED_ENUM_NAMES = [
  'HealthcareEquipmentAssignmentLifecycle',
  'HealthcareEquipmentAssignmentOrigin',
  'HealthcareEquipmentAssignmentReleaseCause',
  'HealthcareEquipmentRequirementCoverageNoteKind',
] as const;

const C5_REQUIRED_IDEMPOTENCY_SCOPE_VALUES = [
  'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE',
  'HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE',
  'HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE',
] as const;

const C5_REQUIRED_CHECK_NAMES = [
  'HealthcareEquipmentAssignmentConflictOverride_distinct_check',
  'HealthcareEquipmentAssignmentConflictOverride_reason_check',
  'HealthcareEquipmentAssignmentConflictOverride_windows_check',
  'HealthcareEquipmentAssignmentSettings_buffers_nonnegative_check',
  'HealthcareEquipmentAssignment_lifecycle_audit_check',
  'HealthcareEquipmentAssignment_origin_check',
  'HealthcareEquipmentAssignment_replaces_not_self_check',
  'HealthcareEquipmentRequirementCoverageNote_comment_check',
  'HealthcareEquipmentRequirementCoverageNote_resolution_check',
] as const;

const C5_REQUIRED_FOREIGN_KEY_NAMES = [
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
] as const;

const C5_REQUIRED_INDEX_NAMES = [
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
] as const;

const C5_REQUIRED_FUNCTION_SIGNATURES = [
  'btrim(text)',
  'current_database()',
  'current_schema()',
  'current_setting(text)',
  'has_database_privilege(name,oid,text)',
  'has_function_privilege(name,oid,text)',
  'has_schema_privilege(name,oid,text)',
  'has_table_privilege(name,oid,text)',
  'has_type_privilege(name,oid,text)',
  'inet_server_addr()',
  'inet_server_port()',
  'pg_backend_pid()',
  'to_regprocedure(text)',
] as const;

class C5PreflightError extends Error {}
class C5CleanupError extends Error {}

type C5CompanyOwnershipMarker = {
  id: string;
  name: string;
  rfc: string;
};

function buildFixture(): Fixture {
  const companyIds = new Set<string>();

  while (companyIds.size < 4) {
    companyIds.add(randomUUID());
  }

  const [companyAId, companyBId, negativeSettingsAId, negativeSettingsBId] = [
    ...companyIds,
  ];

  return {
    companyAId,
    companyBId,
    negativeSettingsCompanyIds: [negativeSettingsAId, negativeSettingsBId],
    userAId: randomUUID(),
    userBId: randomUUID(),
  };
}

async function cleanupFixture(
  prisma: PrismaService,
  runCompanyIds: ReadonlySet<string>,
): Promise<void> {
  const companyIds = [...runCompanyIds];
  const cleanupOperations: Array<{
    tableName: string;
    execute: () => Promise<unknown>;
  }> = [
    {
      tableName: 'HealthcareEquipmentAssignmentConflictOverride',
      execute: () =>
        prisma.healthcareEquipmentAssignmentConflictOverride.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'HealthcareEquipmentRequirementCoverageNote',
      execute: () =>
        prisma.healthcareEquipmentRequirementCoverageNote.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'HealthcareEquipmentAssignment',
      execute: () =>
        prisma.healthcareEquipmentAssignment.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'HealthcareEquipmentAssignmentSettings',
      execute: () =>
        prisma.healthcareEquipmentAssignmentSettings.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'HealthcareCaseRequirement',
      execute: () =>
        prisma.healthcareCaseRequirement.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'HealthcareCase',
      execute: () =>
        prisma.healthcareCase.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'EquipmentAsset',
      execute: () =>
        prisma.equipmentAsset.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'Product',
      execute: () =>
        prisma.product.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'User',
      execute: () =>
        prisma.user.deleteMany({
          where: { companyId: { in: companyIds } },
        }),
    },
    {
      tableName: 'Company',
      execute: () =>
        prisma.company.deleteMany({
          where: { id: { in: companyIds } },
        }),
    },
  ];
  const cleanupErrors: unknown[] = [];

  for (const cleanup of cleanupOperations) {
    try {
      await cleanup.execute();
    } catch {
      cleanupErrors.push(
        new C5CleanupError(`C5 cleanup failed for ${cleanup.tableName}.`),
      );
    }
  }

  try {
    const counts = await readRunOwnedRecordCounts(prisma, companyIds);
    const remaining = counts.filter(({ count }) => count !== 0);

    if (remaining.length > 0) {
      throw new C5CleanupError(
        `C5 cleanup left run-owned records in: ${remaining
          .map(({ tableName, count }) => `${tableName}=${count}`)
          .join(', ')}.`,
      );
    }
  } catch (error) {
    cleanupErrors.push(
      error instanceof C5CleanupError
        ? error
        : new C5CleanupError('C5 cleanup readback failed.'),
    );
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      'Healthcare Equipment Assignment persistence fixture cleanup failed.',
    );
  }
}

async function readRunOwnedRecordCounts(
  prisma: PrismaService,
  companyIds: string[],
): Promise<Array<{ tableName: string; count: number }>> {
  const [
    conflictOverrides,
    coverageNotes,
    assignments,
    settings,
    requirements,
    cases,
    equipmentAssets,
    products,
    users,
    companies,
  ] = await Promise.all([
    prisma.healthcareEquipmentAssignmentConflictOverride.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareEquipmentRequirementCoverageNote.count({
      where: { companyId: { in: companyIds } },
    }),
    prisma.healthcareEquipmentAssignment.count({
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
    prisma.user.count({ where: { companyId: { in: companyIds } } }),
    prisma.company.count({ where: { id: { in: companyIds } } }),
  ]);

  return [
    {
      tableName: 'HealthcareEquipmentAssignmentConflictOverride',
      count: conflictOverrides,
    },
    {
      tableName: 'HealthcareEquipmentRequirementCoverageNote',
      count: coverageNotes,
    },
    { tableName: 'HealthcareEquipmentAssignment', count: assignments },
    { tableName: 'HealthcareEquipmentAssignmentSettings', count: settings },
    { tableName: 'HealthcareCaseRequirement', count: requirements },
    { tableName: 'HealthcareCase', count: cases },
    { tableName: 'EquipmentAsset', count: equipmentAssets },
    { tableName: 'Product', count: products },
    { tableName: 'User', count: users },
    { tableName: 'Company', count: companies },
  ];
}

async function assertReservedCompanyIdsAreUnused(
  prisma: PrismaService,
  reservedCompanyIds: ReadonlySet<string>,
): Promise<void> {
  const counts = await readRunOwnedRecordCounts(prisma, [
    ...reservedCompanyIds,
  ]);
  const occupiedTables = counts
    .filter(({ count }) => count !== 0)
    .map(({ tableName }) => tableName);

  if (occupiedTables.length > 0) {
    throw new C5PreflightError(
      `Reserved C5 Company IDs already have records in: ${occupiedTables.join(
        ', ',
      )}. Cleanup was not authorized.`,
    );
  }
}

async function accreditCompanyFixtureOwnership(
  prisma: PrismaService,
  expectedCompanies: ReadonlyMap<string, C5CompanyOwnershipMarker>,
  cleanupAuthorizedCompanyIds: Set<string>,
  requireEveryCompany: boolean,
): Promise<void> {
  let persistedCompanies: C5CompanyOwnershipMarker[];

  try {
    persistedCompanies = await prisma.company.findMany({
      where: { id: { in: [...expectedCompanies.keys()] } },
      select: { id: true, name: true, rfc: true },
    });
  } catch {
    throw new C5CleanupError(
      'C5 Company fixture ownership could not be verified safely.',
    );
  }

  const persistedById = new Map(
    persistedCompanies.map((company) => [company.id, company]),
  );
  let missingCompanies = 0;
  let conflictingCompanies = 0;

  for (const [companyId, expected] of expectedCompanies) {
    const persisted = persistedById.get(companyId);

    if (!persisted) {
      missingCompanies += 1;
      continue;
    }

    if (persisted.name !== expected.name || persisted.rfc !== expected.rfc) {
      conflictingCompanies += 1;
      continue;
    }

    cleanupAuthorizedCompanyIds.add(companyId);
  }

  if (conflictingCompanies > 0) {
    throw new C5CleanupError(
      'C5 Company fixture ownership conflicted with persisted data; cleanup was not authorized for those IDs.',
    );
  }

  if (requireEveryCompany && missingCompanies > 0) {
    throw new C5CleanupError(
      'C5 Company fixture ownership was not persisted for every successful INSERT.',
    );
  }
}

function requireC5ConnectionUrl(): URL {
  const rawDatabaseUrl = process.env[C5_CONNECTION_VARIABLE];

  if (!rawDatabaseUrl) {
    throw new Error(
      `${C5_CONNECTION_VARIABLE} is required when ${C5_RUN_FLAG}=1.`,
    );
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error(
      `${C5_CONNECTION_VARIABLE} must be a valid PostgreSQL URL.`,
    );
  }

  let databaseName: string;
  let databaseUser: string;

  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
    databaseUser = decodeURIComponent(databaseUrl.username);
  } catch {
    throw new Error(
      `${C5_CONNECTION_VARIABLE} contains invalid percent-encoding.`,
    );
  }

  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    databaseUrl.hostname !== C5_EXPECTED_HOST ||
    databaseUrl.port !== C5_EXPECTED_HOST_PORT ||
    databaseName !== C5_EXPECTED_DATABASE ||
    databaseUser !== C5_EXPECTED_USER ||
    !databaseUrl.password
  ) {
    throw new Error(
      `${C5_CONNECTION_VARIABLE} does not identify the authorized isolated C5 target.`,
    );
  }

  if (databaseUrl.search.length > 0 || databaseUrl.hash.length > 0) {
    throw new Error(
      `${C5_CONNECTION_VARIABLE} must not contain routing or connection-option overrides.`,
    );
  }

  return databaseUrl;
}

class ExplicitC5PrismaService extends PrismaService {
  constructor(datasourceUrl: string) {
    super({ datasourceUrl });
  }
}

function createC5Prisma(connectionUrl: URL): PrismaService {
  const clientUrl = new URL(connectionUrl.toString());
  clientUrl.searchParams.set('connection_limit', '1');
  clientUrl.searchParams.set('pool_timeout', '5');
  clientUrl.searchParams.set('connect_timeout', '5');

  try {
    return new ExplicitC5PrismaService(clientUrl.toString());
  } catch {
    throw new Error('Could not construct the isolated C5 Prisma client.');
  }
}

type C5DatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  serverAddress: string | null;
  serverPort: number;
  serverVersionNumber: string;
  currentSchema: string | null;
  backendPid: number;
};

async function readAndValidateC5Identity(
  prisma: PrismaService,
): Promise<C5DatabaseIdentity> {
  const [identity] = await prisma.$queryRaw<C5DatabaseIdentity[]>(Prisma.sql`
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
    identity.databaseName !== C5_EXPECTED_DATABASE ||
    identity.databaseUser !== C5_EXPECTED_USER ||
    !identity.serverAddress ||
    identity.serverPort !== C5_EXPECTED_SERVER_PORT ||
    identity.currentSchema !== 'public' ||
    !Number.isInteger(serverVersionNumber) ||
    serverVersionNumber < 160_000 ||
    serverVersionNumber >= 170_000 ||
    !Number.isSafeInteger(identity.backendPid) ||
    identity.backendPid <= 0
  ) {
    throw new C5PreflightError(
      'Connected PostgreSQL identity does not match the authorized isolated C5 target.',
    );
  }

  return identity;
}

function assertConsistentC5Identity(
  expected: C5DatabaseIdentity,
  actual: C5DatabaseIdentity,
): void {
  if (
    actual.databaseName !== expected.databaseName ||
    actual.databaseUser !== expected.databaseUser ||
    actual.serverAddress !== expected.serverAddress ||
    actual.serverPort !== expected.serverPort ||
    actual.serverVersionNumber !== expected.serverVersionNumber ||
    actual.currentSchema !== expected.currentSchema ||
    actual.backendPid !== expected.backendPid
  ) {
    throw new C5PreflightError(
      'C5 preflight queries did not remain on one consistent PostgreSQL backend.',
    );
  }
}

async function assertC5RoleIsNonAdministrative(
  prisma: PrismaService,
): Promise<void> {
  const [role] = await prisma.$queryRaw<
    Array<{
      canLogin: boolean;
      isSuperuser: boolean;
      canCreateDatabase: boolean;
      canCreateRole: boolean;
      canReplicate: boolean;
      canBypassRowLevelSecurity: boolean;
    }>
  >(Prisma.sql`
    SELECT
      rolcanlogin AS "canLogin",
      rolsuper AS "isSuperuser",
      rolcreatedb AS "canCreateDatabase",
      rolcreaterole AS "canCreateRole",
      rolreplication AS "canReplicate",
      rolbypassrls AS "canBypassRowLevelSecurity"
    FROM pg_roles
    WHERE rolname = current_user
  `);
  const inheritedAdministrativeRoles = await prisma.$queryRaw<
    Array<{ roleName: string }>
  >(Prisma.sql`
    WITH RECURSIVE inherited_roles("roleOid") AS (
      SELECT membership.roleid
      FROM pg_auth_members AS membership
      JOIN pg_roles AS member_role ON member_role.oid = membership.member
      WHERE member_role.rolname = current_user
      UNION
      SELECT membership.roleid
      FROM pg_auth_members AS membership
      JOIN inherited_roles
        ON inherited_roles."roleOid" = membership.member
    )
    SELECT inherited_role.rolname AS "roleName"
    FROM inherited_roles
    JOIN pg_roles AS inherited_role
      ON inherited_role.oid = inherited_roles."roleOid"
    WHERE inherited_role.rolsuper
       OR inherited_role.rolcreatedb
       OR inherited_role.rolcreaterole
       OR inherited_role.rolreplication
       OR inherited_role.rolbypassrls
  `);

  if (
    !role?.canLogin ||
    role.isSuperuser ||
    role.canCreateDatabase ||
    role.canCreateRole ||
    role.canReplicate ||
    role.canBypassRowLevelSecurity ||
    inheritedAdministrativeRoles.length > 0
  ) {
    throw new C5PreflightError(
      'The isolated C5 database role is administrative.',
    );
  }
}

type C5SchemaAclSubstageCode =
  | 'C5PF-03A-BASE-ACL'
  | 'C5PF-03B-TABLE-CATALOG'
  | 'C5PF-03C-COLUMN-CATALOG'
  | 'C5PF-03D-TABLE-ACL'
  | 'C5PF-03E-ENUM-USAGE'
  | 'C5PF-03F-FUNCTION-EXECUTE'
  | 'C5PF-03G-CONSTRAINT-CATALOG'
  | 'C5PF-03H-INDEX-CATALOG'
  | 'C5PF-03I-IDEMPOTENCY-SCOPE';

async function runC5SchemaAclSubstage<T>(
  code: C5SchemaAclSubstageCode,
  substage: () => T | Promise<T>,
): Promise<T> {
  try {
    return await substage();
  } catch (error) {
    if (error instanceof C5PreflightError) {
      throw new C5PreflightError(`[${code}] ${error.message}`);
    }

    throw new C5PreflightError(
      `[${code}] The isolated C5 schema and ACL substage could not complete safely.`,
    );
  }
}

async function assertC5SchemaAndPrivileges(
  prisma: PrismaService,
): Promise<void> {
  const [basePrivileges] = await runC5SchemaAclSubstage(
    'C5PF-03A-BASE-ACL',
    () =>
      prisma.$queryRaw<
        Array<{ canConnect: boolean; canUseSchema: boolean }>
      >(Prisma.sql`
        SELECT
          COALESCE(
            has_database_privilege(current_user, database.oid, 'CONNECT'),
            false
          ) AS "canConnect",
          COALESCE(
            has_schema_privilege(current_user, namespace.oid, 'USAGE'),
            false
          ) AS "canUseSchema"
        FROM pg_database AS database
        CROSS JOIN pg_namespace AS namespace
        WHERE database.datname = ${C5_EXPECTED_DATABASE}
          AND namespace.nspname = 'public'
      `),
  );

  if (!basePrivileges?.canConnect || !basePrivileges.canUseSchema) {
    throw new C5PreflightError(
      'C5 database or schema privilege preflight failed.',
    );
  }

  const tableRows = await runC5SchemaAclSubstage('C5PF-03B-TABLE-CATALOG', () =>
    prisma.$queryRaw<
      Array<{ tableName: string; tableOid: string | null }>
    >(Prisma.sql`
        SELECT
          required."tableName",
          relation.oid::text AS "tableOid"
        FROM (
          VALUES ${Prisma.join(
            C5_REQUIRED_TABLES.map((tableName) => Prisma.sql`(${tableName})`),
          )}
        ) AS required("tableName")
        LEFT JOIN pg_namespace AS namespace
          ON namespace.nspname = 'public'
        LEFT JOIN pg_class AS relation
          ON relation.relnamespace = namespace.oid
          AND relation.relname = required."tableName"
          AND relation.relkind IN ('r', 'p')
      `),
  );
  const missingTables = tableRows
    .filter(({ tableOid }) => tableOid === null)
    .map(({ tableName }) => tableName);

  const columnRows = await runC5SchemaAclSubstage(
    'C5PF-03C-COLUMN-CATALOG',
    () =>
      prisma.$queryRaw<
        Array<{ tableName: string; columnName: string; exists: boolean }>
      >(Prisma.sql`
        SELECT
          required."tableName",
          required."columnName",
          attribute.attnum IS NOT NULL AS "exists"
        FROM (
          VALUES ${Prisma.join(
            C5_REQUIRED_COLUMNS.map(
              ({ tableName, columnName }) =>
                Prisma.sql`(${tableName}, ${columnName})`,
            ),
          )}
        ) AS required("tableName", "columnName")
        LEFT JOIN pg_namespace AS namespace
          ON namespace.nspname = 'public'
        LEFT JOIN pg_class AS relation
          ON relation.relnamespace = namespace.oid
          AND relation.relname = required."tableName"
        LEFT JOIN pg_attribute AS attribute
          ON attribute.attrelid = relation.oid
          AND attribute.attname = required."columnName"
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
      `),
  );
  const missingColumns = columnRows
    .filter((row) => !row.exists)
    .map((row) => `${row.tableName}.${row.columnName}`);

  const requiredTablePrivileges = C5_REQUIRED_TABLES.flatMap((tableName) =>
    ['SELECT', 'INSERT', 'DELETE'].map((privilege) => ({
      tableName,
      privilege,
    })),
  );
  const tablePrivilegeRows = await runC5SchemaAclSubstage(
    'C5PF-03D-TABLE-ACL',
    () =>
      prisma.$queryRaw<
        Array<{ tableName: string; privilege: string; allowed: boolean }>
      >(Prisma.sql`
        SELECT
          required."tableName",
          required."privilege",
          COALESCE(
            has_table_privilege(
              current_user,
              relation.oid,
              required."privilege"
            ),
            false
          ) AS "allowed"
        FROM (
          VALUES ${Prisma.join(
            requiredTablePrivileges.map(
              ({ tableName, privilege }) =>
                Prisma.sql`(${tableName}, ${privilege})`,
            ),
          )}
        ) AS required("tableName", "privilege")
        LEFT JOIN pg_namespace AS namespace
          ON namespace.nspname = 'public'
        LEFT JOIN pg_class AS relation
          ON relation.relnamespace = namespace.oid
          AND relation.relname = required."tableName"
      `),
  );
  const missingTablePrivileges = tablePrivilegeRows
    .filter((row) => !row.allowed)
    .map((row) => `${row.tableName} ${row.privilege}`);

  const enumRows = await runC5SchemaAclSubstage('C5PF-03E-ENUM-USAGE', () =>
    prisma.$queryRaw<
      Array<{ typeName: string; typeOid: string | null; canUse: boolean }>
    >(Prisma.sql`
        SELECT
          required."typeName",
          enum_type.oid::text AS "typeOid",
          COALESCE(
            has_type_privilege(current_user, enum_type.oid, 'USAGE'),
            false
          ) AS "canUse"
        FROM (
          VALUES ${Prisma.join(
            C5_REQUIRED_ENUMS.map((typeName) => Prisma.sql`(${typeName})`),
          )}
        ) AS required("typeName")
        LEFT JOIN pg_namespace AS namespace
          ON namespace.nspname = 'public'
        LEFT JOIN pg_type AS enum_type
          ON enum_type.typnamespace = namespace.oid
          AND enum_type.typname = required."typeName"
          AND enum_type.typtype = 'e'
      `),
  );
  const missingEnumsOrUsage = enumRows
    .filter((row) => row.typeOid === null || !row.canUse)
    .map((row) => row.typeName);

  const functionRows = await runC5SchemaAclSubstage(
    'C5PF-03F-FUNCTION-EXECUTE',
    () =>
      prisma.$queryRaw<
        Array<{
          signature: string;
          functionOid: string | null;
          canExecute: boolean;
        }>
      >(Prisma.sql`
        SELECT
          required."signature",
          resolved."functionOid"::text AS "functionOid",
          COALESCE(
            has_function_privilege(
              current_user,
              resolved."functionOid",
              'EXECUTE'
            ),
            false
          ) AS "canExecute"
        FROM (
          VALUES ${Prisma.join(
            C5_REQUIRED_FUNCTION_SIGNATURES.map(
              (signature) => Prisma.sql`(${signature})`,
            ),
          )}
        ) AS required("signature")
        CROSS JOIN LATERAL (
          SELECT to_regprocedure(
            'pg_catalog.' || required."signature"
          ) AS "functionOid"
        ) AS resolved
      `),
  );
  const missingFunctionsOrExecute = functionRows
    .filter((row) => row.functionOid === null || !row.canExecute)
    .map((row) => row.signature);

  const requiredConstraintNames = [
    ...C5_REQUIRED_CHECK_NAMES,
    ...C5_REQUIRED_FOREIGN_KEY_NAMES,
  ];
  const constraintRows = await runC5SchemaAclSubstage(
    'C5PF-03G-CONSTRAINT-CATALOG',
    () =>
      prisma.$queryRaw<
        Array<{ conname: string; contype: string; confdeltype: string }>
      >(
        Prisma.sql`
          SELECT
            catalog_constraint.conname,
            catalog_constraint.contype::text AS contype,
            catalog_constraint.confdeltype::text AS confdeltype
          FROM pg_constraint AS catalog_constraint
          JOIN pg_namespace AS namespace
            ON namespace.oid = catalog_constraint.connamespace
          WHERE namespace.nspname = 'public'
            AND catalog_constraint.conname = ANY(${requiredConstraintNames})
        `,
      ),
  );
  const presentConstraintNames = new Set(
    constraintRows.map(({ conname }) => conname),
  );
  const missingConstraints = requiredConstraintNames.filter(
    (constraintName) => !presentConstraintNames.has(constraintName),
  );
  const checkNameSet = new Set<string>(C5_REQUIRED_CHECK_NAMES);
  const invalidConstraints = constraintRows
    .filter((constraint) =>
      checkNameSet.has(constraint.conname)
        ? constraint.contype !== 'c'
        : constraint.contype !== 'f' || constraint.confdeltype !== 'r',
    )
    .map(({ conname }) => conname);

  const indexRows = await runC5SchemaAclSubstage('C5PF-03H-INDEX-CATALOG', () =>
    prisma.$queryRaw<Array<{ indexname: string }>>(
      Prisma.sql`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = ANY(${C5_REQUIRED_INDEX_NAMES})
        `,
    ),
  );
  const presentIndexNames = new Set(
    indexRows.map(({ indexname }) => indexname),
  );
  const missingIndexes = C5_REQUIRED_INDEX_NAMES.filter(
    (indexName) => !presentIndexNames.has(indexName),
  );

  const idempotencyScopeRows = await runC5SchemaAclSubstage(
    'C5PF-03I-IDEMPOTENCY-SCOPE',
    () =>
      prisma.$queryRaw<Array<{ enumlabel: string }>>(Prisma.sql`
        SELECT enum_value.enumlabel
        FROM pg_enum AS enum_value
        JOIN pg_type AS enum_type ON enum_type.oid = enum_value.enumtypid
        JOIN pg_namespace AS namespace ON namespace.oid = enum_type.typnamespace
        WHERE namespace.nspname = 'public'
          AND enum_type.typname = 'IdempotencyScope'
          AND enum_value.enumlabel = ANY(${C5_REQUIRED_IDEMPOTENCY_SCOPE_VALUES})
      `),
  );
  const presentIdempotencyScopes = new Set(
    idempotencyScopeRows.map(({ enumlabel }) => enumlabel),
  );
  const missingIdempotencyScopes = C5_REQUIRED_IDEMPOTENCY_SCOPE_VALUES.filter(
    (scope) => !presentIdempotencyScopes.has(scope),
  );

  const failures = [
    ...missingTables.map((name) => `table ${name}`),
    ...missingColumns.map((name) => `column ${name}`),
    ...missingTablePrivileges.map((name) => `privilege ${name}`),
    ...missingEnumsOrUsage.map((name) => `enum/USAGE ${name}`),
    ...missingFunctionsOrExecute.map((name) => `function/EXECUTE ${name}`),
    ...missingConstraints.map((name) => `constraint ${name}`),
    ...invalidConstraints.map((name) => `constraint definition ${name}`),
    ...missingIndexes.map((name) => `index ${name}`),
    ...missingIdempotencyScopes.map((name) => `enum value ${name}`),
  ];

  if (
    tableRows.length !== C5_REQUIRED_TABLES.length ||
    columnRows.length !== C5_REQUIRED_COLUMNS.length ||
    tablePrivilegeRows.length !== requiredTablePrivileges.length ||
    enumRows.length !== C5_REQUIRED_ENUMS.length ||
    functionRows.length !== C5_REQUIRED_FUNCTION_SIGNATURES.length ||
    failures.length > 0
  ) {
    throw new C5PreflightError(
      `C5 schema and privilege preflight failed for: ${
        failures.join(', ') || 'unknown target'
      }.`,
    );
  }
}

async function assertC5ExclusiveAvailability(
  prisma: PrismaService,
  ownBackendPid: number,
): Promise<void> {
  const otherSessions = await prisma.$queryRaw<Array<{ pid: number }>>(
    Prisma.sql`
      SELECT pid::int AS "pid"
      FROM pg_stat_activity
      WHERE datname = ${C5_EXPECTED_DATABASE}
        AND backend_type = 'client backend'
        AND pid <> ${ownBackendPid}::integer
    `,
  );

  if (otherSessions.length > 0) {
    throw new C5PreflightError(
      `Isolated C5 target has ${otherSessions.length} unrelated client session(s); exclusive availability is required.`,
    );
  }
}

type C5PreflightStageCode =
  | 'C5PF-01-IDENTITY'
  | 'C5PF-02-ROLE'
  | 'C5PF-03-SCHEMA-ACL'
  | 'C5PF-04-BACKEND-CONSISTENCY'
  | 'C5PF-05-SESSIONS'
  | 'C5PF-06-FIXTURE-COLLISION';

async function runC5PreflightStage<T>(
  code: C5PreflightStageCode,
  stage: () => T | Promise<T>,
): Promise<T> {
  try {
    return await stage();
  } catch (error) {
    if (error instanceof C5PreflightError) {
      throw new C5PreflightError(`[${code}] ${error.message}`);
    }

    throw new C5PreflightError(
      `[${code}] The isolated C5 PostgreSQL preflight stage could not complete safely.`,
    );
  }
}

async function runC5Preflight(
  prisma: PrismaService,
  reservedCompanyIds: ReadonlySet<string>,
): Promise<void> {
  const initialIdentity = await runC5PreflightStage('C5PF-01-IDENTITY', () =>
    readAndValidateC5Identity(prisma),
  );
  await runC5PreflightStage('C5PF-02-ROLE', () =>
    assertC5RoleIsNonAdministrative(prisma),
  );
  await runC5PreflightStage('C5PF-03-SCHEMA-ACL', () =>
    assertC5SchemaAndPrivileges(prisma),
  );
  await runC5PreflightStage('C5PF-04-BACKEND-CONSISTENCY', async () => {
    const confirmedIdentity = await readAndValidateC5Identity(prisma);
    assertConsistentC5Identity(initialIdentity, confirmedIdentity);
  });
  await runC5PreflightStage('C5PF-05-SESSIONS', () =>
    assertC5ExclusiveAvailability(prisma, initialIdentity.backendPid),
  );
  await runC5PreflightStage('C5PF-06-FIXTURE-COLLISION', () =>
    assertReservedCompanyIdsAreUnused(prisma, reservedCompanyIds),
  );
}

const runC5PostgresTests = process.env[C5_RUN_FLAG] === '1';
const c5ConnectionUrl = runC5PostgresTests ? requireC5ConnectionUrl() : null;

(runC5PostgresTests ? describe : describe.skip)(
  'Healthcare Equipment Assignment PostgreSQL persistence integrity',
  () => {
    let prisma!: PrismaService;
    const fixture = buildFixture();
    const reservedCompanyIds = new Set([
      fixture.companyAId,
      fixture.companyBId,
      ...fixture.negativeSettingsCompanyIds,
    ]);
    const cleanupAuthorizedCompanyIds = new Set<string>();
    const attemptedCompanyFixtures = new Map<
      string,
      C5CompanyOwnershipMarker
    >();
    let databaseConnected = false;

    const insertCompanyFixturesWithOwnership = async (
      companies: readonly C5CompanyOwnershipMarker[],
      insert: () => Promise<unknown>,
      validateResult: (result: unknown) => boolean = () => true,
    ): Promise<void> => {
      const expectedCompanies = new Map(
        companies.map((company) => [company.id, company]),
      );
      for (const company of companies) {
        attemptedCompanyFixtures.set(company.id, company);
      }

      const errors: unknown[] = [];
      let insertSucceeded = false;

      try {
        const result = await insert();
        insertSucceeded = validateResult(result);
        if (!insertSucceeded) {
          errors.push(
            new Error('C5 Company fixture INSERT returned an invalid result.'),
          );
        }
      } catch {
        errors.push(new Error('C5 Company fixture INSERT failed.'));
      }

      try {
        await accreditCompanyFixtureOwnership(
          prisma,
          expectedCompanies,
          cleanupAuthorizedCompanyIds,
          insertSucceeded,
        );
      } catch (error) {
        errors.push(error);
      }

      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          'C5 Company fixture creation or ownership verification failed.',
        );
      }
    };

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
      if (!c5ConnectionUrl) {
        throw new Error('The isolated C5 connection was not configured.');
      }

      prisma = createC5Prisma(c5ConnectionUrl);
      try {
        await prisma.$connect();
      } catch {
        throw new Error(
          'Could not connect to the authorized isolated C5 PostgreSQL target.',
        );
      }
      databaseConnected = true;
      await runC5Preflight(prisma, reservedCompanyIds);

      const suffix = randomUUID();
      const baseCompanies = [
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
      ];

      await insertCompanyFixturesWithOwnership(
        baseCompanies,
        () => prisma.company.createMany({ data: baseCompanies }),
        (result) =>
          typeof result === 'object' &&
          result !== null &&
          'count' in result &&
          result.count === baseCompanies.length,
      );
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
      const teardownErrors: unknown[] = [];

      try {
        if (databaseConnected && attemptedCompanyFixtures.size > 0) {
          cleanupAuthorizedCompanyIds.clear();
          try {
            await accreditCompanyFixtureOwnership(
              prisma,
              attemptedCompanyFixtures,
              cleanupAuthorizedCompanyIds,
              false,
            );
          } catch (error) {
            teardownErrors.push(error);
          }

          if (cleanupAuthorizedCompanyIds.size > 0) {
            await cleanupFixture(prisma, cleanupAuthorizedCompanyIds);
          }
        }
      } catch (error) {
        teardownErrors.push(error);
      }

      try {
        if (prisma) {
          await prisma.$disconnect();
        }
      } catch {
        teardownErrors.push(
          new Error('Disconnecting the isolated C5 Prisma client failed.'),
        );
      }

      if (teardownErrors.length > 0) {
        throw new AggregateError(
          teardownErrors,
          'Healthcare Equipment Assignment persistence teardown failed.',
        );
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
      {
        companyId: fixture.negativeSettingsCompanyIds[0],
        preCaseBufferMinutes: -1,
        postCaseBufferMinutes: 0,
      },
      {
        companyId: fixture.negativeSettingsCompanyIds[1],
        preCaseBufferMinutes: 0,
        postCaseBufferMinutes: -1,
      },
    ])('rechaza settings negativos: %o', async ({ companyId, ...buffers }) => {
      const company = {
        id: companyId,
        name: `HC-EA Settings ${companyId}`,
        rfc: `EAS${companyId.replaceAll('-', '').slice(0, 10)}`,
      };

      await insertCompanyFixturesWithOwnership([company], () =>
        prisma.company.create({ data: company }),
      );

      await expect(
        prisma.healthcareEquipmentAssignmentSettings.create({
          data: { companyId, ...buffers },
        }),
      ).rejects.toBeDefined();
    });

    it('instala enums, CHECKs, unique/index y FKs RESTRICT esperados', async () => {
      const enumNames = [...C5_ASSERTED_ENUM_NAMES];
      const checkNames = [...C5_REQUIRED_CHECK_NAMES];
      const foreignKeyNames = [...C5_REQUIRED_FOREIGN_KEY_NAMES];
      const indexNames = [...C5_REQUIRED_INDEX_NAMES];
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
        expect.arrayContaining([...C5_REQUIRED_IDEMPOTENCY_SCOPE_VALUES]),
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
