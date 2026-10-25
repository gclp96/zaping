import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';
import { PurchasesFolioService } from '../src/purchases/purchases-folio.service';
import { PurchasesService } from '../src/purchases/purchases.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PUR-FOLIO-01B — isolated PostgreSQL', () => {
  let db: PrismaClient;
  let url: string;
  let migrationVerified = false;
  const folios = new PurchasesFolioService(
    new CompanySequenceAllocatorService(),
  );
  const service = (client = db) =>
    new PurchasesService(client as PrismaService, folios);

  beforeAll(async () => {
    const env = process.env;
    if (
      env.RUN_PUR_FOLIO_PG !== '1' ||
      !env.PUR_FOLIO_PG_URL ||
      !env.PUR_FOLIO_CONTAINER ||
      !env.PUR_FOLIO_TOKEN
    ) {
      throw new Error(
        'Explicit ephemeral PUR-FOLIO authorization required; no DATABASE_URL fallback',
      );
    }
    url = env.PUR_FOLIO_PG_URL;
    const parsed = new URL(url);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.protocol !== 'postgresql:' ||
      !/^qa_pur_folio_[a-f0-9]{12}$/.test(parsed.pathname.slice(1)) ||
      parsed.username !== 'qa_folio' ||
      !parsed.password ||
      parsed.search ||
      parsed.hash ||
      !/^zaping-qa-pur-folio-[a-f0-9]{12}$/.test(env.PUR_FOLIO_CONTAINER)
    ) {
      throw new Error('Ephemeral URL rejected');
    }
    const metadata = JSON.parse(
      execFileSync(
        'docker',
        ['inspect', '--format', '{{json .}}', env.PUR_FOLIO_CONTAINER],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      ),
    ) as {
      State: { Running: boolean };
      Config: { Labels: Record<string, string> };
      Mounts: Array<{ Type: string }>;
      HostConfig: { AutoRemove: boolean; Tmpfs: Record<string, string> };
      NetworkSettings: {
        Ports: Record<string, Array<{ HostIp: string; HostPort: string }>>;
      };
    };
    const ports = metadata.NetworkSettings.Ports['5432/tcp'];
    if (
      !metadata.State.Running ||
      !metadata.HostConfig.AutoRemove ||
      !metadata.HostConfig.Tmpfs['/var/lib/postgresql/data'] ||
      metadata.Mounts.some((m) => m.Type !== 'tmpfs') ||
      metadata.Config.Labels['zaping.pur-folio-token'] !==
        env.PUR_FOLIO_TOKEN ||
      ports?.length !== 1 ||
      ports[0].HostIp !== '127.0.0.1' ||
      ports[0].HostPort !== parsed.port
    ) {
      throw new Error('Ephemeral container identity rejected');
    }
    db = new PrismaClient({ datasources: { db: { url } } });
    const [identity] = await db.$queryRaw<
      Array<{
        database: string;
        role: string;
        version: number;
        marker: string;
        admin: boolean;
        owner: string;
      }>
    >`
      SELECT current_database() AS database, current_user AS role,
        current_setting('server_version_num')::int AS version,
        shobj_description(d.oid,'pg_database') AS marker, pg_get_userbyid(d.datdba) AS owner,
        (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication) AS admin
      FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()
    `;
    expect(identity).toMatchObject({
      database: parsed.pathname.slice(1),
      role: 'qa_folio',
      owner: 'qa_folio',
      marker: `PUR-FOLIO-01B:${env.PUR_FOLIO_TOKEN}`,
      admin: false,
    });
    expect(identity.version).toBeGreaterThanOrEqual(160000);
    expect(identity.version).toBeLessThan(170000);
    expect(await db.company.count()).toBe(0);
    await verifyRealMigration();
    migrationVerified = true;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  async function fixture(timezone = 'America/Hermosillo') {
    const company = await db.company.create({
      data: { name: 'Folio QA', rfc: randomUUID(), timezone },
    });
    const supplier = await db.supplier.create({
      data: { companyId: company.id, name: 'Supplier QA' },
    });
    const product = await db.product.create({
      data: {
        companyId: company.id,
        sku: 'SKU-QA',
        name: 'Product QA',
        cost: 100,
      },
    });
    const dto = {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 2 }],
    };
    const [clock] = await db.$queryRaw<Array<{ year: number }>>`
      SELECT EXTRACT(YEAR FROM (clock_timestamp() AT TIME ZONE ${timezone}))::int AS year
    `;
    return {
      company,
      supplier,
      product,
      dto,
      year: clock.year,
      key: `PURCHASE_FOLIO:${clock.year}`,
      prefix: `OC-${String(clock.year).slice(-2)}-`,
    };
  }

  async function verifyRealMigration() {
    const migration = readFileSync(
      resolve(
        __dirname,
        '../prisma/migrations/20261024000000_purchase_annual_folio_unique/migration.sql',
      ),
      'utf8',
    );
    const index = () => db.$queryRaw<
      Array<{ indisunique: boolean; indisvalid: boolean; definition: string }>
    >`
      SELECT i.indisunique, i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=current_schema() AND c.relname='Purchase_companyId_folio_key'
    `;
    expect(await index()).toEqual([]);
    const f = await fixture();
    const historical = await db.purchase.create({
      data: {
        companyId: f.company.id,
        supplierId: f.supplier.id,
        folio: 'OC-1700000000000',
        subtotal: 200,
        iva: 32,
        total: 232,
        items: {
          create: {
            productId: f.product.id,
            quantity: 2,
            price: 100,
            subtotal: 200,
          },
        },
      },
      include: { items: true },
    });
    await db.purchase.create({
      data: {
        companyId: f.company.id,
        supplierId: f.supplier.id,
        folio: f.prefix + '00001',
        status: 'CANCELLED',
        subtotal: 100,
        iva: 16,
        total: 116,
        items: {
          create: {
            productId: f.product.id,
            quantity: 1,
            price: 100,
            subtotal: 100,
          },
        },
      },
    });
    await db.purchaseReceipt.create({
      data: {
        companyId: f.company.id,
        purchaseId: historical.id,
        folio: 'RC-UPGRADE',
        items: {
          create: {
            companyId: f.company.id,
            purchaseItemId: historical.items[0].id,
            productId: f.product.id,
            quantityReceived: 1,
            unitCost: 100,
          },
        },
      },
    });
    const snapshot = async () => ({
      purchases: await db.purchase.findMany({
        where: { companyId: f.company.id },
        orderBy: { id: 'asc' },
      }),
      items: await db.purchaseItem.findMany({
        where: { purchase: { companyId: f.company.id } },
        orderBy: { id: 'asc' },
      }),
      receipts: await db.purchaseReceipt.findMany({
        where: { companyId: f.company.id },
        orderBy: { id: 'asc' },
      }),
      receiptItems: await db.purchaseReceiptItem.findMany({
        where: { companyId: f.company.id },
        orderBy: { id: 'asc' },
      }),
    });
    // Demonstrate failure on preexisting duplicates without renumbering/deleting them.
    const duplicate = await db.purchase.create({
      data: {
        companyId: f.company.id,
        supplierId: f.supplier.id,
        folio: historical.folio,
        subtotal: 0,
        iva: 0,
        total: 0,
      },
    });
    const beforeFailure = await snapshot();
    await expect(db.$executeRawUnsafe(migration)).rejects.toMatchObject({
      meta: { code: '23505' },
    });
    expect(await index()).toEqual([]);
    expect(await snapshot()).toEqual(beforeFailure);
    // Remove only this deliberate duplicate fixture inside the disposable database.
    await db.purchase.delete({ where: { id: duplicate.id } });
    const before = await snapshot();
    await db.$executeRawUnsafe(migration);
    const [createdIndex] = await index();
    expect(createdIndex).toMatchObject({ indisunique: true, indisvalid: true });
    expect(createdIndex.definition).toContain('("companyId", folio)');
    expect(await snapshot()).toEqual(before);
    await expect(
      db.purchase.create({
        data: {
          companyId: f.company.id,
          supplierId: f.supplier.id,
          folio: historical.folio,
          subtotal: 0,
          iva: 0,
          total: 0,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await snapshot()).toEqual(before);
    console.info(
      'Real folio migration verified: duplicate rejection, valid UNIQUE index, exact historical roots/items/receipt relations preserved.',
    );
  }

  // Decorate only transaction entry for synchronization; all SQL and service logic
  // run through real independent Prisma connections, without overriding options.
  async function competingCreates(
    companyId: string,
    requests: Array<{
      supplierId: string;
      items: Array<{ productId: string; quantity: number }>;
    }>,
  ) {
    expect(requests).toHaveLength(2);
    const clients = requests.map(
      () =>
        new PrismaClient({
          datasources: { db: { url: url + '?connection_limit=1' } },
        }),
    );
    const pids: number[] = [];
    const durations: number[] = [];
    let release!: () => void;
    let arrived = 0;
    const barrier = new Promise<void>((done) => {
      release = done;
    });
    const commands = clients.map(
      (client) =>
        new PurchasesService(
          {
            $transaction: async <T>(
              work: (tx: Prisma.TransactionClient) => Promise<T>,
              options?: unknown,
            ) => {
              expect(options).toBeUndefined();
              const started = performance.now();
              try {
                return await client.$transaction(async (tx) => {
                  const [pid] = await tx.$queryRaw<
                    Array<{ pid: number }>
                  >`SELECT pg_backend_pid() AS pid`;
                  pids.push(pid.pid);
                  if (++arrived === 2) release();
                  await barrier;
                  return work(tx);
                });
              } finally {
                durations.push(performance.now() - started);
              }
            },
          } as unknown as PrismaService,
          folios,
        ),
    );
    try {
      const results = await Promise.allSettled(
        commands.map((command, i) => command.create(companyId, requests[i])),
      );
      expect(new Set(pids).size).toBe(2);
      console.info(
        'PurchasesService.create concurrency: distinct PIDs',
        pids,
        'duration ms',
        durations.map(Math.round),
        'Prisma transaction defaults, no retries.',
      );
      return results;
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
  }

  it('applies the real migration to historical and cancelled purchases with exact relations preserved', () => {
    expect(migrationVerified).toBe(true);
  });

  it('runs PurchasesService.create concurrently with production transaction defaults', async () => {
    const f = await fixture();
    const results = await competingCreates(f.company.id, [f.dto, f.dto]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const persisted = await db.purchase.findMany({
      where: { companyId: f.company.id },
      include: { items: true },
      orderBy: { folio: 'asc' },
    });
    expect(persisted.map((p) => p.folio)).toEqual([
      f.prefix + '00001',
      f.prefix + '00002',
    ]);
    for (const purchase of persisted) {
      expect(purchase).toMatchObject({
        companyId: f.company.id,
        status: 'DRAFT',
        total: 232,
      });
      expect(purchase.items).toHaveLength(1);
      expect(purchase.items[0]).toMatchObject({
        purchaseId: purchase.id,
        productId: f.product.id,
        quantity: 2,
      });
    }
    expect(
      await db.companySequence.findUnique({
        where: { companyId_key: { companyId: f.company.id, key: f.key } },
      }),
    ).toMatchObject({ nextValue: 3 });
  });

  it('rolls back a failed concurrent service command without losing the successful command', async () => {
    const f = await fixture();
    const failing = await db.product.create({
      data: {
        companyId: f.company.id,
        sku: 'FAULT',
        name: 'Fault product',
        cost: 100,
      },
    });
    await db.$executeRawUnsafe(`CREATE FUNCTION pur_folio_concurrent_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."productId" = '${failing.id}' THEN RAISE EXCEPTION 'PUR-FOLIO concurrent item fault'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(
      'CREATE TRIGGER pur_folio_concurrent_fault BEFORE INSERT ON "PurchaseItem" FOR EACH ROW EXECUTE FUNCTION pur_folio_concurrent_fault()',
    );
    try {
      const results = await competingCreates(f.company.id, [
        f.dto,
        { ...f.dto, items: [{ productId: failing.id, quantity: 2 }] },
      ]);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      if (results[1].status === 'rejected')
        expect(String(results[1].reason)).toContain(
          'PUR-FOLIO concurrent item fault',
        );
      const persisted = await db.purchase.findMany({
        where: { companyId: f.company.id },
        include: { items: true },
      });
      expect(persisted).toHaveLength(1);
      expect(persisted[0].folio).toBe(f.prefix + '00001');
      expect(persisted[0].items).toHaveLength(1);
      expect(persisted[0].items[0]).toMatchObject({
        productId: f.product.id,
        quantity: 2,
      });
      expect(
        await db.purchaseItem.count({ where: { productId: failing.id } }),
      ).toBe(0);
      expect(
        await db.companySequence.findUnique({
          where: { companyId_key: { companyId: f.company.id, key: f.key } },
        }),
      ).toMatchObject({ nextValue: 2 });
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER pur_folio_concurrent_fault ON "PurchaseItem"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION pur_folio_concurrent_fault()');
    }
  });

  it('creates the first DRAFT and subsequent folios independently per Company', async () => {
    const a = await fixture(),
      b = await fixture('Pacific/Kiritimati');
    const first = await service().create(a.company.id, a.dto);
    const second = await service().create(a.company.id, a.dto);
    const other = await service().create(b.company.id, b.dto);
    expect(first).toMatchObject({
      folio: a.prefix + '00001',
      status: 'DRAFT',
      total: 232,
    });
    expect(second.folio).toBe(a.prefix + '00002');
    expect(other.folio).toBe(b.prefix + '00001');
    expect(first.items).toHaveLength(1);
  });

  it('starts the current year at one while preserving the previous annual counter', async () => {
    const f = await fixture();
    const previousKey = `PURCHASE_FOLIO:${f.year - 1}`;
    await db.companySequence.create({
      data: { companyId: f.company.id, key: previousKey, nextValue: 42 },
    });
    expect((await service().create(f.company.id, f.dto)).folio).toBe(
      f.prefix + '00001',
    );
    expect(
      await db.companySequence.findUnique({
        where: { companyId_key: { companyId: f.company.id, key: previousKey } },
      }),
    ).toMatchObject({ nextValue: 42 });
  });

  it('rolls back service creation when PostgreSQL rejects a purchase item', async () => {
    const f = await fixture();
    // Fault injection exists only in this disposable test schema, not in production.
    await db.$executeRawUnsafe(`CREATE FUNCTION pur_folio_item_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."productId" = '${f.product.id}' THEN RAISE EXCEPTION 'PUR-FOLIO item fault'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(
      `CREATE TRIGGER pur_folio_item_fault BEFORE INSERT ON "PurchaseItem" FOR EACH ROW EXECUTE FUNCTION pur_folio_item_fault()`,
    );
    try {
      await expect(service().create(f.company.id, f.dto)).rejects.toThrow(
        'PUR-FOLIO item fault',
      );
      expect(
        await db.purchase.count({ where: { companyId: f.company.id } }),
      ).toBe(0);
      expect(
        await db.purchaseItem.count({
          where: { purchase: { companyId: f.company.id } },
        }),
      ).toBe(0);
      expect(
        await db.companySequence.count({ where: { companyId: f.company.id } }),
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER pur_folio_item_fault ON "PurchaseItem"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION pur_folio_item_fault()');
    }
    expect((await service().create(f.company.id, f.dto)).folio).toBe(
      f.prefix + '00001',
    );
  });

  it('serializes first-use allocation on two independent connections', async () => {
    const f = await fixture();
    const one = new PrismaClient({
      datasources: { db: { url: url + '?connection_limit=1' } },
    });
    const two = new PrismaClient({
      datasources: { db: { url: url + '?connection_limit=1' } },
    });
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pids: number[] = [];
    const compete = (client: PrismaClient) =>
      client.$transaction(async (tx) => {
        const [pid] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        pids.push(pid.pid);
        if (++arrived === 2) release();
        await barrier;
        const folio = await folios.allocateNextAvailableFolio(tx, f.company.id);
        return tx.purchase.create({
          data: {
            companyId: f.company.id,
            supplierId: f.supplier.id,
            folio,
            subtotal: 200,
            iva: 32,
            total: 232,
            items: {
              create: {
                productId: f.product.id,
                quantity: 2,
                price: 100,
                subtotal: 200,
              },
            },
          },
        });
      });
    try {
      const results = await Promise.all([compete(one), compete(two)]);
      expect(new Set(pids).size).toBe(2);
      expect(results.map((p) => p.folio).sort()).toEqual([
        f.prefix + '00001',
        f.prefix + '00002',
      ]);
      expect(
        await db.purchase.count({ where: { companyId: f.company.id } }),
      ).toBe(2);
      expect(
        await db.companySequence.findUnique({
          where: { companyId_key: { companyId: f.company.id, key: f.key } },
        }),
      ).toMatchObject({ nextValue: 3 });
    } finally {
      await Promise.all([one.$disconnect(), two.$disconnect()]);
    }
  });

  it('preserves historical and cancelled folios and never reuses the cancelled number', async () => {
    const f = await fixture();
    const old = await db.purchase.create({
      data: {
        companyId: f.company.id,
        supplierId: f.supplier.id,
        folio: 'OC-1700000000000',
        subtotal: 0,
        iva: 0,
        total: 0,
      },
    });
    const cancelled = await db.purchase.create({
      data: {
        companyId: f.company.id,
        supplierId: f.supplier.id,
        folio: f.prefix + '00001',
        status: 'CANCELLED',
        subtotal: 0,
        iva: 0,
        total: 0,
      },
    });
    expect((await service().create(f.company.id, f.dto)).folio).toBe(
      f.prefix + '00002',
    );
    expect(
      await db.purchase.findUnique({ where: { id: old.id } }),
    ).toMatchObject({ folio: old.folio });
    expect(
      await db.purchase.findUnique({ where: { id: cancelled.id } }),
    ).toMatchObject({ folio: cancelled.folio, status: 'CANCELLED' });
  });

  it('enforces SQL uniqueness per Company but allows the same folio in another Company', async () => {
    const f = await fixture(),
      other = await fixture();
    const first = await service().create(f.company.id, f.dto);
    const data = {
      companyId: f.company.id,
      supplierId: f.supplier.id,
      folio: first.folio,
      subtotal: 0,
      iva: 0,
      total: 0,
    };
    await expect(db.purchase.create({ data })).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(
      db.purchase.create({
        data: {
          ...data,
          companyId: other.company.id,
          supplierId: other.supplier.id,
        },
      }),
    ).resolves.toMatchObject({ folio: first.folio });
  });

  it('rolls back root, items and a first-use counter after a real transaction failure', async () => {
    const f = await fixture();
    await expect(
      db.$transaction(async (tx) => {
        const folio = await folios.allocateNextAvailableFolio(tx, f.company.id);
        await tx.purchase.create({
          data: {
            companyId: f.company.id,
            supplierId: f.supplier.id,
            folio,
            subtotal: 200,
            iva: 32,
            total: 232,
            items: {
              create: {
                productId: f.product.id,
                quantity: 2,
                price: 100,
                subtotal: 200,
              },
            },
          },
        });
        throw new Error('PUR-FOLIO deliberate rollback');
      }),
    ).rejects.toThrow('PUR-FOLIO deliberate rollback');
    expect(
      await db.purchase.count({ where: { companyId: f.company.id } }),
    ).toBe(0);
    expect(
      await db.purchaseItem.count({
        where: { purchase: { companyId: f.company.id } },
      }),
    ).toBe(0);
    expect(
      await db.companySequence.count({ where: { companyId: f.company.id } }),
    ).toBe(0);
    expect((await service().create(f.company.id, f.dto)).folio).toBe(
      f.prefix + '00001',
    );
  });

  it('rejects stale exhaustion and rolls back the counter increment', async () => {
    const f = await fixture();
    await db.companySequence.create({
      data: { companyId: f.company.id, key: f.key, nextValue: 99999 },
    });
    expect((await service().create(f.company.id, f.dto)).folio).toBe(
      f.prefix + '99999',
    );
    await expect(service().create(f.company.id, f.dto)).rejects.toMatchObject({
      response: { code: 'PURCHASE_FOLIO_EXHAUSTED' },
    });
    expect(
      await db.companySequence.findUnique({
        where: { companyId_key: { companyId: f.company.id, key: f.key } },
      }),
    ).toMatchObject({ nextValue: 100000 });
    expect(
      await db.purchase.count({ where: { companyId: f.company.id } }),
    ).toBe(1);
  });

  it('rejects foreign supplier and product without reserving numbers', async () => {
    const a = await fixture(),
      b = await fixture();
    await expect(service().create(a.company.id, b.dto)).rejects.toThrow(
      'Proveedor no encontrado',
    );
    await expect(
      service().create(a.company.id, { ...a.dto, items: b.dto.items }),
    ).rejects.toThrow('no encontrado');
    expect(
      await db.companySequence.count({ where: { companyId: a.company.id } }),
    ).toBe(0);
    expect(
      await db.purchase.count({ where: { companyId: a.company.id } }),
    ).toBe(0);
  });

  it('evaluates the New Year boundary in Company local time using PostgreSQL', async () => {
    const result = await db.$queryRaw<
      Array<{ hermosillo: number; kiritimati: number }>
    >(Prisma.sql`
      SELECT EXTRACT(YEAR FROM (TIMESTAMPTZ '2027-01-01 01:00:00+00' AT TIME ZONE 'America/Hermosillo'))::int AS hermosillo,
        EXTRACT(YEAR FROM (TIMESTAMPTZ '2027-01-01 01:00:00+00' AT TIME ZONE 'Pacific/Kiritimati'))::int AS kiritimati
    `);
    expect(result).toEqual([{ hermosillo: 2026, kiritimati: 2027 }]);
  });

  it('exports an annual folio as PDF and keeps the purchase link in receipt history', async () => {
    const f = await fixture();
    const purchase = await service().create(f.company.id, f.dto);
    const output = Object.assign(new PassThrough(), { setHeader: jest.fn() });
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const ended = new Promise<void>((resolve, reject) => {
      output.on('end', resolve);
      output.on('error', reject);
    });
    await service().generatePDF(
      f.company.id,
      purchase.id,
      output as unknown as Response,
    );
    await ended;
    expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF');
    expect(output.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename=compra-${purchase.folio}.pdf`,
    );
    const receipt = await db.purchaseReceipt.create({
      data: {
        companyId: f.company.id,
        purchaseId: purchase.id,
        folio: 'RC-QA',
      },
      include: { purchase: { select: { id: true, folio: true } } },
    });
    expect(receipt.purchase).toEqual({
      id: purchase.id,
      folio: purchase.folio,
    });
  });
});
