import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { HealthcareCaseDispatchCorrectionCommandService } from './healthcare-case-dispatch-correction-command.service';
import { HealthcareCaseDispatchCorrectionCommandRepository } from './healthcare-case-dispatch-correction-command.repository';
import type { MaterialCorrectionSource } from './healthcare-case-dispatch-correction-command.repository';
import type { PhysicalResult } from '../../inventory/physical/physical-inventory.contract';
import { HealthcareCaseDispatchCorrection } from '@prisma/client';
import { InventoryAuthorityError } from '../../inventory/physical/inventory-authority-error';
import {
  normalizeMaterialCorrection,
  correctionCollision,
} from './healthcare-case-dispatch-correction-command.contract';
import { PhysicalInventoryRepository } from '../../inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../../inventory/physical/physical-inventory.service';

import { InventoryCompatibilityProjectionService } from '../../inventory/physical/inventory-compatibility-projection.service';
import { InventoryRuntimeCompatibilityService } from '../../inventory/physical/inventory-runtime-compatibility.service';
import { inventoryAuthorityFence } from '../../inventory/physical/inventory-authority-fence';
import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../common/healthcare-company-transaction-timeout-policy';
import { orchestrationQaUrl } from '../../../test/helpers/dispatch-correction-material-orchestration-postgres-authorization';

jest.mock('../../inventory/physical/inventory-authority-fence', () => ({
  ...jest.requireActual<object>(
    '../../inventory/physical/inventory-authority-fence',
  ),
  inventoryAuthorityFence: jest.fn(),
}));
jest.mock('../common/healthcare-company-lock', () => ({
  acquireHealthcareCompanyLock: jest.fn(),
}));

const policy: HealthcareCompanyTransactionTimeoutPolicy = {
  companyLockAcquisitionTimeoutMs: 1000,
  subsequentLockTimeoutMs: 1000,
  subsequentStatementTimeoutMs: 3000,
  prismaMaxWaitMs: 4000,
  prismaTransactionTimeoutMs: 10000,
};

// Fixtures and negatives precede implementation. These are NOT PostgreSQL proof.
function setup() {
  const context = {
    companyId: randomUUID() as string,
    caseId: randomUUID(),
    dispatchId: randomUUID(),
    requesterId: randomUUID(),
    idempotencyKey: 'key-b',
  };
  const intent = {
    attestedNoHandoff: true as const,
    reason: ' 🚑'.trim().repeat(1000),
  };
  const calls: string[] = [];
  const tx = {} as Prisma.TransactionClient;
  const actor = { id: context.requesterId, role: 'ADMIN', isActive: true };
  const source = {
    id: context.dispatchId,
    companyId: context.companyId,
    caseId: context.caseId,
    caseKitId: randomUUID(),
    status: 'CONFIRMED',
    snapshot: { version: 1 },
    items: [{ id: randomUUID(), type: 'MATERIAL', quantity: 2 }],
  };
  const witness = { id: randomUUID() as string, requestHash: 'a'.repeat(64) };
  const record = (name: string, value: unknown) =>
    jest.fn().mockImplementation(() => {
      calls.push(name);
      return Promise.resolve(value);
    });
  const repo = {
    read: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx),
    ),
    write: jest.fn(
      async (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => {
        calls.push('begin');
        const result = await fn(tx);
        calls.push('commit');
        return result;
      },
    ),
    authorize: record('authorize', actor),
    replayWitness: record('replay', null),
    control: record('control', { status: 'PHYSICAL_ACTIVE' }),
    createClaim: record('claim', { id: randomUUID() }),
    lockStructure: record('structure', source),
    assertSource: record('validate', undefined),
    assertNoCorrection: record('no-correction', undefined),
    createRoot: jest
      .fn()
      .mockImplementation(
        (_tx: unknown, data: { id: string; requestHash: string }) => {
          witness.id = data.id;
          witness.requestHash = data.requestHash;
          calls.push('root');
          return Promise.resolve({
            ...data,
            confirmedAt: new Date('2026-10-20T23:00:00Z'),
          });
        },
      ),
    serverTime: record('time', new Date('2026-10-20T23:00:00Z')),
    createEvidenceItems: record('items', undefined),
    seal: record('seal', undefined),
    constraints: record('constraints', undefined),
    witness: record('witness', witness),
  };
  const physical = {
    classifyCommittedDispatchCorrectionMaterial: record('classify', {
      replay: true,
      effect: {},
    }),
    transferDispatchCorrectionMaterial: record('transfer', {
      replay: false,
      effect: {},
      projectionDeltas: [],
    }),
  };
  const projections = { apply: record('project', undefined) };
  const authority = { resolve: record('authority', 'PHYSICAL') };
  const runtime = {
    identity: jest.fn(() => {
      calls.push('runtime');
    }),
  };
  jest.mocked(inventoryAuthorityFence).mockImplementation(() => {
    calls.push('fence');
    return Promise.resolve();
  });
  jest.mocked(acquireHealthcareCompanyLock).mockImplementation(() => {
    calls.push('hc-lock');
    return Promise.resolve();
  });
  const service = new HealthcareCaseDispatchCorrectionCommandService(
    repo as unknown as HealthcareCaseDispatchCorrectionCommandRepository,
    policy,
    physical as unknown as PhysicalInventoryService,
    projections as unknown as InventoryCompatibilityProjectionService,
    authority,
    runtime as unknown as InventoryRuntimeCompatibilityService,
  );
  return {
    context,
    intent,
    calls,
    repo,
    physical,
    projections,
    authority,
    runtime,
    service,
    source,
    witness,
    tx,
  };
}

