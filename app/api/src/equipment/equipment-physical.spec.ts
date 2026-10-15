import { randomUUID } from 'node:crypto';
import {
  EquipmentAsset,
  EquipmentAssetPhysicalEvent,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { EquipmentPhysicalBaselineService } from './equipment-physical-baseline.service';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from './equipment-physical-history.service';
import {
  ClosedEquipmentBaselineEvidence,
  EquipmentBaselineCommand,
  EquipmentBaselineEvidenceAdapter,
  equipmentBaselineHash,
  equipmentPhysicalHash,
  validateEquipmentBaseline,
  MAX_EQUIPMENT_PHYSICAL_REVISION,
} from './equipment-physical.contract';
import { equipmentBaselineFromArguments } from './equipment-physical-baseline';

jest.mock('../healthcare/common/healthcare-company-lock', () => ({
  acquireHealthcareCompanyLock: jest.fn().mockResolvedValue(undefined),
}));
jest.mock(
  '../healthcare/common/healthcare-subsequent-transaction-timeouts',
  () => ({
    applyHealthcareSubsequentTransactionTimeouts: jest
      .fn()
      .mockResolvedValue(undefined),
  }),
);

describe('01E-A Equipment physical foundation', () => {
  const companyId = randomUUID(),
    assetId = randomUUID();
  const command = (): EquipmentBaselineCommand => ({
    companyId,
    assetId,
    reconciliationId: randomUUID(),
    expectedPhysicalRevision: 0,
    targetPhysicalLocation: 'WAREHOUSE',
    operatorIdentity: 'isolated-operator',
    evidenceReference: 'fixture://evidence',
    evidenceHash: 'a'.repeat(64),
  });
  function fixture(adapter?: EquipmentBaselineEvidenceAdapter) {
    const asset = {
      id: assetId,
      companyId,
      productId: randomUUID(),
      physicalLocation: 'UNVERIFIED',
      physicalRevision: 0,
      activeCustodyId: null,
      condition: 'DAMAGED',
      lifecycle: 'RETIRED',
    } as EquipmentAsset;
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: randomUUID(), role: 'ADMIN' }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: asset.productId }),
      },
    };
    const repo = {
      lockAssetForPhysicalMutation: jest.fn().mockResolvedValue(asset),
      findPhysicalEventByOrigin: jest
        .fn<Promise<EquipmentAssetPhysicalEvent | null>, unknown[]>()
        .mockResolvedValue(null),
      establishWarehouse: jest.fn().mockResolvedValue(undefined),
      appendPhysicalEvent: jest.fn(
        (
          _t: unknown,
          data: Prisma.EquipmentAssetPhysicalEventUncheckedCreateInput,
        ) => Promise.resolve({ ...data, id: randomUUID() }),
      ),
    };
    const db = {
      $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new EquipmentPhysicalBaselineService(
      db as unknown as PrismaClient,
      adapter,
      {
        companyLockAcquisitionTimeoutMs: 1000,
        subsequentLockTimeoutMs: 1000,
        subsequentStatementTimeoutMs: 2000,
        prismaMaxWaitMs: 3000,
        prismaTransactionTimeoutMs: 5000,
      },
      repo as unknown as EquipmentPhysicalRepository,
    );
    return { asset, tx, repo, db, service };
  }
  const accepting: EquipmentBaselineEvidenceAdapter = {
    accept: (c, requestHash) =>
      Promise.resolve({
        requestHash,
        evidenceHash: c.evidenceHash,
        operatorIdentity: c.operatorIdentity,
        warehousePresenceVerified: true,
      }),
  };

  it('hashes a canonical command independent of property insertion order', () => {
    const c = command();
    expect(equipmentBaselineHash(c)).toBe(
      equipmentBaselineHash(
        Object.fromEntries(
          Object.entries(c).reverse(),
        ) as EquipmentBaselineCommand,
      ),
    );
    expect(
      equipmentBaselineHash({ ...c, evidenceHash: 'b'.repeat(64) }),
    ).not.toBe(equipmentBaselineHash(c));
  });
  it.each([-1, MAX_EQUIPMENT_PHYSICAL_REVISION, 1.5])(
    'rejects invalid/overflow revision %s',
    (revision) => {
      expect(() =>
        validateEquipmentBaseline({
          ...command(),
          expectedPhysicalRevision: revision,
        }),
      ).toThrow('INVALID_REQUEST_BODY');
    },
  );
  it('closed adapter never accepts caller evidence', async () => {
    await expect(
      new ClosedEquipmentBaselineEvidence().accept(),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_EVIDENCE_REQUIRED');
    const f = fixture();
    await expect(f.service.reconcile(command())).rejects.toThrow(
      'EQUIPMENT_PHYSICAL_EVIDENCE_REQUIRED',
    );
    expect(f.repo.establishWarehouse).not.toHaveBeenCalled();
    expect(f.repo.appendPhysicalEvent).not.toHaveBeenCalled();
  });
  it('baseline preserves damaged/retired facts and does not invent a User', async () => {
    const f = fixture(accepting),
      c = command();
    const result = await f.service.reconcile(c);
    expect(result.outcome).toBe('APPLIED');
    expect(result.event).toMatchObject({
      actorId: null,
      revisionBefore: 0,
      revisionAfter: 1,
      conditionBefore: 'DAMAGED',
      conditionAfter: 'DAMAGED',
      lifecycleBefore: 'RETIRED',
      lifecycleAfter: 'RETIRED',
      operatorIdentity: c.operatorIdentity,
      evidenceHash: c.evidenceHash,
    });
    expect(f.tx.user.findFirst).not.toHaveBeenCalled();
    expect(f.db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
  });
  it('replays retained evidence after live state moves on without overwriting actor', async () => {
    const f = fixture(accepting),
      c = command(),
      actorId = randomUUID();
    f.repo.findPhysicalEventByOrigin.mockResolvedValue({
      id: randomUUID(),
      operation: 'BASELINE_RECONCILIATION',
      requestHash: equipmentBaselineHash(c),
      hashVersion: 1,
      actorId,
    } as EquipmentAssetPhysicalEvent);
    f.asset.physicalLocation = 'CUSTODY';
    f.asset.physicalRevision = 9;
    const result = await f.service.reconcile(c);
    expect(result.outcome).toBe('REPLAY');
    expect(result.event.actorId).toBe(actorId);
    expect(f.repo.establishWarehouse).not.toHaveBeenCalled();
    expect(f.repo.appendPhysicalEvent).not.toHaveBeenCalled();
  });
  it('origin mismatch rejects before a new write', async () => {
    const f = fixture(accepting);
    f.repo.findPhysicalEventByOrigin.mockResolvedValue({
      hashVersion: 1,
      requestHash: 'b'.repeat(64),
    } as EquipmentAssetPhysicalEvent);
    await expect(f.service.reconcile(command())).rejects.toThrow(
      'IDEMPOTENCY_KEY_REUSED',
    );
    expect(f.repo.establishWarehouse).not.toHaveBeenCalled();
  });
  it('stale revision produces zero writes', async () => {
    const f = fixture(accepting);
    await expect(
      f.service.reconcile({ ...command(), expectedPhysicalRevision: 1 }),
    ).rejects.toThrow('RESOURCE_STATE_CHANGED');
    expect(f.repo.establishWarehouse).not.toHaveBeenCalled();
  });
  it('unaccepted or mismatched evidence produces zero writes', async () => {
    const f = fixture({
      accept: () =>
        Promise.resolve({
          requestHash: 'wrong',
          evidenceHash: 'wrong',
          operatorIdentity: 'wrong',
          warehousePresenceVerified: true,
        }),
    });
    await expect(f.service.reconcile(command())).rejects.toThrow(
      'EQUIPMENT_PHYSICAL_EVIDENCE_INVALID',
    );
    expect(f.repo.establishWarehouse).not.toHaveBeenCalled();
  });
  it('Receipt requires real actor and normal operation role', async () => {
    const history = new EquipmentPhysicalHistoryService();
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: randomUUID(), role: 'SALES' }),
      },
    };
    await expect(
      history.requireReceiptActor(
        tx as unknown as Prisma.TransactionClient,
        companyId,
        undefined,
      ),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_ACTOR_INVALID');
    await expect(
      history.requireReceiptActor(
        tx as unknown as Prisma.TransactionClient,
        companyId,
        randomUUID(),
      ),
    ).rejects.toThrow('EQUIPMENT_PHYSICAL_ACTOR_INVALID');
  });
  it('CLI rejects --all and absent adapter before database creation', async () => {
    await expect(
      equipmentBaselineFromArguments(['--all', 'true']),
    ).rejects.toThrow('Explicit single-Asset');
    const prior = process.env.EQUIPMENT_BASELINE_EVIDENCE_ADAPTER_PATH;
    delete process.env.EQUIPMENT_BASELINE_EVIDENCE_ADAPTER_PATH;
    try {
      const c = command();
      await expect(
        equipmentBaselineFromArguments(
          Object.entries(c).flatMap(([k, v]) => ['--' + k, String(v)]),
        ),
      ).rejects.toThrow('adapter is not configured');
    } finally {
      if (prior === undefined)
        delete process.env.EQUIPMENT_BASELINE_EVIDENCE_ADAPTER_PATH;
      else process.env.EQUIPMENT_BASELINE_EVIDENCE_ADAPTER_PATH = prior;
    }
  });
  it('SHA-256 is lowercase hex', () =>
    expect(equipmentPhysicalHash({ version: 1 })).toMatch(/^[0-9a-f]{64}$/));
});
