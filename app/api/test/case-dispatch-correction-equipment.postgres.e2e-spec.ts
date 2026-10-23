import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  equipmentQaConfiguration,
  verifyEquipmentQaDatabase,
} from './helpers/dispatch-correction-equipment-postgres-authorization';
import {
  equipmentOrigin,
  equipmentHarness,
  equipmentState,
  expectEquipmentCorrection,
  inspectionService,
} from './helpers/dispatch-correction-equipment-fixture';
import { equipmentReconciliation } from './helpers/dispatch-correction-equipment-reconciliation';
import {
  commandContext,
  commandIntent,
  orchestrationOrigin,
} from './helpers/dispatch-correction-material-orchestration-fixture';
import {
  latch,
  settled,
  abortableTwoPartyBarrier,
  observeBlocking,
  transactionPid,
} from './helpers/dispatch-correction-material-concurrency-fixture';
import { EquipmentCustodyCloseService } from '../src/equipment/equipment-custody-close.service';
import { EquipmentCustodyCloseContextRegistry } from '../src/equipment/equipment-custody-close-context.registry';
import { EquipmentPhysicalRepository } from '../src/equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../src/equipment/equipment-physical-history.service';
import { acquireHealthcareCompanyLock } from '../src/healthcare/common/healthcare-company-lock';
import {
  materialCommandFailure,
  correctionCollision,
} from '../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.contract';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import {
  INVENTORY_AUTHORITY_NAMESPACE,
  inventoryAuthorityKey,
} from '../src/inventory/physical/inventory-authority-fence';
import { deriveHealthcareCompanyLockKey } from '../src/healthcare/common/healthcare-company-lock-key';

