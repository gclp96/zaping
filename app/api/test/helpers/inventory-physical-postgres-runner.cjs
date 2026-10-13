/* Explicit test-only runner. Never reads .env or changes existing credentials. */
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');

if (!process.argv.includes('--run-isolated')) {
  console.error(
    'Requires --run-isolated; target is fixed to 127.0.0.1:5434/zaping_spike_test.',
  );
  process.exit(1);
}
const container = 'zaping-hc-spike-postgres';
const database = 'zaping_spike_test';
const migration = '20261013000000_add_inventory_physical_authority';
const runId = randomUUID();
const foreignId = randomUUID();
const role = `zaping_inv01a_${randomBytes(6).toString('hex')}`;
const password = randomBytes(32).toString('hex');
let roleCreated = false;
let stage = 'container identity';
function sql(source) {
  return execFileSync(
    'docker',
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
    {
      input: source,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    },
  ).trim();
}
const writable = [
  'Company',
  'User',
  'Product',
  'InventoryBatch',
  'InventoryPosition',
  'InventoryPhysicalEffect',
  'InventoryPhysicalEffectLine',
];
const tableList = writable.map((v) => `"${v}"`).join(',');
try {
  const info = JSON.parse(
    execFileSync('docker', ['inspect', container], { encoding: 'utf8' }),
  )[0];
  const port = info.NetworkSettings.Ports['5432/tcp'];
  if (
    port.length !== 1 ||
    port[0].HostIp !== '127.0.0.1' ||
    port[0].HostPort !== '5434' ||
    !info.Config.Env.includes(`POSTGRES_DB=${database}`)
  )
    throw new Error('target mismatch');
  console.log(
    `Test-only target: host=127.0.0.1 port=5434 database=${database} migrationUser=postgres runtimeUser=${role}`,
  );
  stage = 'database identity';
  if (
    sql("SELECT current_database() || ':' || current_user;") !==
    `${database}:postgres`
  )
    throw new Error('identity mismatch');
  stage = 'migration';
  const source = readFileSync(
    resolve(__dirname, '../../prisma/migrations', migration, 'migration.sql'),
    'utf8',
  );
  const checksum = createHash('sha256').update(source).digest('hex');
  const applied = sql(
    `SELECT checksum FROM "_prisma_migrations" WHERE migration_name='${migration}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;`,
  );
  if (applied && applied !== checksum)
    throw new Error('applied migration checksum mismatch');
  if (!applied) {
    // Apply the exact checked-in SQL and record successful application atomically.
    // The local socket is used because stored admin TCP credentials may be stale.
    if (!source.trimEnd().endsWith('COMMIT;'))
      throw new Error('migration transaction missing');
    const record = `INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
      VALUES ('${randomUUID()}','${checksum}',CURRENT_TIMESTAMP,'${migration}',CURRENT_TIMESTAMP,1);\nCOMMIT;`;
    sql(source.replace(/COMMIT;\s*$/, record));
  }
  console.log(
    `Migration ${migration}: ${applied ? 'already applied, checksum verified' : 'applied to isolated database'}`,
  );
  stage = 'temporary runtime role';
  sql(`BEGIN; CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    GRANT CONNECT ON DATABASE ${database} TO ${role};
    GRANT USAGE ON SCHEMA public TO ${role};
    GRANT SELECT,INSERT,DELETE ON ${tableList} TO ${role};
    GRANT SELECT ON "InventoryMovement" TO ${role};
    GRANT UPDATE ON "Company","User","Product","InventoryBatch" TO ${role};
    GRANT UPDATE (quantity,revision,"updatedAt") ON "InventoryPosition" TO ${role}; COMMIT;`);
  roleCreated = true;
  stage = 'PostgreSQL acceptance';
  const result = spawnSync(
    process.execPath,
    [
      resolve(__dirname, '../../node_modules/jest/bin/jest.js'),
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
      '--runTestsByPath',
      'test/inventory-physical.postgres.e2e-spec.ts',
    ],
    {
      cwd: resolve(__dirname, '../..'),
      stdio: 'inherit',
      timeout: 240000,
      env: {
        ...process.env,
        RUN_INVENTORY_PHYSICAL_POSTGRES: '1',
        INVENTORY_PHYSICAL_TEST_DATABASE_URL: `postgresql://${role}:${password}@127.0.0.1:5434/${database}?schema=public&connection_limit=8`,
        INVENTORY_PHYSICAL_TEST_COMPANY: runId,
        INVENTORY_PHYSICAL_TEST_FOREIGN: foreignId,
      },
    },
  );
  process.exitCode = result.status === 0 ? 0 : 1;
} catch (error) {
  console.error(
    `Isolated acceptance failed at ${stage}; raw credential-bearing diagnostics suppressed.`,
  );
  if (stage !== 'temporary runtime role') {
    console.error(
      String(error.stderr || error.message)
        .replaceAll(password, '[redacted]')
        .replace(/postgres(?:ql)?:\/\/\S+/g, '[URL]')
        .slice(0, 1500),
    );
  }
  process.exitCode = 1;
} finally {
  if (roleCreated) {
    try {
      stage = 'fixture cleanup';
      const owners = `SELECT id FROM "Company" WHERE id IN ('${runId}','${foreignId}') AND name='INV01A ${runId}'`;
      sql(`BEGIN;
        DELETE FROM "InventoryPhysicalEffectLine" WHERE "companyId" IN (${owners});
        DELETE FROM "InventoryPhysicalEffect" WHERE "companyId" IN (${owners});
        DELETE FROM "InventoryPosition" WHERE "companyId" IN (${owners});
        DELETE FROM "InventoryBatch" WHERE "companyId" IN (${owners});
        DELETE FROM "Product" WHERE "companyId" IN (${owners});
        DELETE FROM "User" WHERE "companyId" IN (${owners});
        DELETE FROM "Company" WHERE id IN (${owners}); COMMIT;`);
      if (
        sql(
          `SELECT count(*) FROM "Company" WHERE id IN ('${runId}','${foreignId}');`,
        ) !== '0'
      )
        throw new Error('fixture residue');
      console.log('Fixture cleanup: PASS; company residue=0');
      sql(`REVOKE ALL ON ${tableList},"InventoryMovement" FROM ${role};
        REVOKE UPDATE (quantity,revision,"updatedAt") ON "InventoryPosition" FROM ${role};
        REVOKE ALL ON SCHEMA public FROM ${role};
        REVOKE ALL ON DATABASE ${database} FROM ${role}; DROP ROLE ${role};`);
      console.log('Temporary runtime role removed: PASS');
    } catch {
      console.error(
        `Cleanup failed at ${stage}; inspect this run's isolated fixture ownership and role ${role}.`,
      );
      process.exitCode = 1;
    }
  }
}
