// Disposable pre-migration schema. The suite applies the real folio migration.
// Never reads dotenv or targets a persistent database.
const { execFileSync, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { readFileSync, readdirSync } = require('node:fs');
const cwd = path.resolve(__dirname, '..');
const token = randomBytes(6).toString('hex');
const container = `zaping-qa-pur-folio-${token}`;
const database = `qa_pur_folio_${token}`;
const password = randomBytes(24).toString('hex');
const env = { ...process.env };
// Override inherited database settings before invoking Prisma/Jest.
env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
function run(command, args, input) {
  return execFileSync(command, args, {
    cwd,
    env,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
let ownedId;
let stage = 'container';
try {
  ownedId = run('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--label',
    `zaping.pur-folio-token=${token}`,
    '--tmpfs',
    '/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
    '--publish',
    '127.0.0.1::5432',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16',
  ]).trim();
  stage = 'readiness';
  run('docker', [
    'exec',
    container,
    'sh',
    '-c',
    'i=0; until pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do i=$((i+1)); [ "$i" -lt 30 ] || exit 1; sleep 1; done',
  ]);
  stage = 'identity';
  const metadata = JSON.parse(
    run('docker', ['inspect', '--format', '{{json .}}', container]),
  );
  if (
    metadata.Id !== ownedId ||
    metadata.Config.Labels['zaping.pur-folio-token'] !== token ||
    !metadata.HostConfig.AutoRemove ||
    !metadata.HostConfig.Tmpfs['/var/lib/postgresql/data'] ||
    metadata.Mounts.some((m) => m.Type !== 'tmpfs')
  )
    throw new Error('Isolation rejected');
  const ports = metadata.NetworkSettings.Ports['5432/tcp'];
  if (ports.length !== 1 || ports[0].HostIp !== '127.0.0.1')
    throw new Error('Port isolation rejected');
  const sql = (text, role = 'postgres', db = 'postgres') =>
    run(
      'docker',
      [
        'exec',
        '-i',
        container,
        'psql',
        '--no-psqlrc',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        role,
        '-d',
        db,
      ],
      text,
    );
  // No persistent mounts, reused database, inherited credentials or local DB access.
  stage = 'database';
  sql(`CREATE ROLE qa_folio LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE DATABASE ${database} OWNER qa_folio;
COMMENT ON DATABASE ${database} IS 'PUR-FOLIO-01B:${token}';`);
  const migrationRoot = path.join(cwd, 'prisma', 'migrations');
  const target = '20261024000000_purchase_annual_folio_unique';
  const migrations = readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (
    !migrations.includes(target) ||
    migrations.some((name) => name > target)
  ) {
    throw new Error(
      'Unexpected migration baseline; review launcher before proceeding',
    );
  }
  stage = 'prior-migrations';
  for (const name of migrations.filter((name) => name < target)) {
    sql(
      readFileSync(path.join(migrationRoot, name, 'migration.sql'), 'utf8'),
      'qa_folio',
      database,
    );
  }
  console.log(
    `PUR-FOLIO ephemeral PostgreSQL 16: ${database}; loopback port ${ports[0].HostPort}; tmpfs, auto-remove, non-admin role. ${migrations.length - 1} prior migration files applied; folio migration applied only by the isolated suite.`,
  );
  Object.assign(env, {
    RUN_PUR_FOLIO_PG: '1',
    PUR_FOLIO_CONTAINER: container,
    PUR_FOLIO_TOKEN: token,
    PUR_FOLIO_PG_URL: `postgresql://qa_folio:${password}@127.0.0.1:${ports[0].HostPort}/${database}`,
  });
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/jest/bin/jest.js',
      '--config',
      'test/jest-e2e.json',
      '--runInBand',
      '--runTestsByPath',
      'test/purchase-annual-folio.postgres.e2e-spec.ts',
    ],
    { cwd, env, stdio: 'inherit' },
  );
  process.exitCode = result.status ?? 1;
} catch (error) {
  // Never print command arguments, connection strings or generated role passwords.
  console.error(
    `PUR-FOLIO ephemeral setup/QA failed at ${stage}. No persistent database targeted.`,
  );
  if (stage === 'prior-migrations') {
    const diagnostic = String(error.stderr ?? '')
      .replaceAll(password, '[REDACTED]')
      .replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED URL]');
    console.error(diagnostic.slice(0, 1600));
  }
  process.exitCode = 1;
} finally {
  if (ownedId) {
    const metadata = JSON.parse(
      run('docker', ['inspect', '--format', '{{json .}}', container]),
    );
    if (
      metadata.Id === ownedId &&
      metadata.Config.Labels['zaping.pur-folio-token'] === token
    ) {
      run('docker', ['rm', '--force', ownedId]);
      console.log('PUR-FOLIO owned ephemeral container removed.');
    }
  }
}
