import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  orchestrationQaUrl,
  verifyOrchestrationQaDatabase,
} from './helpers/dispatch-correction-material-orchestration-postgres-authorization';
import {
  orchestrationOrigin,
  orchestrationHarness,
  orchestrationState,
  commandContext,
  commandIntent,
  reconciliationEpisode,
  twoPartyBarrier,
} from './helpers/dispatch-correction-material-orchestration-fixture';
import { InventoryRuntimeCompatibilityService } from '../src/inventory/physical/inventory-runtime-compatibility.service';
import { inventoryAuthorityFence } from '../src/inventory/physical/inventory-authority-fence';

// No dotenv, fallback URL, provisioning, cleanup or automatic PostgreSQL execution.
// These tests prove basic B atomicity only; the global race matrix belongs to C.
const enabled =
  process.env.RUN_CASE_DISPATCH_CORRECTION_ORCHESTRATION_POSTGRES === '1';
(enabled ? describe : describe.skip)(
  '01C-B isolated PostgreSQL orchestration',
  () => {
    let db: PrismaClient;
    beforeAll(async () => {
      db = new PrismaClient({
        datasources: { db: { url: orchestrationQaUrl() } },
      });
      await verifyOrchestrationQaDatabase(db);
      new InventoryRuntimeCompatibilityService().identity();
    });
    afterEach(() => jest.restoreAllMocks());
    afterAll(async () => {
      await db?.$disconnect();
    });
    jest.setTimeout(30000);

    it.each(['simple', 'grouped', 'batch'] as const)(
      'commits %s with a sealed 01B witness, exact mappings and conserved owned',
      async (kind) => {
        const o = await orchestrationOrigin(db, kind),
          c = commandContext(o),
          i = commandIntent();
        const before = await orchestrationState(db, c.companyId);
        const result = await orchestrationHarness(db).service.execute(c, i);
        const after = await orchestrationState(db, c.companyId);
        expect(result.replay).toBe(false);
        expect(after.roots).toHaveLength(1);
        const root = after.roots[0];
        expect(root.snapshot).not.toBeNull();
        expect(result.witness.id).toBe(root.id);
        expect(result.witness.items).toHaveLength(
          before.sources.filter((s) => s.lifecycle === 'ACTIVE').length,
        );
        expect(after.claims.filter((cl) => cl.resourceId === root.id)).toEqual([
          expect.objectContaining({
            key: c.idempotencyKey,
            requestHash: root.requestHash,
          }),
        ]);
        const effects = after.effects.filter(
          (e) => e.originType === 'CASE_DISPATCH_CORRECTION',
        );
        expect(effects).toHaveLength(1);
        const effect = effects[0];
        expect(effect.requestHash).toBe(root.requestHash);
        expect(effect.actorId).toBe(root.confirmedById);
        expect(effect.occurredAt).toEqual(root.confirmedAt);
        expect(effect.lines).toHaveLength(effect.lineCount);
        for (const source of before.sources.filter(
          (s) => s.lifecycle === 'ACTIVE',
        )) {
          const item = result.witness.items.find(
            (item) => item.sourceDispatchItemId === source.id,
          )!;
          expect(item).toMatchObject({
            quantity: source.quantity,
            originalPhysicalEffectId: source.physicalEffectId,
            sourceCustodyPositionId: source.destinationPositionId,
            compensatingEffectId: effect.id,
          });
          expect(item.snapshot).not.toBeNull();
          expect(
            after.positions.find((p) => p.id === source.destinationPositionId),
          ).toMatchObject({ quantity: 0, revision: 2 });
          expect(
            effect.lines.find(
              (l) => l.positionId === source.destinationPositionId,
            ),
          ).toMatchObject({ delta: -source.quantity!, quantityAfter: 0 });
          expect(
            after.positions.find((p) => p.id === item.destinationPositionId),
          ).toMatchObject({
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
            productId: source.productId,
            inventoryBatchId: source.batchId,
          });
        }
        for (const p of before.products) {
          const sum = (positions: typeof before.positions) =>
            positions
              .filter((x) => x.productId === p.id)
              .reduce((n, x) => n + x.quantity, 0);
          expect(sum(after.positions)).toBe(sum(before.positions));
        }
        expect(after.products).toEqual(before.products);
        expect(after.dispatch).toEqual(before.dispatch);
        expect(after.sources).toEqual(before.sources);
        expect(after.dispatchAudit).toEqual(before.dispatchAudit);
        expect(after.kits).toEqual(before.kits);
        expect(
          after.effects.filter(
            (e) => e.originType !== 'CASE_DISPATCH_CORRECTION',
          ),
        ).toEqual(before.effects);
        if (kind === 'batch')
          expect(after.batches[0]).toMatchObject({
            availableQuantity: 10,
            initialQuantity: 10,
          });
        const replay = await orchestrationHarness(db).service.execute(c, i);
        expect(replay).toEqual({ replay: true, witness: result.witness });
        expect(await orchestrationState(db, c.companyId)).toEqual(after);
      },
    );

    it.each([
      'inactive',
      'role',
      'actor-tenant',
      'dispatch-tenant',
      'draft',
    ] as const)('rejects %s with no changes', async (scenario) => {
      const o = await orchestrationOrigin(
        db,
        scenario === 'draft' ? 'draft' : 'simple',
      );
      const c = commandContext(o);
      if (scenario === 'inactive')
        await db.user.update({
          where: { id: c.requesterId },
          data: { isActive: false },
        });
      if (scenario === 'role')
        await db.user.update({
          where: { id: c.requesterId },
          data: { role: 'WAREHOUSE' },
        });
      if (scenario === 'actor-tenant')
        c.requesterId = (await orchestrationOrigin(db)).f.user.id;
      if (scenario === 'dispatch-tenant')
        c.dispatchId = (await orchestrationOrigin(db)).d.id;
      const before = await orchestrationState(db, c.companyId);
      const code =
        scenario === 'draft'
          ? 'CORRECTION_DISPATCH_NOT_CONFIRMED'
          : scenario === 'dispatch-tenant'
            ? 'CORRECTION_DISPATCH_NOT_FOUND'
            : 'CORRECTION_ACTOR_FORBIDDEN';
      await expect(
        orchestrationHarness(db).service.execute(c, commandIntent()),
      ).rejects.toMatchObject({ code });
      expect(await orchestrationState(db, c.companyId)).toEqual(before);
    });

    it.each(['LEGACY', 'CUTOVER', 'RECOVERY_REQUIRED'] as const)(
      'rejects %s authority before claims',
      async (scenario) => {
        const o = await orchestrationOrigin(db),
          c = commandContext(o);
        if (scenario === 'LEGACY')
          await db.inventoryCutover.delete({
            where: { companyId: c.companyId },
          });
        if (scenario === 'CUTOVER')
          await db.inventoryCutover.update({
            where: { companyId: c.companyId },
            data: {
              status: 'PRECHECK',
              manifestDigest: null,
              snapshotFingerprint: null,
              baselineBuild: null,
              manifestLockedAt: null,
              approvedBy: null,
              activatedBy: null,
              activatedAt: null,
            },
          });
        if (scenario === 'RECOVERY_REQUIRED')
          await db.inventoryCutover.update({
            where: { companyId: c.companyId },
            data: {
              status: 'RECOVERY_REQUIRED',
              recoveryFromStatus: 'PHYSICAL_ACTIVE',
            },
          });
        const before = await orchestrationState(db, c.companyId);
        await expect(
          orchestrationHarness(db).service.execute(c, commandIntent()),
        ).rejects.toMatchObject({
          code:
            scenario === 'LEGACY'
              ? 'PHYSICAL_AUTHORITY_REQUIRED'
              : scenario === 'CUTOVER'
                ? 'CUTOVER_FROZEN'
                : 'RECOVERY_REQUIRED',
        });
        expect(await orchestrationState(db, c.companyId)).toEqual(before);
      },
    );

    it('replays for a current Manager after live-state changes, retains historical actor/date and rejects incompatible keys', async () => {
      const o = await orchestrationOrigin(db),
        c = commandContext(o),
        i = { ...commandIntent(), reason: '🚑'.repeat(1000) };
      const h = orchestrationHarness(db),
        result = await h.service.execute(c, i);
      const actor = await db.user.create({
        data: {
          companyId: c.companyId,
          firstName: 'Current',
          lastName: 'Manager',
          email: randomUUID() + '@example.invalid',
          passwordHash: 'NOT-A-CREDENTIAL',
          role: 'MANAGER',
        },
      });
      await db.product.update({
        where: { id: o.f.product.id },
        data: { isActive: false },
      });
      await db.inventoryCutover.update({
        where: { companyId: c.companyId },
        data: {
          status: 'RECOVERY_REQUIRED',
          recoveryFromStatus: 'PHYSICAL_ACTIVE',
        },
      });
      const before = await orchestrationState(db, c.companyId);
      const replay = await h.service.execute(
        { ...c, requesterId: actor.id },
        i,
      );
      expect(replay).toEqual({ replay: true, witness: result.witness });
      expect(replay.witness.confirmedById).toBe(c.requesterId);
      await expect(
        h.service.execute(c, { ...i, reason: 'Different' }),
      ).rejects.toHaveProperty('response.code', 'IDEMPOTENCY_KEY_REUSED');
      // Restore compatible authority to test the distinct-key new-command branch.
      await db.inventoryCutover.update({
        where: { companyId: c.companyId },
        data: { status: 'PHYSICAL_ACTIVE', recoveryFromStatus: null },
      });
      const compatible = await orchestrationState(db, c.companyId);
      await expect(
        h.service.execute({ ...c, idempotencyKey: randomUUID() }, i),
      ).rejects.toMatchObject({ code: 'CORRECTION_ALREADY_EXISTS' });
      expect(await orchestrationState(db, c.companyId)).toEqual(compatible);
      expect(before.roots).toEqual(compatible.roots);
      await db.user.update({
        where: { id: actor.id },
        data: { isActive: false },
      });
      await expect(
        h.service.execute({ ...c, requesterId: actor.id }, i),
      ).rejects.toMatchObject({ code: 'CORRECTION_ACTOR_FORBIDDEN' });
    });

    it.each(['DRAFT', 'CONFIRMED', 'CANCELLED'] as const)(
      'handles RR %s without automatically cancelling it',
      async (status) => {
        const o = await orchestrationOrigin(db),
          c = commandContext(o);
        await reconciliationEpisode(db, o, status);
        const before = await orchestrationState(db, c.companyId);
        if (status === 'CANCELLED')
          await expect(
            orchestrationHarness(db).service.execute(c, commandIntent()),
          ).resolves.toMatchObject({ replay: false });
        else {
          await expect(
            orchestrationHarness(db).service.execute(c, commandIntent()),
          ).rejects.toMatchObject({
            code: 'CORRECTION_RECONCILIATION_INCOMPATIBLE',
          });
          expect(await orchestrationState(db, c.companyId)).toEqual(before);
        }
        expect((await orchestrationState(db, c.companyId)).rr).toEqual(
          before.rr,
        );
      },
    );

    it.each(['mixed', 'equipment'] as const)(
      'rejects all %s Equipment ACTIVE without partial compensation',
      async (kind) => {
        const o = await orchestrationOrigin(db, kind),
          c = commandContext(o),
          before = await orchestrationState(db, c.companyId);
        await expect(
          orchestrationHarness(db).service.execute(c, commandIntent()),
        ).rejects.toMatchObject({ code: 'CORRECTION_MATERIAL_ONLY' });
        expect(await orchestrationState(db, c.companyId)).toEqual(before);
      },
    );

    it.each([
      'quantity',
      'revision',
      'movement',
      'product-inactive',
      'batch-inactive',
      'batch-expired',
    ] as const)('rejects changed %s', async (scenario) => {
      const o = await orchestrationOrigin(
          db,
          scenario.startsWith('batch') ? 'batch' : 'simple',
        ),
        c = commandContext(o);
      const id = o.source.destinationPositionId!;
      if (scenario === 'quantity')
        await db.inventoryPosition.update({
          where: { id },
          data: { quantity: 1 },
        });
      if (scenario === 'revision')
        await db.inventoryPosition.update({
          where: { id },
          data: { revision: 2 },
        });
      if (scenario === 'product-inactive')
        await db.product.update({
          where: { id: o.f.product.id },
          data: { isActive: false },
        });
      if (scenario.startsWith('batch'))
        await db.inventoryBatch.update({
          where: { id: o.source.batchId! },
          data:
            scenario === 'batch-inactive'
              ? { isActive: false }
              : { expirationDate: new Date(Date.now() - 86400000) },
        });
      if (scenario === 'movement') {
        const physical = orchestrationHarness(db).physical;
        await db.$transaction(async (tx) => {
          await inventoryAuthorityFence(tx, c.companyId, 'shared');
          await physical.transfer(
            tx,
            {
              companyId: c.companyId,
              actorId: c.requesterId,
              origin: { type: '01C_B_QA', id: randomUUID(), operation: 'OUT' },
            },
            [
              {
                sourceId: id,
                quantity: 1,
                expectedSourceRevision: 1,
                target: {
                  productId: o.source.productId,
                  inventoryBatchId: null,
                  state: 'AVAILABLE',
                  contextType: null,
                  contextId: null,
                },
              },
            ],
          );
          await physical.transfer(
            tx,
            {
              companyId: c.companyId,
              actorId: c.requesterId,
              origin: {
                type: '01C_B_QA',
                id: randomUUID(),
                operation: 'RESTORE',
              },
            },
            [
              {
                sourceId: o.source.sourcePositionId!,
                quantity: 1,
                expectedSourceRevision: 2,
                target: {
                  productId: o.source.productId,
                  inventoryBatchId: null,
                  state: 'CUSTODY',
                  contextType: 'CASE_DISPATCH_ITEM',
                  contextId: o.source.id,
                },
              },
            ],
          );
        });
        expect(
          await db.inventoryPosition.findUniqueOrThrow({ where: { id } }),
        ).toMatchObject({ quantity: 2, revision: 3 });
      }
      const before = await orchestrationState(db, c.companyId);
      const code =
        scenario === 'quantity'
          ? 'CORRECTION_SOURCE_CHANGED'
          : scenario === 'revision' || scenario === 'movement'
            ? 'STALE_INVENTORY_REVISION'
            : 'PHYSICAL_SOURCE_NOT_ELIGIBLE';
      await expect(
        orchestrationHarness(db).service.execute(c, commandIntent()),
      ).rejects.toMatchObject({ code });
      expect(await orchestrationState(db, c.companyId)).toEqual(before);
    });

    it.each([
      'claim',
      'root',
      'effect',
      'projection',
      'items',
      'seal',
    ] as const)(
      'rolls back every fact after injected %s failure',
      async (phase) => {
        const o = await orchestrationOrigin(db, 'batch'),
          c = commandContext(o),
          h = orchestrationHarness(db);
        const before = await orchestrationState(db, c.companyId);
        const fail = () => {
          throw new Error('01C-B controlled failure');
        };
        // Test-only spies run the REAL phase first. No production fault hooks.
        if (phase === 'claim') {
          const fn = h.repo.createClaim.bind(
            h.repo,
          ) as typeof h.repo.createClaim;
          jest
            .spyOn(h.repo, 'createClaim')
            .mockImplementation(async (...args) => {
              await fn(...args);
              return fail();
            });
        }
        if (phase === 'root') {
          const fn = h.repo.createRoot.bind(h.repo) as typeof h.repo.createRoot;
          jest
            .spyOn(h.repo, 'createRoot')
            .mockImplementation(async (...args) => {
              await fn(...args);
              return fail();
            });
        }
        if (phase === 'effect') {
          const fn = h.physical.transferDispatchCorrectionMaterial.bind(
            h.physical,
          ) as typeof h.physical.transferDispatchCorrectionMaterial;
          jest
            .spyOn(h.physical, 'transferDispatchCorrectionMaterial')
            .mockImplementation(async (...args) => {
              await fn(...args);
              return fail();
            });
        }
        if (phase === 'projection') {
          const fn = h.projections.apply.bind(
            h.projections,
          ) as typeof h.projections.apply;
          jest
            .spyOn(h.projections, 'apply')
            .mockImplementation(async (...args) => {
              await fn(...args);
              return fail();
            });
        }
        if (phase === 'items') {
          const fn = h.repo.createEvidenceItems.bind(
            h.repo,
          ) as typeof h.repo.createEvidenceItems;
          jest
            .spyOn(h.repo, 'createEvidenceItems')
            .mockImplementation(async (...args) => {
              await fn(...args);
              return fail();
            });
        }
        if (phase === 'seal') {
          const fn = h.repo.seal.bind(h.repo) as typeof h.repo.seal;
          jest.spyOn(h.repo, 'seal').mockImplementation(async (...args) => {
            await fn(...args);
            return fail();
          });
        }
        await expect(
          h.service.execute(c, commandIntent()),
        ).rejects.toMatchObject({ code: 'CORRECTION_PERSISTENCE_ERROR' });
        expect(await orchestrationState(db, c.companyId)).toEqual(before);
      },
    );

    it('rejects an orphan Effect staged after the root and rolls back the entire command', async () => {
      const o = await orchestrationOrigin(db),
        c = commandContext(o),
        h = orchestrationHarness(db);
      const before = await orchestrationState(db, c.companyId);
      const create = h.repo.createRoot.bind(h.repo) as typeof h.repo.createRoot;
      jest.spyOn(h.repo, 'createRoot').mockImplementation(async (tx, data) => {
        const root = await create(tx, data);
        await tx.inventoryPhysicalEffect.create({
          data: {
            companyId: c.companyId,
            actorId: c.requesterId,
            originType: 'CASE_DISPATCH_CORRECTION',
            originId: root.id,
            originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
            kind: 'TRANSFER',
            requestHash: root.requestHash,
            occurredAt: root.confirmedAt,
            lineCount: 2,
          },
        });
        return root;
      });
      await expect(h.service.execute(c, commandIntent())).rejects.toMatchObject(
        { code: 'PHYSICAL_EFFECT_MISMATCH' },
      );
      expect(await orchestrationState(db, c.companyId)).toEqual(before);
    });

    it('two actual connections race the same claim; one correction and one compensating Effect persist', async () => {
      const o = await orchestrationOrigin(db),
        c = commandContext(o),
        i = commandIntent();
      const url = new URL(orchestrationQaUrl());
      url.searchParams.set('connection_limit', '1');
      const clients = [
        new PrismaClient({ datasources: { db: { url: url.toString() } } }),
        new PrismaClient({ datasources: { db: { url: url.toString() } } }),
      ];
      const barrier = twoPartyBarrier(),
        pids: number[] = [];
      try {
        for (const client of clients)
          await verifyOrchestrationQaDatabase(client);
        const harnesses = clients.map((client) => orchestrationHarness(client));
        for (const h of harnesses) {
          const fn = h.repo.createClaim.bind(
            h.repo,
          ) as typeof h.repo.createClaim;
          jest
            .spyOn(h.repo, 'createClaim')
            .mockImplementation(async (tx, data) => {
              const [pid] = await tx.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`;
              pids.push(pid.pid);
              await barrier();
              return fn(tx, data);
            });
        }
        const results = await Promise.all(
          harnesses.map((h) => h.service.execute(c, i)),
        );
        expect(new Set(pids).size).toBe(2);
        expect(results.map((r) => r.replay).sort()).toEqual([false, true]);
        expect(results[0].witness).toEqual(results[1].witness);
        const state = await orchestrationState(db, c.companyId);
        expect(state.roots).toHaveLength(1);
        expect(
          state.claims.filter((cl) => cl.key === c.idempotencyKey),
        ).toHaveLength(1);
        expect(
          state.effects.filter(
            (e) => e.originType === 'CASE_DISPATCH_CORRECTION',
          ),
        ).toHaveLength(1);
      } finally {
        await Promise.all(clients.map((client) => client.$disconnect()));
      }
    });
  },
);
