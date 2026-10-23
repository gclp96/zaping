import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const enabled = process.env.RUN_UNBATCHED_EXPIRY_MIGRATION_PG === '1';
const suite = enabled ? describe : describe.skip;

suite('INSAP-AUTO-01B physical expiry migration on ephemeral PostgreSQL', () => {
  let db: PrismaClient;
  let companyId: string;
  let productId: string;
  const firstDay = new Date('2028-08-15T00:00:00.000Z');
  const secondDay = new Date('2028-11-20T00:00:00.000Z');

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error('Expiry migration smoke is CI-only');
    }
    const url = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '5432' ||
      url.pathname !== '/zaping_test' ||
      url.username !== 'ci'
    ) {
      throw new Error('Unsafe PostgreSQL expiry test target');
    }

    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRaw<
      { database: string; role: string; superuser: boolean }[]
    >`
      SELECT current_database() AS database,
             current_user AS role,
             rolsuper AS superuser
      FROM pg_roles WHERE rolname = current_user
    `;
    // GitHub's disposable postgres service initializes ci as its local owner;
    // isolation is established by the workflow-only guards and exact DB URL.
    expect(identity).toMatchObject({
      database: 'zaping_test',
      role: 'ci',
    });

    companyId = randomUUID();
    productId = randomUUID();
    await db.company.create({
      data: {
        id: companyId,
        name: 'Expiry migration CI',
        rfc: companyId,
      },
    });
    await db.product.create({
      data: {
        id: productId,
        companyId,
        name: 'Unbatched expiry test product',
        sku: productId,
        inventoryTracking: 'QUANTITY',
        lotTracking: 'OPTIONAL',
      },
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('retains exactly one legacy null-date AVAILABLE position', async () => {
    const old = await db.inventoryPosition.create({
      data: {
        companyId,
        productId,
        inventoryBatchId: null,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        quantity: 10,
        revision: 3,
      },
    });
    expect(old.expirationDate).toBeNull();
    expect(old.quantity).toBe(10);
    expect(old.revision).toBe(3);

    await expect(
      db.inventoryPosition.create({
        data: {
          companyId,
          productId,
          inventoryBatchId: null,
          state: 'AVAILABLE',
          contextType: null,
          contextId: null,
          expirationDate: null,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('separates known calendar days and forbids duplicates for each day', async () => {
    const a = await db.inventoryPosition.create({
      data: {
        companyId,
        productId,
        inventoryBatchId: null,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        expirationDate: firstDay,
        quantity: 6,
      },
    });
    const b = await db.inventoryPosition.create({
      data: {
        companyId,
        productId,
        inventoryBatchId: null,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        expirationDate: secondDay,
        quantity: 4,
      },
    });
    expect(a.id).not.toBe(b.id);
    expect(a.expirationDate?.toISOString()).toBe('2028-08-15T00:00:00.000Z');
    expect(b.expirationDate?.toISOString()).toBe('2028-11-20T00:00:00.000Z');
    await expect(
      db.inventoryPosition.create({
        data: {
          companyId,
          productId,
          inventoryBatchId: null,
          state: 'AVAILABLE',
          contextType: null,
          contextId: null,
          expirationDate: firstDay,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(
      await db.inventoryPosition.aggregate({
        where: { companyId, productId, state: 'AVAILABLE' },
        _sum: { quantity: true },
      }),
    ).toMatchObject({ _sum: { quantity: 20 } });
  });

  it('keeps separate CUSTODY pools per day without altering source identity', async () => {
    const base = {
      companyId,
      productId,
      inventoryBatchId: null,
      state: 'CUSTODY' as const,
      contextType: 'CASE',
      contextId: 'CI-CASE-1',
    };
    await db.inventoryPosition.create({
      data: { ...base, expirationDate: null },
    });
    await db.inventoryPosition.create({
      data: { ...base, expirationDate: firstDay },
    });
    await db.inventoryPosition.create({
      data: { ...base, expirationDate: secondDay },
    });
    await expect(
      db.inventoryPosition.create({
        data: { ...base, expirationDate: firstDay },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      db.inventoryPosition.create({
        data: { ...base, expirationDate: null },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('prevents two expiry sources when a real InventoryBatch is present', async () => {
    const batch = await db.inventoryBatch.create({
      data: {
        companyId,
        productId,
        lotNumber: 'LOT-REAL-CI',
        expirationDate: firstDay,
      },
    });
    const position = await db.inventoryPosition.create({
      data: {
        companyId,
        productId,
        inventoryBatchId: batch.id,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        expirationDate: null,
      },
    });
    expect(position.inventoryBatchId).toBe(batch.id);
    await expect(
      db.inventoryPosition.create({
        data: {
          companyId,
          productId,
          inventoryBatchId: batch.id,
          expirationDate: secondDay,
          state: 'CUSTODY',
          contextType: 'CASE',
          contextId: 'CI-CASE-2',
        },
      }),
    ).rejects.toThrow();
  });
});