describe('01C-B internal atomic orchestration', () => {
  it('rejects incompatible runtime before any claim', async () => {
    const f = setup();
    f.runtime.identity.mockImplementation(() => {
      throw new InventoryAuthorityError('INCOMPATIBLE_BUILD');
    });
    await expect(f.service.execute(f.context, f.intent)).rejects.toMatchObject({
      code: 'INCOMPATIBLE_BUILD',
    });
    expect(f.repo.createClaim).not.toHaveBeenCalled();
  });
  it.each(['DRAFT', 'CONFIRMED', 'CANCELLED_WITH_EFFECT'] as const)(
    'repository rejects incompatible RR %s including excluded items',
    async () => {
      const f = setup();
      const findFirst = jest.fn().mockResolvedValue({ id: randomUUID() });
      const tx = {
        healthcareCaseReconciliation: { findFirst },
      } as unknown as Prisma.TransactionClient;
      const repo = new HealthcareCaseDispatchCorrectionCommandRepository(
        {} as PrismaClient,
      );
      await expect(
        repo.assertSource(
          tx,
          f.context,
          f.source as unknown as MaterialCorrectionSource,
        ),
      ).rejects.toMatchObject({
        code: 'CORRECTION_RECONCILIATION_INCOMPATIBLE',
      });
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          companyId: f.context.companyId,
          dispatchId: f.context.dispatchId,
          OR: [
            { status: { not: 'CANCELLED' } },
            {
              items: {
                some: {
                  OR: [
                    { returnedPhysicalEffectId: { not: null } },
                    { usedPhysicalEffectId: { not: null } },
                    { closePhysicalEventId: { not: null } },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true },
      });
    },
  );
  it('repository creates only complete mappings from persisted Lines and rejects mismatched evidence', async () => {
    const f = setup(),
      id = randomUUID(),
      effectId = randomUUID(),
      custody = randomUUID(),
      available = randomUUID(),
      product = randomUUID(),
      sourceId = randomUUID();
    const at = new Date('2026-10-20T23:00:00.123Z');
    const root = {
      id,
      confirmedById: f.context.requesterId,
      confirmedAt: at,
      requestHash: 'a'.repeat(64),
    } as HealthcareCaseDispatchCorrection;
    const source = {
      ...f.source,
      items: [
        {
          id: sourceId,
          type: 'MATERIAL',
          productId: product,
          batchId: null,
          quantity: 2,
          destinationPositionId: custody,
          physicalEffectId: randomUUID(),
        },
      ],
    } as unknown as MaterialCorrectionSource;
    const facts = [
      {
        id: randomUUID(),
        positionId: custody,
        delta: -2,
        quantityBefore: 2,
        quantityAfter: 0,
        revisionBefore: 1,
        revisionAfter: 2,
        position: {
          companyId: f.context.companyId,
          productId: product,
          inventoryBatchId: null,
          state: 'CUSTODY',
          contextType: 'CASE_DISPATCH_ITEM',
          contextId: sourceId,
          quantity: 0,
          revision: 2,
        },
      },
      {
        id: randomUUID(),
        positionId: available,
        delta: 2,
        quantityBefore: 8,
        quantityAfter: 10,
        revisionBefore: 1,
        revisionAfter: 2,
        position: {
          companyId: f.context.companyId,
          productId: product,
          inventoryBatchId: null,
          state: 'AVAILABLE',
          contextType: null,
          contextId: null,
          quantity: 10,
          revision: 2,
        },
      },
    ];
    const result = {
      replay: false,
      effect: {
        id: effectId,
        companyId: f.context.companyId,
        originType: 'CASE_DISPATCH_CORRECTION',
        originId: id,
        originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
        kind: 'TRANSFER',
        requestHash: root.requestHash,
        actorId: root.confirmedById,
        occurredAt: at,
        lineCount: 2,
        lines: facts.map((l) => ({ ...l })),
      },
      projectionDeltas: [{ productId: product, ownedDelta: 0 }],
    } as unknown as PhysicalResult;
    const createMany = jest.fn().mockResolvedValue({ count: 1 }),
      query = jest.fn().mockResolvedValue(1);
    const tx = {
      inventoryPhysicalEffectLine: {
        findMany: jest.fn().mockResolvedValue(facts),
      },
      healthcareCaseDispatchCorrectionItem: { createMany },
      $executeRaw: query,
    } as unknown as Prisma.TransactionClient;
    const repo = new HealthcareCaseDispatchCorrectionCommandRepository(
      {} as PrismaClient,
    );
    await repo.createEvidenceItems(tx, f.context, root, source, result);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          companyId: f.context.companyId,
          correctionId: id,
          dispatchId: f.context.dispatchId,
          sourceDispatchItemId: sourceId,
          type: 'MATERIAL',
          quantity: 2,
          originalPhysicalEffectId: source.items[0].physicalEffectId,
          sourceCustodyPositionId: custody,
          compensatingEffectId: effectId,
          destinationPositionId: available,
        },
      ],
    });
    createMany.mockClear();
    query.mockClear();
    // Returned adapter data must agree with independently re-read persisted facts.
    result.effect.lines[0].revisionAfter = 99;
    await expect(
      repo.createEvidenceItems(tx, f.context, root, source, result),
    ).rejects.toMatchObject({ code: 'CORRECTION_EVIDENCE_INCONSISTENT' });
    expect(createMany).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
  it('focal B/01B/A replay preserves historical metadata without writable delegates', async () => {
    const f = setup(),
      hash = normalizeMaterialCorrection(f.context, f.intent).hash;
    const at = new Date('2026-10-20T23:00:00.123Z');
    const id = randomUUID(),
      claimId = randomUUID(),
      effectId = randomUUID();
    const custodyId = randomUUID(),
      availableId = randomUUID(),
      originalId = randomUUID();
    const item = {
      id: randomUUID(),
      type: 'MATERIAL',
      quantity: 2,
      physicalEffectId: originalId,
      destinationPositionId: custodyId,
    };
    const root = {
      id,
      ...f.context,
      confirmedById: randomUUID(),
      confirmedAt: at,
      status: 'CONFIRMED',
      kind: 'NO_PHYSICAL_HANDOFF',
      requestHash: hash,
      reason: f.intent.reason,
      attestedNoHandoff: true,
      hashVersion: 1,
      snapshotVersion: 1,
      idempotencyRecordId: claimId,
      snapshot: { version: 1 },
      items: [
        {
          sourceDispatchItemId: item.id,
          type: 'MATERIAL',
          quantity: 2,
          originalPhysicalEffectId: originalId,
          sourceCustodyPositionId: custodyId,
          compensatingEffectId: effectId,
          destinationPositionId: availableId,
          snapshot: { version: 1 },
        },
      ],
    };
    const claim = {
      id: claimId,
      companyId: f.context.companyId,
      scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
      key: f.context.idempotencyKey,
      requestHash: hash,
      resourceId: id,
    };
    const effect = {
      id: effectId,
      companyId: f.context.companyId,
      originType: 'CASE_DISPATCH_CORRECTION',
      originId: id,
      originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
      kind: 'TRANSFER',
      requestHash: hash,
      actorId: root.confirmedById,
      occurredAt: at,
      lineCount: 2,
      lines: [
        {
          positionId: custodyId,
          delta: -2,
          quantityBefore: 2,
          quantityAfter: 0,
          revisionBefore: 1,
          revisionAfter: 2,
        },
        {
          positionId: availableId,
          delta: 2,
          quantityBefore: 8,
          quantityAfter: 10,
          revisionBefore: 1,
          revisionAfter: 2,
        },
      ],
    };
    // Only reads exist. Snapshot SQL is stubbed; real SQL proof belongs to the PG suite.
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: f.context.requesterId }),
      },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(claim) },
      healthcareCaseDispatchCorrection: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...root, idempotencyRecord: claim }),
      },
      healthcareCaseDispatch: {
        findFirst: jest.fn().mockResolvedValue({
          ...f.source,
          confirmedAt: new Date(at.getTime() - 1),
          items: [item],
        }),
      },
      inventoryPhysicalEffect: {
        findUnique: jest.fn().mockResolvedValue(effect),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ valid: true }]),
    };
    const transaction = jest.fn(
      (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        fn(tx as unknown as Prisma.TransactionClient),
    );
    const repo = new HealthcareCaseDispatchCorrectionCommandRepository({
      $transaction: transaction,
    } as unknown as PrismaClient);
    const service = new HealthcareCaseDispatchCorrectionCommandService(
      repo,
      policy,
      new PhysicalInventoryService(new PhysicalInventoryRepository()),
      f.projections as unknown as InventoryCompatibilityProjectionService,
      f.authority,
      f.runtime as unknown as InventoryRuntimeCompatibilityService,
    );
    const result = await service.execute(f.context, f.intent);
    expect(result.replay).toBe(true);
    expect(result.witness.confirmedById).toBe(root.confirmedById);
    expect(result.witness.confirmedAt).toEqual(at);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
      maxWait: policy.prismaMaxWaitMs,
      timeout: policy.prismaTransactionTimeoutMs,
    });
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: f.context.requesterId,
        companyId: f.context.companyId,
        isActive: true,
        role: { in: ['ADMIN', 'MANAGER'] },
      },
    });
    expect(
      tx.healthcareCaseDispatchCorrection.findFirst,
    ).toHaveBeenNthCalledWith(1, {
      where: {
        companyId: f.context.companyId,
        caseId: f.context.caseId,
        dispatchId: f.context.dispatchId,
        status: 'CONFIRMED',
        snapshot: { not: Prisma.DbNull },
      },
      include: { items: { orderBy: { sourceDispatchItemId: 'asc' } } },
    });
    expect(f.projections.apply).not.toHaveBeenCalled();
    expect(inventoryAuthorityFence).not.toHaveBeenCalled();
    expect(tx.inventoryPhysicalEffect.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_originType_originId_originOperation: {
            companyId: f.context.companyId,
            originType: 'CASE_DISPATCH_CORRECTION',
            originId: id,
            originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
          },
        },
      }),
    );
  });
  beforeEach(() => jest.clearAllMocks());
  it('normalizes once, preserves Unicode and never accepts external metadata overrides', () => {
    const f = setup();
    const n = normalizeMaterialCorrection(f.context, f.intent);
    expect(n.intent.reason).toBe('🚑'.repeat(1000));
    expect(n.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(n.context).not.toHaveProperty('correctionId');
  });
  it.each(['id', 'key', 'reason', 'attestation'] as const)(
    'rejects invalid %s before transactions',
    async (invalid) => {
      const f = setup();
      if (invalid === 'id') f.context.companyId = 'foreign';
      if (invalid === 'key') f.context.idempotencyKey = ' ';
      if (invalid === 'reason') f.intent.reason = ' ';
      if (invalid === 'attestation')
        Object.assign(f.intent, { attestedNoHandoff: false });
      await expect(
        f.service.execute(f.context, f.intent),
      ).rejects.toMatchObject({ code: 'CORRECTION_INVALID_REQUEST' });
      expect(f.repo.write).not.toHaveBeenCalled();
    },
  );
  it('enforces authority before claim and returns only after commit', async () => {
    const f = setup();
    const result = await f.service.execute(f.context, f.intent);
    expect(result).toEqual({ replay: false, witness: f.witness });
    expect(f.calls).toEqual([
      'authorize',
      'replay',
      'begin',
      'fence',
      'control',
      'authority',
      'runtime',
      'authorize',
      'replay',
      'claim',
      'hc-lock',
      'structure',
      'no-correction',
      'validate',
      'authorize',
      'time',
      'root',
      'transfer',
      'project',
      'items',
      'authorize',
      'seal',
      'authorize',
      'constraints',
      'witness',
      'commit',
    ]);
    expect(f.repo.createClaim).toHaveBeenCalledWith(
      f.tx,
      expect.objectContaining({ resourceId: expect.any(String) as unknown }),
    );
  });
  it('performs authorized replay without authority or live-state checks', async () => {
    const f = setup();
    f.repo.replayWitness.mockResolvedValue(f.witness);
    await expect(f.service.execute(f.context, f.intent)).resolves.toEqual({
      replay: true,
      witness: f.witness,
    });
    expect(f.repo.write).not.toHaveBeenCalled();
    expect(f.authority.resolve).not.toHaveBeenCalled();
    expect(
      f.physical.classifyCommittedDispatchCorrectionMaterial,
    ).toHaveBeenCalled();
  });
  it('rereads a winner before creating a claim', async () => {
    const f = setup();
    f.repo.replayWitness
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(f.witness);
    await expect(f.service.execute(f.context, f.intent)).resolves.toMatchObject(
      { replay: true },
    );
    expect(f.repo.createClaim).not.toHaveBeenCalled();
  });
  it.each(['LEGACY', 'CUTOVER', 'RECOVERY_REQUIRED', 'missing'] as const)(
    'rejects authority %s before claim',
    async (state) => {
      const f = setup();
      if (state === 'missing') f.repo.control.mockResolvedValue(null);
      else {
        f.repo.control.mockResolvedValue({ status: state });
        f.authority.resolve.mockResolvedValue(
          state === 'LEGACY' ? state : 'CUTOVER',
        );
      }
      await expect(
        f.service.execute(f.context, f.intent),
      ).rejects.toBeDefined();
      expect(f.repo.createClaim).not.toHaveBeenCalled();
    },
  );
  it.each([
    'authorize',
    'assertSource',
    'createClaim',
    'createRoot',
    'createEvidenceItems',
    'seal',
    'constraints',
  ] as const)('never commits after %s failure', async (method) => {
    const f = setup();
    f.repo[method].mockRejectedValue(new Error('transport'));
    await expect(f.service.execute(f.context, f.intent)).rejects.toMatchObject({
      code: 'CORRECTION_PERSISTENCE_ERROR',
    });
    expect(f.calls).not.toContain('commit');
  });
  it.each(['transfer', 'project'] as const)(
    'aborts on %s failure',
    async (phase) => {
      const f = setup();
      if (phase === 'transfer')
        f.physical.transferDispatchCorrectionMaterial.mockRejectedValue(
          new Error('connection'),
        );
      else f.projections.apply.mockRejectedValue(new Error('projection'));
      await expect(
        f.service.execute(f.context, f.intent),
      ).rejects.toMatchObject({ code: 'CORRECTION_PERSISTENCE_ERROR' });
      expect(f.calls).not.toContain('commit');
    },
  );
  it('rejects an unexpected adapter replay in the new-command branch', async () => {
    const f = setup();
    f.physical.transferDispatchCorrectionMaterial.mockResolvedValue({
      replay: true,
      effect: {},
      projectionDeltas: [],
    });
    await expect(f.service.execute(f.context, f.intent)).rejects.toMatchObject({
      code: 'CORRECTION_EVIDENCE_INCONSISTENT',
    });
    expect(f.projections.apply).not.toHaveBeenCalled();
  });
  it('classifies an exact claim collision only after rollback, in a fresh read', async () => {
    const f = setup();
    f.repo.write.mockImplementation(() => {
      f.calls.push('rollback');
      return Promise.reject(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['companyId', 'scope', 'key'] },
        }),
      );
    });
    f.repo.replayWitness
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(f.witness);
    await expect(f.service.execute(f.context, f.intent)).resolves.toMatchObject(
      { replay: true },
    );
    expect(f.calls.indexOf('rollback')).toBeLessThan(
      f.calls.lastIndexOf('classify'),
    );
    expect(f.repo.read).toHaveBeenCalledTimes(2);
  });
  it.each(['P1001', 'P2028', 'P2034', 'P2002'] as const)(
    'does not adopt a winner for unrelated %s',
    async (code) => {
      const f = setup();
      f.repo.write.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unrelated', {
          code,
          clientVersion: 'test',
          meta: { target: ['id'] },
        }),
      );
      await expect(
        f.service.execute(f.context, f.intent),
      ).rejects.toBeDefined();
      expect(f.repo.read).toHaveBeenCalledTimes(1);
    },
  );
  it('requires a B-specific PostgreSQL opt-in', () => {
    expect(() =>
      orchestrationQaUrl({
        RUN_CASE_DISPATCH_CORRECTION_MATERIAL_POSTGRES: '1',
        HC_DSP_COR_01C_A_DATABASE_AUTHORIZATION:
          'HC-DSP-COR-01C-A isolated QA authorized',
      }),
    ).toThrow('not explicitly authorized');
  });
  it('recognizes only exact unique targets', () => {
    const e = (target: unknown) =>
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target },
      });
    expect(correctionCollision(e(['companyId', 'scope', 'key']))).toBe('claim');
    expect(correctionCollision(e('DispatchCorrection_dispatch_key'))).toBe(
      'dispatch',
    );
    expect(
      correctionCollision(e('prefix_DispatchCorrection_dispatch_key_suffix')),
    ).toBeNull();
    expect(
      correctionCollision(e(['companyId', 'scope', 'key', 'id'])),
    ).toBeNull();
  });
  it('repository opens bounded READ COMMITTED and repeatable-read transactions', async () => {
    const transaction = jest.fn().mockResolvedValue('value');
    const repo = new HealthcareCaseDispatchCorrectionCommandRepository({
      $transaction: transaction,
    } as unknown as PrismaClient);
    await repo.read(() => Promise.resolve(null), policy);
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'RepeatableRead' }),
    );
  });
  it('focal 01B lookup returns no replay for an absent claim without writes', async () => {
    const f = setup();
    // Read-only 01B path with an absent claim.
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: f.context.requesterId }),
      },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as Prisma.TransactionClient;
    const transaction = jest.fn(
      (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
    );
    const repo = new HealthcareCaseDispatchCorrectionCommandRepository({
      $transaction: transaction,
    } as unknown as PrismaClient);
    await expect(
      repo.replayWitness(
        tx,
        f.context,
        normalizeMaterialCorrection(f.context, f.intent).hash,
      ),
    ).resolves.toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('01C-B restricted 01B lookup arguments', () => {
  function fixture() {
    const f = setup();
    const hash = normalizeMaterialCorrection(f.context, f.intent).hash;
    const claim = {
      id: randomUUID(),
      resourceId: randomUUID(),
      requestHash: hash,
    };
    const witness = {
      id: claim.resourceId,
      idempotencyRecordId: claim.id,
      requestHash: hash,
    };
    const findFirst = jest.fn().mockResolvedValue(witness);
    const findUnique = jest.fn().mockResolvedValue(claim);
    // Use the real B -> 01B methods; inspect the Prisma arguments they construct.
    // No write delegate is supplied: lookup/replay must remain read-only.
    const tx = {
      healthcareCaseDispatchCorrection: { findFirst },
      idempotencyRecord: { findUnique },
    } as unknown as Prisma.TransactionClient;
    const repo = new HealthcareCaseDispatchCorrectionCommandRepository(
      {} as PrismaClient,
    );
    const witnessQuery = {
      where: {
        companyId: f.context.companyId,
        caseId: f.context.caseId,
        dispatchId: f.context.dispatchId,
        status: 'CONFIRMED',
        snapshot: { not: Prisma.DbNull },
      },
      include: { items: { orderBy: { sourceDispatchItemId: 'asc' } } },
    };
    return {
      ...f,
      repo,
      tx,
      hash,
      claim,
      witness,
      findFirst,
      findUnique,
      witnessQuery,
    };
  }

  it('findWitness passes exactly the five allowed Prisma filter fields despite the full command context', async () => {
    const f = fixture();
    const contextBefore = { ...f.context };
    await expect(f.repo.witness(f.tx, f.context)).resolves.toBe(f.witness);
    expect(f.findFirst).toHaveBeenCalledTimes(1);
    expect(f.findFirst).toHaveBeenCalledWith(f.witnessQuery);
    expect(f.findUnique).not.toHaveBeenCalled();
    expect(f.context).toEqual(contextBefore);
  });

  it('findReplay restricts the witness filter while retaining the original idempotency key and linked identity', async () => {
    const f = fixture();
    await expect(f.repo.replayWitness(f.tx, f.context, f.hash)).resolves.toBe(
      f.witness,
    );
    expect(f.findUnique).toHaveBeenCalledTimes(1);
    expect(f.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_scope_key: {
          companyId: f.context.companyId,
          scope: 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF',
          key: f.context.idempotencyKey,
        },
      },
    });
    expect(f.findFirst).toHaveBeenCalledTimes(1);
    expect(f.findFirst).toHaveBeenCalledWith(f.witnessQuery);
  });

  it.each(['resourceId', 'idempotencyRecordId', 'requestHash'] as const)(
    'findReplay still rejects a mismatched claim/witness %s',
    async (field) => {
      const f = fixture();
      if (field === 'resourceId') f.claim.resourceId = randomUUID();
      else if (field === 'idempotencyRecordId')
        f.witness.idempotencyRecordId = randomUUID();
      else f.witness.requestHash = '0'.repeat(64);
      await expect(
        f.repo.replayWitness(f.tx, f.context, f.hash),
      ).rejects.toThrow('Correction idempotency witness inconsistent');
      expect(f.findFirst).toHaveBeenCalledWith(f.witnessQuery);
    },
  );

  it('rejects the same key with different intent before querying the witness', async () => {
    const f = fixture();
    const changedHash = normalizeMaterialCorrection(f.context, {
      ...f.intent,
      reason: 'Different intent',
    }).hash;
    await expect(
      f.repo.replayWitness(f.tx, f.context, changedHash),
    ).rejects.toHaveProperty('response.code', 'IDEMPOTENCY_KEY_REUSED');
    expect(f.findFirst).not.toHaveBeenCalled();
  });

  it.each(['witness', 'replay'] as const)(
    '%s propagates the original Prisma rejection without returning a replay',
    async (path) => {
      const f = fixture();
      const error = new Prisma.PrismaClientValidationError('invalid query', {
        clientVersion: 'test',
      });
      f.findFirst.mockRejectedValue(error);
      const result =
        path === 'witness'
          ? f.repo.witness(f.tx, f.context)
          : f.repo.replayWitness(f.tx, f.context, f.hash);
      await expect(result).rejects.toBe(error);
      expect(f.findFirst).toHaveBeenCalledWith(f.witnessQuery);
    },
  );
});
