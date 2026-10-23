import { createHash, randomUUID } from 'node:crypto';
import { InventoryPosition, PrismaClient } from '@prisma/client';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { companyLocalDay } from '../src/inventory/physical/physical-expiration-policy';
import {
  PhysicalRequest,
  PositionKey,
} from '../src/inventory/physical/physical-inventory.contract';

const enabled = process.env.RUN_UNBATCHED_EXPIRY_MIGRATION_PG === '1';
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
