import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  materialQaUrl,
  verifyMaterialQaDatabase,
} from './helpers/dispatch-correction-material-postgres-authorization';
import {
  materialOrigin,
  materialService,
  persistMaterialContract,
} from './helpers/dispatch-correction-material-contract-fixture';

// Opt-in only. Skipping is NOT PostgreSQL acceptance evidence.
const enabled =
  process.env.RUN_CASE_DISPATCH_CORRECTION_MATERIAL_POSTGRES === '1';
(enabled ? describe : describe.skip)('01C-A real PostgreSQL contract', () => {
  let db: PrismaClient;
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: materialQaUrl() } } });
    await verifyMaterialQaDatabase(db);
    new (
      await import('../src/inventory/physical/inventory-runtime-compatibility.service')
    ).InventoryRuntimeCompatibilityService().identity();
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it.each([false, true])(
    'commits exact 01B witness and conserves owned, grouped=%s',
    async (grouped) => {
      const o = await materialOrigin(db, grouped);
      const before = await db.product.findMany({
        where: { companyId: o.f.companyId },
        orderBy: { id: 'asc' },
      });
      const { input, result, at } = await persistMaterialContract(db, o);
      expect(result.effect.requestHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.effect.occurredAt).toEqual(at);
      const witness =
        await db.healthcareCaseDispatchCorrection.findUniqueOrThrow({
          where: { id: input.correctionId },
        });
      expect(witness.snapshot).not.toBeNull();
      expect(result.projectionDeltas.every((d) => d.ownedDelta === 0)).toBe(
        true,
      );
      const after = await db.product.findMany({
        where: { companyId: o.f.companyId },
        orderBy: { id: 'asc' },
      });
      expect(after.map((p) => p.stock)).toEqual(before.map((p) => p.stock));
      const replay = await db.$transaction((tx) =>
        materialService().classifyCommittedDispatchCorrectionMaterial(
          tx,
          input,
        ),
      );
      expect(replay?.effect.id).toBe(result.effect.id);
    },
  );

  it('preserves 1000 supplementary Unicode characters', async () => {
    const o = await materialOrigin(db);
    const { result } = await persistMaterialContract(db, o, {
      reason: '🚑'.repeat(1000),
    });
    expect(result.effect.reason).toBe('🚑'.repeat(1000));
  });

  it('restores Batch AVAILABLE projection while keeping owned unchanged', async () => {
    const o = await materialOrigin(db, false, false, true);
    const item = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
      where: { id: o.source.id },
    });
    const { result } = await persistMaterialContract(db, o);
    expect(result.projectionDeltas).toEqual([
      { productId: o.f.product.id, ownedDelta: 0 },
    ]);
    const batch = await db.inventoryBatch.findUniqueOrThrow({
      where: { id: item.batchId! },
    });
    expect(batch.availableQuantity).toBe(10);
    expect(batch.initialQuantity).toBe(10);
  });

  it.each(['inactive', 'expired'] as const)(
    'rejects Batch %s after Dispatch',
    async (state) => {
      const o = await materialOrigin(db, false, false, true);
      const item = await db.healthcareCaseDispatchItem.findUniqueOrThrow({
        where: { id: o.source.id },
      });
      await db.inventoryBatch.update({
        where: { id: item.batchId! },
        data:
          state === 'inactive'
            ? { isActive: false }
            : { expirationDate: new Date(Date.now() - 86400000) },
      });
      await expect(persistMaterialContract(db, o)).rejects.toMatchObject({
        code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      });
      expect(
        await db.healthcareCaseDispatchCorrection.count({
          where: { companyId: o.f.companyId },
        }),
      ).toBe(0);
    },
  );

  it('replays for another authorized actor after product deactivation without writes', async () => {
    const o = await materialOrigin(db);
    const { input, result } = await persistMaterialContract(db, o);
    const actor = await db.user.create({
      data: {
        companyId: o.f.companyId,
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
    const count = await db.inventoryPhysicalEffect.count({
      where: { companyId: o.f.companyId },
    });
    const replay = await db.$transaction((tx) =>
      materialService().transferDispatchCorrectionMaterial(tx, {
        ...input,
        requesterId: actor.id,
      }),
    );
    expect(replay.replay).toBe(true);
    expect(replay.effect.actorId).toBe(result.effect.actorId);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: o.f.companyId },
      }),
    ).toBe(count);
    await expect(
      db.$transaction((tx) =>
        materialService().classifyCommittedDispatchCorrectionMaterial(tx, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: 'CORRECTION_ALREADY_EXISTS' });
    await expect(
      db.$transaction((tx) =>
        materialService().classifyCommittedDispatchCorrectionMaterial(tx, {
          ...input,
          reason: 'other',
        }),
      ),
    ).rejects.toHaveProperty('response.code', 'IDEMPOTENCY_KEY_REUSED');
    await expect(
      db.$transaction((tx) =>
        materialService().classifyCommittedDispatchCorrectionMaterial(tx, {
          ...input,
          companyId: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: 'CORRECTION_ACTOR_FORBIDDEN' });
  });

  it.each(['quantity', 'revision', 'inactive', 'orphan', 'rollback'] as const)(
    'rejects %s and rolls back every partial',
    async (failure) => {
      const o = await materialOrigin(db);
      const before = await db.inventoryPosition.findMany({
        where: { companyId: o.f.companyId },
        orderBy: { id: 'asc' },
      });
      const error =
        failure === 'revision'
          ? 'STALE_INVENTORY_REVISION'
          : failure === 'quantity'
            ? 'CORRECTION_SOURCE_CHANGED'
            : failure === 'inactive'
              ? 'PHYSICAL_SOURCE_NOT_ELIGIBLE'
              : failure === 'orphan'
                ? 'PHYSICAL_EFFECT_MISMATCH'
                : 'TEST_ROLLBACK';
      const promise = persistMaterialContract(db, o, {
        beforeApply: async (tx, input) => {
          if (failure === 'quantity' || failure === 'revision')
            await tx.inventoryPosition.update({
              where: { id: o.source.destinationPositionId! },
              data: failure === 'quantity' ? { quantity: 3 } : { revision: 3 },
            });
          if (failure === 'inactive')
            await tx.product.update({
              where: { id: o.f.product.id },
              data: { isActive: false },
            });
          if (failure === 'orphan') {
            const root =
              await tx.healthcareCaseDispatchCorrection.findUniqueOrThrow({
                where: { id: input.correctionId },
              });
            await tx.inventoryPhysicalEffect.create({
              data: {
                companyId: input.companyId,
                actorId: input.requesterId,
                originType: 'CASE_DISPATCH_CORRECTION',
                originId: input.correctionId,
                originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
                kind: 'TRANSFER',
                requestHash: root.requestHash,
                occurredAt: root.confirmedAt,
                lineCount: 2,
              },
            });
          }
        },
        afterApply: () =>
          failure === 'rollback'
            ? Promise.reject(
                Object.assign(new Error('rollback'), { code: 'TEST_ROLLBACK' }),
              )
            : Promise.resolve(),
      });
      await expect(promise).rejects.toMatchObject({ code: error });
      expect(
        await db.healthcareCaseDispatchCorrection.count({
          where: { companyId: o.f.companyId },
        }),
      ).toBe(0);
      expect(
        await db.idempotencyRecord.count({
          where: {
            companyId: o.f.companyId,
            scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
          },
        }),
      ).toBe(0);
      expect(
        await db.inventoryPosition.findMany({
          where: { companyId: o.f.companyId },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(before);
      expect(
        await db.inventoryPhysicalEffect.count({
          where: {
            companyId: o.f.companyId,
            originType: 'CASE_DISPATCH_CORRECTION',
          },
        }),
      ).toBe(0);
    },
  );

  it('rejects all grouped MATERIAL when Equipment is ACTIVE', async () => {
    const o = await materialOrigin(db, true, true);
    await expect(persistMaterialContract(db, o)).rejects.toMatchObject({
      code: 'CORRECTION_MATERIAL_ONLY',
    });
    expect(
      await db.inventoryPhysicalEffect.count({
        where: {
          companyId: o.f.companyId,
          originType: 'CASE_DISPATCH_CORRECTION',
        },
      }),
    ).toBe(0);
  });
});