// Explicit authorization fails closed, never skip. Real Prisma/SQL throughout.
// Spies only delegate real domain operations to coordinate or inject test faults.
// RR CREATE-after-correction requires 01E: no invented guard or passing placeholder.
describe('HC-DSP-COR-01D isolated real PostgreSQL16 Equipment/MIXTO', () => {
  jest.setTimeout(30000);
  const clients: PrismaClient[] = [],
    pids = new Set<number>();
  let a: PrismaClient,
    b: PrismaClient,
    observer: PrismaClient,
    pidA: number,
    pidB: number,
    runId: string;
  beforeAll(async () => {
    const config = equipmentQaConfiguration();
    runId = config.runId;
    new InventoryRuntimeCompatibilityService().identity();
    for (let n = 0; n < 3; n++) {
      const db = new PrismaClient({ datasources: { db: { url: config.url } } });
      clients.push(db);
      const identity = await verifyEquipmentQaDatabase(db, pids, true);
      expect(pids.has(identity.pid)).toBe(false);
      pids.add(identity.pid);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const [clock] = await tx.$queryRaw<
          { at: Date }[]
        >`SELECT clock_timestamp()::timestamp(3) AS at`;
        expect(clock.at).toBeInstanceOf(Date);
      });
    }
    [a, b, observer] = clients;
    [pidA, pidB] = [...pids];
    expect(pids.size).toBe(3);
  });
  beforeEach(async () => {
    expect(
      pids.has((await verifyEquipmentQaDatabase(observer, pids, false)).pid),
    ).toBe(true);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await Promise.all(clients.map((db) => db.$disconnect()));
  });
  async function held(ready: Promise<void>, work: ReturnType<typeof settled>) {
    await Promise.race([
      ready,
      work.then((r) => {
        if (!r.ok) throw r.error;
        throw new Error('Holder finished before coordination point');
      }),
    ]);
  }
  function harness(db: PrismaClient, pid: number) {
    const h = equipmentHarness(db),
      write = h.repo.write.bind(h.repo) as typeof h.repo.write;
    jest.spyOn(h.repo, 'write').mockImplementation((fn, policy) =>
      write(async (tx) => {
        expect(await transactionPid(tx)).toBe(pid);
        return fn(tx);
      }, policy),
    );
    return h;
  }
  it.each(['GOOD', 'INSPECTION_PENDING', 'DAMAGED', 'OUT_OF_SERVICE'] as const)(
    'Equipment-only preserves %s and exact SQL 01B metadata, forcing constraints inside tx',
    async (condition) => {
      const o = await equipmentOrigin(a, runId, false, 1, condition),
        c = commandContext(o),
        h = harness(a, pidA);
      const before = await equipmentState(observer, c.companyId);
      const constraints = h.repo.constraints.bind(
        h.repo,
      ) as typeof h.repo.constraints;
      let reached = false;
      jest.spyOn(h.repo, 'constraints').mockImplementation(async (tx) => {
        await constraints(tx);
        const [facts] = await tx.$queryRaw<
          { valid: boolean }[]
        >`SELECT bool_and(i.snapshot=public.dispatch_correction_item_snapshot(i.id) AND e."requestHash"=r."requestHash" AND e."createdAt"=r."confirmedAt" AND c."closedAt"=r."confirmedAt") AS valid FROM "HealthcareCaseDispatchCorrectionItem" i JOIN "HealthcareCaseDispatchCorrection" r ON r.id=i."correctionId" JOIN "EquipmentAssetPhysicalEvent" e ON e.id=i."closePhysicalEventId" JOIN "EquipmentAssetCustody" c ON c.id=i."equipmentCustodyId" WHERE r."companyId"=${c.companyId}`;
        expect(facts.valid).toBe(true);
        reached = true;
      });
      const result = await h.service.execute(c, commandIntent());
      expect(reached).toBe(true);
      expectEquipmentCorrection(
        before,
        await equipmentState(observer, c.companyId),
        result,
      );
    },
  );
  it.each([
    [false, 2],
    [true, 1],
    [true, 2],
  ] as const)(
    'complete Equipment/MIXTO material=%s equipment=%s',
    async (material, count) => {
      const o = await equipmentOrigin(a, runId, material, count),
        c = commandContext(o),
        before = await equipmentState(observer, c.companyId);
      const result = await harness(a, pidA).service.execute(c, commandIntent());
      expectEquipmentCorrection(
        before,
        await equipmentState(observer, c.companyId),
        result,
      );
    },
  );
  it('MATERIAL-only keeps 01C behavior with the 01D composition', async () => {
    const o = await orchestrationOrigin(a),
      c = commandContext(o),
      before = await equipmentState(observer, c.companyId);
    const result = await harness(a, pidA).service.execute(c, commandIntent());
    expectEquipmentCorrection(
      before,
      await equipmentState(observer, c.companyId),
      result,
    );
  });
  it.each(['material', 'close-1', 'close-2'] as const)(
    'real MIXTO rollback AFTER verified %s, including all physical/projection facts',
    async (phase) => {
      const o = await equipmentOrigin(a, runId, true, 2),
        c = commandContext(o),
        h = harness(a, pidA),
        before = await equipmentState(observer, c.companyId);
      let reached = false,
        closes = 0;
      async function inject(tx: Prisma.TransactionClient) {
        const state = await equipmentState(tx as PrismaClient, c.companyId);
        expect(state.roots).toHaveLength(1);
        expect(state.claims.length).toBe(before.claims.length + 1);
        expect(
          state.effects.filter(
            (e) => e.originType === 'CASE_DISPATCH_CORRECTION',
          ),
        ).toHaveLength(1);
        expect(
          state.positions.find(
            (p) =>
              p.id ===
              o.items.find((i) => i.type === 'MATERIAL')!.destinationPositionId,
          ),
        ).toMatchObject({ quantity: 0 });
        expect(
          state.events.filter((e) => e.operation === 'CUSTODY_CLOSE'),
        ).toHaveLength(closes);
        expect(
          state.custodies.filter((episode) => episode.closedAt !== null),
        ).toHaveLength(closes);
        expect(state.products).toEqual(before.products);
        reached = true;
        throw new Error('01D fault AFTER verified ' + phase);
      }
      if (phase === 'material') {
        const real = h.repo.createEvidenceItems.bind(
          h.repo,
        ) as typeof h.repo.createEvidenceItems;
        jest
          .spyOn(h.repo, 'createEvidenceItems')
          .mockImplementation(async (...args) => {
            await real(...args);
            await inject(args[0]);
          });
      } else {
        const real = Reflect.get(
          EquipmentCustodyCloseService.prototype,
          'returnFromCustody',
        );
        jest
          .spyOn(EquipmentCustodyCloseService.prototype, 'returnFromCustody')
          .mockImplementation(async function (
            this: EquipmentCustodyCloseService,
            tx,
            command,
          ) {
            const result = await (real.bind(this) as typeof real)(tx, command);
            closes++;
            if (closes === (phase === 'close-1' ? 1 : 2)) await inject(tx);
            return result;
          });
      }
      const outcome = await settled(h.service.execute(c, commandIntent()));
      expect({ reached, outcome }).toMatchObject({ reached: true });
      expect(await equipmentState(observer, c.companyId)).toEqual(before);
      expect(outcome).toMatchObject({
        ok: false,
        error: { code: 'CORRECTION_PERSISTENCE_ERROR' },
      });
    },
  );
  it('rejects a legitimate CONDITION_CHANGE after the target CUSTODY_OPEN', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o);
    await inspectionService(a).createInspection(
      c.companyId,
      c.requesterId,
      o.f.asset.id,
      { conditionAfter: 'DAMAGED', notes: '01D later legitimate inspection' },
    );
    const before = await equipmentState(observer, c.companyId);
    expect(
      before.events.some(
        (e) => e.operation === 'CONDITION_CHANGE' && e.revisionAfter === 2,
      ),
    ).toBe(true);
    await expect(
      harness(a, pidA).service.execute(c, commandIntent()),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
  });
  it('rejects inconsistent live revision without accepting orphan physical history', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o);
    // Deliberately malformed QA state, not a production writer operation.
    await a.equipmentAsset.update({
      where: { id: o.f.asset.id },
      data: { physicalRevision: 2 },
    });
    const before = await equipmentState(observer, c.companyId);
    await expect(
      harness(a, pidA).service.execute(c, commandIntent()),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
  });
  it('rejects inconsistent staged evidence before a close, rolling back the real parent/claim', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o),
      before = await equipmentState(observer, c.companyId);
    const real = Reflect.get(
      EquipmentCustodyCloseService.prototype,
      'returnFromCustody',
    );
    let reached = false;
    jest
      .spyOn(EquipmentCustodyCloseService.prototype, 'returnFromCustody')
      .mockImplementation(async function (
        this: EquipmentCustodyCloseService,
        tx,
        command,
      ) {
        const item =
          await tx.healthcareCaseDispatchCorrectionItem.findUniqueOrThrow({
            where: { id: command.durableOrigin.id },
          });
        expect(item.snapshot).toBeNull();
        await tx.healthcareCaseDispatchCorrectionItem.update({
          where: { id: item.id },
          data: { openPhysicalEventId: null },
        });
        reached = true;
        return (real.bind(this) as typeof real)(tx, command);
      });
    const outcome = await settled(
      harness(a, pidA).service.execute(c, commandIntent()),
    );
    expect({ reached, outcome }).toMatchObject({
      reached: true,
      outcome: { ok: false, error: { code: 'RESOURCE_STATE_CHANGED' } },
    });
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
  });
  it.each(['SALES', 'WAREHOUSE', 'INACTIVE'] as const)(
    'rejects %s current actor with no persisted correction writes',
    async (role) => {
      const o = await equipmentOrigin(a, runId),
        c = commandContext(o);
      await a.user.update({
        where: { id: c.requesterId },
        data: role === 'INACTIVE' ? { isActive: false } : { role },
      });
      const before = await equipmentState(observer, c.companyId);
      await expect(
        harness(a, pidA).service.execute(c, commandIntent()),
      ).rejects.toHaveProperty('code', 'CORRECTION_ACTOR_FORBIDDEN');
      expect(await equipmentState(observer, c.companyId)).toEqual(before);
    },
  );
  it('rejects foreign tenant even with its own authorized ADMIN', async () => {
    const o = await equipmentOrigin(a, runId),
      foreign = await equipmentOrigin(a, runId),
      c = commandContext(o);
    const before = await equipmentState(observer, c.companyId),
      alienBefore = await equipmentState(observer, foreign.f.companyId);
    await expect(
      harness(a, pidA).service.execute(
        {
          ...c,
          companyId: foreign.f.companyId,
          requesterId: foreign.f.user.id,
        },
        commandIntent(),
      ),
    ).rejects.toHaveProperty('code', 'CORRECTION_DISPATCH_NOT_FOUND');
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
    expect(await equipmentState(observer, foreign.f.companyId)).toEqual(
      alienBefore,
    );
  });
  it.each(['DRAFT', 'CONFIRMED'] as const)(
    'real RR %s blocks correction (including its already closed custody)',
    async (status) => {
      const o = await equipmentOrigin(a, runId),
        c = commandContext(o),
        rr = await equipmentReconciliation(a, o);
      if (status === 'CONFIRMED') await rr.confirm();
      const before = await equipmentState(observer, c.companyId);
      if (status === 'CONFIRMED')
        expect(before.custodies[0].closedAt).not.toBeNull();
      await expect(
        harness(a, pidA).service.execute(c, commandIntent()),
      ).rejects.toHaveProperty(
        'code',
        'CORRECTION_RECONCILIATION_INCOMPATIBLE',
      );
      expect(await equipmentState(observer, c.companyId)).toEqual(before);
    },
  );
  it('explicit RR cancellation remains historical and permits complete correction', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o),
      rr = await equipmentReconciliation(a, o);
    await rr.cancel();
    const before = await equipmentState(observer, c.companyId),
      result = await harness(a, pidA).service.execute(c, commandIntent());
    expectEquipmentCorrection(
      before,
      await equipmentState(observer, c.companyId),
      result,
    );
  });
  it.each(['unchanged', 'later inspection', 'other authorized actor'] as const)(
    'historical replay: %s, no new movements/closures',
    async (mode) => {
      const o = await equipmentOrigin(a, runId, true),
        c = commandContext(o),
        h = harness(a, pidA),
        intent = commandIntent();
      const first = await h.service.execute(c, intent);
      if (mode === 'later inspection')
        await inspectionService(a).createInspection(
          c.companyId,
          c.requesterId,
          o.f.asset.id,
          { conditionAfter: 'DAMAGED' },
        );
      if (mode === 'other authorized actor') {
        const actor = await a.user.create({
          data: {
            companyId: c.companyId,
            firstName: 'Replay',
            lastName: 'Manager',
            email: randomUUID() + '@example.invalid',
            passwordHash: 'NOT-A-CREDENTIAL',
            role: 'MANAGER',
          },
        });
        c.requesterId = actor.id;
      }
      const before = await equipmentState(observer, c.companyId),
        write = jest.spyOn(h.repo, 'write');
      write.mockClear();
      expect(await h.service.execute(c, intent)).toEqual({
        replay: true,
        witness: first.witness,
      });
      expect(write).not.toHaveBeenCalled();
      expect(await equipmentState(observer, c.companyId)).toEqual(before);
    },
  );
  it('new key cannot close a corrected custody twice', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o),
      h = harness(a, pidA);
    await h.service.execute(c, commandIntent());
    const before = await equipmentState(observer, c.companyId);
    await expect(
      h.service.execute(
        { ...c, idempotencyKey: randomUUID() },
        commandIntent(),
      ),
    ).rejects.toHaveProperty('code', 'CORRECTION_ALREADY_EXISTS');
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
  });
  it('same key with a different intent remains a conflict without writes', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o),
      h = harness(a, pidA);
    await h.service.execute(c, commandIntent());
    const before = await equipmentState(observer, c.companyId);
    await expect(
      h.service.execute(c, { ...commandIntent(), reason: 'Another intention' }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
  });
  it('distinct keys race on distinct physical connections; exactly one complete MIXTO correction', async () => {
    const o = await equipmentOrigin(a, runId, true, 2),
      c = commandContext(o),
      before = await equipmentState(observer, c.companyId);
    const hs = [harness(a, pidA), harness(b, pidB)],
      barrier = abortableTwoPartyBarrier(),
      arrivals: number[] = [];
    for (const h of hs) {
      const create = h.repo.createClaim.bind(
        h.repo,
      ) as typeof h.repo.createClaim;
      jest.spyOn(h.repo, 'createClaim').mockImplementation(async (...args) => {
        arrivals.push(await transactionPid(args[0]));
        await barrier.arrive();
        return create(...args);
      });
    }
    const results = await Promise.all(
      hs.map((h, n) =>
        settled(
          h.service
            .execute(
              { ...c, idempotencyKey: n ? randomUUID() : c.idempotencyKey },
              commandIntent(),
            )
            .catch((e: unknown) => {
              barrier.abort(e);
              throw e;
            }),
        ),
      ),
    );
    expect(new Set(arrivals)).toEqual(new Set([pidA, pidB]));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const winner = results.find((r) => r.ok),
      loser = results.find((r) => !r.ok);
    if (!winner?.ok || !loser || loser.ok)
      throw new Error('Expected exactly one winner');
    expect(loser.error).toHaveProperty('code', 'CORRECTION_ALREADY_EXISTS');
    expectEquipmentCorrection(
      before,
      await equipmentState(observer, c.companyId),
      winner.value,
    );
  });
  it('the real temporal guard rejects a future openedAt AFTER successful physical-history validation', async () => {
    const o = await equipmentOrigin(a, runId),
      c = commandContext(o);
    // Deliberately malformed QA timestamp. No clocks, guards or Events are overridden.
    await a.$executeRaw`UPDATE "EquipmentAssetCustody" SET "openedAt"=date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day' WHERE id=${o.items[0].equipmentCustodyId} AND "companyId"=${c.companyId}`;
    const before = await equipmentState(observer, c.companyId);
    type Proof = {
      proveApplyHistory(
        tx: Prisma.TransactionClient,
        asset: object,
        custody: object,
      ): Promise<void>;
    };
    const prototype =
        EquipmentCustodyCloseService.prototype as unknown as Proof,
      real = Reflect.get(prototype, 'proveApplyHistory');
    let historyReached = false;
    jest
      .spyOn(prototype, 'proveApplyHistory')
      .mockImplementation(async function (this: Proof, ...args) {
        await (real.bind(this) as typeof real)(...args);
        historyReached = true;
      });
    const repository = new EquipmentPhysicalRepository(),
      history = new EquipmentPhysicalHistoryService(repository),
      service = new EquipmentCustodyCloseService(
        repository,
        history,
        new EquipmentCustodyCloseContextRegistry(),
      );
    const append = jest.spyOn(history, 'appendCustodyClose'),
      actor = jest.spyOn(history, 'requireReceiptActor');
    const outcome = await settled(
      a.$transaction(async (tx) => {
        await acquireHealthcareCompanyLock(tx, c.companyId, {
          acquisitionTimeoutMs:
            equipmentHarness(a).policy.companyLockAcquisitionTimeoutMs,
        });
        return service.returnFromCustody(tx, {
          companyId: c.companyId,
          caseId: c.caseId,
          actorId: c.requesterId,
          assetId: o.items[0].assetId!,
          custodyId: o.items[0].equipmentCustodyId!,
          assignmentId: o.items[0].assignmentId!,
          expectedPhysicalRevision: 1,
          reportedCondition: 'GOOD',
          validatedContext: {
            adapterKey: 'QA_TEMPORAL_GUARD',
            contextId: randomUUID(),
          },
          durableOrigin: {
            type: 'QA_TEMPORAL_GUARD',
            id: randomUUID(),
            operation: 'REJECT_BEFORE_CONTEXT',
          },
        });
      }),
    );
    expect({ historyReached, outcome }).toMatchObject({
      historyReached: true,
      outcome: {
        ok: false,
        error: { code: 'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR' },
      },
    });
    expect(actor).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(await equipmentState(observer, c.companyId)).toEqual(before);
  });
  it.each(['correction', 'reconciliation'] as const)(
    'real RR compatible close versus correction: %s holds Company first',
    async (first) => {
      const o = await equipmentOrigin(a, runId),
        c = commandContext(o),
        rr = await equipmentReconciliation(b, o),
        h = harness(a, pidA);
      const before = await equipmentState(observer, c.companyId),
        ready = latch(),
        release = latch();
      if (first === 'correction') {
        const real = h.repo.lockStructure.bind(
          h.repo,
        ) as typeof h.repo.lockStructure;
        jest
          .spyOn(h.repo, 'lockStructure')
          .mockImplementation(async (...args) => {
            const source = await real(...args);
            ready.release();
            await release.ready;
            return source;
          });
      } else {
        const real = Reflect.get(
          EquipmentCustodyCloseService.prototype,
          'returnFromCustody',
        );
        jest
          .spyOn(EquipmentCustodyCloseService.prototype, 'returnFromCustody')
          .mockImplementation(async function (
            this: EquipmentCustodyCloseService,
            tx,
            command,
          ) {
            expect(await transactionPid(tx)).toBe(pidB);
            const result = await (real.bind(this) as typeof real)(tx, command);
            ready.release();
            await release.ready;
            return result;
          });
      }
      const correction = () => h.service.execute(c, commandIntent());
      const leader =
        first === 'correction' ? settled(correction()) : settled(rr.confirm());
      let follower: ReturnType<typeof settled> | undefined;
      try {
        await held(ready.ready, leader);
        follower =
          first === 'correction'
            ? settled(rr.confirm())
            : settled(correction());
        await observeBlocking(
          observer,
          first === 'correction' ? pidB : pidA,
          first === 'correction' ? pidA : pidB,
        );
        release.release();
        const lead = await leader,
          follow = await follower;
        const rejected = first === 'correction' ? lead : follow,
          accepted = first === 'correction' ? follow : lead;
        expect(rejected).toMatchObject({
          ok: false,
          error: { code: 'CORRECTION_RECONCILIATION_INCOMPATIBLE' },
        });
        expect(accepted.ok).toBe(true);
        const after = await equipmentState(observer, c.companyId);
        expect(after.roots).toEqual(before.roots);
        expect(after.items).toEqual(before.items);
        expect(
          after.claims.filter(
            (cl) =>
              cl.scope === 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
          ),
        ).toHaveLength(0);
        const close = after.events.filter(
          (e) => e.operation === 'CUSTODY_CLOSE',
        );
        expect(close).toHaveLength(1);
        expect(close[0].originType).toBe('CASE_RECONCILIATION_ITEM');
        expect(after.custodies[0].closedAt).not.toBeNull();
        expect(
          after.assets.find((asset) => asset.id === o.f.asset.id),
        ).toMatchObject({
          physicalRevision: 2,
          physicalLocation: 'WAREHOUSE',
          activeCustodyId: null,
        });
        expect(after.assignments).toEqual(before.assignments);
        expect(after.sources).toEqual(before.sources);
        expect(after.dispatch).toEqual(before.dispatch);
        expect(after.products).toEqual(before.products);
        expect(after.rr[0].status).toBe('CONFIRMED');
      } finally {
        release.release();
        await leader;
        if (follower) await follower;
      }
    },
  );
  it('a real Asset lock timeout rejects the MIXTO command without replay or partial effects', async () => {
    const o = await equipmentOrigin(a, runId, true),
      c = commandContext(o),
      h = equipmentHarness(a),
      before = await equipmentState(observer, c.companyId),
      ready = latch(),
      release = latch();
    const holder = settled(
      b.$transaction(
        async (tx) => {
          expect(await transactionPid(tx)).toBe(pidB);
          await tx.$queryRaw`SELECT id FROM "EquipmentAsset" WHERE id=${o.f.asset.id} AND "companyId"=${c.companyId} FOR UPDATE`;
          ready.release();
          await release.ready;
        },
        { timeout: 15000 },
      ),
    );
    const write = h.repo.write.bind(h.repo) as typeof h.repo.write,
      read = jest.spyOn(h.repo, 'read');
    let raw: unknown;
    jest.spyOn(h.repo, 'write').mockImplementation(async (fn, policy) => {
      try {
        return await write(fn, policy);
      } catch (e) {
        raw = e;
        throw e;
      }
    });
    let command: ReturnType<typeof settled> | undefined;
    try {
      await held(ready.ready, holder);
      command = settled(h.service.execute(c, commandIntent()));
      await observeBlocking(observer, pidA, pidB);
      const result = await command;
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'CORRECTION_CONCURRENCY_ERROR' },
      });
      expect(raw).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(raw).toMatchObject({ code: 'P2010', meta: { code: '55P03' } });
      expect(read).toHaveBeenCalledTimes(2);
      expect(await equipmentState(observer, c.companyId)).toEqual(before);
    } finally {
      release.release();
      await holder;
      if (command) await command;
    }
  });
  it('controlled real SQL lock inversion produces a deadlock, classified as concurrency and never replay', async () => {
    const o = await equipmentOrigin(a, runId, false, 2),
      before = await equipmentState(observer, o.f.companyId),
      assets = o.items.map((i) => i.assetId!).sort(),
      barrier = abortableTwoPartyBarrier();
    const [settings] = await observer.$queryRaw<
      { milliseconds: number }[]
    >`SELECT setting::integer AS milliseconds FROM pg_settings WHERE name='deadlock_timeout' AND unit='ms'`;
    expect(settings.milliseconds).toBeLessThanOrEqual(2000);
    // Deliberately reversed TEST locks, not an assertion of a production inversion.
    // No domain writer or business data changes are issued in either transaction.
    const work = (db: PrismaClient, pid: number, n: number) =>
      settled(
        db
          .$transaction(
            async (tx) => {
              expect(await transactionPid(tx)).toBe(pid);
              await tx.$queryRaw`SELECT set_config('lock_timeout','5s',true),set_config('statement_timeout','8s',true)`;
              await tx.$queryRaw`SELECT id FROM "EquipmentAsset" WHERE id=${assets[n]} AND "companyId"=${o.f.companyId} FOR UPDATE`;
              await barrier.arrive();
              await tx.$queryRaw`SELECT id FROM "EquipmentAsset" WHERE id=${assets[1 - n]} AND "companyId"=${o.f.companyId} FOR UPDATE`;
            },
            { timeout: 10000 },
          )
          .catch((e: unknown) => {
            barrier.abort(e);
            throw e;
          }),
      );
    const results = await Promise.all([work(a, pidA, 0), work(b, pidB, 1)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const rejected = results.find((r) => !r.ok);
    if (!rejected || rejected.ok)
      throw new Error('Expected one actual deadlock victim');
    expect(rejected.error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(rejected.error).toMatchObject({
      code: 'P2010',
      meta: { code: '40P01' },
    });
    expect(correctionCollision(rejected.error)).toBeNull();
    let classified: unknown;
    try {
      materialCommandFailure(rejected.error);
    } catch (e) {
      classified = e;
    }
    expect(classified).toHaveProperty('code', 'CORRECTION_CONCURRENCY_ERROR');
    expect(await equipmentState(observer, o.f.companyId)).toEqual(before);
  });
  it('observes the real MIXTO lock prefix and proves Asset/Custody prelocks with independent NOWAIT probes', async () => {
    const o = await equipmentOrigin(a, runId, true),
      c = commandContext(o),
      h = harness(a, pidA),
      before = await equipmentState(observer, c.companyId),
      order: string[] = [];
    const key = BigInt.asUintN(64, deriveHealthcareCompanyLockKey(c.companyId));
    const claim = h.repo.createClaim.bind(h.repo) as typeof h.repo.createClaim;
    jest.spyOn(h.repo, 'createClaim').mockImplementation(async (...args) => {
      const [locks] = await args[0].$queryRaw<
        { inventory: boolean; company: boolean }[]
      >`SELECT
        EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted AND classid=${INVENTORY_AUTHORITY_NAMESPACE}::oid AND objid=(${inventoryAuthorityKey(c.companyId)}::bigint & 4294967295)::oid AND objsubid=2 AND mode='ShareLock') AS inventory,
        EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted AND classid=(${key >> 32n}::bigint)::oid AND objid=(${key & 0xffffffffn}::bigint)::oid AND objsubid=1 AND mode='ExclusiveLock') AS company`;
      expect(locks).toEqual({ inventory: true, company: false });
      const result = await claim(...args);
      order.push('claim');
      return result;
    });
    const structure = h.repo.lockStructure.bind(
      h.repo,
    ) as typeof h.repo.lockStructure;
    jest.spyOn(h.repo, 'lockStructure').mockImplementation(async (...args) => {
      const [lock] = await args[0].$queryRaw<
        { held: boolean }[]
      >`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted AND classid=(${key >> 32n}::bigint)::oid AND objid=(${key & 0xffffffffn}::bigint)::oid AND objsubid=1 AND mode='ExclusiveLock') AS held`;
      expect(lock.held).toBe(true);
      const result = await structure(...args);
      order.push('structure');
      return result;
    });
    const transfer = h.physical.transferDispatchCorrectionMaterial.bind(
      h.physical,
    ) as typeof h.physical.transferDispatchCorrectionMaterial;
    jest
      .spyOn(h.physical, 'transferDispatchCorrectionMaterial')
      .mockImplementation(async (...args) => {
        const result = await transfer(...args);
        order.push('material');
        return result;
      });
    const close = Reflect.get(
      EquipmentCustodyCloseService.prototype,
      'returnFromCustody',
    );
    jest
      .spyOn(EquipmentCustodyCloseService.prototype, 'returnFromCustody')
      .mockImplementation(async function (
        this: EquipmentCustodyCloseService,
        tx,
        command,
      ) {
        expect(await transactionPid(tx)).toBe(pidA);
        const asset = await settled(
          b.$transaction(
            (other) =>
              other.$queryRaw`SELECT id FROM "EquipmentAsset" WHERE id=${command.assetId} AND "companyId"=${command.companyId} FOR UPDATE NOWAIT`,
          ),
        );
        const custody = await settled(
          b.$transaction(
            (other) =>
              other.$queryRaw`SELECT id FROM "EquipmentAssetCustody" WHERE id=${command.custodyId} AND "companyId"=${command.companyId} FOR UPDATE NOWAIT`,
          ),
        );
        expect(asset).toMatchObject({
          ok: false,
          error: { code: 'P2010', meta: { code: '55P03' } },
        });
        expect(custody).toMatchObject({
          ok: false,
          error: { code: 'P2010', meta: { code: '55P03' } },
        });
        const result = await (close.bind(this) as typeof close)(tx, command);
        order.push('equipment');
        return result;
      });
    const constraints = h.repo.constraints.bind(
      h.repo,
    ) as typeof h.repo.constraints;
    jest.spyOn(h.repo, 'constraints').mockImplementation(async (tx) => {
      await constraints(tx);
      order.push('constraints');
    });
    const result = await h.service.execute(c, commandIntent());
    expect(order).toEqual([
      'claim',
      'structure',
      'material',
      'equipment',
      'constraints',
    ]);
    expectEquipmentCorrection(
      before,
      await equipmentState(observer, c.companyId),
      result,
    );
  });
});
