/* Test-only opt-in runner. Creates a NEW empty tmpfs PostgreSQL instance.
 * Never opens the existing spike/dev/qa databases, modifies .env or mounts a volume.
 */
const { execFileSync, spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
if (!process.argv.includes('--run-isolated')) {
  console.error(
    'Requires --run-isolated; creates an empty ephemeral loopback PostgreSQL test container.',
  );
  process.exit(1);
}
const runId = randomUUID();
const container = `zaping-opening-test-${runId}`;
const password = randomBytes(24).toString('hex');
const database = 'zaping_opening_test';
const label = `zaping.opening.test=${runId}`;
const cwd = resolve(__dirname, '../..');
let created = false;
let stage = 'fresh isolated container';
function docker(args, input) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    input,
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
function sql(query) {
  return docker(
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
}
function run(args, env) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    stdio: 'inherit',
    timeout: 300000,
  });
  if (result.error || result.status !== 0)
    throw new Error('child validation failed');
}
(async () => {
  try {
    // The new tmpfs and unique container are proof of an empty test target before any DB connection.
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--label',
      label,
      '--tmpfs',
      '/var/lib/postgresql/data:rw',
      '-p',
      '127.0.0.1::5432',
      '-e',
      `POSTGRES_DB=${database}`,
      '-e',
      `POSTGRES_PASSWORD=${password}`,
      'postgres:16',
    ]);
    created = true;
    const info = JSON.parse(docker(['inspect', container]))[0];
    const ports = info.NetworkSettings.Ports['5432/tcp'];
    if (
      info.Config.Labels['zaping.opening.test'] !== runId ||
      ports.length !== 1 ||
      ports[0].HostIp !== '127.0.0.1' ||
      !info.Config.Env.includes(`POSTGRES_DB=${database}`) ||
      Object.keys(info.HostConfig.Tmpfs || {}).length !== 1 ||
      !info.HostConfig.Tmpfs['/var/lib/postgresql/data'] ||
      info.Mounts.some(
        (m) =>
          m.Type !== 'tmpfs' || m.Destination !== '/var/lib/postgresql/data',
      )
    )
      throw new Error('isolation verification failed');
    const port = ports[0].HostPort;
    console.log(
      `Verified fresh isolated target: 127.0.0.1:${port}/${database}; tmpfs; no existing volume; run=${runId}`,
    );
    stage = 'readiness';
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        docker([
          'exec',
          container,
          'pg_isready',
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
    if (!ready) throw new Error('PostgreSQL not ready');
    if (
      sql('SELECT current_database();') !== database ||
      sql(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';",
      ) !== '0'
    )
      throw new Error('new database is not empty');
    stage = 'schema-only migration deployment in fresh test DB';
    const adminEnv = {
      ...process.env,
      DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/${database}?schema=public`,
    };
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
    // Runtime acceptance is not superuser. Fixtures are isolated to this disposable DB.
    sql(`CREATE ROLE opening_test LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
      GRANT CONNECT ON DATABASE ${database} TO opening_test;
      GRANT USAGE ON SCHEMA public TO opening_test;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opening_test;`);
    stage = 'PostgreSQL acceptance';
    run(
      [
        'node_modules/jest/bin/jest.js',
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
        '--runTestsByPath',
        'test/inventory-opening.postgres.e2e-spec.ts',
      ],
      {
        ...process.env,
        RUN_INVENTORY_OPENING_POSTGRES: '1',
        INVENTORY_OPENING_TEST_RUN: runId,
        INVENTORY_OPENING_TEST_DATABASE_URL: `postgresql://opening_test:${password}@127.0.0.1:${port}/${database}?schema=public&connection_limit=8`,
      },
    );
    console.log('PostgreSQL acceptance: PASS');
  } catch (error) {
    console.error(`Cutover PostgreSQL validation failed at ${stage}.`);
    console.error(
      String(error.stderr || error.message)
        .replaceAll(password, '[redacted]')
        .replace(/postgres(?:ql)?:\/\/\S+/g, '[URL]')
        .slice(0, 1800),
    );
    process.exitCode = 1;
  } finally {
    if (created) {
      try {
        const info = JSON.parse(docker(['inspect', container]))[0];
        if (info.Config.Labels['zaping.opening.test'] !== runId)
          throw new Error('cleanup identity mismatch');
        docker(['rm', '--force', container]);
        console.log(
          'Identified ephemeral fixtures/container/tmpfs removed: PASS',
        );
      } catch {
        console.error(
          `Cleanup blocked; inspect only owned container ${container}`,
        );
        process.exitCode = 1;
      }
    }
  }
})();
