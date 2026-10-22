import { PrismaClient } from '@prisma/client';

export const ORCHESTRATION_QA_MARKER =
  'HC-DSP-COR-01C-B isolated QA authorized';

export function orchestrationQaUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (
    env.RUN_CASE_DISPATCH_CORRECTION_ORCHESTRATION_POSTGRES !== '1' ||
    env.HC_DSP_COR_01C_B_DATABASE_AUTHORIZATION !== ORCHESTRATION_QA_MARKER ||
    !env.CASE_DISPATCH_CORRECTION_ORCHESTRATION_TEST_RUN
  ) {
    throw new Error('HC-DSP-COR-01C-B PostgreSQL not explicitly authorized');
  }
  // Never fall back to DATABASE_URL or dotenv.
  const url = new URL(
    env.CASE_DISPATCH_CORRECTION_ORCHESTRATION_TEST_DATABASE_URL!,
  );
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5437' ||
    url.pathname !== '/zaping_hc_dsp_cor_01c_b_test' ||
    url.username !== 'hc_dsp_cor_01c_b_test' ||
    [...url.searchParams.keys()].some((key) => key !== 'connection_limit')
  ) {
    throw new Error('Unverified HC-DSP-COR-01C-B PostgreSQL target');
  }
  return url.toString();
}

// Run before fixtures. All database operations in this preflight are read only.
export async function verifyOrchestrationQaDatabase(db: PrismaClient) {
  const rows = await db.$queryRaw<
    {
      database: string;
      role: string;
      version: number;
      marker: string | null;
      owner: string;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }[]
  >`SELECT current_database() AS database, current_user AS role,
      current_setting('server_version_num')::integer AS version,
      shobj_description(d.oid,'pg_database') AS marker,
      pg_get_userbyid(d.datdba) AS owner,
      r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls
    FROM pg_database d JOIN pg_roles r ON r.rolname=current_user
    WHERE d.datname=current_database()`;
  const target = rows[0];
  if (
    rows.length !== 1 ||
    target.database !== 'zaping_hc_dsp_cor_01c_b_test' ||
    target.role !== 'hc_dsp_cor_01c_b_test' ||
    target.owner !== target.role ||
    target.version < 160000 ||
    target.version >= 170000 ||
    target.marker !== ORCHESTRATION_QA_MARKER ||
    target.rolsuper ||
    target.rolcreatedb ||
    target.rolcreaterole ||
    target.rolreplication ||
    target.rolbypassrls
  ) {
    throw new Error('Unverified HC-DSP-COR-01C-B database identity/isolation');
  }
  const [schema] = await db.$queryRaw<{ has_company: boolean }[]>`
    SELECT to_regclass('public."Company"') IS NOT NULL AS has_company`;
  const foreignCompanies = schema.has_company
    ? await db.company.count({
        where: { name: { not: 'HC-DSP-COR-01C-B QA' } },
      })
    : 0;
  if (foreignCompanies !== 0)
    throw new Error('Database contains non-ticket companies');
  return {
    database: target.database,
    role: target.role,
    version: target.version,
    marker: target.marker,
  };
}
