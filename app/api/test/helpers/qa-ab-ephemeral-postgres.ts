import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// Local QA is authorized only by the launcher which owns a fresh tmpfs container.
// The CI-only paths in existing suites are unchanged. Never read dotenv here.
export async function openQaAbPostgres(): Promise<PrismaClient> {
  const env = process.env;
  const fail = () => {
    throw new Error('QA-AB-01 ephemeral PostgreSQL authorization rejected');
  };
  const raw = env.QA_AB_DATABASE_URL;
  if (env.RUN_QA_AB_PG !== '1' || !raw || env.DATABASE_URL !== raw)
    return fail();
  const url = new URL(raw);
  const name = env.QA_AB_CONTAINER;
  if (
    !name ||
    !/^zaping-qa-ab-[a-f0-9]{12}$/.test(name) ||
    !/^qa_ab_[a-f0-9]{12}$/.test(env.QA_AB_DATABASE ?? '') ||
    url.hostname !== '127.0.0.1' ||
    url.protocol !== 'postgresql:' ||
    url.pathname !== '/' + env.QA_AB_DATABASE ||
    url.username !== env.QA_AB_ROLE ||
    !url.password ||
    url.port !== env.QA_AB_PORT ||
    url.search ||
    url.hash
  )
    return fail();
  const metadata = JSON.parse(
    execFileSync('docker', ['inspect', '--format', '{{json .}}', name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ) as {
    Id: string;
    State: { Running: boolean };
    Config: { Labels: Record<string, string> };
    Mounts: { Type: string }[];
    HostConfig: { AutoRemove: boolean; Tmpfs: Record<string, string> };
    NetworkSettings: {
      Ports: Record<string, { HostIp: string; HostPort: string }[]>;
    };
  };
  if (
    metadata.Id !== env.QA_AB_CONTAINER_ID ||
    !metadata.State.Running ||
    metadata.Config.Labels['zaping.qa-ab-token'] !== env.QA_AB_TOKEN ||
    !metadata.HostConfig.AutoRemove ||
    !metadata.HostConfig.Tmpfs['/var/lib/postgresql/data'] ||
    metadata.Mounts.some((m) => m.Type !== 'tmpfs')
  )
    return fail();
  const ports = metadata.NetworkSettings.Ports['5432/tcp'];
  if (
    ports?.length !== 1 ||
    ports[0].HostIp !== '127.0.0.1' ||
    ports[0].HostPort !== url.port
  )
    return fail();
  const db = new PrismaClient({ datasources: { db: { url: raw } } });
  try {
    const [id] = await db.$queryRaw<
      {
        database: string;
        role: string;
        owner: string;
        version: number;
        port: number;
        address: string;
        marker: string;
        system: string;
        superuser: boolean;
        createdb: boolean;
        createrole: boolean;
        replication: boolean;
      }[]
    >`
      SELECT current_database() AS database, current_user AS role,
        pg_get_userbyid(d.datdba) AS owner, current_setting('server_version_num')::int AS version,
        inet_server_port() AS port, host(inet_server_addr()) AS address,
        shobj_description(d.oid,'pg_database') AS marker,
        (SELECT system_identifier::text FROM pg_control_system()) AS system,
        r.rolsuper AS superuser, r.rolcreatedb AS createdb, r.rolcreaterole AS createrole, r.rolreplication AS replication
      FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()
    `;
    if (
      !id ||
      id.database !== env.QA_AB_DATABASE ||
      id.role !== env.QA_AB_ROLE ||
      id.owner !== id.role ||
      id.version < 160000 ||
      id.version >= 170000 ||
      id.port !== 5432 ||
      id.address !== env.QA_AB_INTERNAL_ADDRESS ||
      id.system !== env.QA_AB_SYSTEM_ID ||
      id.marker !== 'QA-AB-01:' + env.QA_AB_TOKEN ||
      id.superuser ||
      id.createdb ||
      id.createrole ||
      id.replication
    )
      return fail();
    return db;
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}
