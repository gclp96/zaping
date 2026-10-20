import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { correctionFixtureFactory } from './helpers/dispatch-correction-fixture';
import {
  groupedCorrectionOrigin,
  originalDispatchBytes,
} from './helpers/dispatch-correction-grouped-fixture';
import {
  correctionQaUrl,
  verifyCorrectionQaDatabase,
} from './helpers/dispatch-correction-postgres-authorization';
import {
  correctionPgFailure,
  isCorrectionCheckViolation,
  CorrectionCheckExpectation,
} from './helpers/dispatch-correction-pg-failure';
import {
  CorrectionOrigin,
  persistCorrectionWitness,
  stageCorrectionWitness,
} from './helpers/dispatch-correction-witness';
import { HealthcareCaseDispatchCorrectionRepository } from '../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.repository';

jest.setTimeout(45000);
const suite =
  process.env.RUN_CASE_DISPATCH_CORRECTION_POSTGRES === '1'
    ? describe
    : describe.skip;
suite(
  'HC-DSP-COR-01B seal hardening / authorized isolated PostgreSQL16 only',
  () => {
    let db: PrismaClient;
    beforeAll(async () => {
      db = new PrismaClient({
        datasources: { db: { url: correctionQaUrl() } },
      });
      await db.$connect();
      console.info(
        'Verified hardening QA target',
        await verifyCorrectionQaDatabase(db),
      );
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function corrector(o: CorrectionOrigin) {
      return db.user.create({
        data: {
          companyId: o.f.companyId,
          firstName: 'Correction',
          lastName: 'Actor',
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'NOT-A-CREDENTIAL',
          role: 'MANAGER',
        },
      });
    }
    async function checkViolation(
      p: Promise<unknown>,
      expected: CorrectionCheckExpectation,
    ) {
      const result = await p.then(
        () => ({ accepted: true, error: null as unknown }),
        (error: unknown) => ({ accepted: false, error }),
      );
      expect(result.accepted).toBe(false);
      const failure = correctionPgFailure(result.error);
      // Keep the received code/constraint/diagnostic visible when a different
      // validator or a fixture/setup error rejects the transaction.
      expect({
        expected,
        received: {
          code: failure.code,
          constraint: failure.constraint,
          diagnostic: failure.diagnostic,
        },
        matches: isCorrectionCheckViolation(result.error, expected),
      }).toEqual(expect.objectContaining({ matches: true }));
    }
    async function assertRollback(
      id: string,
      o: CorrectionOrigin,
      before: unknown,
    ) {
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
          where: { originId: id, originType: 'CASE_DISPATCH_CORRECTION' },
        }),
      ).toBe(0);
      expect(await positions(o)).toEqual(before);
    }
    function positions(o: CorrectionOrigin) {
      return db.inventoryPosition.findMany({
        where: { companyId: o.f.companyId },
        orderBy: { id: 'asc' },
      });
    }
    it.each([false, true])(
      'checks grouped Effect lines and the exact source set independently (mixed=%s)',
      async (mixed) => {
        const o = await groupedCorrectionOrigin(db, mixed),
          actor = await corrector(o);
        const sources = await db.healthcareCaseDispatchItem.findMany({
          where: { dispatchId: o.d.id, lifecycle: 'ACTIVE' },
        });
        const materials = sources.filter(
          (source) => source.type === 'MATERIAL',
        );
        expect(materials).toHaveLength(2);
        const { id } = await persistCorrectionWitness(db, o, actor.id);
        const items = await db.healthcareCaseDispatchCorrectionItem.findMany({
          where: { correctionId: id },
        });
        expect(items.map((item) => item.sourceDispatchItemId).sort()).toEqual(
          sources.map((source) => source.id).sort(),
        );
        const effects = await db.inventoryPhysicalEffect.findMany({
          where: {
            companyId: o.f.companyId,
            originType: 'CASE_DISPATCH_CORRECTION',
            originId: id,
          },
          include: { lines: true },
        });
        expect(effects).toHaveLength(1);
        expect(effects[0].lineCount).toBe(4);
        const expected = materials
          .flatMap((source) => [
            {
              positionId: source.destinationPositionId!,
              delta: -source.quantity!,
            },
            { positionId: source.sourcePositionId!, delta: source.quantity! },
          ])
          .sort((a, b) => a.positionId.localeCompare(b.positionId));
        expect(
          effects[0].lines
            .map((line) => ({
              positionId: line.positionId,
              delta: line.delta,
            }))
            .sort((a, b) => a.positionId.localeCompare(b.positionId)),
        ).toEqual(expected);
        for (const source of materials) {
          const custody = await db.inventoryPosition.findUniqueOrThrow({
            where: { id: source.destinationPositionId! },
          });
          const available = await db.inventoryPosition.findUniqueOrThrow({
            where: { id: source.sourcePositionId! },
          });
          expect({
            quantity: custody.quantity,
            revision: custody.revision,
          }).toEqual({ quantity: 0, revision: 2 });
          expect({
            quantity: available.quantity,
            revision: available.revision,
          }).toEqual({ quantity: 10, revision: 2 });
        }
      },
    );
    it('rejects precisely one omitted source from two ACTIVE sources', async () => {
      const o = await groupedCorrectionOrigin(db, false),
        actor = await corrector(o),
        id = randomUUID();
      const sources = await db.healthcareCaseDispatchItem.findMany({
        where: { dispatchId: o.d.id, lifecycle: 'ACTIVE' },
      });
      expect(sources).toHaveLength(2);
      const before = await positions(o);
      let stagedCount = 0;
      await checkViolation(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          omitSourceId: sources[1].id,
          afterSeal: async (tx, rid) => {
            stagedCount = await tx.healthcareCaseDispatchCorrectionItem.count({
              where: { correctionId: rid },
            });
          },
        }),
        { messages: ['Correction source set/reconciliation incompatible'] },
      );
      expect(stagedCount).toBe(1);
      await assertRollback(id, o, before);
    });
    it('rejects replacement of an ACTIVE source by an EXCLUDED source with equal cardinality', async () => {
      const factory = correctionFixtureFactory(db),
        f = await factory.fixture();
      let excludedId = '';
      const { d, i } = await factory.confirmed(
        f,
        false,
        async (tx, dispatchId) => {
          const excluded = await tx.healthcareCaseDispatchItem.create({
            data: {
              ...factory.itemData(f, dispatchId),
              lifecycle: 'EXCLUDED',
              excludedById: f.user.id,
              excludedAt: new Date(),
              exclusionReason: 'Synthetic exclusion',
              snapshot: factory.itemSnapshot(f),
            },
          });
          excludedId = excluded.id;
        },
      );
      const o = {
        f,
        d,
        source: await db.healthcareCaseDispatchItem.findUniqueOrThrow({
          where: { id: i.id },
        }),
      };
      const actor = await corrector(o),
        id = randomUUID(),
        before = await positions(o);
      await checkViolation(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          omitSourceId: i.id,
          afterRoot: async (tx, correctionId) => {
            await tx.healthcareCaseDispatchCorrectionItem.create({
              data: {
                companyId: f.companyId,
                correctionId,
                dispatchId: d.id,
                sourceDispatchItemId: excludedId,
                type: 'MATERIAL',
                quantity: 2,
              },
            });
          },
        }),
        { messages: ['Correction item source/snapshot incomplete'] },
      );
      await assertRollback(id, o, before);
    });
    it.each([
      'sql-null',
      'json-null',
      'array',
      'string',
      'empty-object',
      'wrong-version',
      'wrong-history',
    ] as const)(
      'rejects item snapshot %s at deferred commit',
      async (failure) => {
        const o = await correctionFixtureFactory(db).origin(),
          actor = await corrector(o),
          id = randomUUID(),
          before = await positions(o);
        let bodyEnded = false;
        await checkViolation(
          persistCorrectionWitness(db, o, actor.id, {
            id,
            afterSnapshot: async (tx, correctionId) => {
              const values = {
                'sql-null': Prisma.DbNull,
                'json-null': Prisma.JsonNull,
                array: [],
                string: 'invalid',
                'empty-object': {},
                'wrong-version': { version: 2 },
                'wrong-history': { version: 1, history: { wrong: true } },
              };
              await tx.healthcareCaseDispatchCorrectionItem.updateMany({
                where: { correctionId },
                data: { snapshot: values[failure] },
              });
              const [state] = await tx.$queryRaw<
                { sql_null: boolean; kind: string | null }[]
              >`SELECT snapshot IS NULL AS sql_null,jsonb_typeof(snapshot) AS kind FROM "HealthcareCaseDispatchCorrectionItem" WHERE "correctionId"=${correctionId}`;
              if (failure === 'sql-null')
                expect(state).toEqual({ sql_null: true, kind: null });
              if (failure === 'json-null')
                expect(state).toEqual({ sql_null: false, kind: 'null' });
            },
            afterSeal: () => {
              bodyEnded = true;
              return Promise.resolve();
            },
          }),
          {
            messages: [
              'Correction item source/snapshot incomplete',
              'Correction unsealed item',
            ],
          },
        );
        expect(bodyEnded).toBe(true);
        await assertRollback(id, o, before);
      },
    );
    it.each([
      'sql-null',
      'json-null',
      'array',
      'string',
      'empty-object',
      'bad-date',
    ] as const)(
      'rejects root snapshot %s at deferred commit',
      async (failure) => {
        const o = await correctionFixtureFactory(db).origin(),
          actor = await corrector(o),
          id = randomUUID(),
          before = await positions(o);
        let bodyEnded = false;
        await checkViolation(
          persistCorrectionWitness(db, o, actor.id, {
            id,
            seal: false,
            afterSeal: async (tx, rid) => {
              if (failure !== 'sql-null') {
                const values = {
                  'json-null': Prisma.JsonNull,
                  array: [],
                  string: 'invalid',
                  'empty-object': {},
                  'bad-date': { version: 1, confirmedAt: 'not-a-date' },
                };
                await tx.healthcareCaseDispatchCorrection.update({
                  where: { id: rid },
                  data: { snapshot: values[failure] },
                });
              }
              const [state] = await tx.$queryRaw<
                { sql_null: boolean; kind: string | null }[]
              >`SELECT snapshot IS NULL AS sql_null,jsonb_typeof(snapshot) AS kind FROM "HealthcareCaseDispatchCorrection" WHERE id=${rid}`;
              if (failure === 'sql-null')
                expect(state).toEqual({ sql_null: true, kind: null });
              if (failure === 'json-null')
                expect(state).toEqual({ sql_null: false, kind: 'null' });
              bodyEnded = true;
            },
          }),
          {
            messages: [
              'Correction terminal root snapshot malformed',
              'Correction idempotency resource incomplete',
            ],
          },
        );
        expect(bodyEnded).toBe(true);
        await assertRollback(id, o, before);
      },
    );
    it.each([
      'asset',
      'event',
      'custody',
      'actor',
      'position',
      'effect',
      'line',
      'truncate-lines',
      'rr',
    ] as const)(
      'rejects dependency mutation %s after SET CONSTRAINTS ALL IMMEDIATE, including SAVEPOINT',
      async (mutation) => {
        const equipment = ['asset', 'event', 'custody'].includes(mutation);
        const o = await correctionFixtureFactory(db).origin(equipment),
          actor = await corrector(o),
          id = randomUUID();
        const before = await positions(o),
          history = await originalDispatchBytes(db, o.d.id);
        await checkViolation(
          persistCorrectionWitness(db, o, actor.id, {
            id,
            afterSeal: async (tx, rid) => {
              await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
              await tx.$executeRaw`SAVEPOINT correction_sealed_probe`;
              const item =
                await tx.healthcareCaseDispatchCorrectionItem.findFirstOrThrow({
                  where: { correctionId: rid },
                });
              if (mutation === 'asset')
                await tx.$executeRaw`UPDATE "EquipmentAsset" SET condition='DAMAGED' WHERE id=${item.assetId}`;
              if (mutation === 'custody')
                await tx.$executeRaw`UPDATE "EquipmentAssetCustody" SET "closedById"=${o.f.user.id} WHERE id=${item.equipmentCustodyId}`;
              if (mutation === 'event')
                await tx.$executeRaw`
          INSERT INTO "EquipmentAssetPhysicalEvent" (id,"companyId","equipmentAssetId","custodyId",operation,"originType","originId","originOperation","requestHash","physicalLocationBefore","physicalLocationAfter","conditionBefore","conditionAfter","lifecycleBefore","lifecycleAfter","revisionBefore","revisionAfter","actorId","reasonCode")
          SELECT ${randomUUID()},"companyId","equipmentAssetId","custodyId",'CONDITION_CHANGE','TEST_EVENT',${randomUUID()},'CHANGE',"requestHash",'WAREHOUSE','WAREHOUSE',"conditionAfter",'DAMAGED',"lifecycleAfter","lifecycleAfter","revisionAfter","revisionAfter"+1,${actor.id},'FIXTURE'
          FROM "EquipmentAssetPhysicalEvent" WHERE id=${item.closePhysicalEventId}`;
              if (mutation === 'actor')
                await tx.$executeRaw`UPDATE "User" SET role='WAREHOUSE' WHERE id=${actor.id}`;
              if (mutation === 'position')
                await tx.$executeRaw`UPDATE "InventoryPosition" SET quantity=quantity+1 WHERE id=${item.destinationPositionId}`;
              if (mutation === 'effect')
                await tx.$executeRaw`UPDATE "InventoryPhysicalEffect" SET reason='changed after seal' WHERE id=${item.compensatingEffectId}`;
              if (mutation === 'line')
                await tx.$executeRaw`UPDATE "InventoryPhysicalEffectLine" SET sequence=sequence WHERE "effectId"=${item.compensatingEffectId}`;
              if (mutation === 'truncate-lines')
                await tx.$executeRaw`TRUNCATE "InventoryPhysicalEffectLine"`;
              if (mutation === 'rr')
                await tx.$executeRaw`
          INSERT INTO "HealthcareCaseReconciliation" (id,"companyId","caseId","caseKitId","dispatchId","createdById","updatedAt")
          VALUES (${randomUUID()},${o.f.companyId},${o.f.c.id},${o.f.kit.id},${o.d.id},${actor.id},CURRENT_TIMESTAMP)`;
            },
          }),
          {
            messages: [
              'Correction dependencies sealed until creating transaction commits',
            ],
            constraint: 'DispatchCorrection_dependencies_sealed',
          },
        );
        await assertRollback(id, o, before);
        expect(await originalDispatchBytes(db, o.d.id)).toBe(history);
      },
    );
    it('allows later physical operations in a new transaction and replays the unchanged witness', async () => {
      const o = await correctionFixtureFactory(db).origin(true),
        actor = await corrector(o),
        key = randomUUID();
      const result = await persistCorrectionWitness(db, o, actor.id, { key });
      const repository = new HealthcareCaseDispatchCorrectionRepository(db);
      const context = {
        companyId: o.f.companyId,
        caseId: o.f.c.id,
        dispatchId: o.d.id,
      };
      const before = await repository.findWitness(context);
      await db.$transaction(async (tx) => {
        const close = await tx.equipmentAssetPhysicalEvent.findUniqueOrThrow({
          where: { id: before!.items[0].closePhysicalEventId! },
        });
        const { id: _id, ...fields } = close;
        void _id;
        await tx.equipmentAssetPhysicalEvent.create({
          data: {
            ...fields,
            id: randomUUID(),
            createdAt: new Date(),
            operation: 'CONDITION_CHANGE',
            originType: 'TEST_EVENT',
            originId: randomUUID(),
            originOperation: 'CHANGE',
            physicalLocationBefore: 'WAREHOUSE',
            conditionBefore: close.conditionAfter,
            conditionAfter: 'DAMAGED',
            revisionBefore: close.revisionAfter,
            revisionAfter: close.revisionAfter + 1,
          },
        });
        await tx.equipmentAsset.update({
          where: { id: o.f.asset.id },
          data: {
            condition: 'DAMAGED',
            physicalRevision: close.revisionAfter + 1,
          },
        });
        await tx.user.update({
          where: { id: actor.id },
          data: { role: 'WAREHOUSE' },
        });
      });
      expect(
        await repository.findReplay(context, key, result.requestHash),
      ).toEqual(before);
    });
    it.each([false, true])(
      'checks snapshots against independently read source/evidence rows (equipment=%s)',
      async (equipment) => {
        const o = await correctionFixtureFactory(db).origin(equipment),
          actor = await corrector(o);
        const { id } = await persistCorrectionWitness(db, o, actor.id);
        const witness =
          await db.healthcareCaseDispatchCorrection.findUniqueOrThrow({
            where: { id },
            include: { items: true },
          });
        const item = witness.items[0];
        if (!equipment) {
          const [original] = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(e) AS value FROM "InventoryPhysicalEffect" e WHERE id=${o.source.physicalEffectId}`;
          const [compensation] = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(e) AS value FROM "InventoryPhysicalEffect" e WHERE id=${item.compensatingEffectId}`;
          const originalLines = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(l) AS value FROM "InventoryPhysicalEffectLine" l WHERE "effectId"=${o.source.physicalEffectId} ORDER BY sequence`;
          const correctionLines = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(l) AS value FROM "InventoryPhysicalEffectLine" l WHERE "effectId"=${item.compensatingEffectId} ORDER BY sequence`;
          expect(item.snapshot).toEqual({
            version: 1,
            sourceDispatchItemId: o.source.id,
            history: o.source.snapshot,
            original: {
              effect: original.value,
              lines: originalLines.map((line) => line.value),
            },
            compensation: {
              effect: compensation.value,
              lines: correctionLines.map((line) => line.value),
            },
          });
          expect(original.value.actorId).toBe(o.f.user.id);
          expect(compensation.value.actorId).toBe(actor.id);
          expect(correctionLines.map((line) => line.value.delta)).toEqual([
            -2, 2,
          ]);
          const custody = await db.inventoryPosition.findUniqueOrThrow({
            where: { id: o.source.destinationPositionId! },
          });
          const available = await db.inventoryPosition.findUniqueOrThrow({
            where: { id: o.source.sourcePositionId! },
          });
          expect({
            quantity: custody.quantity,
            revision: custody.revision,
          }).toEqual({ quantity: 0, revision: 2 });
          expect({
            quantity: available.quantity,
            revision: available.revision,
          }).toEqual({ quantity: 10, revision: 2 });
        } else {
          const [episode] = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(c) AS value FROM "EquipmentAssetCustody" c WHERE id=${o.source.equipmentCustodyId}`;
          const [open] = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(e) AS value FROM "EquipmentAssetPhysicalEvent" e WHERE id=${o.source.equipmentPhysicalEventId}`;
          const [close] = await db.$queryRaw<
            { value: Prisma.JsonObject }[]
          >`SELECT to_jsonb(e) AS value FROM "EquipmentAssetPhysicalEvent" e WHERE id=${item.closePhysicalEventId}`;
          const { closedAt, closedById, ...originalCustody } = episode.value;
          expect(item.snapshot).toEqual({
            version: 1,
            sourceDispatchItemId: o.source.id,
            history: o.source.snapshot,
            original: { custody: originalCustody, openEvent: open.value },
            compensation: { closeEvent: close.value, closedAt, closedById },
          });
          expect(originalCustody.openedById).toBe(o.f.user.id);
          expect(closedById).toBe(actor.id);
          expect(close.value.conditionAfter).toBe(open.value.conditionAfter);
          expect(close.value.lifecycleAfter).toBe(open.value.lifecycleAfter);
        }
      },
    );
    it('rejects an otherwise balanced but unreferenced Effect in this correction namespace', async () => {
      const o = await correctionFixtureFactory(db).origin(),
        actor = await corrector(o),
        id = randomUUID(),
        before = await positions(o);
      await checkViolation(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          beforeSnapshot: async (tx, rid) => {
            const product = await tx.product.create({
              data: {
                companyId: o.f.companyId,
                sku: randomUUID(),
                name: 'Unreferenced fixture',
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
                contextType: 'TEST_UNREFERENCED',
                contextId: randomUUID(),
              },
            });
            const effect = await tx.inventoryPhysicalEffect.create({
              data: {
                companyId: o.f.companyId,
                originType: 'CASE_DISPATCH_CORRECTION',
                originId: rid,
                originOperation: 'UNREFERENCED',
                kind: 'TRANSFER',
                lineCount: 2,
                requestHash: 'a'.repeat(64),
                actorId: actor.id,
              },
            });
            await tx.inventoryPhysicalEffectLine.createMany({
              data: [
                {
                  companyId: o.f.companyId,
                  effectId: effect.id,
                  positionId: available.id,
                  sequence: 1,
                  delta: -1,
                  quantityBefore: 1,
                  quantityAfter: 0,
                  revisionBefore: 0,
                  revisionAfter: 1,
                },
                {
                  companyId: o.f.companyId,
                  effectId: effect.id,
                  positionId: custody.id,
                  sequence: 2,
                  delta: 1,
                  quantityBefore: 0,
                  quantityAfter: 1,
                  revisionBefore: 0,
                  revisionAfter: 1,
                },
              ],
            });
          },
        }),
        { messages: ['Correction contains unreferenced compensating Effect'] },
      );
      await assertRollback(id, o, before);
    });
    it('assigns a top-level transaction identity that cannot be forged at INSERT', async () => {
      const o = await correctionFixtureFactory(db).origin(),
        actor = await corrector(o),
        id = randomUUID();
      await checkViolation(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          afterRoot: async (tx, rid) => {
            await tx.$executeRaw`INSERT INTO "HealthcareCaseDispatchCorrection" ("creationTransactionId",id,"companyId","caseId","caseKitId","dispatchId",reason,"attestedNoHandoff","confirmedById","confirmedAt","requestHash","idempotencyRecordId")
        SELECT '0'::xid8,id || '-forged',"companyId","caseId","caseKitId","dispatchId",reason,true,"confirmedById","confirmedAt","requestHash","idempotencyRecordId" FROM "HealthcareCaseDispatchCorrection" WHERE id=${rid}`;
          },
        }),
        {
          messages: [
            'Correction must start unsealed in its creating transaction',
          ],
        },
      );
      expect(
        await db.healthcareCaseDispatchCorrection.count({ where: { id } }),
      ).toBe(0);
    });
    it.each([false, true])(
      'permits complete staging followed by ALL IMMEDIATE without further dependency changes (equipment=%s)',
      async (equipment) => {
        const o = await correctionFixtureFactory(db).origin(equipment),
          actor = await corrector(o);
        const { id } = await persistCorrectionWitness(db, o, actor.id, {
          afterSeal: async (tx) => {
            await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
            // This row is unrelated to the witness: no global Inventory guard.
            const unrelated = await tx.inventoryPosition.create({
              data: {
                companyId: o.f.companyId,
                productId: o.f.product.id,
                state: 'CUSTODY',
                contextType: 'TEST_UNRELATED',
                contextId: randomUUID(),
                quantity: 0,
              },
            });
            await tx.inventoryPosition.update({
              where: { id: unrelated.id },
              data: { revision: 1 },
            });
          },
        });
        expect(
          await db.healthcareCaseDispatchCorrection.count({ where: { id } }),
        ).toBe(1);
      },
    );
    it('retains the top-level seal when the root was created inside a released SAVEPOINT', async () => {
      const o = await correctionFixtureFactory(db).origin(),
        actor = await corrector(o),
        id = randomUUID(),
        before = await positions(o);
      await checkViolation(
        persistCorrectionWitness(db, o, actor.id, {
          id,
          beforeRoot: async (tx) => {
            await tx.$executeRaw`SAVEPOINT create_correction`;
          },
          afterSeal: async (tx, rid) => {
            await tx.$executeRaw`RELEASE SAVEPOINT create_correction`;
            await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
            await tx.$executeRaw`UPDATE "InventoryPosition" SET quantity=quantity+1 WHERE id IN (
          SELECT "destinationPositionId" FROM "HealthcareCaseDispatchCorrectionItem" WHERE "correctionId"=${rid})`;
          },
        }),
        {
          messages: [
            'Correction dependencies sealed until creating transaction commits',
          ],
          constraint: 'DispatchCorrection_dependencies_sealed',
        },
      );
      await assertRollback(id, o, before);
    });
    it('allows a later AVAILABLE count operation without changing a historical material witness', async () => {
      const o = await correctionFixtureFactory(db).origin(),
        actor = await corrector(o),
        key = randomUUID();
      const result = await persistCorrectionWitness(db, o, actor.id, { key });
      const repository = new HealthcareCaseDispatchCorrectionRepository(db);
      const context = {
        companyId: o.f.companyId,
        caseId: o.f.c.id,
        dispatchId: o.d.id,
      };
      const before = await repository.findWitness(context);
      await db.$transaction(async (tx) => {
        const position = await tx.inventoryPosition.findUniqueOrThrow({
          where: { id: o.source.sourcePositionId! },
        });
        const effect = await tx.inventoryPhysicalEffect.create({
          data: {
            companyId: o.f.companyId,
            kind: 'COUNT_CORRECTION',
            originType: 'TEST_LEGITIMATE_LATER_OPERATION',
            originId: randomUUID(),
            originOperation: 'COUNT',
            requestHash: 'a'.repeat(64),
            actorId: actor.id,
            lineCount: 1,
          },
        });
        await tx.inventoryPhysicalEffectLine.create({
          data: {
            companyId: o.f.companyId,
            effectId: effect.id,
            positionId: position.id,
            sequence: 1,
            delta: -1,
            quantityBefore: position.quantity,
            quantityAfter: position.quantity - 1,
            revisionBefore: position.revision,
            revisionAfter: position.revision + 1,
          },
        });
        await tx.inventoryPosition.update({
          where: { id: position.id },
          data: {
            quantity: position.quantity - 1,
            revision: position.revision + 1,
          },
        });
      });
      expect(
        await repository.findReplay(context, key, result.requestHash),
      ).toEqual(before);
    });
    it('rejects stale-snapshot write isolation without restricting historical read transactions', async () => {
      const o = await correctionFixtureFactory(db).origin(),
        actor = await corrector(o),
        id = randomUUID();
      await checkViolation(
        db.$transaction(
          (tx) => stageCorrectionWitness(tx, o, actor.id, { id }),
          { isolationLevel: 'RepeatableRead' },
        ),
        {
          messages: [
            'Correction requires READ COMMITTED for terminal dependency visibility',
          ],
        },
      );
      expect(
        await db.healthcareCaseDispatchCorrection.count({ where: { id } }),
      ).toBe(0);
      await persistCorrectionWitness(db, o, actor.id);
      const witness = await db.$transaction(
        (tx) =>
          new HealthcareCaseDispatchCorrectionRepository(tx).findWitness({
            companyId: o.f.companyId,
            caseId: o.f.c.id,
            dispatchId: o.d.id,
          }),
        { isolationLevel: 'RepeatableRead' },
      );
      expect(witness).not.toBeNull();
    });
    it('keeps successive confirmations consistent with the latest position quantity/revision', async () => {
      const factory = correctionFixtureFactory(db),
        f = await factory.fixture();
      const first = await factory.confirmed(f),
        second = await factory.confirmed(f);
      const items = await db.healthcareCaseDispatchItem.findMany({
        where: { id: { in: [first.i.id, second.i.id] } },
        orderBy: { expectedPositionRevision: 'asc' },
      });
      expect(items.map((item) => item.expectedPositionRevision)).toEqual([
        0, 1,
      ]);
      const position = await db.inventoryPosition.findUniqueOrThrow({
        where: { id: f.position.id },
      });
      expect({
        quantity: position.quantity,
        revision: position.revision,
      }).toEqual({ quantity: 6, revision: 2 });
    });
  },
);
