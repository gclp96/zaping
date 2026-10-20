import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { correctionFixtureFactory } from './helpers/dispatch-correction-fixture';
import {
  correctionQaUrl,
  verifyCorrectionQaDatabase,
} from './helpers/dispatch-correction-postgres-authorization';
import {
  groupedCorrectionOrigin,
  originalDispatchBytes,
} from './helpers/dispatch-correction-grouped-fixture';
import {
  CorrectionOrigin,
  persistCorrectionWitness,
  stageCorrectionWitness,
} from './helpers/dispatch-correction-witness';
import { HealthcareCaseDispatchCorrectionRepository } from '../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.repository';
import {
  assertCorrectionRejection as rejected,
  correctionBarrier,
  correctionDeadline,
  correctionPgFailure,
  isDispatchCorrectionDuplicate,
} from './helpers/dispatch-correction-pg-failure';

jest.setTimeout(45000);
const suite =
  process.env.RUN_CASE_DISPATCH_CORRECTION_POSTGRES === '1'
    ? describe
    : describe.skip;
suite('HC-DSP-COR-01B explicitly authorized isolated PostgreSQL16', () => {
  let db: PrismaClient;
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: correctionQaUrl() } } });
    await db.$connect();
    // No fixture or write precedes successful preflight. Do not log the URL.
    console.info(
      'Verified correction QA target',
      await verifyCorrectionQaDatabase(db),
    );
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  async function corrector(
    o: CorrectionOrigin,
    role: 'ADMIN' | 'MANAGER' | 'WAREHOUSE' = 'MANAGER',
  ) {
    return db.user.create({
      data: {
        companyId: o.f.companyId,
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'NOT-A-CREDENTIAL',
        firstName: 'Correction',
        lastName: 'Actor',
        role,
      },
    });
  }
  async function noPartial(id: string) {
    expect(
      await db.healthcareCaseDispatchCorrection.count({ where: { id } }),
    ).toBe(0);
    expect(
      await db.healthcareCaseDispatchCorrectionItem.count({
        where: { correctionId: id },
      }),
    ).toBe(0);
    expect(
      await db.idempotencyRecord.count({ where: { resourceId: id } }),
    ).toBe(0);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { originType: 'CASE_DISPATCH_CORRECTION', originId: id },
      }),
    ).toBe(0);
  }
  it.each(['material', 'equipment', 'grouped', 'mixed'] as const)(
    'commits a complete %s witness; preserves original history and distinct actors',
    async (kind) => {
      const o =
        kind === 'mixed' || kind === 'grouped'
          ? await groupedCorrectionOrigin(db, kind === 'mixed')
          : await correctionFixtureFactory(db).origin(kind === 'equipment');
      const actor = await corrector(o);
      const before = await originalDispatchBytes(db, o.d.id);
      const key = randomUUID();
      const result = await persistCorrectionWitness(db, o, actor.id, { key });
      expect(await originalDispatchBytes(db, o.d.id)).toBe(before);
      const repository = new HealthcareCaseDispatchCorrectionRepository(db);
      const context = {
        companyId: o.f.companyId,
        caseId: o.f.c.id,
        dispatchId: o.d.id,
      };
      const witness = await repository.findWitness(context);
      expect(witness?.confirmedById).toBe(actor.id);
      expect(witness?.confirmedById).not.toBe(o.f.user.id);
      const sourceCount = await db.healthcareCaseDispatchItem.count({
        where: { dispatchId: o.d.id, lifecycle: 'ACTIVE' },
      });
      expect(witness?.items).toHaveLength(sourceCount);
      expect(
        await repository.findReplay(context, key, result.requestHash),
      ).toEqual(witness);
      await expect(
        repository.findReplay(context, key, 'b'.repeat(64)),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await repository.findWitness({ ...context, companyId: randomUUID() }),
      ).toBeNull();
      if (kind === 'grouped' || kind === 'mixed') {
        expect(
          new Set(
            witness!.items
              .filter((i) => i.type === 'MATERIAL')
              .map((i) => i.compensatingEffectId),
          ).size,
        ).toBe(1);
      }
    },
  );
  it.each([
    'unsealed',
    'missing-items',
    'missing-evidence',
    'snapshot-tamper',
  ] as const)(
    'rejects %s at deferred commit and rolls back',
    async (failure) => {
      const o = await correctionFixtureFactory(db).origin();
      const actor = await corrector(o),
        id = randomUUID();
      let reachedEnd = false;
      const positionsBefore = await db.inventoryPosition.findMany({
        where: { companyId: o.f.companyId },
        orderBy: { id: 'asc' },
      });
      await rejected(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          seal: failure !== 'unsealed',
          omitItem: failure === 'missing-items',
          beforeSnapshot: async (tx, rid) => {
            if (failure === 'missing-evidence')
              await tx.healthcareCaseDispatchCorrectionItem.updateMany({
                where: { correctionId: rid },
                data: { compensatingEffectId: null },
              });
          },
          afterSeal: async (tx, rid) => {
            // Root tamper is staged as the single seal, rather than a forbidden update.
            if (failure === 'snapshot-tamper') return;
            await tx.$queryRaw`SELECT ${rid}::text`;
            reachedEnd = true;
          },
          ...(failure === 'snapshot-tamper'
            ? {
                seal: false,
                afterSeal: async (
                  tx: Prisma.TransactionClient,
                  rid: string,
                ) => {
                  await tx.healthcareCaseDispatchCorrection.update({
                    where: { id: rid },
                    data: { snapshot: { version: 1 } },
                  });
                  reachedEnd = true;
                },
              }
            : {}),
        }),
        failure === 'unsealed'
          ? {
              kind: 'check',
              messages: [
                'Correction idempotency resource incomplete',
                'Correction terminal root snapshot malformed',
              ],
            }
          : failure === 'missing-items'
            ? {
                kind: 'check',
                messages: ['Correction source set/reconciliation incompatible'],
              }
            : failure === 'missing-evidence'
              ? {
                  kind: 'check',
                  messages: ['Correction material evidence incompatible'],
                }
              : {
                  kind: 'check',
                  messages: ['Correction terminal root snapshot malformed'],
                },
      );
      expect(reachedEnd).toBe(true);
      await noPartial(id);
      expect(
        await db.inventoryPosition.findMany({
          where: { companyId: o.f.companyId },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(positionsBefore);
    },
  );
  it.each(['foreign-tenant', 'same-tenant-other-dispatch'] as const)(
    'rejects the exact source DispatchItem FK: %s',
    async (scenario) => {
      const factory = correctionFixtureFactory(db),
        f = await factory.fixture();
      const first = await factory.confirmed(f);
      const other =
        scenario === 'foreign-tenant'
          ? await factory.origin()
          : await (async () => {
              const second = await factory.confirmed(f);
              return {
                f,
                d: second.d,
                source: await db.healthcareCaseDispatchItem.findUniqueOrThrow({
                  where: { id: second.i.id },
                }),
              };
            })();
      const o = {
        f,
        d: first.d,
        source: await db.healthcareCaseDispatchItem.findUniqueOrThrow({
          where: { id: first.i.id },
        }),
      };
      const actor = await corrector(o),
        id = randomUUID();
      const before = await db.inventoryPosition.findMany({
        where: { companyId: f.companyId },
        orderBy: { id: 'asc' },
      });
      expect(other.source.dispatchId).not.toBe(o.d.id);
      if (scenario === 'same-tenant-other-dispatch') {
        expect(other.source).toMatchObject({
          companyId: f.companyId,
          caseId: f.c.id,
          caseKitId: f.kit.id,
        });
      } else expect(other.source.companyId).not.toBe(f.companyId);
      let attempted = false;
      await rejected(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          afterRoot: async (tx, correctionId) => {
            attempted = true;
            await tx.$executeRaw`INSERT INTO "HealthcareCaseDispatchCorrectionItem" (id,"companyId","correctionId","dispatchId","sourceDispatchItemId",type)
            VALUES (${randomUUID()},${f.companyId},${correctionId},${o.d.id},${other.source.id},'MATERIAL')`;
          },
        }),
        {
          kind: 'foreign-key',
          constraint:
            'HealthcareCaseDispatchCorrectionItem_sourceDispatchItemId__fkey',
        },
      );
      expect(attempted).toBe(true);
      await noPartial(id);
      if (scenario === 'foreign-tenant') {
        const parentId = randomUUID();
        // Preserve the cross-tenant parent rejection separately: the child
        // matches its own foreign source, but cannot attach to our root.
        await rejected(
          persistCorrectionWitness(db, o, actor.id, {
            id: parentId,
            afterRoot: async (tx, correctionId) => {
              await tx.$executeRaw`INSERT INTO "HealthcareCaseDispatchCorrectionItem" (id,"companyId","correctionId","dispatchId","sourceDispatchItemId",type)
                VALUES (${randomUUID()},${other.f.companyId},${correctionId},${other.source.dispatchId},${other.source.id},'MATERIAL')`;
            },
          }),
          { kind: 'check', messages: ['Correction sealed or missing parent'] },
        );
        await noPartial(parentId);
      }
      expect(
        await db.inventoryPosition.findMany({
          where: { companyId: f.companyId },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(before);
    },
  );
  it('rejects duplicate source items, cross-type evidence and absent attestation', async () => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o);
    for (const failure of ['duplicate', 'type', 'attestation'] as const) {
      const id = randomUUID();
      await rejected(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          rootPatch:
            failure === 'attestation'
              ? { attestedNoHandoff: false }
              : undefined,
          beforeSnapshot: async (tx, correctionId) => {
            const item =
              await tx.healthcareCaseDispatchCorrectionItem.findFirstOrThrow({
                where: { correctionId },
              });
            if (failure === 'duplicate')
              await tx.healthcareCaseDispatchCorrectionItem.create({
                data: { ...item, id: randomUUID(), snapshot: Prisma.DbNull },
              });
            if (failure === 'type')
              await tx.healthcareCaseDispatchCorrectionItem.update({
                where: { id: item.id },
                data: { assetId: o.f.asset.id },
              });
          },
        }),
        (
          {
            duplicate: {
              kind: 'duplicate',
              constraint: 'DispatchCorrectionItem_source_key',
              target: ['companyId', 'correctionId', 'sourceDispatchItemId'],
            },
            type: { kind: 'check', constraint: 'DispatchCorrectionItem_shape' },
            attestation: {
              kind: 'check',
              constraint: 'DispatchCorrection_shape',
            },
          } as const
        )[failure],
      );
      await noPartial(id);
    }
  });
  it('rejects the second independent, observably blocked transaction by Dispatch uniqueness', async () => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o);
    const url = new URL(correctionQaUrl());
    url.searchParams.set('connection_limit', '1');
    const first = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const second = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const ready = correctionBarrier(),
      release = correctionBarrier(),
      attempting = correctionBarrier();
    let firstPid = 0,
      secondPid = 0,
      sealedReady = false,
      rootAttempted = false;
    let winner: Promise<unknown> | undefined;
    let loser: Promise<{ error: unknown }> | undefined;
    const loserId = randomUUID();
    try {
      await Promise.all([first.$connect(), second.$connect()]);
      await Promise.all([
        verifyCorrectionQaDatabase(first),
        verifyCorrectionQaDatabase(second),
      ]);
      winner = first.$transaction(
        async (tx) => {
          [{ pid: firstPid }] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          return stageCorrectionWitness(tx, o, actor.id, {
            afterSeal: async () => {
              sealedReady = true;
              ready.release();
              await correctionDeadline(release.promise, 12000);
            },
          });
        },
        { timeout: 20000, isolationLevel: 'ReadCommitted' },
      );
      // Attach a handler immediately, including during synchronization failure.
      void winner.catch(() => ready.release());
      await correctionDeadline(ready.promise, 8000);
      if (!sealedReady) await winner;
      loser = second
        .$transaction(
          async (tx) => {
            [{ pid: secondPid }] = await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`;
            await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;
            return stageCorrectionWitness(tx, o, actor.id, {
              id: loserId,
              beforeRoot: () => {
                rootAttempted = true;
                attempting.release();
                return Promise.resolve();
              },
            });
          },
          { timeout: 20000, isolationLevel: 'ReadCommitted' },
        )
        .then(
          () => {
            throw new Error('Expected duplicate rejection');
          },
          (error: unknown) => {
            attempting.release();
            return { error };
          },
        );
      void loser.catch(() => attempting.release());
      await correctionDeadline(attempting.promise, 8000);
      if (!rootAttempted) throw (await loser).error;
      expect(firstPid).not.toBe(secondPid);
      expect(firstPid).toBeGreaterThan(0);
      expect(secondPid).toBeGreaterThan(0);
      const deadline = Date.now() + 5000;
      let observedBlocking = false;
      while (Date.now() < deadline) {
        const [state] = await db.$queryRaw<
          { blocked: boolean }[]
        >`SELECT ${firstPid} = ANY(pg_blocking_pids(${secondPid}::integer)) AS blocked`;
        if (state.blocked) {
          observedBlocking = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(observedBlocking).toBe(true);
      release.release();
      await winner;
      const failure = (await loser).error;
      expect(isDispatchCorrectionDuplicate(failure)).toBe(true);
      expect(correctionPgFailure(failure).kind).toBe('duplicate');
      await noPartial(loserId);
    } finally {
      release.release();
      await Promise.allSettled([winner, loser]);
      await Promise.all([first.$disconnect(), second.$disconnect()]);
    }
    expect(
      await db.healthcareCaseDispatchCorrection.count({
        where: { dispatchId: o.d.id },
      }),
    ).toBe(1);
    expect(
      await db.idempotencyRecord.count({
        where: {
          companyId: o.f.companyId,
          scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
        },
      }),
    ).toBe(1);
  });
  it('rejects seal NOWAIT under an independently held actor lock with 55P03 and no partial writes', async () => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o),
      id = randomUUID();
    const before = await db.inventoryPosition.findMany({
      where: { companyId: o.f.companyId },
      orderBy: { id: 'asc' },
    });
    const history = await originalDispatchBytes(db, o.d.id);
    const url = new URL(correctionQaUrl());
    url.searchParams.set('connection_limit', '1');
    const holder = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const contender = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const locked = correctionBarrier(),
      release = correctionBarrier();
    let holderPid = 0,
      contenderPid = 0,
      holderXid = '';
    let holderReady = false,
      holderFinished = false,
      staged = false,
      sealAttempted = false;
    let holding: Promise<void> | undefined;
    try {
      await Promise.all([holder.$connect(), contender.$connect()]);
      await Promise.all([
        verifyCorrectionQaDatabase(holder),
        verifyCorrectionQaDatabase(contender),
      ]);
      holding = holder
        .$transaction(
          async (tx) => {
            [{ pid: holderPid }] = await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`;
            const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "User" WHERE id=${actor.id} AND "companyId"=${o.f.companyId} FOR NO KEY UPDATE`;
            expect(rows).toEqual([{ id: actor.id }]);
            const locks = await tx.$queryRaw<{ xid: string }[]>`
          SELECT transactionid::text AS xid FROM pg_locks
          WHERE pid=pg_backend_pid() AND locktype='transactionid' AND mode='ExclusiveLock' AND granted`;
            expect(locks).toHaveLength(1);
            holderXid = locks[0].xid;
            holderReady = true;
            locked.release();
            await correctionDeadline(release.promise, 15000);
          },
          { timeout: 25000, isolationLevel: 'ReadCommitted' },
        )
        .then(() => {
          holderFinished = true;
        });
      void holding.catch(() => locked.release());
      await correctionDeadline(locked.promise, 8000);
      if (!holderReady) await holding;
      const outcome = await contender
        .$transaction(
          async (tx) => {
            [{ pid: contenderPid }] = await tx.$queryRaw<
              { pid: number }[]
            >`SELECT pg_backend_pid() AS pid`;
            expect(contenderPid).toBeGreaterThan(0);
            expect(holderPid).toBeGreaterThan(0);
            expect(contenderPid).not.toBe(holderPid);
            // A lock timeout must never masquerade as the NOWAIT error below.
            await tx.$executeRaw`SET LOCAL lock_timeout = '0'`;
            return stageCorrectionWitness(tx, o, actor.id, {
              id,
              seal: false,
              afterSnapshot: async (stage) => {
                const [visible] = await stage.$queryRaw<
                  { holder_visible: boolean; relation_visible: boolean }[]
                >`
              SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=${holderPid} AND locktype='transactionid'
                AND transactionid::text=${holderXid} AND mode='ExclusiveLock' AND granted) AS holder_visible,
                EXISTS(SELECT 1 FROM pg_locks WHERE pid=${holderPid} AND relation='public."User"'::regclass
                AND mode='RowShareLock' AND granted) AS relation_visible`;
                expect(visible).toEqual({
                  holder_visible: true,
                  relation_visible: true,
                });
                expect(
                  await stage.healthcareCaseDispatchCorrection.count({
                    where: { id },
                  }),
                ).toBe(1);
                expect(
                  await stage.healthcareCaseDispatchCorrectionItem.count({
                    where: { correctionId: id },
                  }),
                ).toBe(1);
                expect(
                  await stage.idempotencyRecord.count({
                    where: { resourceId: id },
                  }),
                ).toBe(1);
                expect(
                  await stage.inventoryPhysicalEffect.count({
                    where: {
                      originId: id,
                      originType: 'CASE_DISPATCH_CORRECTION',
                    },
                  }),
                ).toBe(1);
                staged = true;
              },
              afterSeal: async (stage, rid) => {
                const root =
                  await stage.healthcareCaseDispatchCorrection.findUniqueOrThrow(
                    { where: { id: rid } },
                  );
                const source =
                  await stage.healthcareCaseDispatch.findUniqueOrThrow({
                    where: { id: o.d.id },
                  });
                const snapshot = {
                  version: 1,
                  correctionId: rid,
                  kind: root.kind,
                  reason: root.reason,
                  attestedNoHandoff: true,
                  sourceDispatch: { id: source.id, history: source.snapshot },
                  confirmedBy: { id: actor.id, role: actor.role },
                  confirmedAt: root.confirmedAt.toISOString(),
                  requestHash: root.requestHash,
                };
                sealAttempted = true;
                // Exercise the actual seal trigger through a raw query so Prisma
                // exposes SQLSTATE, rather than its diagnostic-only ORM envelope.
                await stage.$executeRaw`UPDATE "HealthcareCaseDispatchCorrection" SET snapshot=${JSON.stringify(snapshot)}::jsonb WHERE id=${rid}`;
              },
            });
          },
          { timeout: 20000, isolationLevel: 'ReadCommitted' },
        )
        .then(
          () => ({ accepted: true, error: null as unknown }),
          (error: unknown) => ({ accepted: false, error }),
        );
      expect(outcome.accepted).toBe(false);
      expect(staged).toBe(true);
      expect(sealAttempted).toBe(true);
      expect(correctionPgFailure(outcome.error)).toMatchObject({
        code: '55P03',
        kind: 'lock-timeout',
        diagnostic: 'could not obtain lock on row in relation "User"',
      });
    } finally {
      release.release();
      await Promise.allSettled([holding]);
      await Promise.all([holder.$disconnect(), contender.$disconnect()]);
    }
    expect(holderFinished).toBe(true);
    await noPartial(id);
    expect(
      await db.inventoryPosition.findMany({
        where: { companyId: o.f.companyId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
    expect(await originalDispatchBytes(db, o.d.id)).toBe(history);
    // The holder has finished; the same row must be lockable without waiting.
    await db.$transaction(async (tx) => {
      expect(
        await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "User" WHERE id=${actor.id} FOR NO KEY UPDATE NOWAIT`,
      ).toEqual([{ id: actor.id }]);
    });
  });
  it('rejects a correction attributed to a non-authorized actor', async () => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o, 'WAREHOUSE');
    await rejected(persistCorrectionWitness(db, o, actor.id), {
      kind: 'check',
      messages: ['Correction terminal root/attestation/idempotency incomplete'],
    });
  });
  it.each(['blank-reason', 'foreign-actor', 'claim-hash'] as const)(
    'rejects invalid root: %s',
    async (failure) => {
      const o = await correctionFixtureFactory(db).origin(),
        actor = await corrector(o);
      const foreign = await correctionFixtureFactory(db).origin();
      const id = randomUUID();
      await rejected(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          rootPatch:
            failure === 'blank-reason'
              ? { reason: '\t\n' }
              : failure === 'foreign-actor'
                ? { confirmedById: foreign.f.user.id }
                : { requestHash: 'b'.repeat(64) },
        }),
        (
          {
            'blank-reason': {
              kind: 'check',
              constraint: 'DispatchCorrection_shape',
            },
            'foreign-actor': {
              kind: 'foreign-key',
              constraint:
                'HealthcareCaseDispatchCorrection_confirmedById_companyId_fkey',
            },
            'claim-hash': {
              kind: 'check',
              messages: [
                'Correction idempotency resource incomplete',
                'Correction terminal root/attestation/idempotency incomplete',
              ],
            },
          } as const
        )[failure],
      );
      await noPartial(id);
    },
  );
  it('rejects compensating evidence falsely attributed to the original actor', async () => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o);
    await rejected(
      persistCorrectionWitness(db, o, actor.id, {
        beforeSnapshot: async (tx, id) => {
          await tx.inventoryPhysicalEffect.updateMany({
            where: { originId: id, originType: 'CASE_DISPATCH_CORRECTION' },
            data: { actorId: o.f.user.id },
          });
        },
      }),
      {
        kind: 'check',
        messages: ['Correction material evidence incompatible'],
      },
    );
  });
  it.each([
    'quantity',
    'foreign-position',
    'foreign-effect',
    'extra-balanced-lines',
  ] as const)('rejects incompatible material evidence: %s', async (failure) => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o);
    const foreign = await correctionFixtureFactory(db).origin();
    const id = randomUUID();
    await rejected(
      persistCorrectionWitness(db, o, actor.id, {
        id,
        beforeSnapshot: async (tx, correctionId) => {
          const item =
            await tx.healthcareCaseDispatchCorrectionItem.findFirstOrThrow({
              where: { correctionId },
            });
          if (failure === 'quantity')
            await tx.healthcareCaseDispatchCorrectionItem.update({
              where: { id: item.id },
              data: { quantity: 1 },
            });
          if (failure === 'foreign-position')
            await tx.healthcareCaseDispatchCorrectionItem.update({
              where: { id: item.id },
              data: {
                sourceCustodyPositionId: foreign.source.destinationPositionId,
              },
            });
          if (failure === 'foreign-effect')
            await tx.healthcareCaseDispatchCorrectionItem.update({
              where: { id: item.id },
              data: { compensatingEffectId: foreign.source.physicalEffectId },
            });
          if (failure === 'extra-balanced-lines') {
            const product = await tx.product.create({
              data: {
                companyId: o.f.companyId,
                sku: randomUUID(),
                name: 'Unrelated balanced material',
                lotTracking: 'NONE',
              },
            });
            const available = await tx.inventoryPosition.create({
              data: {
                companyId: o.f.companyId,
                productId: product.id,
                state: 'AVAILABLE',
                quantity: 1,
              },
            });
            const custody = await tx.inventoryPosition.create({
              data: {
                companyId: o.f.companyId,
                productId: product.id,
                state: 'CUSTODY',
                contextType: 'TEST_UNRELATED',
                contextId: randomUUID(),
              },
            });
            await tx.inventoryPhysicalEffect.update({
              where: { id: item.compensatingEffectId! },
              data: { lineCount: 4 },
            });
            await tx.inventoryPhysicalEffectLine.createMany({
              data: [
                {
                  companyId: o.f.companyId,
                  effectId: item.compensatingEffectId!,
                  positionId: available.id,
                  sequence: 3,
                  delta: -1,
                  quantityBefore: 1,
                  quantityAfter: 0,
                  revisionBefore: 0,
                  revisionAfter: 1,
                },
                {
                  companyId: o.f.companyId,
                  effectId: item.compensatingEffectId!,
                  positionId: custody.id,
                  sequence: 4,
                  delta: 1,
                  quantityBefore: 0,
                  quantityAfter: 1,
                  revisionBefore: 0,
                  revisionAfter: 1,
                },
              ],
            });
          }
        },
      }),
      (
        {
          quantity: {
            kind: 'check',
            messages: ['Correction material evidence incompatible'],
          },
          'foreign-position': {
            kind: 'foreign-key',
            constraint:
              'HealthcareCaseDispatchCorrectionItem_sourceCustodyPosition_fkey',
          },
          'foreign-effect': {
            kind: 'foreign-key',
            constraint:
              'HealthcareCaseDispatchCorrectionItem_compensatingEffectId__fkey',
          },
          'extra-balanced-lines': {
            kind: 'check',
            messages: ['Correction contains unrelated physical lines'],
          },
        } as const
      )[failure],
    );
    await noPartial(id);
  });
  it('rejects a same-tenant Effect from another Dispatch', async () => {
    const factory = correctionFixtureFactory(db),
      f = await factory.fixture();
    const first = await factory.confirmed(f),
      second = await factory.confirmed(f);
    const source = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
      where: { id: first.i.id },
    });
    const other = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
      where: { id: second.i.id },
    });
    const o = { f, d: first.d, source },
      actor = await corrector(o);
    await rejected(
      persistCorrectionWitness(db, o, actor.id, {
        beforeSnapshot: async (tx, correctionId) => {
          await tx.healthcareCaseDispatchCorrectionItem.updateMany({
            where: { correctionId },
            data: { originalPhysicalEffectId: other.physicalEffectId },
          });
        },
      }),
      {
        kind: 'check',
        messages: ['Correction material evidence incompatible'],
      },
    );
  });
  it.each([
    'missing-close',
    'foreign-custody',
    'intermediate-event',
    'changed-condition',
  ] as const)(
    'rejects incompatible Equipment evidence: %s',
    async (failure) => {
      const o = await correctionFixtureFactory(db).origin(true),
        actor = await corrector(o);
      const foreign = await correctionFixtureFactory(db).origin(true);
      await rejected(
        persistCorrectionWitness(db, o, actor.id, {
          closePatch:
            failure === 'changed-condition'
              ? { conditionAfter: 'DAMAGED' }
              : undefined,
          beforeSnapshot: async (tx, correctionId) => {
            const item =
              await tx.healthcareCaseDispatchCorrectionItem.findFirstOrThrow({
                where: { correctionId },
              });
            if (failure === 'missing-close')
              await tx.healthcareCaseDispatchCorrectionItem.update({
                where: { id: item.id },
                data: { closePhysicalEventId: null },
              });
            if (failure === 'foreign-custody')
              await tx.healthcareCaseDispatchCorrectionItem.update({
                where: { id: item.id },
                data: { equipmentCustodyId: foreign.source.equipmentCustodyId },
              });
            if (failure === 'intermediate-event') {
              const close =
                await tx.equipmentAssetPhysicalEvent.findUniqueOrThrow({
                  where: { id: item.closePhysicalEventId! },
                });
              // Append-only events cannot be edited even in staging. A distinct later
              // event must fail the strict V1 witness policy.
              await tx.equipmentAssetPhysicalEvent.create({
                data: {
                  companyId: o.f.companyId,
                  equipmentAssetId: item.assetId!,
                  custodyId: item.equipmentCustodyId,
                  operation: 'CONDITION_CHANGE',
                  originType: 'TEST_EVENT',
                  originId: randomUUID(),
                  originOperation: 'CONDITION_CHANGE',
                  requestHash: 'a'.repeat(64),
                  physicalLocationBefore: 'WAREHOUSE',
                  physicalLocationAfter: 'WAREHOUSE',
                  conditionBefore: close.conditionAfter,
                  conditionAfter: close.conditionAfter,
                  lifecycleBefore: close.lifecycleAfter,
                  lifecycleAfter: close.lifecycleAfter,
                  revisionBefore: close.revisionAfter,
                  revisionAfter: close.revisionAfter + 1,
                  actorId: actor.id,
                  reasonCode: 'FIXTURE',
                },
              });
            }
          },
        }),
        failure === 'foreign-custody'
          ? {
              kind: 'foreign-key',
              constraint:
                'HealthcareCaseDispatchCorrectionItem_equipmentCustodyId_co_fkey',
            }
          : {
              kind: 'check',
              messages: ['Correction equipment evidence incompatible'],
            },
      );
    },
  );
  it('rolls back all staged mixed effects, leaving no witness, claim, event or position change', async () => {
    const o = await groupedCorrectionOrigin(db, true),
      actor = await corrector(o),
      id = randomUUID();
    const before = await db.equipmentAssetCustody.findUniqueOrThrow({
      where: {
        id: (
          await db.healthcareCaseDispatchItem.findFirstOrThrow({
            where: { dispatchId: o.d.id, type: 'EQUIPMENT' },
          })
        ).equipmentCustodyId!,
      },
    });
    await expect(
      persistCorrectionWitness(db, o, actor.id, {
        id,
        beforeSnapshot: () => {
          throw new Error('SYNTHETIC_ROLLBACK');
        },
      }),
    ).rejects.toThrow('SYNTHETIC_ROLLBACK');
    await noPartial(id);
    expect(
      await db.equipmentAssetCustody.findUniqueOrThrow({
        where: { id: before.id },
      }),
    ).toEqual(before);
    expect(
      await db.equipmentAssetPhysicalEvent.count({
        where: { companyId: o.f.companyId, operation: 'CUSTODY_CLOSE' },
      }),
    ).toBe(0);
  });
  it('rejects terminal UPDATE, DELETE, late item insertion, TRUNCATE and claim mutation', async () => {
    const o = await correctionFixtureFactory(db).origin(),
      actor = await corrector(o);
    const { id, claim } = await persistCorrectionWitness(db, o, actor.id);
    const item = await db.healthcareCaseDispatchCorrectionItem.findFirstOrThrow(
      { where: { correctionId: id } },
    );
    await rejected(
      db.healthcareCaseDispatchCorrection.update({
        where: { id },
        data: { reason: 'rewrite' },
      }),
      {
        kind: 'check',
        messages: ['Correction immutable identity/sealed history'],
      },
    );
    await rejected(
      db.healthcareCaseDispatchCorrection.delete({ where: { id } }),
      { kind: 'check', messages: ['Correction history cannot be deleted'] },
    );
    await rejected(
      db.healthcareCaseDispatchCorrectionItem.update({
        where: { id: item.id },
        data: { quantity: 3 },
      }),
      { kind: 'check', messages: ['Correction sealed or missing parent'] },
    );
    await rejected(
      db.healthcareCaseDispatchCorrectionItem.delete({
        where: { id: item.id },
      }),
      {
        kind: 'check',
        messages: ['Correction item history cannot be deleted'],
      },
    );
    await rejected(
      db.healthcareCaseDispatchCorrectionItem.create({
        data: {
          ...item,
          id: randomUUID(),
          snapshot: item.snapshot as Prisma.InputJsonValue,
        },
      }),
      { kind: 'check', messages: ['Correction sealed or missing parent'] },
    );
    await rejected(
      db.$executeRaw`TRUNCATE "HealthcareCaseDispatchCorrectionItem"`,
      { kind: 'check', messages: ['Dispatch history is append-only'] },
    );
    await rejected(
      db.idempotencyRecord.update({
        where: { id: claim.id },
        data: { resourceId: 'other' },
      }),
      { kind: 'check', messages: ['Correction idempotency history immutable'] },
    );
  });
});
