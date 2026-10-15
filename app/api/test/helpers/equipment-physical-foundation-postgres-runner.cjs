/* Opt-in: new loopback PostgreSQL16/tmpfs only. No user DB, .env or existing volume. */
const { execFileSync, spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve, dirname, basename } = require('node:path');
const fs = require('node:fs');
const { PrismaClient, Prisma } = require('@prisma/client');
if (process.argv.length !== 3 || process.argv[2] !== '--run-isolated') {
  console.error('Requires --run-isolated; no existing database is accepted.');
  process.exit(1);
}
const runId = randomUUID(),
  password = randomBytes(24).toString('hex');
const container = 'zaping-equipment-physical-' + runId;
const database = 'zaping_equipment_physical_test',
  role = 'equipment_physical_test';
const label = 'zaping.equipment.physical.test',
  cwd = resolve(__dirname, '../..');
const work = resolve(cwd, 'prisma', '.equipment-physical-acceptance-' + runId);
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
async function historicalFixtures(url) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const c = await db.company.create({
      data: { name: 'PRE-MIGRATION EQUIPMENT', rfc: runId },
      select: { id: true },
    });
    const p = await db.product.create({
      data: {
        companyId: c.id,
        sku: runId,
        name: 'Historical ASSET',
        inventoryTracking: 'ASSET',
        stock: 13,
      },
      select: { id: true },
    });
    const u = await db.user.create({
      data: {
        companyId: c.id,
        firstName: 'Fixture',
        lastName: 'Only',
        email: runId + '@example.invalid',
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
      select: { id: true },
    });
    const ids = [];
    for (const lifecycle of ['ACTIVE', 'RETIRED'])
      for (const condition of [
        'GOOD',
        'INSPECTION_PENDING',
        'DAMAGED',
        'OUT_OF_SERVICE',
      ]) {
        const id = randomUUID();
        ids.push(id);
        await db.$executeRaw(
          Prisma.sql`INSERT INTO "EquipmentAsset" ("id","companyId","productId","assetCode","serialNumber","serialNumberKey","lifecycle","condition","origin","updatedAt") VALUES (${id},${c.id},${p.id},${id},${id},${id},CAST(${lifecycle} AS "EquipmentLifecycle"),CAST(${condition} AS "EquipmentCondition"),'INITIAL_MIGRATION',CURRENT_TIMESTAMP)`,
        );
      }
    const healthcareCase = await db.healthcareCase.create({
      data: {
        companyId: c.id,
        folio: randomUUID(),
        title: 'Historical prepared',
        createdById: u.id,
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-10-15T10:00:00Z'),
        scheduledEnd: new Date('2026-10-15T12:00:00Z'),
      },
      select: { id: true },
    });
    const assignment = await db.healthcareEquipmentAssignment.create({
      data: {
        companyId: c.id,
        caseId: healthcareCase.id,
        equipmentAssetId: ids[0],
        origin: 'DIRECT',
        directAssignmentReason: 'ISOLATED FIXTURE',
        createdById: u.id,
      },
      select: { id: true },
    });
    const kit = await db.healthcareCaseKit.create({
      data: {
        companyId: c.id,
        caseId: healthcareCase.id,
        createdById: u.id,
        status: 'PREPARED',
        preparedById: u.id,
        preparedAt: new Date(),
      },
      select: { id: true },
    });
    await db.healthcareCaseKitItem.create({
      data: {
        companyId: c.id,
        caseId: healthcareCase.id,
        caseKitId: kit.id,
        equipmentAssignmentId: assignment.id,
        addedById: u.id,
      },
    });
    const before = await db.$queryRaw(
      Prisma.sql`SELECT row_to_json(a) AS row FROM "EquipmentAsset" a WHERE "companyId"=${c.id} ORDER BY "id"`,
    );
    return {
      companyId: c.id,
      productId: p.id,
      assets: before.map((r) => r.row),
    };
  } finally {
    await db.$disconnect();
  }
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
    stage = '39 baseline migrations';
    if (fs.existsSync(work)) throw new Error('Owned work directory exists');
    fs.mkdirSync(work);
    fs.writeFileSync(resolve(work, 'owner'), runId);
    const migrations = resolve(work, 'migrations');
    fs.mkdirSync(migrations);
    const names = fs
      .readdirSync(resolve(cwd, 'prisma/migrations'))
      .filter((n) => /^\d/.test(n) && !n.startsWith('2026101500'));
    if (names.length !== 39)
      throw new Error('Unexpected baseline migration set');
    for (const n of names)
      fs.cpSync(resolve(cwd, 'prisma/migrations', n), resolve(migrations, n), {
        recursive: true,
      });
    fs.copyFileSync(
      resolve(cwd, 'prisma/migrations/migration_lock.toml'),
      resolve(migrations, 'migration_lock.toml'),
    );
    // migrate deploy follows the selected migration directory, not model drift.
    // Use the checked-out schema so the runner also works after commit/shallow CI checkout.
    fs.copyFileSync(
      resolve(cwd, 'prisma/schema.prisma'),
      resolve(work, 'schema.prisma'),
    );
    const config = resolve(work, 'prisma.config.ts');
    fs.writeFileSync(
      config,
      'import {defineConfig} from "prisma/config";export default defineConfig({schema:' +
        JSON.stringify(resolve(work, 'schema.prisma')) +
        ',migrations:{path:' +
        JSON.stringify(migrations) +
        '},datasource:{url:process.env.DATABASE_URL!}});',
    );
    run(
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--config',
        config,
      ],
      adminEnv,
    );
    if (
      sql(
        `SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='EquipmentAsset' AND column_name IN ('physicalLocation','physicalRevision','activeCustodyId');`,
      ) !== '0'
    )
      throw new Error(
        'Physical columns already exist before historical fixtures',
      );
    stage = 'historical fixtures before 01E-A';
    const historical = await historicalFixtures(adminEnv.DATABASE_URL);
    console.log(
      'Historical Assets/RESERVED/PREPARED created BEFORE physical columns; snapshot retained.',
    );
    stage = 'two new schema-only migrations';
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
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role};`);
    stage = 'runtime PostgreSQL acceptance';
    run(
      [
        'node_modules/jest/bin/jest.js',
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
        '--runTestsByPath',
        'test/equipment-physical-foundation.postgres.e2e-spec.ts',
      ],
      {
        ...process.env,
        RUN_EQUIPMENT_PHYSICAL_POSTGRES: '1',
        EQUIPMENT_PHYSICAL_TEST_RUN: runId,
        EQUIPMENT_PHYSICAL_TEST_DATABASE_URL: `postgresql://${role}:${password}@127.0.0.1:${port}/${database}?schema=public&connection_limit=8`,
        EQUIPMENT_PHYSICAL_HISTORICAL_FIXTURES: JSON.stringify(historical),
        INVENTORY_RUNTIME_BUILD: 'equipment-foundation-fixture',
        INVENTORY_RUNTIME_ENVIRONMENT: 'isolated',
        INVENTORY_AUTHORITY_PROTOCOL: 'inventory-authority-v1',
      },
    );
    console.log('Equipment physical PostgreSQL acceptance: PASS');
  } catch (e) {
    console.error('Equipment physical validation failed at ' + stage);
    console.error(
      String(e.stderr || e.message)
        .replaceAll(password, '[redacted]')
        .replace(/postgres(?:ql)?:\/\/\S+/g, '[URL]')
        .slice(0, 1800),
    );
    process.exitCode = 1;
  } finally {
    if (fs.existsSync(work)) {
      if (
        dirname(work) !== resolve(cwd, 'prisma') ||
        basename(work) !== '.equipment-physical-acceptance-' + runId ||
        fs.readFileSync(resolve(work, 'owner'), 'utf8') !== runId
      )
        throw new Error('Owned cleanup identity mismatch');
      fs.rmSync(work, { recursive: true });
    }
    if (created) {
      try {
        if (
          JSON.parse(docker(['inspect', container]))[0].Config.Labels[label] !==
          runId
        )
          throw new Error('Container cleanup identity mismatch');
        docker(['rm', '--force', container]);
        console.log(
          'Task-owned fixtures/container/tmpfs and temporary baseline files cleanup: PASS',
        );
      } catch {
        console.error('Cleanup failed for task-owned container ' + container);
        process.exitCode = 1;
      }
    }
  }
})();
