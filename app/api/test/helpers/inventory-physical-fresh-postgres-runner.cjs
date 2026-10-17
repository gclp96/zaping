/* Opt-in: new loopback PostgreSQL16/tmpfs only. No user DB, .env or existing volume. */
const { execFileSync, spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
if (process.argv.length !== 3 || process.argv[2] !== '--run-isolated') {
  console.error('Requires --run-isolated; no existing database is accepted.');
  process.exit(1);
}
const runId = randomUUID(),
  password = randomBytes(24).toString('hex');
const container = 'zaping-inventory-physical-fresh-' + runId;
const database = 'zaping_spike_test',
  role = 'zaping_inv01a_' + randomBytes(6).toString('hex');
const label = 'zaping.inventory.physical.fresh.test',
  cwd = resolve(__dirname, '../..');
let created = false,
  stage = 'fresh container';
const docker = (args, input) =>
  execFileSync('docker', args, {
    input,
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
const sql = (query) =>
  docker(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      database,
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
    ],
    query,
  );
function run(args, env) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    env,
    stdio: 'inherit',
    timeout: 300000,
  });
  if (r.error || r.status !== 0) throw new Error('Child validation failed');
}
(async () => {
  try {
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--label',
      label + '=' + runId,
      '--tmpfs',
      '/var/lib/postgresql/data:rw',
      '-p',
      '127.0.0.1::5432',
      '-e',
      'POSTGRES_DB=' + database,
      '-e',
      'POSTGRES_PASSWORD=' + password,
      'postgres:16',
    ]);
    created = true;
    const info = JSON.parse(docker(['inspect', container]))[0],
      ports = info.NetworkSettings.Ports['5432/tcp'];
    if (
      info.Config.Labels[label] !== runId ||
      ports.length !== 1 ||
      ports[0].HostIp !== '127.0.0.1' ||
      !info.Config.Env.includes('POSTGRES_DB=' + database) ||
      !info.HostConfig.Tmpfs['/var/lib/postgresql/data'] ||
      info.Mounts.some(
        (m) =>
          m.Type !== 'tmpfs' || m.Destination !== '/var/lib/postgresql/data',
      )
    )
      throw new Error('Isolation proof failed');
    const port = ports[0].HostPort;
    console.log(
      `Verified NEW isolated target: 127.0.0.1:${port}/${database}; tmpfs/no volume; run=${runId}`,
    );
    stage = 'readiness';
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        docker([
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          database,
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (
      !ready ||
      sql('SELECT current_database();') !== database ||
      sql(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';",
      ) !== '0'
    )
      throw new Error('New DB not ready/empty');
    const adminEnv = {
      ...process.env,
      DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/${database}?schema=public`,
    };
    stage = 'all merged migrations in fresh empty DB';
    run(
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--schema',
        'prisma/schema.prisma',
      ],
      adminEnv,
    );
    sql(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
      GRANT CONNECT ON DATABASE ${database} TO ${role};GRANT USAGE ON SCHEMA public TO ${role};
      GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA public TO ${role};`);
    stage = 'runtime PostgreSQL acceptance';
    run(
      [
        'node_modules/jest/bin/jest.js',
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
        '--runTestsByPath',
        'test/inventory-physical.postgres.e2e-spec.ts',
        'test/physical-effect-deferred.postgres.e2e-spec.ts',
      ],
      {
        ...process.env,
        RUN_INVENTORY_PHYSICAL_POSTGRES: '1',
        INVENTORY_PHYSICAL_TEST_COMPANY: runId,
        INVENTORY_PHYSICAL_TEST_FOREIGN: randomUUID(),
        INVENTORY_PHYSICAL_TEST_RUN: runId,
        INVENTORY_PHYSICAL_TEST_DATABASE_URL: `postgresql://${role}:${password}@127.0.0.1:${port}/${database}?schema=public&connection_limit=8`,
      },
    );
    console.log('Inventory physical fresh PostgreSQL acceptance: PASS');
  } catch (e) {
    console.error('Inventory physical validation failed at ' + stage);
    console.error(
      String(e.stderr || e.message)
        .replaceAll(password, '[redacted]')
        .replace(/postgres(?:ql)?:\/\/\S+/g, '[URL]')
        .slice(0, 1800),
    );
    process.exitCode = 1;
  } finally {
    if (created) {
      try {
        if (
          JSON.parse(docker(['inspect', container]))[0].Config.Labels[label] !==
          runId
        )
          throw new Error('Container cleanup identity mismatch');
        docker(['rm', '--force', container]);
        console.log('Task-owned container/tmpfs cleanup: PASS');
      } catch {
        console.error('Cleanup failed for task-owned container ' + container);
        process.exitCode = 1;
      }
    }
  }
})();
