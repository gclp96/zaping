import { Prisma, PrismaClient } from '@prisma/client';

// Proposed target only. No provisioning, dotenv, fallback URL, cleanup or migration.
export const EQUIPMENT_QA_MARKER = 'HC-DSP-COR-01D isolated QA authorized';
export const EQUIPMENT_QA_DATABASE = 'zaping_hc_dsp_cor_01d_test';
export const EQUIPMENT_QA_ROLE = 'hc_dsp_cor_01d_test';

export function equipmentQaConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const runId = env.HC_DSP_COR_01D_TEST_RUN;
  if (
    env.RUN_CASE_DISPATCH_CORRECTION_EQUIPMENT_POSTGRES !== '1' ||
    env.HC_DSP_COR_01D_DATABASE_AUTHORIZATION !== EQUIPMENT_QA_MARKER ||
    !runId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      runId,
    )
  )
    throw new Error(
      '01D PostgreSQL requires explicit authorization and a fresh run UUID',
    );
  const value = env.HC_DSP_COR_01D_TEST_DATABASE_URL;
  if (!value)
    throw new Error('01D dedicated URL required; no DATABASE_URL fallback');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid 01D dedicated URL');
  }
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5439' ||
    url.pathname !== '/' + EQUIPMENT_QA_DATABASE ||
    url.username !== EQUIPMENT_QA_ROLE ||
    !url.password ||
    url.hash ||
    [...url.searchParams.keys()].some((k) => k !== 'connection_limit') ||
    url.searchParams.getAll('connection_limit').length > 1 ||
    (url.searchParams.has('connection_limit') &&
      url.searchParams.get('connection_limit') !== '1')
  )
    throw new Error(
      'Unverified 01D target/options; proposed identifiers are not authorization',
    );
  url.searchParams.set('connection_limit', '1');
  return { url: url.toString(), runId };
}

// Every SQL statement in preflight runs in a READ ONLY transaction. Fail closed
// on ANY application data, including rows with familiar Company names from B.
export async function verifyEquipmentQaDatabase(
  db: PrismaClient,
  ownedPids: ReadonlySet<number>,
  requireEmpty: boolean,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const rows = await tx.$queryRaw<
        {
          database: string;
          role: string;
          session_role: string;
          owner: string;
          version: number;
          marker: string | null;
          host: string;
          port: number;
          pid: number;
          dangerous: boolean;
        }[]
      >`SELECT current_database() AS database, current_user AS role,
      session_user AS session_role, pg_get_userbyid(d.datdba) AS owner,
      current_setting('server_version_num')::integer AS version,
      shobj_description(d.oid,'pg_database') AS marker,
      host(inet_server_addr()) AS host, inet_server_port() AS port,
      pg_backend_pid() AS pid,
      EXISTS (SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER')
        AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
          OR r.rolname IN ('pg_execute_server_program','pg_read_server_files','pg_write_server_files','pg_signal_backend','pg_read_all_data','pg_write_all_data'))) AS dangerous
      FROM pg_database d WHERE d.datname=current_database()`;
      const t = rows[0];
      // The strict URL pins the external endpoint to 127.0.0.1:5439.
      // PostgreSQL reports its internal Docker address/port (typically 5432),
      // not the published endpoint; retain those as diagnostics, not identity.
      if (
        rows.length !== 1 ||
        t.database !== EQUIPMENT_QA_DATABASE ||
        t.role !== EQUIPMENT_QA_ROLE ||
        t.session_role !== t.role ||
        t.owner !== t.role ||
        t.version < 160000 ||
        t.version >= 170000 ||
        t.marker !== EQUIPMENT_QA_MARKER ||
        t.dangerous
      )
        throw new Error(
          '01D database identity/version/privileges/marker rejected',
        );
      const sessions = await tx.$queryRaw<{ pid: number }[]>`
      SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND pid<>pg_backend_pid() AND backend_type='client backend'`;
      if (sessions.some((s) => !ownedPids.has(s.pid)))
        throw new Error(
          '01D target has an unowned session; exclusive QA not established',
        );
      const tables = await tx.$queryRaw<
        { schema: string; name: string; kind: string }[]
      >`
      SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('r','p','f') AND n.nspname NOT LIKE 'pg_%'
        AND n.nspname<>'information_schema' ORDER BY n.nspname,c.relname`;
      const required = [
        'Company',
        'IdempotencyRecord',
        'InventoryPosition',
        'InventoryPhysicalEffect',
        'InventoryPhysicalEffectLine',
        'HealthcareCaseDispatchCorrection',
        'HealthcareCaseDispatchCorrectionItem',
        'EquipmentAsset',
        'EquipmentAssetCustody',
        'EquipmentAssetPhysicalEvent',
        'HealthcareEquipmentAssignment',
        'HealthcareCaseReconciliation',
        'HealthcareCaseReconciliationItem',
      ];
      if (
        tables.some((t) => t.schema !== 'public' || t.kind === 'f') ||
        required.some((name) => !tables.some((t) => t.name === name))
      )
        throw new Error(
          '01D schema unverified; migrations must be prepared separately',
        );
      for (const table of tables) {
        const identifier = '"public"."' + table.name.replace(/"/g, '""') + '"';
        const [rights] = await tx.$queryRaw<{ allowed: boolean }[]>`
        SELECT has_table_privilege(current_user,${identifier},'SELECT') AND
          has_table_privilege(current_user,${identifier},'INSERT') AND
          has_table_privilege(current_user,${identifier},'UPDATE') AS allowed`;
        if (!rights.allowed)
          throw new Error('01D required table privileges missing');
        if (requireEmpty && table.name !== '_prisma_migrations') {
          // Identifier comes only from the server catalog and is quoted, never URL input.
          const [data] = await tx.$queryRaw<{ occupied: boolean }[]>(Prisma.sql`
          SELECT EXISTS(SELECT 1 FROM ${Prisma.raw(identifier)} LIMIT 1) AS occupied`);
          if (data.occupied)
            throw new Error(
              '01D database is not empty; no cleanup is performed',
            );
        }
      }
      return {
        pid: t.pid,
        version: t.version,
        database: t.database,
        role: t.role,
        serverAddress: t.host,
        serverPort: t.port,
      };
    },
    { isolationLevel: 'ReadCommitted', timeout: 15000 },
  );
}
