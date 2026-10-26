import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { createDispatchCorrectionRequestHash } from '../../healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';
import { DispatchCorrectionMaterialInput } from './dispatch-correction-physical.adapter';
import { loadCorrectionContext } from './dispatch-correction-physical.adapter';
import {
  materialQaUrl,
  MATERIAL_QA_MARKER,
} from '../../../test/helpers/dispatch-correction-material-postgres-authorization';

// Define positive/negative fixtures before changing the physical implementation.
function fixture() {
  const input: DispatchCorrectionMaterialInput = {
    companyId: randomUUID(),
    caseId: randomUUID(),
    dispatchId: randomUUID(),
    correctionId: randomUUID(),
    requesterId: randomUUID(),
    idempotencyKey: 'contract-a',
    attestedNoHandoff: true,
    reason: '🚑'.repeat(1000),
  };
  const at = new Date('2026-10-20T12:00:00.123Z');
  const hash = createDispatchCorrectionRequestHash(input);
  const item = {
    id: randomUUID(),
    type: 'MATERIAL',
    lifecycle: 'ACTIVE',
    productId: randomUUID(),
    batchId: null,
    quantity: 2,
    destinationPositionId: randomUUID(),
    sourcePositionId: randomUUID(),
    physicalEffectId: randomUUID(),
    expectedPositionRevision: 0,
  };
  const root = {
    id: input.correctionId,
    companyId: input.companyId,
    caseId: input.caseId,
    dispatchId: input.dispatchId,
    status: 'CONFIRMED',
    kind: 'NO_PHYSICAL_HANDOFF',
    hashVersion: 1,
    snapshotVersion: 1,
    confirmedById: input.requesterId,
    confirmedAt: at,
    reason: input.reason,
    attestedNoHandoff: true,
    requestHash: hash,
    snapshot: null,
    idempotencyRecordId: randomUUID(),
    items: [] as unknown[],
  };
  const source = {
    id: input.dispatchId,
    companyId: input.companyId,
    caseId: input.caseId,
    status: 'CONFIRMED',
    confirmedById: input.requesterId,
    confirmedAt: new Date(at.getTime() - 1000),
    items: [item],
  };
  const position = {
    id: item.destinationPositionId,
    companyId: input.companyId,
    productId: item.productId,
    inventoryBatchId: null,
    state: 'CUSTODY',
    contextType: 'CASE_DISPATCH_ITEM',
    contextId: item.id,
    quantity: 2,
    revision: 1,
  };
  const line = {
    positionId: position.id,
    delta: 2,
    quantityBefore: 0,
    quantityAfter: 2,
    revisionBefore: 0,
    revisionAfter: 1,
  };
  const original = {
    id: item.physicalEffectId,
    companyId: input.companyId,
    kind: 'TRANSFER',
    originType: 'CASE_DISPATCH',
    originId: input.dispatchId,
    originOperation: 'CONFIRM_QUANTITY',
    actorId: source.confirmedById,
    occurredAt: source.confirmedAt,
    lineCount: 2,
    lines: [
      line,
      {
        positionId: item.sourcePositionId,
        delta: -2,
        quantityBefore: 10,
        quantityAfter: 8,
        revisionBefore: 0,
        revisionAfter: 1,
      },
    ],
  };
  const claim = {
    id: root.idempotencyRecordId,
    scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
    companyId: input.companyId,
    key: input.idempotencyKey,
    requestHash: hash,
    resourceId: root.id,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ valid: true }]),
    inventoryCutover: {
      findUnique: jest.fn().mockResolvedValue({
        id: randomUUID(),
        companyId: input.companyId,
        status: 'PHYSICAL_ACTIVE',
        revision: 0,
        manifestDigest: 'a'.repeat(64),
        snapshotFingerprint: 'b'.repeat(64),
        baselineBuild: 'qa',
        manifestLockedAt: at,
        recoveryFromStatus: null,
        initiatedBy: input.requesterId,
        approvedBy: input.requesterId,
        activatedBy: input.requesterId,
        activatedAt: at,
      }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: input.requesterId,
        role: 'ADMIN',
        isActive: true,
      }),
    },
    healthcareCaseDispatchCorrection: {
      findFirst: jest.fn().mockResolvedValue(root),
    },
    healthcareCaseDispatch: { findFirst: jest.fn().mockResolvedValue(source) },
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(claim) },
    healthcareCaseReconciliation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    inventoryPhysicalEffect: {
      findFirst: jest.fn().mockResolvedValue(original),
    },
    inventoryPhysicalEffectLine: { count: jest.fn().mockResolvedValue(1) },
    inventoryPosition: {
      groupBy: jest
        .fn()
        .mockResolvedValue([
          { productId: item.productId, _sum: { quantity: 10 } },
        ]),
    },
  };
  const repo = {
    findEffect: jest.fn().mockResolvedValue(null),
    findSources: jest.fn().mockResolvedValue([position]),
    lockProducts: jest.fn().mockResolvedValue([
      {
        id: item.productId,
        companyId: input.companyId,
        inventoryTracking: 'QUANTITY',
        lotTracking: 'NONE',
        isActive: true,
      },
    ]),
    lockBatches: jest.fn().mockResolvedValue([]),
    lockPositions: jest.fn().mockResolvedValue([
      position,
      {
        ...position,
        id: item.sourcePositionId,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
        quantity: 8,
        revision: 1,
      },
    ]),
    claimDispatchCorrectionEffect: jest.fn().mockResolvedValue({
      id: randomUUID(),
      companyId: input.companyId,
      requestHash: hash,
      occurredAt: at,
    }),
    mutatePosition: jest.fn().mockResolvedValue({ count: 1 }),
    appendLines: jest
      .fn()
      .mockImplementation((_tx: unknown, rows: unknown[]) =>
        Promise.resolve(rows),
      ),
  };
  const service = new PhysicalInventoryService(
    repo as unknown as PhysicalInventoryRepository,
  );
  return {
    input,
    root,
    source,
    item,
    position,
    original,
    claim,
    tx,
    repo,
    service,
    db: tx as unknown as Prisma.TransactionClient,
  };
}

