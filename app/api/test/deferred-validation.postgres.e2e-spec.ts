import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
jest.setTimeout(30000);
const suite =
  process.env.RUN_DEFERRED_VALIDATION_PERF === '1' ? describe : describe.skip;
suite(
  'HC-RR-PERF-01 isolated PostgreSQL16 scaling and timeout acceptance',
  () => {
    let db: PrismaClient;
    beforeAll(async () => {
      const url = new URL(process.env.CASE_DISPATCH_TEST_DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.pathname !== '/zaping_case_dispatch_persistence_test' ||
        url.username !== 'case_dispatch_persistence_test' ||
        !process.env.CASE_DISPATCH_TEST_RUN
      )
        throw Error('Unverified target');
      db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
      await db.$connect();
      const [role] = await db.$queryRaw<
        { rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }[]
      >`SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`;
      expect(role).toEqual({
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
      });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function fixture() {
      const company = await db.company.create({
          data: { name: 'Dispatch isolated', rfc: randomUUID() },
        }),
        companyId = company.id;
      const user = await db.user.create({
        data: {
          companyId,
          firstName: 'Historical',
          lastName: 'Actor',
          email: randomUUID() + '@example.invalid',
          passwordHash: 'NOT-A-CREDENTIAL',
          role: 'ADMIN',
        },
      });
      const c = await db.healthcareCase.create({
        data: {
          companyId,
          createdById: user.id,
          folio: randomUUID(),
          title: 'Isolated',
        },
      });
      const kit = await db.healthcareCaseKit.create({
        data: { companyId, caseId: c.id, createdById: user.id },
      });
      const product = await db.product.create({
        data: {
          companyId,
          sku: randomUUID(),
          name: 'Material original',
          lotTracking: 'NONE',
        },
      });
      const requirement = await db.healthcareCaseRequirement.create({
        data: {
          companyId,
          caseId: c.id,
          productId: product.id,
          requestedQty: 10,
          type: 'REQUIRED',
          sortOrder: 0,
          createdById: user.id,
        },
      });
      const source = await db.healthcareCaseKitItem.create({
        data: {
          companyId,
          caseId: c.id,
          caseKitId: kit.id,
          requirementId: requirement.id,
          preparedQuantity: 10,
          addedById: user.id,
        },
      });
      const position = await db.inventoryPosition.create({
        data: {
          companyId,
          productId: product.id,
          state: 'AVAILABLE',
          quantity: 10,
        },
      });
      const ep = await db.product.create({
        data: {
          companyId,
          sku: randomUUID(),
          name: 'Equipment original',
          inventoryTracking: 'ASSET',
        },
      });
      const asset = await db.equipmentAsset.create({
        data: {
          companyId,
          productId: ep.id,
          assetCode: randomUUID(),
          condition: 'GOOD',
        },
      });
      const assignment = await db.healthcareEquipmentAssignment.create({
        data: {
          companyId,
          caseId: c.id,
          equipmentAssetId: asset.id,
          origin: 'DIRECT',
          directAssignmentReason: 'Fixture',
          createdById: user.id,
        },
      });
      const es = await db.healthcareCaseKitItem.create({
        data: {
          companyId,
          caseId: c.id,
          caseKitId: kit.id,
          equipmentAssignmentId: assignment.id,
          addedById: user.id,
        },
      });
      return {
        companyId,
        user,
        c,
        kit,
        product,
        requirement,
        source,
        position,
        ep,
        asset,
        assignment,
        es,
      };
    }
    type F = Awaited<ReturnType<typeof fixture>>;
    const rootData = (f: F) => ({
      companyId: f.companyId,
      caseId: f.c.id,
      caseKitId: f.kit.id,
      createdById: f.user.id,
      custodianType: 'EXTERNAL_PERSON' as const,
      custodianDisplayName: 'Receiver',
    });
    const itemData = (f: F, dispatchId: string) => ({
      companyId: f.companyId,
      dispatchId,
      caseId: f.c.id,
      caseKitId: f.kit.id,
      sourceCaseKitItemId: f.source.id,
      type: 'MATERIAL' as const,
      productId: f.product.id,
      addedById: f.user.id,
      quantity: 2,
      sourcePositionId: f.position.id,
      expectedPositionRevision: 0,
    });
    const equipmentData = (f: F, dispatchId: string) => ({
      companyId: f.companyId,
      dispatchId,
      caseId: f.c.id,
      caseKitId: f.kit.id,
      sourceCaseKitItemId: f.es.id,
      type: 'EQUIPMENT' as const,
      productId: f.ep.id,
      addedById: f.user.id,
      assignmentId: f.assignment.id,
      assetId: f.asset.id,
      expectedPhysicalRevision: 0,
    });
    async function draft(f: F, equipment = false) {
      const d = await db.healthcareCaseDispatch.create({ data: rootData(f) });
      const i = await db.healthcareCaseDispatchItem.create({
        data: equipment
          ? {
              ...equipmentData(f, d.id),
              expectedPhysicalRevision: (
                await db.equipmentAsset.findUniqueOrThrow({
                  where: { id: f.asset.id },
                })
              ).physicalRevision,
            }
          : itemData(f, d.id),
      });
      return { d, i };
    }
    async function rejected(
      p: Promise<unknown>,
      pattern = /23514|23503|23505|constraint|Dispatch|Foreign key|Unique constraint/i,
    ) {
      try {
        await p;
        throw Error('Expected structural rejection');
      } catch (e) {
        const err = e as Error;
        expect(err.message).not.toBe('Expected structural rejection');
        expect(err.message + JSON.stringify(e)).toMatch(pattern);
      }
    }
    const rootSnapshot = (f: F, date: Date) => ({
      version: 1,
      case: {
        id: f.c.id,
        folio: f.c.folio,
        scheduledStart: null,
        scheduledEnd: null,
      },
      custodian: {
        type: 'EXTERNAL_PERSON',
        userId: null,
        displayName: 'Receiver',
      },
      dispatchedBy: {
        id: f.user.id,
        firstName: f.user.firstName,
        lastName: f.user.lastName,
      },
      dispatchedAt: date.toISOString(),
    });
    const itemSnapshot = (f: F, equipment = false) => ({
      version: 1,
      product: equipment
        ? {
            id: f.ep.id,
            sku: f.ep.sku,
            name: f.ep.name,
            inventoryTracking: 'ASSET',
            lotTracking: 'OPTIONAL',
          }
        : {
            id: f.product.id,
            sku: f.product.sku,
            name: f.product.name,
            inventoryTracking: 'QUANTITY',
            lotTracking: 'NONE',
          },
      preparation: {
        sourceCaseKitItemId: equipment ? f.es.id : f.source.id,
        requirementId: equipment ? null : f.requirement.id,
        assignmentId: equipment ? f.assignment.id : null,
        preparedQuantity: equipment ? null : 10,
      },
      batch: null,
      equipment: equipment
        ? { id: f.asset.id, assetCode: f.asset.assetCode, serialNumber: null }
        : null,
    });
    const dispatchConstraints =
      'SET CONSTRAINTS "Dispatch_local_state", "Dispatch_item_final_state", "Dispatch_final_state", "Dispatch_insert_final_state", "Dispatch_idempotency_resource" IMMEDIATE';
    const physicalLineConstraints =
      'SET CONSTRAINTS "InventoryPhysicalEffectLine_complete" IMMEDIATE';
    const physicalEffectConstraints =
      'SET CONSTRAINTS "InventoryPhysicalEffect_complete" IMMEDIATE';
    const rrConstraints =
      'SET CONSTRAINTS "Reconciliation_local_state", "Reconciliation_item_final_state", "Reconciliation_final_state", "Reconciliation_insert_final_state", "Reconciliation_idempotency_resource" IMMEDIATE';
    async function calls(tx: Prisma.TransactionClient, name: string) {
      const rows = await tx.$queryRaw<
        { calls: bigint }[]
      >`SELECT calls FROM pg_stat_xact_user_functions WHERE funcname=${name}`;
      return Number(rows[0]?.calls ?? 0);
    }
    async function dispatchFixture(n: number, missingAudit = false) {
      const start = performance.now(),
        f = await fixture();
      const root = await db.healthcareCaseDispatch.create({
        data: rootData(f),
      });
      const batches = Array.from({ length: n }, () => ({
        id: randomUUID(),
        companyId: f.companyId,
        productId: f.product.id,
        lotNumber: randomUUID(),
      }));
      const sources = batches.map((b) => ({
        id: randomUUID(),
        companyId: f.companyId,
        productId: f.product.id,
        inventoryBatchId: b.id,
        state: 'AVAILABLE' as const,
        quantity: 2,
      }));
      const items = sources.map((p, k) => ({
        ...itemData(f, root.id),
        id: randomUUID(),
        sourcePositionId: p.id,
        batchId: batches[k].id,
      }));
      let write = 0,
        validation = 0,
        physical = 0,
        physicalWrite = 0,
        physicalLocal = 0,
        physicalAggregate = 0,
        physicalCalls = 0,
        aggregateCalls = 0;
      await db.$transaction(
        async (tx) => {
          const setupAt = performance.now();
          await tx.inventoryBatch.createMany({ data: batches });
          await tx.inventoryPosition.createMany({ data: sources });
          physicalWrite = performance.now() - setupAt;
          await tx.healthcareCaseDispatchItem.createMany({ data: items });
          const physicalAt = performance.now();
          const effect = await tx.inventoryPhysicalEffect.create({
            data: {
              companyId: f.companyId,
              originType: 'CASE_DISPATCH',
              originId: root.id,
              originOperation: 'CONFIRM_QUANTITY',
              kind: 'TRANSFER',
              requestHash: 'a'.repeat(64),
              lineCount: n * 2,
              actorId: f.user.id,
            },
          });
          const dests = items.map((i, k) => ({
            id: randomUUID(),
            companyId: f.companyId,
            productId: f.product.id,
            inventoryBatchId: batches[k].id,
            state: 'CUSTODY' as const,
            contextType: 'CASE_DISPATCH_ITEM',
            contextId: i.id,
            quantity: 2,
            revision: 1,
          }));
          await tx.inventoryPosition.createMany({ data: dests });
          await tx.inventoryPhysicalEffectLine.createMany({
            data: items.flatMap((i, k) => [
              {
                companyId: f.companyId,
                effectId: effect.id,
                positionId: sources[k].id,
                sequence: k * 2 + 1,
                delta: -2,
                quantityBefore: 2,
                quantityAfter: 0,
                revisionBefore: 0,
                revisionAfter: 1,
              },
              {
                companyId: f.companyId,
                effectId: effect.id,
                positionId: dests[k].id,
                sequence: k * 2 + 2,
                delta: 2,
                quantityBefore: 0,
                quantityAfter: 2,
                revisionBefore: 0,
                revisionAfter: 1,
              },
            ]),
          });
          await tx.inventoryPosition.updateMany({
            where: { id: { in: sources.map((p) => p.id) } },
            data: { quantity: 0, revision: 1 },
          });
          physicalWrite += performance.now() - physicalAt;
          // One set-based update stages final evidence; local validators re-read it.
          await tx.$executeRaw`UPDATE "HealthcareCaseDispatchItem" i SET "destinationPositionId"=p.id, "physicalEffectId"=${effect.id}, snapshot=jsonb_set(${JSON.stringify(itemSnapshot(f))}::jsonb,'{batch}',jsonb_build_object('id',i."batchId",'lotNumber',b."lotNumber",'expirationDate',NULL)) FROM "InventoryPosition" p, "InventoryBatch" b WHERE i."dispatchId"=${root.id} AND i."companyId"=${f.companyId} AND p."contextId"=i.id AND p."companyId"=i."companyId" AND b.id=i."batchId"`;
          const now = new Date();
          await tx.healthcareCaseDispatch.update({
            where: { id: root.id },
            data: { snapshot: rootSnapshot(f, now), snapshotVersion: 1 },
          });
          if (!missingAudit)
            await tx.healthcareCaseDispatchAudit.create({
              data: {
                companyId: f.companyId,
                dispatchId: root.id,
                operation: 'CONFIRM',
                actorId: f.user.id,
                revisionBefore: 0,
                revisionAfter: 1,
                change: { version: 1, operation: 'CONFIRM', reason: null },
              },
            });
          await tx.healthcareCaseDispatch.update({
            where: { id: root.id },
            data: {
              status: 'CONFIRMED',
              revision: 1,
              confirmedFromRevision: 0,
              confirmedById: f.user.id,
              confirmedAt: now,
            },
          });
          write = performance.now() - start;
          const beforeCalls = await calls(tx, 'dispatch_final_state');
          let at = performance.now();
          await tx.$executeRawUnsafe(dispatchConstraints);
          validation = performance.now() - at;
          aggregateCalls =
            (await calls(tx, 'dispatch_final_state')) - beforeCalls;
          const beforePhysicalCalls = await calls(
            tx,
            'inventory_physical_effect_complete',
          );
          // Separate statements guarantee local checks finish before the header scan.
          at = performance.now();
          await tx.$executeRawUnsafe(physicalLineConstraints);
          physicalLocal = performance.now() - at;
          expect(
            (await calls(tx, 'inventory_physical_effect_complete')) -
              beforePhysicalCalls,
          ).toBe(0);
          at = performance.now();
          await tx.$executeRawUnsafe(physicalEffectConstraints);
          physicalAggregate = performance.now() - at;
          physicalCalls =
            (await calls(tx, 'inventory_physical_effect_complete')) -
            beforePhysicalCalls;
          physical = physicalLocal + physicalAggregate;
        },
        { timeout: 30000 },
      ); // Test harness budget only; production budgets are unchanged.
      return {
        f,
        root,
        items,
        write,
        validation,
        physical,
        physicalWrite,
        physicalLocal,
        physicalAggregate,
        physicalCalls,
        aggregateCalls,
        total: performance.now() - start,
      };
    }
    it.each([10, 50, 100, 250, 500, 1000])(
      'N=%i terminal validation scaling',
      async (n) => {
        const d = await dispatchFixture(n);
        expect(d.aggregateCalls).toBe(1);
        const start = performance.now();
        const r = await db.healthcareCaseReconciliation.create({
          data: {
            companyId: d.f.companyId,
            caseId: d.f.c.id,
            caseKitId: d.f.kit.id,
            dispatchId: d.root.id,
            createdById: d.f.user.id,
          },
        });
        const dispatch = await db.healthcareCaseDispatch.findUniqueOrThrow({
          where: { id: d.root.id },
          include: { items: true },
        });
        const data = dispatch.items.map((i) => ({
          companyId: d.f.companyId,
          caseId: d.f.c.id,
          dispatchId: d.root.id,
          reconciliationId: r.id,
          sourceDispatchItemId: i.id,
          createdById: d.f.user.id,
          type: 'MATERIAL' as const,
          sourceCustodyPositionId: i.destinationPositionId!,
          expectedSourceRevision: 1,
          returnedQty: 0,
          usedQty: 0,
        }));
        await db.healthcareCaseReconciliationItem.createMany({ data });
        const draftMs = performance.now() - start;
        let rrMs = 0,
          rrCalls = 0;
        await db.$transaction(
          async (tx) => {
            const now = new Date(),
              observation = 'Observed pending resources';
            await tx.$executeRaw`UPDATE "HealthcareCaseReconciliationItem" i SET snapshot=jsonb_build_object('version',1,'sourceDispatchItemId',s.id,'history',s.snapshot,'dispatchedQty',s.quantity,'capturedAt',${now.toISOString()},'result',jsonb_build_object('type','MATERIAL','returnedQty',0,'usedQty',0,'source',jsonb_build_object('positionId',i."sourceCustodyPositionId",'revision',1,'quantity',2),'returnedDestinationPositionId',NULL,'returnedPhysicalEffectId',NULL,'usedPhysicalEffectId',NULL,'unresolvedBefore',2,'unresolvedAfter',2)) FROM "HealthcareCaseDispatchItem" s WHERE i."reconciliationId"=${r.id} AND i."companyId"=${d.f.companyId} AND s.id=i."sourceDispatchItemId" AND s."companyId"=i."companyId"`;
            await tx.healthcareCaseReconciliationAudit.create({
              data: {
                companyId: d.f.companyId,
                reconciliationId: r.id,
                operation: 'CONFIRM',
                actorId: d.f.user.id,
                revisionBefore: 0,
                revisionAfter: 1,
                change: { version: 1, operation: 'CONFIRM' },
              },
            });
            await tx.healthcareCaseReconciliation.update({
              where: { id: r.id },
              data: {
                snapshotVersion: 1,
                observation,
                snapshot: {
                  version: 1,
                  reconciliationId: r.id,
                  sourceDispatch: {
                    id: d.root.id,
                    caseId: d.f.c.id,
                    caseKitId: d.f.kit.id,
                    history: dispatch.snapshot as Prisma.InputJsonObject,
                  },
                  confirmedBy: {
                    id: d.f.user.id,
                    firstName: d.f.user.firstName,
                    lastName: d.f.user.lastName,
                  },
                  confirmedAt: now.toISOString(),
                  observation,
                  episodeFacts: {
                    materialItemCount: n,
                    equipmentItemCount: 0,
                    hasPhysicalMutation: false,
                  },
                },
              },
            });
            await tx.healthcareCaseReconciliation.update({
              where: { id: r.id },
              data: {
                status: 'CONFIRMED',
                revision: 1,
                confirmedFromRevision: 0,
                confirmedById: d.f.user.id,
                confirmedAt: now,
              },
            });
            const beforeCalls = await calls(tx, 'rr_final_state');
            const at = performance.now();
            await tx.$executeRawUnsafe(rrConstraints);
            rrMs = performance.now() - at;
            rrCalls = (await calls(tx, 'rr_final_state')) - beforeCalls;
          },
          { timeout: 30000 },
        );
        console.log(
          'HC-RR-PERF-01 ' +
            JSON.stringify({
              n,
              dispatchWriteMs: d.write,
              dispatchValidationMs: d.validation,
              physicalWriteMs: d.physicalWrite,
              physicalLocalMs: d.physicalLocal,
              physicalAggregateMs: d.physicalAggregate,
              physicalCalls: d.physicalCalls,
              physicalMs: d.physical,
              dispatchTotalMs: d.total,
              rrDraftMs: draftMs,
              rrValidationMs: rrMs,
              dispatchCalls: d.aggregateCalls,
              rrCalls,
            }),
        );
        expect(rrCalls).toBe(1);
        expect(d.physicalCalls).toBe(1);
        expect(d.physical).toBeLessThan(2500);
        expect(d.validation + d.physical).toBeLessThan(4000);
        expect(d.total).toBeLessThan(10000);
        expect(rrMs).toBeLessThan(4000);
      },
    );
    it('missing CONFIRM audit rejects terminal aggregate', async () => {
      await rejected(dispatchFixture(2, true), /final evidence/);
    });
    it('DRAFT item snapshot rejects without a root update', async () => {
      const f = await fixture(),
        { d, i } = await draft(f);
      await rejected(
        db.healthcareCaseDispatchItem.update({
          where: { id: i.id },
          data: { snapshot: itemSnapshot(f) },
        }),
        /final evidence/,
      );
      expect(
        (
          await db.healthcareCaseDispatch.findUniqueOrThrow({
            where: { id: d.id },
          })
        ).status,
      ).toBe('DRAFT');
    });
    it('DRAFT Reconciliation result rejects without a root update', async () => {
      const d = await dispatchFixture(1),
        source = await db.healthcareCaseDispatchItem.findFirstOrThrow({
          where: { dispatchId: d.root.id },
        });
      const r = await db.healthcareCaseReconciliation.create({
        data: {
          companyId: d.f.companyId,
          caseId: d.f.c.id,
          caseKitId: d.f.kit.id,
          dispatchId: d.root.id,
          createdById: d.f.user.id,
        },
      });
      const i = await db.healthcareCaseReconciliationItem.create({
        data: {
          companyId: d.f.companyId,
          caseId: d.f.c.id,
          dispatchId: d.root.id,
          reconciliationId: r.id,
          sourceDispatchItemId: source.id,
          createdById: d.f.user.id,
          type: 'MATERIAL',
          sourceCustodyPositionId: source.destinationPositionId!,
          expectedSourceRevision: 1,
          returnedQty: 0,
          usedQty: 0,
        },
      });
      await rejected(
        db.healthcareCaseReconciliationItem.update({
          where: { id: i.id },
          data: { snapshot: { version: 1 } },
        }),
        /Nonterminal reconciliation/,
      );
      expect(
        (
          await db.healthcareCaseReconciliation.findUniqueOrThrow({
            where: { id: r.id },
          })
        ).status,
      ).toBe('DRAFT');
    });
    it('explicit deferred evaluation is cancelled by server statement_timeout and rolls back', async () => {
      const id = randomUUID(),
        start = performance.now();
      try {
        await db.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL statement_timeout='75ms'");
            await tx.$executeRaw`INSERT INTO "PerfTimeoutProbe"(id) VALUES (${id})`;
            await tx.$executeRawUnsafe(
              'SET CONSTRAINTS "PerfTimeoutProbe_deferred" IMMEDIATE',
            );
          },
          { timeout: 5000 },
        );
        throw Error('Expected timeout');
      } catch (error) {
        expect(JSON.stringify(error)).toMatch(/57014|statement timeout/);
      }
      expect(performance.now() - start).toBeLessThan(1500);
      const rows = await db.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) FROM "PerfTimeoutProbe" WHERE id=${id}`;
      expect(Number(rows[0].count)).toBe(0);
    });
  },
);
