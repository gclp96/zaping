/* Explicit test-only runner. Never reads .env or changes existing credentials. */
const { execFileSync, spawnSync } = require('node:child_process');

const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');

if (!process.argv.includes('--run-isolated')) {
  console.error(
    'Requires --run-isolated; target is fixed to 127.0.0.1:5434/zaping_spike_test.',
  );
  process.exit(1);
}
const container = 'zaping-hc-spike-postgres';
const database = 'zaping_spike_test';

const runId = randomUUID();
const foreignId = randomUUID();
const role = `zaping_inv01c_${randomBytes(6).toString('hex')}`;
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
  'Customer',
  'Sale',
  'SaleItem',
  'Quote',
  'QuoteItem',
  'InventoryMovement',
  'IdempotencyRecord',
  'Supplier',
  'Purchase',
  'PurchaseItem',
  'PurchaseReceipt',
  'PurchaseReceiptItem',
  'EquipmentAsset',
  'CompanySequence',
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
    `Test-only target: host=127.0.0.1 port=5434 database=${database} fixtureAdmin=postgres runtimeUser=${role}`,
  );
  stage = 'database identity';
  if (
    sql("SELECT current_database() || ':' || current_user;") !==
    `${database}:postgres`
  )
    throw new Error('identity mismatch');
  stage = 'existing schema verification';
  const required = [
    '20261013000000_add_inventory_physical_authority',
    '20261014000000_inventory_count_enums',
    '20261014000100_inventory_count_constraints',
  ];
  for (const name of required) {
    if (
      sql(
        `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name='${name}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;`,
      ) !== '1'
    )
      throw new Error(
        'Required existing migration absent; runner never applies migrations',
      );
  }
  stage = 'temporary runtime role';
  sql(
    `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;`,
  );
  roleCreated = true;
  sql(`GRANT CONNECT ON DATABASE ${database} TO ${role};
    GRANT USAGE ON SCHEMA public TO ${role};
    GRANT SELECT,INSERT,DELETE ON ${tableList} TO ${role};
    GRANT UPDATE ON "Company","User","Product","InventoryBatch","Purchase","IdempotencyRecord","CompanySequence","Sale","Quote" TO ${role};
    GRANT UPDATE (quantity,revision,"updatedAt") ON "InventoryPosition" TO ${role};`);
  console.log('Existing schema verified; migrations: NONE');
  stage = 'PostgreSQL acceptance';
  const result = spawnSync(
    process.execPath,
    [
      resolve(__dirname, '../../node_modules/jest/bin/jest.js'),
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
      '--runTestsByPath',
      'test/sales-physical.postgres.e2e-spec.ts',
    ],
    {
      cwd: resolve(__dirname, '../..'),
      stdio: 'inherit',
      timeout: 300000,
      env: {
        ...process.env,
        RUN_SALES_PHYSICAL_POSTGRES: '1',
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
      const owners = `SELECT id FROM "Company" WHERE id IN ('${runId}','${foreignId}') AND name='INV01C ${runId}'`;
      sql(`BEGIN;
        DELETE FROM "InventoryMovement" WHERE "companyId" IN (${owners});
        DELETE FROM "IdempotencyRecord" WHERE "companyId" IN (${owners});
        DELETE FROM "EquipmentAsset" WHERE "companyId" IN (${owners});
        DELETE FROM "PurchaseReceiptItem" WHERE "companyId" IN (${owners});
        DELETE FROM "PurchaseReceipt" WHERE "companyId" IN (${owners});
        DELETE FROM "PurchaseItem" WHERE "purchaseId" IN (SELECT id FROM "Purchase" WHERE "companyId" IN (${owners}));
        DELETE FROM "Purchase" WHERE "companyId" IN (${owners});
        DELETE FROM "Supplier" WHERE "companyId" IN (${owners});
        DELETE FROM "SaleItem" WHERE "saleId" IN (SELECT id FROM "Sale" WHERE "companyId" IN (${owners}));
        DELETE FROM "Sale" WHERE "companyId" IN (${owners});
        DELETE FROM "QuoteItem" WHERE "quoteId" IN (SELECT id FROM "Quote" WHERE "companyId" IN (${owners}));
        DELETE FROM "Quote" WHERE "companyId" IN (${owners});
        DELETE FROM "Customer" WHERE "companyId" IN (${owners});
        DELETE FROM "CompanySequence" WHERE "companyId" IN (${owners});
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
      sql(`REASSIGN OWNED BY ${role} TO postgres; REVOKE ALL ON ${tableList},"InventoryMovement" FROM ${role};
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