describe('01C-A specific material contract', () => {
  it('01D selects MATERIAL from a mixed durable source without changing default MATERIAL-only admission', async () => {
    const f = fixture();
    const equipment = {
      ...f.item,
      id: randomUUID(),
      type: 'EQUIPMENT',
      quantity: null,
    };
    f.source.items.push(equipment as unknown as typeof f.item);
    await expect(loadCorrectionContext(f.db, f.input)).rejects.toHaveProperty(
      'code',
      'CORRECTION_MATERIAL_ONLY',
    );
    const context = await loadCorrectionContext(f.db, f.input, true);
    expect(context?.source.items).toEqual([f.item]);
    expect(f.repo.mutatePosition).not.toHaveBeenCalled();
  });
  const before = { ...process.env };
  beforeEach(() => {
    process.env.INVENTORY_AUTHORITY_PROTOCOL = 'inventory-authority-v1';
    process.env.INVENTORY_RUNTIME_BUILD = 'qa-a';
    process.env.INVENTORY_RUNTIME_ENVIRONMENT = 'isolated';
  });
  afterAll(() => {
    process.env = before;
  });
  it('derives Unicode reason/hash/date and rechecks around locks without generic classification', async () => {
    const f = fixture();
    const generic = jest.spyOn(f.service, 'classifyCommittedEffect');
    const result = await f.service.transferDispatchCorrectionMaterial(
      f.db,
      f.input,
    );
    expect(result.replay).toBe(false);
    expect(result.projectionDeltas).toEqual([
      { productId: f.item.productId, ownedDelta: 0 },
    ]);
    expect(generic).not.toHaveBeenCalled();
    expect(f.repo.findEffect.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(f.repo.claimDispatchCorrectionEffect).toHaveBeenCalledWith(
      f.db,
      expect.objectContaining({
        requestHash: f.root.requestHash,
        confirmedAt: f.root.confirmedAt,
        confirmedById: f.root.confirmedById,
        reason: f.input.reason,
      }),
      2,
    );
  });

  it.each(['writer boundary'])(
    'rejects missing %s proof before effects',
    async () => {
      const f = fixture();
      f.tx.$queryRaw.mockResolvedValue([{ valid: false }]);
      await expect(
        f.service.transferDispatchCorrectionMaterial(f.db, f.input),
      ).rejects.toBeDefined();
      expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'intention',
      (f: ReturnType<typeof fixture>) => {
        f.input.reason = 'different';
      },
    ],
    [
      'key',
      (f: ReturnType<typeof fixture>) => {
        f.claim.key = 'different';
      },
    ],
    [
      'foreign root',
      (f: ReturnType<typeof fixture>) => {
        f.root.companyId = randomUUID();
      },
    ],
    [
      'actor',
      (f: ReturnType<typeof fixture>) => {
        f.root.confirmedById = randomUUID();
      },
    ],
    [
      'Equipment',
      (f: ReturnType<typeof fixture>) => {
        f.item.type = 'EQUIPMENT';
      },
    ],
    [
      'quantity',
      (f: ReturnType<typeof fixture>) => {
        f.position.quantity = 3;
      },
    ],
    [
      'revision',
      (f: ReturnType<typeof fixture>) => {
        f.position.revision = 3;
      },
    ],
    [
      'history',
      (f: ReturnType<typeof fixture>) => {
        f.tx.inventoryPhysicalEffectLine.count.mockResolvedValue(2);
      },
    ],
    [
      'orphan',
      (f: ReturnType<typeof fixture>) => {
        f.repo.findEffect.mockResolvedValue({ id: randomUUID() });
      },
    ],
  ] as const)(
    'rejects %s and never creates a header',
    async (_name, change) => {
      const f = fixture();
      change(f);
      await expect(
        f.service.transferDispatchCorrectionMaterial(f.db, f.input),
      ).rejects.toBeDefined();
      expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
    },
  );

  it('revalidates the locked Position, not just the discovery hint', async () => {
    const f = fixture();
    f.repo.lockPositions.mockResolvedValue([
      { ...f.position, quantity: 1, revision: 2 },
    ]);
    await expect(
      f.service.transferDispatchCorrectionMaterial(f.db, f.input),
    ).rejects.toBeDefined();
    expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
  });

  it('does not authorize a dated source through the existing correction adapter', async () => {
    const f = fixture();
    Object.assign(f.tx, {
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ timezone: 'America/Hermosillo' }),
      },
    });
    f.repo.lockPositions.mockResolvedValue([
      { ...f.position, expirationDate: new Date('2099-08-15') },
    ] as never);
    await expect(
      f.service.transferDispatchCorrectionMaterial(f.db, f.input),
    ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
    expect(f.repo.lockPositions).toHaveBeenCalled();
    expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
    expect(f.repo.mutatePosition).not.toHaveBeenCalled();
    expect(f.repo.appendLines).not.toHaveBeenCalled();
  });

  it('retains current Product eligibility', async () => {
    const f = fixture();
    f.repo.lockProducts.mockResolvedValue([
      {
        id: f.item.productId,
        companyId: f.input.companyId,
        inventoryTracking: 'QUANTITY',
        lotTracking: 'NONE',
        isActive: false,
      },
    ]);
    await expect(
      f.service.transferDispatchCorrectionMaterial(f.db, f.input),
    ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
  });

  it('propagates failure after header creation for caller rollback', async () => {
    const f = fixture();
    f.repo.appendLines.mockRejectedValue(new Error('transport failure'));
    await expect(
      f.service.transferDispatchCorrectionMaterial(f.db, f.input),
    ).rejects.toBeDefined();
    expect(f.repo.claimDispatchCorrectionEffect).toHaveBeenCalledTimes(1);
  });

  it('returns null for an unknown replay key without physical mutation', async () => {
    const f = fixture();
    f.tx.idempotencyRecord.findUnique.mockResolvedValue(null);
    f.tx.healthcareCaseDispatchCorrection.findFirst.mockResolvedValue(null);
    await expect(
      f.service.classifyCommittedDispatchCorrectionMaterial(f.db, f.input),
    ).resolves.toBeNull();
    expect(f.repo.lockProducts).not.toHaveBeenCalled();
  });

  it('rejects a root client before any database call', async () => {
    const f = fixture();
    await expect(
      f.service.transferDispatchCorrectionMaterial(
        { $transaction: true } as unknown as Prisma.TransactionClient,
        f.input,
      ),
    ).rejects.toBeDefined();
    expect(f.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it.each(['PRECHECK', 'RECOVERY_REQUIRED', 'missing'] as const)(
    'rejects authority %s before header creation',
    async (status) => {
      const f = fixture();
      if (status === 'missing')
        f.tx.inventoryCutover.findUnique.mockResolvedValue(null);
      else
        f.tx.inventoryCutover.findUnique.mockResolvedValue({
          id: randomUUID(),
          companyId: f.input.companyId,
          status,
          revision: 0,
          manifestDigest: null,
          snapshotFingerprint: null,
          baselineBuild: null,
          manifestLockedAt: null,
          recoveryFromStatus:
            status === 'RECOVERY_REQUIRED' ? 'PRECHECK' : null,
          initiatedBy: f.input.requesterId,
          approvedBy: null,
          activatedBy: null,
          activatedAt: null,
        });
      await expect(
        f.service.transferDispatchCorrectionMaterial(f.db, f.input),
      ).rejects.toMatchObject({
        code:
          status === 'missing'
            ? 'PHYSICAL_AUTHORITY_REQUIRED'
            : status === 'RECOVERY_REQUIRED'
              ? status
              : 'CUTOVER_FROZEN',
      });
      expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
    },
  );

  it.each(['inactive actor', 'active RR', 'runtime'] as const)(
    'rejects %s',
    async (failure) => {
      const f = fixture();
      if (failure === 'inactive actor')
        f.tx.user.findFirst.mockResolvedValue(null);
      if (failure === 'active RR')
        f.tx.healthcareCaseReconciliation.findFirst.mockResolvedValue({
          id: randomUUID(),
        });
      if (failure === 'runtime') delete process.env.INVENTORY_RUNTIME_BUILD;
      await expect(
        f.service.transferDispatchCorrectionMaterial(f.db, f.input),
      ).rejects.toBeDefined();
      expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
    },
  );

  function sealedFixture() {
    const f = fixture();
    const effect = {
      id: randomUUID(),
      companyId: f.input.companyId,
      originType: 'CASE_DISPATCH_CORRECTION',
      originId: f.root.id,
      originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
      kind: 'TRANSFER',
      requestHash: f.root.requestHash,
      actorId: f.root.confirmedById,
      occurredAt: f.root.confirmedAt,
      lineCount: 2,
      lines: [
        {
          positionId: f.item.destinationPositionId,
          delta: -2,
          quantityBefore: 2,
          quantityAfter: 0,
          revisionBefore: 1,
          revisionAfter: 2,
        },
        {
          positionId: f.item.sourcePositionId,
          delta: 2,
          quantityBefore: 8,
          quantityAfter: 10,
          revisionBefore: 1,
          revisionAfter: 2,
        },
      ],
    };
    Object.assign(f.root, { snapshot: { version: 1 } });
    f.root.items.push({
      sourceDispatchItemId: f.item.id,
      type: 'MATERIAL',
      snapshot: { version: 1 },
      quantity: 2,
      originalPhysicalEffectId: f.item.physicalEffectId,
      sourceCustodyPositionId: f.item.destinationPositionId,
      compensatingEffectId: effect.id,
      destinationPositionId: f.item.sourcePositionId,
    });
    f.repo.findEffect.mockResolvedValue(effect);
    return { ...f, effect };
  }

  it('replays historical evidence for a different authorized actor without live physical reads', async () => {
    const f = sealedFixture();
    f.input.requesterId = randomUUID();
    const replay = await f.service.transferDispatchCorrectionMaterial(
      f.db,
      f.input,
    );
    expect(replay).toEqual({
      replay: true,
      effect: f.effect,
      projectionDeltas: [],
    });
    expect(replay.effect.actorId).toBe(f.root.confirmedById);
    expect(f.repo.findSources).not.toHaveBeenCalled();
    expect(f.repo.lockProducts).not.toHaveBeenCalled();
    expect(f.tx.inventoryCutover.findUnique).not.toHaveBeenCalled();
    expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
  });

  it('recognizes a winner committed between the initial key read and root read', async () => {
    const f = sealedFixture();
    Object.assign(f.root, { idempotencyRecord: f.claim });
    f.tx.idempotencyRecord.findUnique.mockResolvedValueOnce(null);
    await expect(
      f.service.classifyCommittedDispatchCorrectionMaterial(f.db, f.input),
    ).resolves.toMatchObject({ replay: true });
  });

  it.each(['hash', 'date', 'actor', 'line', 'snapshot'] as const)(
    'rejects historical %s mismatch',
    async (failure) => {
      const f = sealedFixture();
      if (failure === 'hash') f.effect.requestHash = 'b'.repeat(64);
      if (failure === 'date') f.effect.occurredAt = new Date(0);
      if (failure === 'actor') f.effect.actorId = randomUUID();
      if (failure === 'line') f.effect.lines[0].delta = -1;
      if (failure === 'snapshot')
        f.tx.$queryRaw.mockResolvedValue([{ valid: false }]);
      await expect(
        f.service.classifyCommittedDispatchCorrectionMaterial(f.db, f.input),
      ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    },
  );

  it('checks the specific classifier again after Product locks', async () => {
    const f = fixture();
    f.repo.findEffect
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'orphan' });
    await expect(
      f.service.transferDispatchCorrectionMaterial(f.db, f.input),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    expect(f.repo.lockProducts).toHaveBeenCalled();
    expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
  });

  it.each([0, -1, 2147483648])(
    'rejects invalid quantity %s before effects',
    async (quantity) => {
      const f = fixture();
      f.item.quantity = quantity;
      await expect(
        f.service.transferDispatchCorrectionMaterial(f.db, f.input),
      ).rejects.toBeDefined();
      expect(f.repo.claimDispatchCorrectionEffect).not.toHaveBeenCalled();
    },
  );

  it('requires A-specific authorization and never falls back to 01B', () => {
    expect(() =>
      materialQaUrl({
        HC_DSP_COR_01B_DATABASE_AUTHORIZATION:
          'HC-DSP-COR-01B isolated QA authorized',
        DATABASE_URL: 'postgresql://unused.invalid',
      }),
    ).toThrow('not explicitly authorized');
  });

  it.each(['5432', '5434', '5435'])('rejects PostgreSQL port %s', (port) => {
    expect(() =>
      materialQaUrl({
        RUN_CASE_DISPATCH_CORRECTION_MATERIAL_POSTGRES: '1',
        HC_DSP_COR_01C_A_DATABASE_AUTHORIZATION: MATERIAL_QA_MARKER,
        CASE_DISPATCH_CORRECTION_MATERIAL_TEST_RUN: 'unit',
        CASE_DISPATCH_CORRECTION_MATERIAL_TEST_DATABASE_URL: `postgresql://hc_dsp_cor_01c_a_test@127.0.0.1:${port}/zaping_hc_dsp_cor_01c_a_test`,
      }),
    ).toThrow('target');
  });
});
