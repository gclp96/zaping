import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  concurrencyQaConfiguration,
  verifyConcurrencyQaDatabase,
} from './helpers/dispatch-correction-material-concurrency-postgres-authorization';
import {
  abortableTwoPartyBarrier,
  concurrencyOrigin,
  expectCommittedCorrection,
  latch,
  movingCommand,
  movingTransfer,
  observeBlocking,
  settled,
  transactionPid,
} from './helpers/dispatch-correction-material-concurrency-fixture';
import {
  orchestrationHarness,
  orchestrationState,
  commandContext,
  commandIntent,
} from './helpers/dispatch-correction-material-orchestration-fixture';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { inventoryAuthorityFence } from '../src/inventory/physical/inventory-authority-fence';
import { MaterialCorrectionCommandError } from '../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.contract';

// Hoisted by ts-jest before any source/helper imports of @prisma/client.
// This returns the REAL installed generated client, not simulated database calls.
jest.mock('@prisma/client', () => {
  const loader = jest.requireActual<
    typeof import('./helpers/dispatch-correction-material-concurrency-client')
  >('./helpers/dispatch-correction-material-concurrency-client');
  return loader.concurrencyPrismaWithoutDotenv();
});

// Manual opt-in ONLY. No describe.skip, pending cases, dotenv, DB provisioning or cleanup.
// Missing authorization fails before any client is constructed, not a misleading skip.
// RR review: a committed DRAFT/CONFIRMED rejects correction; CANCELLED without
// physical effects can precede correction (existing B fixtures/contracts).
// CREATE AFTER correction lacks the 01E admission guard: STOP that direction.
// CREATE/CANCEL/CONFIRM two-direction global races remain uncertified here;
// no passing placeholder, skip, or invented future-guard expectation is added.
// Real deadlock victim choice / real transport interruption are NOT certified here.
// Their error-classification inputs are injected explicitly in the last test.
describe('HC-DSP-COR-01C-C isolated MATERIAL concurrency', () => {
  jest.setTimeout(30000);
  const clients: PrismaClient[] = [];
  const ownedPids = new Set<number>();
  let a: PrismaClient, b: PrismaClient, observer: PrismaClient;
  let pidA: number, pidB: number, runId: string;

  beforeAll(async () => {
    const config = concurrencyQaConfiguration();
    runId = config.runId;
    new InventoryRuntimeCompatibilityService().identity();
    for (let index = 0; index < 3; index++) {
      const db = new PrismaClient({ datasources: { db: { url: config.url } } });
      clients.push(db);
      const identity = await verifyConcurrencyQaDatabase(db, ownedPids, true);
      expect(ownedPids.has(identity.pid)).toBe(false);
      ownedPids.add(identity.pid);
      // Fail before fixtures if the no-dotenv loader crosses Jest's Date realm.
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const [row] = await tx.$queryRaw<{ at: Date }[]>`
          SELECT date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC') AS at`;
        expect(row.at).toBeInstanceOf(Date);
        expect(Number.isFinite(row.at.getTime())).toBe(true);
      });
    }
    [a, b, observer] = clients;
    [pidA, pidB] = [...ownedPids];
    expect(ownedPids.size).toBe(3);
  });
  beforeEach(async () => {
    const identity = await verifyConcurrencyQaDatabase(
      observer,
      ownedPids,
      false,
    );
    expect(ownedPids.has(identity.pid)).toBe(true);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await Promise.all(clients.map((db) => db.$disconnect()));
  });

  function harness(db: PrismaClient, expectedPid: number) {
    const h = orchestrationHarness(db),
      write = h.repo.write.bind(h.repo) as typeof h.repo.write;
    jest.spyOn(h.repo, 'write').mockImplementation((fn, policy) =>
      write(async (tx) => {
        expect(await transactionPid(tx)).toBe(expectedPid);
        return fn(tx);
      }, policy),
    );
    return h;
  }

  async function held(ready: Promise<void>, work: ReturnType<typeof settled>) {
    await Promise.race([
      ready,
      work.then((result) => {
        if (!result.ok) throw result.error;
        throw new Error('Holder finished before its test barrier');
      }),
    ]);
  }

  it.each(['simple', 'grouped', 'batch'] as const)(
    'two independent connections race distinct keys on one %s Dispatch; one rejects contractually',
    async (kind) => {
      const o = await concurrencyOrigin(a, runId, kind),
        c = commandContext(o),
        intent = commandIntent();
      const contexts = [c, { ...c, idempotencyKey: randomUUID() }];
      const before = await orchestrationState(observer, c.companyId);
      const hs = [harness(a, pidA), harness(b, pidB)],
        barrier = abortableTwoPartyBarrier();
      const arrived: number[] = [];
      for (const h of hs) {
        const create = h.repo.createClaim.bind(
          h.repo,
        ) as typeof h.repo.createClaim;
        jest
          .spyOn(h.repo, 'createClaim')
          .mockImplementation(async (tx, data) => {
            arrived.push(await transactionPid(tx));
            await barrier.arrive();
            return create(tx, data);
          });
      }
      const results = await Promise.all(
        hs.map((h, index) =>
          settled(
            h.service
              .execute(contexts[index], intent)
              .catch((error: unknown) => {
                barrier.abort(error);
                throw error;
              }),
          ),
        ),
      );
      expect(new Set(arrived)).toEqual(new Set([pidA, pidB]));
      const winner = results.findIndex((result) => result.ok);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const win = results[winner],
        lose = results[1 - winner];
      if (!win?.ok || !lose || lose.ok)
        throw new Error('Expected one success and one rejection');
      expect(lose.error).toBeInstanceOf(MaterialCorrectionCommandError);
      expect(lose.error).toMatchObject({ code: 'CORRECTION_ALREADY_EXISTS' });
      const after = await orchestrationState(observer, c.companyId);
      expectCommittedCorrection(
        o,
        before,
        after,
        win.value,
        contexts[winner].idempotencyKey,
      );
      expect(after.claims).toHaveLength(before.claims.length + 1);
      expect(
        after.claims.some(
          (cl) => cl.key === contexts[1 - winner].idempotencyKey,
        ),
      ).toBe(false);
      const replay = await hs[winner].service.execute(contexts[winner], intent);
      expect(replay).toEqual({ replay: true, witness: win.value.witness });
      expect(await orchestrationState(observer, c.companyId)).toEqual(after);
    },
  );

  it.each(['writer', 'correction'] as const)(
    'real physical transfer versus correction, %s commits first',
    async (first) => {
      const o = await concurrencyOrigin(a, runId),
        c = commandContext(o),
        h = harness(a, pidA);
      const before = await orchestrationState(observer, c.companyId),
        ready = latch(),
        release = latch();
      const physical = orchestrationHarness(b);
      if (first === 'correction') {
        const items = h.repo.createEvidenceItems.bind(
          h.repo,
        ) as typeof h.repo.createEvidenceItems;
        jest
          .spyOn(h.repo, 'createEvidenceItems')
          .mockImplementation(async (...args) => {
            await items(...args);
            ready.release();
            await release.ready;
          });
      }
      const writer = () =>
        b.$transaction(
          async (tx) => {
            expect(await transactionPid(tx)).toBe(pidB);
            await inventoryAuthorityFence(tx, c.companyId, 'shared');
            const result = await physical.physical.transfer(
              tx,
              movingCommand(o),
              movingTransfer(o),
            );
            expect(result.replay).toBe(false);
            await physical.projections.apply(tx, c.companyId, result);
            if (first === 'writer') {
              ready.release();
              await release.ready;
            }
            return result;
          },
          { timeout: 15000, isolationLevel: 'ReadCommitted' },
        );
      const leader =
        first === 'writer'
          ? settled(writer())
          : settled(h.service.execute(c, commandIntent()));
      let follower: ReturnType<typeof settled> | undefined;
      try {
        await held(ready.ready, leader);
        follower =
          first === 'writer'
            ? settled(h.service.execute(c, commandIntent()))
            : settled(writer());
        await observeBlocking(
          observer,
          first === 'writer' ? pidA : pidB,
          first === 'writer' ? pidB : pidA,
        );
        release.release();
        const [lead, follow] = await Promise.all([leader, follower]);
        expect(lead.ok).toBe(true);
        expect(follow.ok).toBe(false);
        if (follow.ok) throw new Error('Contender unexpectedly committed');
        expect(follow.error).toMatchObject({
          code:
            first === 'writer'
              ? 'CORRECTION_SOURCE_CHANGED'
              : 'STALE_INVENTORY_REVISION',
        });
        const after = await orchestrationState(observer, c.companyId);
        if (first === 'writer') {
          expect(after.roots).toEqual(before.roots);
          expect(after.claims).toEqual(before.claims);
          expect(after.items).toEqual(before.items);
          expect(
            after.effects.filter(
              (e) => e.originType === 'CASE_DISPATCH_CORRECTION',
            ),
          ).toHaveLength(0);
          expect(after.effects).toHaveLength(before.effects.length + 1);
          expect(
            after.positions.find(
              (p) => p.id === o.source.destinationPositionId,
            ),
          ).toMatchObject({ quantity: 1, revision: 2 });
          expect(after.products).toEqual(before.products);
          expect(after.dispatch).toEqual(before.dispatch);
          expect(after.sources).toEqual(before.sources);
          expect(after.dispatchAudit).toEqual(before.dispatchAudit);
        } else {
          if (!lead.ok || !('witness' in lead.value))
            throw new Error('Correction leader result missing');
          expectCommittedCorrection(
            o,
            before,
            after,
            lead.value,
            c.idempotencyKey,
          );
          const correction = await h.service.execute(c, commandIntent());
          expect(correction).toEqual({
            replay: true,
            witness: lead.value.witness,
          });
          expect(await orchestrationState(observer, c.companyId)).toEqual(
            after,
          );
        }
      } finally {
        release.release();
        await leader;
        if (follower) await follower;
      }
    },
  );

  it.each(['shared', 'exclusive'] as const)(
    '%s Inventory fence held on independent connection versus correction shared fence',
    async (mode) => {
      const o = await concurrencyOrigin(a, runId),
        c = commandContext(o),
        h = harness(a, pidA);
      const before = await orchestrationState(observer, c.companyId),
        ready = latch(),
        release = latch();
      const claim = jest.spyOn(h.repo, 'createClaim');
      const holder = settled(
        b.$transaction(
          async (tx) => {
            expect(await transactionPid(tx)).toBe(pidB);
            await inventoryAuthorityFence(tx, c.companyId, mode);
            ready.release();
            await release.ready;
          },
          { timeout: 15000, isolationLevel: 'ReadCommitted' },
        ),
      );
      let command:
        | ReturnType<
            typeof settled<Awaited<ReturnType<typeof h.service.execute>>>
          >
        | undefined;
      try {
        await held(ready.ready, holder);
        command = settled(h.service.execute(c, commandIntent()));
        if (mode === 'exclusive') {
          await observeBlocking(observer, pidA, pidB);
          expect(claim).not.toHaveBeenCalled();
          expect(await orchestrationState(observer, c.companyId)).toEqual(
            before,
          );
          release.release();
        }
        const result = await command;
        if (!result.ok) throw result.error;
        // In shared mode the holder is STILL open, proving coexistence, not serialization.
        expectCommittedCorrection(
          o,
          before,
          await orchestrationState(observer, c.companyId),
          result.value,
          c.idempotencyKey,
        );
      } finally {
        release.release();
        await holder;
        if (command) await command;
      }
    },
  );

  it('an exclusive fence waits behind the correction shared fence until its sealed commit', async () => {
    const o = await concurrencyOrigin(a, runId),
      c = commandContext(o),
      h = harness(a, pidA);
    const ready = latch(),
      release = latch(),
      createClaim = h.repo.createClaim.bind(
        h.repo,
      ) as typeof h.repo.createClaim;
    jest.spyOn(h.repo, 'createClaim').mockImplementation(async (...args) => {
      const result = await createClaim(...args);
      ready.release();
      await release.ready;
      return result;
    });
    const command = settled(h.service.execute(c, commandIntent()));
    let exclusive: ReturnType<typeof settled> | undefined;
    try {
      await held(ready.ready, command);
      exclusive = settled(
        b.$transaction(
          async (tx) => {
            expect(await transactionPid(tx)).toBe(pidB);
            await inventoryAuthorityFence(tx, c.companyId, 'exclusive');
            const roots = await tx.healthcareCaseDispatchCorrection.findMany({
              where: { companyId: c.companyId },
            });
            expect(roots).toHaveLength(1);
            expect(roots[0].snapshot).not.toBeNull();
          },
          { timeout: 15000, isolationLevel: 'ReadCommitted' },
        ),
      );
      await observeBlocking(observer, pidB, pidA);
      release.release();
      expect((await command).ok).toBe(true);
      expect((await exclusive).ok).toBe(true);
    } finally {
      release.release();
      await command;
      if (exclusive) await exclusive;
    }
  });

  it.each(['lock', 'statement'] as const)(
    'real PostgreSQL %s timeout rejects before claim and never replays',
    async (kind) => {
      const o = await concurrencyOrigin(a, runId),
        c = commandContext(o),
        h = orchestrationHarness(a);
      const before = await orchestrationState(observer, c.companyId),
        ready = latch(),
        release = latch();
      const holder = settled(
        b.$transaction(
          async (tx) => {
            expect(await transactionPid(tx)).toBe(pidB);
            await inventoryAuthorityFence(tx, c.companyId, 'exclusive');
            ready.release();
            await release.ready;
          },
          { timeout: 15000, isolationLevel: 'ReadCommitted' },
        ),
      );
      const write = h.repo.write.bind(h.repo) as typeof h.repo.write,
        read = jest.spyOn(h.repo, 'read');
      const claim = jest.spyOn(h.repo, 'createClaim');
      let rawError: unknown;
      jest.spyOn(h.repo, 'write').mockImplementation(async (fn, policy) => {
        try {
          return await write(async (tx) => {
            expect(await transactionPid(tx)).toBe(pidA);
            // Only this timeout scenario disables lock_timeout to reach the
            // existing 4s statement_timeout. No sleep or production timeout change.
            if (kind === 'statement')
              await tx.$queryRaw`SELECT set_config('lock_timeout','0',true)`;
            return fn(tx);
          }, policy);
        } catch (error) {
          rawError = error;
          throw error;
        }
      });
      let command: ReturnType<typeof settled> | undefined;
      try {
        await held(ready.ready, holder);
        command = settled(h.service.execute(c, commandIntent()));
        await observeBlocking(observer, pidA, pidB);
        const result = await command;
        expect(result.ok).toBe(false);
        if (result.ok)
          throw new Error('Timeout was falsely treated as success');
        expect(result.error).toMatchObject({
          code: 'CORRECTION_CONCURRENCY_ERROR',
        });
        expect(rawError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
        expect(rawError).toMatchObject({
          code: 'P2010',
          meta: { code: kind === 'lock' ? '55P03' : '57014' },
        });
        expect(claim).not.toHaveBeenCalled();
        expect(read).toHaveBeenCalledTimes(1);
        expect(await orchestrationState(observer, c.companyId)).toEqual(before);
      } finally {
        release.release();
        await holder;
        if (command) await command;
      }
    },
  );

  it.each([
    'claim',
    'root',
    'effect',
    'projection',
    'items',
    'seal',
    'constraints',
  ] as const)(
    'observes real persisted %s facts inside the transaction before injecting rollback',
    async (phase) => {
      const o = await concurrencyOrigin(a, runId, 'batch'),
        c = commandContext(o),
        h = harness(a, pidA);
      const before = await orchestrationState(observer, c.companyId),
        read = jest.spyOn(h.repo, 'read');
      let observed:
        | {
            claims: number;
            roots: number;
            effects: number;
            items: number;
            sealed: boolean;
            custody: number;
            available: number;
          }
        | undefined;
      const inject = async (
        tx: Prisma.TransactionClient,
        real: () => Promise<unknown>,
      ): Promise<never> => {
        await real();
        const roots = await tx.healthcareCaseDispatchCorrection.findMany({
          where: { companyId: c.companyId },
        });
        observed = {
          claims: await tx.idempotencyRecord.count({
            where: { companyId: c.companyId, key: c.idempotencyKey },
          }),
          roots: roots.length,
          effects: await tx.inventoryPhysicalEffect.count({
            where: {
              companyId: c.companyId,
              originType: 'CASE_DISPATCH_CORRECTION',
            },
          }),
          items: await tx.healthcareCaseDispatchCorrectionItem.count({
            where: { companyId: c.companyId },
          }),
          sealed: roots.length === 1 && roots[0].snapshot !== null,
          custody: (
            await tx.inventoryPosition.findUniqueOrThrow({
              where: { id: o.source.destinationPositionId! },
            })
          ).quantity,
          available: (
            await tx.inventoryBatch.findUniqueOrThrow({
              where: { id: o.source.batchId! },
            })
          ).availableQuantity,
        };
        throw new Error('01C-C fault AFTER verified real phase ' + phase);
      };
      if (phase === 'claim') {
        const fn = h.repo.createClaim.bind(h.repo) as typeof h.repo.createClaim;
        jest
          .spyOn(h.repo, 'createClaim')
          .mockImplementation((tx, data) => inject(tx, () => fn(tx, data)));
      }
      if (phase === 'root') {
        const fn = h.repo.createRoot.bind(h.repo) as typeof h.repo.createRoot;
        jest
          .spyOn(h.repo, 'createRoot')
          .mockImplementation((tx, data) => inject(tx, () => fn(tx, data)));
      }
      if (phase === 'effect') {
        const fn = h.physical.transferDispatchCorrectionMaterial.bind(
          h.physical,
        ) as typeof h.physical.transferDispatchCorrectionMaterial;
        jest
          .spyOn(h.physical, 'transferDispatchCorrectionMaterial')
          .mockImplementation((tx, input) => inject(tx, () => fn(tx, input)));
      }
      if (phase === 'projection') {
        const fn = h.projections.apply.bind(
          h.projections,
        ) as typeof h.projections.apply;
        jest
          .spyOn(h.projections, 'apply')
          .mockImplementation((tx, company, result) =>
            inject(tx, () => fn(tx, company, result)),
          );
      }
      if (phase === 'items') {
        const fn = h.repo.createEvidenceItems.bind(
          h.repo,
        ) as typeof h.repo.createEvidenceItems;
        jest
          .spyOn(h.repo, 'createEvidenceItems')
          .mockImplementation((tx, context, root, source, result) =>
            inject(tx, () => fn(tx, context, root, source, result)),
          );
      }
      if (phase === 'seal') {
        const fn = h.repo.seal.bind(h.repo) as typeof h.repo.seal;
        jest
          .spyOn(h.repo, 'seal')
          .mockImplementation((tx, root, source, actor) =>
            inject(tx, () => fn(tx, root, source, actor)),
          );
      }
      if (phase === 'constraints') {
        const fn = h.repo.constraints.bind(h.repo) as typeof h.repo.constraints;
        jest
          .spyOn(h.repo, 'constraints')
          .mockImplementation((tx) => inject(tx, () => fn(tx)));
      }
      const outcome = await settled(h.service.execute(c, commandIntent()));
      // Prove the phase was reached BEFORE interpreting the final error code.
      // Include the actual outcome if setup/production rejected before injection.
      expect({
        phase,
        reached: observed !== undefined,
        outcome,
      }).toMatchObject({ reached: true });
      const index = [
        'claim',
        'root',
        'effect',
        'projection',
        'items',
        'seal',
        'constraints',
      ].indexOf(phase);
      expect(observed).toMatchObject({
        claims: 1,
        roots: index >= 1 ? 1 : 0,
        effects: index >= 2 ? 1 : 0,
        items: index >= 4 ? 1 : 0,
        sealed: index >= 5,
        custody: index >= 2 ? 0 : o.source.quantity,
      });
      expect(observed!.available).toBe(
        before.batches[0].availableQuantity +
          (index >= 3 ? o.source.quantity! : 0),
      );
      expect(read).toHaveBeenCalledTimes(1);
      expect(await orchestrationState(observer, c.companyId)).toEqual(before);
      expect(outcome).toMatchObject({
        ok: false,
        error: { code: 'CORRECTION_PERSISTENCE_ERROR' },
      });
    },
  );

  it.each([
    ['deadlock', 'P2010', '40P01', 'CORRECTION_CONCURRENCY_ERROR'],
    ['serialization', 'P2034', null, 'CORRECTION_CONCURRENCY_ERROR'],
    ['transport', 'P1001', null, 'CORRECTION_PERSISTENCE_ERROR'],
    ['unrelated unique', 'P2002', null, 'CORRECTION_PERSISTENCE_ERROR'],
    ['unknown persistence', 'P2028', null, 'CORRECTION_PERSISTENCE_ERROR'],
  ] as const)(
    'injected %s classifier input AFTER a real claim is never replayed',
    async (_scenario, code, sqlState, expected) => {
      const o = await concurrencyOrigin(a, runId),
        c = commandContext(o),
        h = harness(a, pidA);
      const before = await orchestrationState(observer, c.companyId),
        read = jest.spyOn(h.repo, 'read');
      const create = h.repo.createClaim.bind(
        h.repo,
      ) as typeof h.repo.createClaim;
      let observedClaim: string | undefined;
      const injected =
        _scenario === 'transport'
          ? new Prisma.PrismaClientInitializationError(
              '01C-C injected transport failure',
              Prisma.prismaVersion.client,
              'P1001',
            )
          : new Prisma.PrismaClientKnownRequestError(
              '01C-C explicitly injected classifier input',
              {
                code,
                clientVersion: Prisma.prismaVersion.client,
                meta: sqlState
                  ? { code: sqlState }
                  : code === 'P2002'
                    ? { target: ['email'] }
                    : undefined,
              },
            );
      const spy = jest
        .spyOn(h.repo, 'createClaim')
        .mockImplementation(async (tx, data) => {
          const claim = await create(tx, data);
          observedClaim = (
            await tx.idempotencyRecord.findUniqueOrThrow({
              where: { id: claim.id },
            })
          ).id;
          throw injected;
        });
      const outcome = await settled(h.service.execute(c, commandIntent()));
      expect({
        reached: typeof observedClaim === 'string' && observedClaim.length > 0,
        outcome,
      }).toMatchObject({ reached: true });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledTimes(1);
      expect(await orchestrationState(observer, c.companyId)).toEqual(before);
      expect(outcome).toMatchObject({ ok: false, error: { code: expected } });
    },
  );
});
