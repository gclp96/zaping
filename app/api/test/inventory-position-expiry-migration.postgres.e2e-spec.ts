import { openQaAbPostgres } from './helpers/qa-ab-ephemeral-postgres';
import { createHash, randomUUID } from 'node:crypto';
import { InventoryPosition, Prisma, PrismaClient } from '@prisma/client';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { companyLocalDay } from '../src/inventory/physical/physical-expiration-policy';
import { PhysicalInventoryReadService } from '../src/inventory/physical/physical-inventory-read.service';
import { SalesPhysicalSourceResolver } from '../src/inventory/physical/sales-physical-source-resolver';
import {
  PhysicalRequest,
  PositionKey,
} from '../src/inventory/physical/physical-inventory.contract';

const enabled =
  process.env.RUN_UNBATCHED_EXPIRY_MIGRATION_PG === '1' ||
  process.env.RUN_QA_AB_PG === '1';
const suite = enabled ? describe : describe.skip;

suite(
  'INSAP-AUTO-01B physical expiry migration on ephemeral PostgreSQL',
  () => {
    let db: PrismaClient;
    let companyId: string;
    let productId: string;
    const firstDay = new Date('2028-08-15T00:00:00.000Z');
    const secondDay = new Date('2028-11-20T00:00:00.000Z');

    beforeAll(async () => {
      if (process.env.RUN_QA_AB_PG === '1') {
        db = await openQaAbPostgres();
        // Continue fixture setup below for Foundation; W1 has no shared fixture.
      }
      if (process.env.RUN_QA_AB_PG !== '1') {
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
      }

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

    describe('S3b-S plan-only FEFO and closed production entry', () => {
      const repository = new PhysicalInventoryRepository();
      const planner = new SalesPhysicalSourceResolver(repository);
      const core = new PhysicalInventoryService(repository);
      async function fixture() {
        const company = await db.company.create({
          data: {
            name: 'S3b-S CI',
            rfc: randomUUID(),
            timezone: 'America/Hermosillo',
          },
        });
        const product = await db.product.create({
          data: {
            companyId: company.id,
            name: 'planner material',
            sku: randomUUID(),
            inventoryTracking: 'QUANTITY',
            lotTracking: 'OPTIONAL',
          },
        });
        const actor = await db.user.create({
          data: {
            companyId: company.id,
            firstName: 'S3b-S',
            lastName: 'CI',
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'not-a-login',
            role: 'ADMIN',
          },
        });
        const day = new Date(
          `${companyLocalDay(company.timezone, new Date())}T00:00:00Z`,
        ).getTime();
        const rows: InventoryPosition[] = [];
        for (const [offset, quantity] of [
          [0, 2],
          [1, 3],
          [2, 4],
          [null, 5],
          [-1, 9],
          [3, 0],
        ] as const) {
          rows.push(
            await db.inventoryPosition.create({
              data: {
                companyId: company.id,
                productId: product.id,
                inventoryBatchId: null,
                expirationDate:
                  offset === null ? null : new Date(day + offset * 86400000),
                state: 'AVAILABLE',
                quantity,
              },
            }),
          );
        }
        await db.inventoryPosition.create({
          data: {
            companyId: company.id,
            productId: product.id,
            state: 'CUSTODY',
            contextType: 'CASE',
            contextId: 'planner fixture',
            quantity: 11,
          },
        });
        const batch = await db.inventoryBatch.create({
          data: {
            companyId: company.id,
            productId: product.id,
            lotNumber: randomUUID(),
          },
        });
        await db.inventoryPosition.create({
          data: {
            companyId: company.id,
            productId: product.id,
            inventoryBatchId: batch.id,
            state: 'AVAILABLE',
            quantity: 13,
          },
        });
        const item = { id: randomUUID(), productId: product.id, quantity: 12 };
        return { company, product, actor, rows, item };
      }
      function gate() {
        let release!: () => void;
        let reject!: (error: unknown) => void;
        const wait = new Promise<void>((resolve, fail) => {
          release = resolve;
          reject = fail;
        });
        return { wait, release, reject };
      }
      function clients() {
        const url = new URL(process.env.DATABASE_URL!);
        url.searchParams.set('connection_limit', '1');
        return [1, 2].map(
          () =>
            new PrismaClient({ datasources: { db: { url: url.toString() } } }),
        );
      }

      it('plans three dates FEFO then unknown with partial quantities and no writes; dated execution remains forbidden', async () => {
        const f = await fixture();
        const before = await db.inventoryPosition.findMany({
          where: { companyId: f.company.id },
          orderBy: { id: 'asc' },
        });
        const result = await db.$transaction((tx) =>
          planner.planUnbatchedSources(tx, f.company.id, [f.item]),
        );
        expect(result.plan[0].sources).toEqual(
          f.rows.slice(0, 4).map((p, i) => ({
            positionId: p.id,
            quantity: i === 3 ? 3 : p.quantity,
            expectedRevision: 0,
          })),
        );
        expect(
          await db.inventoryPosition.findMany({
            where: { companyId: f.company.id },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
        await expect(
          db.$transaction((tx) =>
            core.definitiveOut(
              tx,
              {
                companyId: f.company.id,
                actorId: f.actor.id,
                origin: {
                  type: 'INV01A_TEST',
                  id: randomUUID(),
                  operation: 'OUT',
                },
              },
              result.plan[0].sources.map((s) => ({
                sourceId: s.positionId,
                quantity: s.quantity,
                expectedSourceRevision: s.expectedRevision,
              })),
            ),
          ),
        ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(0);
        expect(
          await db.inventoryPosition.findMany({
            where: { companyId: f.company.id },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
      });

      it('rejects insufficient unbatched eligible stock despite expired, custody and real Batch quantities', async () => {
        const f = await fixture();
        await expect(
          db.$transaction((tx) =>
            planner.planUnbatchedSources(tx, f.company.id, [
              { ...f.item, quantity: 15 },
            ]),
          ),
        ).rejects.toMatchObject({ code: 'INSUFFICIENT_PHYSICAL_AVAILABILITY' });
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(0);
      });

      it('keeps production resolution undated-only and preserves REQUIRED and tenant rejection', async () => {
        const f = await fixture();
        const result = await db.$transaction((tx) =>
          planner.resolve(tx, f.company.id, [{ ...f.item, quantity: 3 }]),
        );
        expect(result.plan[0].sources).toEqual([
          { positionId: f.rows[3].id, quantity: 3, expectedRevision: 0 },
        ]);
        const foreign = await fixture();
        await expect(
          db.$transaction((tx) =>
            planner.planUnbatchedSources(tx, foreign.company.id, [f.item]),
          ),
        ).rejects.toMatchObject({ code: 'SALE_PHYSICAL_SOURCE_INVALID' });
        await db.product.update({
          where: { id: f.product.id },
          data: { lotTracking: 'REQUIRED' },
        });
        for (const method of ['resolve', 'planUnbatchedSources'] as const) {
          await expect(
            db.$transaction((tx) =>
              planner[method](tx, f.company.id, [f.item]),
            ),
          ).rejects.toThrow(
            `El producto ${f.product.name} requiere selección de lote para completar la venta`,
          );
        }
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(0);
      });

      it('serializes two physical connections and plans from the refreshed locked revision without consuming dated stock', async () => {
        const f = await fixture();
        const [first, second] = clients();
        const ready = gate(),
          release = gate();
        let ownerPid = 0,
          contenderPid = 0;
        const command = {
          companyId: f.company.id,
          actorId: f.actor.id,
          origin: { type: 'INV01A_TEST', id: randomUUID(), operation: 'OUT' },
        };
        const debit = [
          { sourceId: f.rows[3].id, quantity: 2, expectedSourceRevision: 0 },
        ];
        const owner = first.$transaction(
          async (tx) => {
            const [session] = await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`;
            ownerPid = session.pid;
            const initial = await planner.planUnbatchedSources(
              tx,
              f.company.id,
              [f.item],
            );
            expect(initial.plan[0].sources[3].expectedRevision).toBe(0);
            ready.release();
            await release.wait;
            // Existing undated core operation only. The FEFO preview is not
            // executed, and every reentrant core root is already held by this tx.
            await core.definitiveOut(tx, command, debit);
          },
          { timeout: 15000 },
        );
        void owner.catch(ready.reject);
        try {
          await ready.wait;
          const started = gate();
          const contender = second.$transaction(
            async (tx) => {
              await tx.$executeRaw`SET LOCAL statement_timeout = '7s'`;
              const [session] = await tx.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`;
              contenderPid = session.pid;
              started.release();
              return planner.planUnbatchedSources(tx, f.company.id, [f.item]);
            },
            { timeout: 12000 },
          );
          const outcome = contender.then(
            (value) => ({ value, error: null }),
            (error: unknown) => ({ value: null, error }),
          );
          void contender.catch(started.reject);
          await started.wait;
          expect(ownerPid).not.toBe(contenderPid);
          let blocked = false;
          const deadline = Date.now() + 5000;
          while (!blocked && Date.now() < deadline) {
            const [row] = await db.$queryRaw<
              { blocked: boolean }[]
            >`SELECT ${ownerPid}::integer = ANY(pg_blocking_pids(${contenderPid}::integer)) AS blocked`;
            blocked = row.blocked;
          }
          expect(blocked).toBe(true);
          release.release();
          const result = await outcome;
          expect(result.error).toBeNull();
          expect(result.value?.plan[0].sources).toEqual(
            f.rows.slice(0, 4).map((p, i) => ({
              positionId: p.id,
              quantity: i === 3 ? 3 : p.quantity,
              expectedRevision: i === 3 ? 1 : 0,
            })),
          );
          const replay = await db.$transaction((tx) =>
            core.definitiveOut(tx, command, debit),
          );
          expect(replay.replay).toBe(true);
          expect(
            await db.inventoryPhysicalEffect.count({
              where: { companyId: f.company.id },
            }),
          ).toBe(1);
          expect(
            await db.inventoryPosition.findUniqueOrThrow({
              where: { id: f.rows[3].id },
            }),
          ).toMatchObject({ quantity: 3, revision: 1 });
          expect(
            await db.inventoryPosition.count({
              where: {
                id: { in: f.rows.slice(0, 3).map((p) => p.id) },
                revision: 0,
              },
            }),
          ).toBe(3);
        } finally {
          release.release();
          await owner.finally(() =>
            Promise.all([first.$disconnect(), second.$disconnect()]),
          );
        }
      });

      it('rejects a stale retained revision on the existing undated path, without creating another Effect', async () => {
        const f = await fixture();
        const plan = await db.$transaction((tx) =>
          planner.resolve(tx, f.company.id, [{ ...f.item, quantity: 1 }]),
        );
        const command = {
          companyId: f.company.id,
          actorId: f.actor.id,
          origin: { type: 'INV01A_TEST', id: randomUUID(), operation: 'OUT' },
        };
        await db.$transaction((tx) =>
          core.definitiveOut(tx, command, [
            { sourceId: f.rows[3].id, quantity: 1, expectedSourceRevision: 0 },
          ]),
        );
        await expect(
          db.$transaction((tx) =>
            core.definitiveOut(
              tx,
              { ...command, origin: { ...command.origin, id: randomUUID() } },
              plan.plan[0].sources.map((s) => ({
                sourceId: s.positionId,
                quantity: s.quantity,
                expectedSourceRevision: s.expectedRevision,
              })),
            ),
          ),
        ).rejects.toMatchObject({ code: 'STALE_INVENTORY_REVISION' });
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(1);
        expect(
          await db.inventoryPosition.findUniqueOrThrow({
            where: { id: f.rows[3].id },
          }),
        ).toMatchObject({ quantity: 4, revision: 1 });
      });

      it('rolls back all core writes and evidence after a test-only fault on the existing undated execution path', async () => {
        const f = await fixture();
        const before = await db.inventoryPosition.findMany({
          where: { companyId: f.company.id },
          orderBy: { id: 'asc' },
        });
        let reached = false;
        class FailingRepository extends PhysicalInventoryRepository {
          override async appendLines(
            ...args: Parameters<PhysicalInventoryRepository['appendLines']>
          ): Promise<never> {
            await super.appendLines(...args);
            reached = true;
            throw new Error('S3b-S test-only fault after evidence');
          }
        }
        await expect(
          db.$transaction(async (tx) => {
            const plan = await planner.resolve(tx, f.company.id, [
              { ...f.item, quantity: 1 },
            ]);
            return new PhysicalInventoryService(
              new FailingRepository(),
            ).definitiveOut(
              tx,
              {
                companyId: f.company.id,
                actorId: f.actor.id,
                origin: {
                  type: 'INV01A_TEST',
                  id: randomUUID(),
                  operation: 'OUT',
                },
              },
              plan.plan[0].sources.map((s) => ({
                sourceId: s.positionId,
                quantity: s.quantity,
                expectedSourceRevision: s.expectedRevision,
              })),
            );
          }),
        ).rejects.toMatchObject({
          code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR',
        });
        expect(reached).toBe(true);
        expect(
          await db.inventoryPosition.findMany({
            where: { companyId: f.company.id },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(0);
        expect(
          await db.inventoryPhysicalEffectLine.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(0);
        expect(
          await db.inventoryMovement.count({
            where: { companyId: f.company.id },
          }),
        ).toBe(0);
        expect(
          await db.product.findUniqueOrThrow({ where: { id: f.product.id } }),
        ).toMatchObject({ stock: f.product.stock });
      });
    });

    describe('S3b-R consistent calendar-aware physical reads', () => {
      const reads = new PhysicalInventoryReadService();
      async function readFixture(timezone = 'America/Hermosillo') {
        const company = await db.company.create({
          data: { name: 'S3b-R CI', rfc: randomUUID(), timezone },
        });
        const product = await db.product.create({
          data: {
            companyId: company.id,
            sku: randomUUID(),
            name: 'S3b-R aggregate',
            stock: 999,
            inventoryTracking: 'QUANTITY',
            lotTracking: 'OPTIONAL',
          },
        });
        const today = companyLocalDay(timezone, new Date());
        const midnight = new Date(`${today}T00:00:00Z`).getTime();
        const dates = {
          unknown: null,
          today: new Date(`${today}T00:00:00Z`),
          expired: new Date(midnight - 86400000),
          future: new Date(midnight + 86400000),
        };
        for (const [expirationDate, quantity, custody] of [
          [dates.unknown, 2, false],
          [dates.today, 3, false],
          [dates.expired, 5, false],
          [dates.future, 7, false],
          [dates.expired, 11, true],
          [dates.unknown, 13, true],
        ] as const) {
          await db.inventoryPosition.create({
            data: {
              companyId: company.id,
              productId: product.id,
              inventoryBatchId: null,
              expirationDate,
              quantity,
              ...(custody
                ? { state: 'CUSTODY', contextType: 'CASE', contextId: 'S3b-R' }
                : { state: 'AVAILABLE' }),
            },
          });
        }
        const batches = {} as Record<
          'expired' | 'today' | 'unknown' | 'future' | 'inactive',
          string
        >;
        for (const [name, expirationDate, quantity, isActive] of [
          ['expired', dates.expired, 17, true],
          ['today', dates.today, 19, true],
          ['unknown', null, 23, true],
          ['future', dates.future, 29, true],
          ['inactive', dates.future, 31, false],
        ] as const) {
          const batch = await db.inventoryBatch.create({
            data: {
              companyId: company.id,
              productId: product.id,
              lotNumber: randomUUID(),
              expirationDate,
              isActive,
            },
          });
          batches[name] = batch.id;
          await db.inventoryPosition.create({
            data: {
              companyId: company.id,
              productId: product.id,
              inventoryBatchId: batch.id,
              state: 'AVAILABLE',
              quantity,
            },
          });
        }
        await db.inventoryPosition.create({
          data: {
            companyId: company.id,
            productId: product.id,
            inventoryBatchId: batches.expired,
            state: 'CUSTODY',
            contextType: 'CASE',
            contextId: 'S3b-R',
            quantity: 37,
          },
        });
        return { company, product, batches };
      }
      const expected = {
        authority: 'PHYSICAL_POSITIONS',
        owned: 197,
        available: 83,
        inCustody: 61,
        hasPositions: true,
      };

      // These Company days are always different (UTC-11 vs UTC+14). Together,
      // local yesterday/today detect an accidental server/UTC cutoff at any hour.
      it.each(['Pacific/Pago_Pago', 'Pacific/Kiritimati'])(
        'separates NULL/D/past/future and retains expired owned/custody using Company %s',
        async (timezone) => {
          const f = await readFixture(timezone);
          expect(await reads.product(db, f.company.id, f.product.id)).toEqual(
            expected,
          );
          expect(
            await db.product.findUniqueOrThrow({ where: { id: f.product.id } }),
          ).toMatchObject({ stock: 999 });
          expect(
            await db.inventoryPhysicalEffect.count({
              where: { companyId: f.company.id },
            }),
          ).toBe(0);
        },
      );

      it('keeps product and real-Batch reads coherent, including expired custody and inactive Batch', async () => {
        const f = await readFixture();
        const results = [
          ['expired', 54, 0, 37],
          ['today', 19, 19, 0],
          ['unknown', 23, 23, 0],
          ['future', 29, 29, 0],
          ['inactive', 31, 0, 0],
        ] as const;
        for (const [name, owned, available, inCustody] of results) {
          expect(
            await reads.batch(db, f.company.id, f.product.id, f.batches[name]),
          ).toEqual({
            authority: 'PHYSICAL_POSITIONS',
            owned,
            available,
            inCustody,
            hasPositions: true,
          });
        }
        expect(await reads.product(db, f.company.id, f.product.id)).toEqual(
          expected,
        );
      });

      it('preserves the historical Batch stored calendar component independently of session timezone', async () => {
        const f = await readFixture();
        const day = companyLocalDay(f.company.timezone, new Date());
        await db.inventoryBatch.update({
          where: { id: f.batches.today },
          data: { expirationDate: new Date(`${day}T23:59:59Z`) },
        });
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`SET LOCAL TIME ZONE 'Pacific/Kiritimati'`;
          expect(await reads.product(tx, f.company.id, f.product.id)).toEqual(
            expected,
          );
          expect(
            await reads.batch(tx, f.company.id, f.product.id, f.batches.today),
          ).toMatchObject({ owned: 19, available: 19 });
        });
      });

      it('keeps physical totals when Product is inactive and returns zeroes without legacy fallback when empty', async () => {
        const f = await readFixture();
        await db.product.update({
          where: { id: f.product.id },
          data: { isActive: false },
        });
        expect(await reads.product(db, f.company.id, f.product.id)).toEqual({
          ...expected,
          available: 0,
        });
        const empty = await db.product.create({
          data: {
            companyId: f.company.id,
            name: 'empty physical',
            sku: randomUUID(),
            stock: 123,
          },
        });
        expect(await reads.product(db, f.company.id, empty.id)).toEqual({
          authority: 'PHYSICAL_POSITIONS',
          owned: 0,
          available: 0,
          inCustody: 0,
          hasPositions: false,
        });
        const batch = await db.inventoryBatch.create({
          data: {
            companyId: f.company.id,
            productId: empty.id,
            lotNumber: randomUUID(),
          },
        });
        expect(
          await reads.batch(db, f.company.id, empty.id, batch.id),
        ).toMatchObject({
          owned: 0,
          available: 0,
          inCustody: 0,
          hasPositions: false,
        });
      });

      it('isolates Company and rejects foreign or mismatched Batch without exposing their quantities', async () => {
        const f = await readFixture();
        const foreign = await readFixture('Asia/Tokyo');
        await expect(
          reads.product(db, f.company.id, foreign.product.id),
        ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
        await expect(
          reads.batch(db, f.company.id, f.product.id, foreign.batches.today),
        ).rejects.toMatchObject({ code: 'INVENTORY_BATCH_NOT_FOUND' });
        const other = await db.product.create({
          data: {
            companyId: f.company.id,
            name: 'other product',
            sku: randomUUID(),
          },
        });
        await expect(
          reads.batch(db, f.company.id, other.id, f.batches.today),
        ).rejects.toMatchObject({ code: 'INVENTORY_BATCH_PRODUCT_MISMATCH' });
        expect(await reads.product(db, f.company.id, f.product.id)).toEqual(
          expected,
        );
      });

      it('uses fresh statement time in an already started transaction, with one aggregate snapshot', async () => {
        const f = await readFixture();
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT transaction_timestamp()`;
          let statements = 0;
          const observed = {
            $queryRaw: async (sql: Prisma.Sql) => {
              statements++;
              expect(sql.text).toContain(
                'statement_timestamp() AT TIME ZONE c.timezone',
              );
              expect(sql.text).not.toMatch(
                /CURRENT_DATE|CURRENT_TIMESTAMP|transaction_timestamp|\bnow\(/i,
              );
              // Real SQL, not a fabricated aggregate. The wrapper only observes
              // the two clocks in the same statement as the production query.
              const rows = await tx.$queryRaw<
                Array<{ fresh: boolean }>
              >(Prisma.sql`
              SELECT result.*, statement_timestamp() > transaction_timestamp() AS fresh
              FROM (${sql}) result
            `);
              expect(rows[0].fresh).toBe(true);
              return rows;
            },
          } as unknown as Prisma.TransactionClient;
          expect(
            await reads.product(observed, f.company.id, f.product.id),
          ).toEqual(expected);
          expect(statements).toBe(1);
        });
      });

      it('fails closed for invalid persisted Company timezone rather than returning misleading availability', async () => {
        const f = await readFixture();
        await db.company.update({
          where: { id: f.company.id },
          data: { timezone: 'Invalid/Timezone' },
        });
        await expect(
          reads.product(db, f.company.id, f.product.id),
        ).rejects.toMatchObject({
          code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR',
        });
        expect(
          await db.inventoryPosition.aggregate({
            where: { companyId: f.company.id },
            _sum: { quantity: true },
          }),
        ).toMatchObject({ _sum: { quantity: 197 } });
      });
    });

    describe('S2 repository identity, replay and closed operational gate', () => {
      const repository = new PhysicalInventoryRepository();
      const physical = new PhysicalInventoryService(repository);
      let actorId: string;

      beforeAll(async () => {
        actorId = randomUUID();
        await db.user.create({
          data: {
            id: actorId,
            companyId,
            firstName: 'S2',
            lastName: 'CI',
            email: `${actorId}@example.invalid`,
            passwordHash: 'not-a-login',
            role: 'ADMIN',
          },
        });
      });

      async function pools(custody = false) {
        const id = randomUUID();
        await db.product.create({
          data: {
            id,
            companyId,
            name: 'S2 identity fixture',
            sku: id,
            inventoryTracking: 'QUANTITY',
            lotTracking: 'OPTIONAL',
          },
        });
        const keys: PositionKey[] = [null, '2028-08-15', '2028-11-20'].map(
          (expirationDate) => ({
            productId: id,
            inventoryBatchId: null,
            expirationDate,
            ...(custody
              ? {
                  state: 'CUSTODY' as const,
                  contextType: 'CASE',
                  contextId: 'S2-case',
                }
              : {
                  state: 'AVAILABLE' as const,
                  contextType: null,
                  contextId: null,
                }),
          }),
        );
        const positions = await db.$transaction(async (tx) => {
          const rows: InventoryPosition[] = [];
          for (const key of keys)
            rows.push(await repository.createPosition(tx, companyId, key));
          return rows;
        });
        return { id, keys, positions };
      }
      function creditRequest(key: PositionKey): PhysicalRequest {
        return {
          companyId,
          actorId,
          origin: {
            type: 'INV01A_TEST',
            id: randomUUID(),
            operation: 'CREDIT',
          },
          operation: {
            kind: 'CREDIT',
            credits: [{ target: key, quantity: 3 }],
          },
        };
      }
      function clients() {
        // Same CI-only target already verified above; one physical connection per
        // independent client. No fallback, local target, or automatic provisioning.
        const url = new URL(process.env.DATABASE_URL!);
        url.searchParams.set('connection_limit', '1');
        return [1, 2].map(
          () =>
            new PrismaClient({ datasources: { db: { url: url.toString() } } }),
        );
      }
      function gate() {
        let release!: () => void;
        let reject!: (error: unknown) => void;
        const wait = new Promise<void>((resolve, fail) => {
          release = resolve;
          reject = fail;
        });
        return { wait, release, reject };
      }

      it.each([false, true])(
        'locks exactly NULL/A/B for CUSTODY=%s and retains ID/revision',
        async (custody) => {
          const { keys, positions } = await pools(custody);
          for (const [index, key] of keys.entries()) {
            const locked = await db.$transaction((tx) =>
              repository.lockPositions(tx, companyId, [], [key]),
            );
            expect(locked).toHaveLength(1);
            expect(locked[0]).toMatchObject({
              id: positions[index].id,
              revision: 0,
              quantity: 0,
            });
            expect(
              locked[0].expirationDate?.toISOString().slice(0, 10) ?? null,
            ).toBe(key.expirationDate);
          }
        },
      );

      it('keeps historical Sales restricted to NULL when dated receipt identities coexist', async () => {
        const { id, positions } = await pools();
        await db.inventoryPosition.updateMany({
          where: { companyId, productId: id },
          data: { quantity: 9 },
        });
        const before = await db.inventoryPosition.findMany({
          where: { companyId, productId: id },
          orderBy: { id: 'asc' },
        });
        const result = await db.$transaction((tx) =>
          new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
            { id: randomUUID(), productId: id, quantity: 3 },
          ]),
        );
        expect(result.plan).toHaveLength(1);
        expect(result.plan[0].sources).toEqual([
          { positionId: positions[0].id, quantity: 3, expectedRevision: 0 },
        ]);
        expect(
          await db.inventoryPosition.findMany({
            where: { companyId, productId: id },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
        expect(
          await db.inventoryPhysicalEffect.count({
            where: {
              companyId,
              lines: { some: { position: { productId: id } } },
            },
          }),
        ).toBe(0);
      });

      it('reports physical availability for REQUIRED without authorizing its unbatched consumption', async () => {
        const { id, positions } = await pools();
        await db.product.update({
          where: { id },
          data: { lotTracking: 'REQUIRED' },
        });
        await db.inventoryPosition.updateMany({
          where: { companyId, productId: id },
          data: { quantity: 2 },
        });
        const company = await db.company.findUniqueOrThrow({
          where: { id: companyId },
        });
        const today = companyLocalDay(company.timezone, new Date());
        for (const index of [1, 2]) {
          await db.inventoryPosition.update({
            where: { id: positions[index].id },
            data: {
              expirationDate: new Date(
                new Date(today + 'T00:00:00Z').getTime() + index * 86400000,
              ),
            },
          });
        }
        const before = await db.inventoryPosition.findMany({
          where: { companyId, productId: id },
          orderBy: { id: 'asc' },
        });
        expect(
          await new PhysicalInventoryReadService().product(db, companyId, id),
        ).toMatchObject({ owned: 6, available: 6, inCustody: 0 });
        await expect(
          db.$transaction((tx) =>
            new SalesPhysicalSourceResolver(repository).resolve(tx, companyId, [
              { id: randomUUID(), productId: id, quantity: 1 },
            ]),
          ),
        ).rejects.toThrow('requiere selección de lote');
        const origin = {
          type: 'AB_REQUIRED_GATE',
          id: randomUUID(),
          operation: 'OUT',
        };
        await expect(
          db.$transaction((tx) =>
            physical.definitiveOut(tx, { companyId, actorId, origin }, [
              {
                sourceId: positions[0].id,
                quantity: 1,
                expectedSourceRevision: 0,
              },
            ]),
          ),
        ).rejects.toMatchObject({ code: 'INVALID_PHYSICAL_REQUEST' });
        expect(
          await db.inventoryPosition.findMany({
            where: { companyId, productId: id },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId, originId: origin.id },
          }),
        ).toBe(0);
      });

      it('credits/replays the historical NULL pool without touching dated siblings; stale revision still fails', async () => {
        const { keys, positions } = await pools();
        const oldKey = { ...keys[0] };
        delete oldKey.expirationDate;
        const request = creditRequest(oldKey);
        const historicalHash = createHash('sha256')
          .update(
            JSON.stringify({
              version: 1,
              companyId,
              origin: request.origin,
              operation: request.operation,
              reason: null,
            }),
          )
          .digest('hex');
        const applied = await db.$transaction((tx) =>
          physical.apply(tx, request),
        );
        expect(applied.effect.requestHash).toBe(historicalHash);
        expect(applied.effect.lines).toHaveLength(1);
        expect(applied.effect.lines[0]).toMatchObject({
          positionId: positions[0].id,
          delta: 3,
          quantityBefore: 0,
          quantityAfter: 3,
          revisionBefore: 0,
          revisionAfter: 1,
        });
        const replay = await db.$transaction((tx) =>
          physical.apply(tx, {
            ...request,
            operation: {
              kind: 'CREDIT',
              credits: [{ target: keys[0], quantity: 3 }],
            },
          }),
        );
        expect(replay.replay).toBe(true);
        expect(replay.effect.id).toBe(applied.effect.id);
        expect(
          await db.inventoryPosition.findUniqueOrThrow({
            where: { id: positions[0].id },
          }),
        ).toMatchObject({ quantity: 3, revision: 1, expirationDate: null });
        expect(
          await db.inventoryPosition.count({
            where: {
              id: { in: positions.slice(1).map((p) => p.id) },
              quantity: 0,
              revision: 0,
            },
          }),
        ).toBe(2);
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId, originId: request.origin.id },
          }),
        ).toBe(1);
        await expect(
          db.$transaction((tx) =>
            physical.definitiveOut(
              tx,
              { ...request, origin: { ...request.origin, id: randomUUID() } },
              [
                {
                  sourceId: positions[0].id,
                  quantity: 1,
                  expectedSourceRevision: 0,
                },
              ],
            ),
          ),
        ).rejects.toMatchObject({ code: 'STALE_INVENTORY_REVISION' });
      });

      it.each([
        'CREDIT',
        'TRANSFER',
        'DEFINITIVE_OUT',
        'COUNT_CORRECTION',
      ] as const)('rejects dated %s atomically in S2', async (kind) => {
        const { keys, positions } = await pools();
        const request = creditRequest(keys[1]);
        const operations: PhysicalRequest['operation'][] = [
          request.operation,
          {
            kind: 'TRANSFER',
            transfers: [
              { sourceId: positions[1].id, quantity: 1, target: keys[0] },
            ],
          },
          {
            kind: 'DEFINITIVE_OUT',
            debits: [{ sourceId: positions[1].id, quantity: 1 }],
          },
          {
            kind: 'COUNT_CORRECTION',
            sourceId: positions[1].id,
            countedQuantity: 1,
            expectedRevision: 0,
          },
        ];
        const before = await db.inventoryPosition.findMany({
          where: { productId: keys[0].productId },
          orderBy: { id: 'asc' },
        });
        await expect(
          db.$transaction((tx) =>
            physical.apply(tx, {
              ...request,
              reason: 'S2 gate',
              operation: operations.find((op) => op.kind === kind)!,
            }),
          ),
        ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
        expect(
          await db.inventoryPosition.findMany({
            where: { productId: keys[0].productId },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId, originId: request.origin.id },
          }),
        ).toBe(0);
      });

      it.each(['same-day', 'different-day'] as const)(
        'proves real row-lock isolation across two connections: %s',
        async (scenario) => {
          const { keys, positions } = await pools();
          const [first, second] = clients();
          const ready = gate();
          const release = gate();
          let firstPid = 0;
          let secondPid = 0;
          const owner = first.$transaction(
            async (tx) => {
              const [session] = await tx.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`;
              firstPid = session.pid;
              await repository.lockPositions(tx, companyId, [], [keys[1]]);
              ready.release();
              await release.wait;
            },
            { timeout: 15000 },
          );
          void owner.catch(ready.reject);
          try {
            await ready.wait;
            const started = gate();
            const contender = second.$transaction(
              async (tx) => {
                await tx.$executeRaw`SET LOCAL statement_timeout = '7s'`;
                const [session] = await tx.$queryRaw<
                  { pid: number }[]
                >`SELECT pg_backend_pid() AS pid`;
                secondPid = session.pid;
                started.release();
                return repository.lockPositions(
                  tx,
                  companyId,
                  [],
                  [keys[scenario === 'same-day' ? 1 : 2]],
                );
              },
              { timeout: 12000 },
            );
            const outcome = contender.then(
              (value) => ({ value, error: null }),
              (error: unknown) => ({ value: null, error }),
            );
            void contender.catch(started.reject);
            await started.wait;
            expect(firstPid).not.toBe(secondPid);
            if (scenario === 'same-day') {
              let blocked = false;
              const deadline = Date.now() + 5000;
              while (!blocked && Date.now() < deadline) {
                const [row] = await db.$queryRaw<
                  { blocked: boolean }[]
                >`SELECT ${firstPid}::integer = ANY(pg_blocking_pids(${secondPid}::integer)) AS blocked`;
                blocked = row.blocked;
              }
              expect(blocked).toBe(true);
              release.release();
            }
            const result = await outcome;
            expect(result.error).toBeNull();
            expect(result.value?.map((p) => p.id)).toEqual([
              positions[scenario === 'same-day' ? 1 : 2].id,
            ]);
          } finally {
            release.release();
            await owner.finally(() =>
              Promise.all([first.$disconnect(), second.$disconnect()]),
            );
          }
        },
      );

      it('serializes simultaneous legacy credits as one Effect and one replay, leaving dated pools untouched', async () => {
        const { keys, positions } = await pools();
        const request = creditRequest(keys[0]);
        const [first, second] = clients();
        const start = gate();
        const pids: number[] = [];
        try {
          const results = await Promise.all(
            [first, second].map((client) =>
              client.$transaction(
                async (tx) => {
                  const [session] = await tx.$queryRaw<
                    { pid: number }[]
                  >`SELECT pg_backend_pid() AS pid`;
                  pids.push(session.pid);
                  if (pids.length === 2) start.release();
                  await start.wait;
                  return physical.apply(tx, request);
                },
                { timeout: 15000 },
              ),
            ),
          );
          expect(new Set(pids).size).toBe(2);
          expect(results.map((r) => r.replay).sort()).toEqual([false, true]);
          expect(results[0].effect.id).toBe(results[1].effect.id);
          expect(
            await db.inventoryPhysicalEffect.count({
              where: { companyId, originId: request.origin.id },
            }),
          ).toBe(1);
          expect(
            await db.inventoryPosition.findUniqueOrThrow({
              where: { id: positions[0].id },
            }),
          ).toMatchObject({ quantity: 3, revision: 1 });
          expect(
            await db.inventoryPosition.count({
              where: {
                id: { in: positions.slice(1).map((p) => p.id) },
                quantity: 0,
                revision: 0,
              },
            }),
          ).toBe(2);
        } finally {
          start.release();
          await Promise.all([first.$disconnect(), second.$disconnect()]);
        }
      });

      describe('S3a persisted Company day after the existing locks', () => {
        async function batchFixture(
          timezone = 'America/Hermosillo',
          expirationDate: Date | null = null,
        ) {
          const company = await db.company.create({
            data: { name: 'S3a isolated CI', rfc: randomUUID(), timezone },
          });
          const product = await db.product.create({
            data: {
              companyId: company.id,
              name: 'S3a batch',
              sku: randomUUID(),
              inventoryTracking: 'QUANTITY',
              lotTracking: 'OPTIONAL',
            },
          });
          const actor = await db.user.create({
            data: {
              companyId: company.id,
              firstName: 'S3a',
              lastName: 'CI',
              email: `${randomUUID()}@example.invalid`,
              passwordHash: 'not-a-login',
              role: 'ADMIN',
            },
          });
          const batch = await db.inventoryBatch.create({
            data: {
              companyId: company.id,
              productId: product.id,
              lotNumber: randomUUID(),
              expirationDate,
            },
          });
          const position = await db.inventoryPosition.create({
            data: {
              companyId: company.id,
              productId: product.id,
              inventoryBatchId: batch.id,
              state: 'AVAILABLE',
              quantity: 4,
            },
          });
          const request: PhysicalRequest = {
            companyId: company.id,
            actorId: actor.id,
            origin: { type: 'INV01A_TEST', id: randomUUID(), operation: 'OUT' },
            operation: {
              kind: 'DEFINITIVE_OUT',
              debits: [
                {
                  sourceId: position.id,
                  quantity: 1,
                  expectedSourceRevision: 0,
                },
              ],
            },
          };
          return { company, product, actor, batch, position, request };
        }

        it.each(['America/Hermosillo', 'Asia/Tokyo'])(
          'permits today throughout the persisted Company day in %s; replay survives later expiry',
          async (timezone) => {
            const day = companyLocalDay(timezone, new Date());
            const f = await batchFixture(
              timezone,
              new Date(`${day}T00:00:00Z`),
            );
            const applied = await db.$transaction((tx) =>
              physical.apply(tx, f.request),
            );
            expect(applied.replay).toBe(false);
            expect(applied.effect.lines).toHaveLength(1);
            expect(applied.effect.lines[0]).toMatchObject({
              positionId: f.position.id,
              delta: -1,
              quantityBefore: 4,
              quantityAfter: 3,
              revisionBefore: 0,
              revisionAfter: 1,
            });
            await db.inventoryBatch.update({
              where: { id: f.batch.id },
              data: { expirationDate: new Date('2000-01-01') },
            });
            await db.company.update({
              where: { id: f.company.id },
              data: { timezone: 'Invalid/Timezone' },
            });
            const replay = await db.$transaction((tx) =>
              physical.apply(tx, f.request),
            );
            expect(replay.replay).toBe(true);
            expect(replay.effect.id).toBe(applied.effect.id);
            expect(
              await db.inventoryPhysicalEffect.count({
                where: { companyId: f.company.id },
              }),
            ).toBe(1);
            expect(
              await db.inventoryPosition.findUniqueOrThrow({
                where: { id: f.position.id },
              }),
            ).toMatchObject({ quantity: 3, revision: 1 });
          },
        );

        it('allows an unknown Batch expiry without inventing a day', async () => {
          const f = await batchFixture();
          await db.$transaction((tx) => physical.apply(tx, f.request));
          expect(
            await db.inventoryBatch.findUniqueOrThrow({
              where: { id: f.batch.id },
            }),
          ).toMatchObject({ expirationDate: null });
          expect(
            await db.inventoryPosition.findUniqueOrThrow({
              where: { id: f.position.id },
            }),
          ).toMatchObject({ quantity: 3, revision: 1 });
        });

        it('rejects expired Batch atomically and does not conflate the failure with replay', async () => {
          const f = await batchFixture(
            'America/Hermosillo',
            new Date('2000-01-01'),
          );
          await expect(
            db.$transaction((tx) => physical.apply(tx, f.request)),
          ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
          expect(
            await db.inventoryPhysicalEffect.count({
              where: { companyId: f.company.id },
            }),
          ).toBe(0);
          expect(
            await db.inventoryPosition.findUniqueOrThrow({
              where: { id: f.position.id },
            }),
          ).toMatchObject({ quantity: 4, revision: 0 });
        });

        it('rolls back a valid dated-Batch mutation and its persisted lines after a test-only injected failure', async () => {
          const f = await batchFixture(
            'America/Hermosillo',
            new Date('2099-01-01'),
          );
          let reached = false;
          class FailingRepository extends PhysicalInventoryRepository {
            override async appendLines(
              ...args: Parameters<PhysicalInventoryRepository['appendLines']>
            ): Promise<never> {
              await super.appendLines(...args);
              reached = true;
              throw new Error('S3a test-only fault after lines');
            }
          }
          const failing = new PhysicalInventoryService(new FailingRepository());
          await expect(
            db.$transaction((tx) => failing.apply(tx, f.request)),
          ).rejects.toMatchObject({
            code: 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR',
          });
          expect(reached).toBe(true);
          expect(
            await db.inventoryPhysicalEffect.count({
              where: { companyId: f.company.id },
            }),
          ).toBe(0);
          expect(
            await db.inventoryPhysicalEffectLine.count({
              where: { companyId: f.company.id },
            }),
          ).toBe(0);
          expect(
            await db.inventoryPosition.findUniqueOrThrow({
              where: { id: f.position.id },
            }),
          ).toMatchObject({ quantity: 4, revision: 0 });
        });

        it.each(['expired-batch', 'invalid-zone'] as const)(
          'observes %s committed while waiting for Batch lock on a separate connection',
          async (scenario) => {
            const f = await batchFixture(
              'America/Hermosillo',
              new Date('2099-01-01'),
            );
            const [first, second] = clients();
            const ready = gate();
            const release = gate();
            let ownerPid = 0;
            let contenderPid = 0;
            const owner = first.$transaction(
              async (tx) => {
                const [session] = await tx.$queryRaw<
                  { pid: number }[]
                >`SELECT pg_backend_pid() AS pid`;
                ownerPid = session.pid;
                await tx.inventoryBatch.update({
                  where: { id: f.batch.id },
                  data: {
                    expirationDate: new Date(
                      scenario === 'expired-batch'
                        ? '2000-01-01'
                        : '2099-01-01',
                    ),
                  },
                });
                if (scenario === 'invalid-zone')
                  await tx.company.update({
                    where: { id: f.company.id },
                    data: { timezone: 'Invalid/Timezone' },
                  });
                ready.release();
                await release.wait;
              },
              { timeout: 15000 },
            );
            void owner.catch(ready.reject);
            try {
              await ready.wait;
              const started = gate();
              const contender = second.$transaction(
                async (tx) => {
                  await tx.$executeRaw`SET LOCAL statement_timeout = '7s'`;
                  const [session] = await tx.$queryRaw<
                    { pid: number }[]
                  >`SELECT pg_backend_pid() AS pid`;
                  contenderPid = session.pid;
                  started.release();
                  return physical.apply(tx, f.request);
                },
                { timeout: 12000 },
              );
              const outcome = contender.then(
                (value) => ({ value, error: null }),
                (error: unknown) => ({ value: null, error }),
              );
              void contender.catch(started.reject);
              await started.wait;
              expect(ownerPid).not.toBe(contenderPid);
              let blocked = false;
              const deadline = Date.now() + 5000;
              while (!blocked && Date.now() < deadline) {
                const [row] = await db.$queryRaw<
                  { blocked: boolean }[]
                >`SELECT ${ownerPid}::integer = ANY(pg_blocking_pids(${contenderPid}::integer)) AS blocked`;
                blocked = row.blocked;
              }
              expect(blocked).toBe(true);
              release.release();
              const result = await outcome;
              expect(result.value).toBeNull();
              expect(result.error).toMatchObject({
                code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
              });
              expect(
                await db.inventoryPhysicalEffect.count({
                  where: { companyId: f.company.id },
                }),
              ).toBe(0);
              expect(
                await db.inventoryPosition.findUniqueOrThrow({
                  where: { id: f.position.id },
                }),
              ).toMatchObject({ quantity: 4, revision: 0 });
            } finally {
              release.release();
              await owner.finally(() =>
                Promise.all([first.$disconnect(), second.$disconnect()]),
              );
            }
          },
        );
      });
    });
  },
);
