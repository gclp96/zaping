import { randomUUID } from 'node:crypto';
import {
  EquipmentAsset,
  EquipmentAssetCustody,
  EquipmentAssetPhysicalEvent,
  Prisma,
} from '@prisma/client';
import { EquipmentCustodyCloseService } from './equipment-custody-close.service';
import {
  EquipmentCustodyCloseCommand,
  equipmentCustodyCloseHash,
} from './equipment-custody-close.contract';
import { EquipmentCustodyCloseContextRegistry } from './equipment-custody-close-context.registry';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from './equipment-physical-history.service';

describe('Equipment custody close service', () => {
  function fixture() {
    const c: EquipmentCustodyCloseCommand = {
      companyId: randomUUID(),
      assetId: randomUUID(),
      custodyId: randomUUID(),
      caseId: randomUUID(),
      assignmentId: randomUUID(),
      actorId: randomUUID(),
      expectedPhysicalRevision: 1,
      reportedCondition: 'DAMAGED',
      validatedContext: { adapterKey: 'TEST', contextId: randomUUID() },
      durableOrigin: {
        type: 'TEST_CLOSE',
        id: randomUUID(),
        operation: 'CLOSE',
      },
    };
    const openedAt = new Date('2026-10-01T00:00:00Z'),
      closedAt = new Date('2026-10-02T00:00:00Z');
    const asset = {
      id: c.assetId,
      companyId: c.companyId,
      physicalLocation: 'CUSTODY',
      activeCustodyId: c.custodyId,
      physicalRevision: 1,
      condition: 'GOOD',
      lifecycle: 'ACTIVE',
    } as EquipmentAsset;
    const custody = {
      id: c.custodyId,
      companyId: c.companyId,
      equipmentAssetId: c.assetId,
      caseId: c.caseId,
      assignmentId: c.assignmentId,
      openedAt,
      openedById: c.actorId,
      closedAt: null,
      closedById: null,
    } as EquipmentAssetCustody;
    const opening = {
      id: randomUUID(),
      companyId: c.companyId,
      equipmentAssetId: c.assetId,
      custodyId: c.custodyId,
      operation: 'CUSTODY_OPEN',
      physicalLocationBefore: 'WAREHOUSE',
      physicalLocationAfter: 'CUSTODY',
      conditionBefore: 'GOOD',
      conditionAfter: 'GOOD',
      lifecycleBefore: 'ACTIVE',
      lifecycleAfter: 'ACTIVE',
      revisionBefore: 0,
      revisionAfter: 1,
      actorId: c.actorId,
    } as EquipmentAssetPhysicalEvent;
    const event = {
      ...opening,
      id: randomUUID(),
      operation: 'CUSTODY_CLOSE',
      physicalLocationBefore: 'CUSTODY',
      physicalLocationAfter: 'WAREHOUSE',
      conditionAfter: c.reportedCondition,
      revisionBefore: 1,
      revisionAfter: 2,
      originType: c.durableOrigin.type,
      originId: c.durableOrigin.id,
      originOperation: c.durableOrigin.operation,
      hashVersion: 1,
      requestHash: equipmentCustodyCloseHash(c),
      createdAt: closedAt,
    } as EquipmentAssetPhysicalEvent;
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ held: true }])
        .mockResolvedValue([{ closedAt }]),
      equipmentAssetCustody: {
        findMany: jest.fn().mockResolvedValue([custody]),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(custody)),
      },
      equipmentAssetPhysicalEvent: {
        findMany: jest.fn().mockResolvedValue([opening]),
      },
    };
    const repo = {
      lockAssetForPhysicalMutation: jest.fn().mockResolvedValue(asset),
      lockCustodyForClose: jest.fn().mockResolvedValue(custody),
      findPhysicalEventByOrigin: jest.fn().mockResolvedValue(null),
      closeCustodyCas: jest.fn().mockResolvedValue(undefined),
      closeAssetFromCustodyCas: jest.fn().mockResolvedValue(undefined),
    };
    const history = {
      requireReceiptActor: jest.fn().mockResolvedValue(c.actorId),
      appendCustodyClose: jest.fn().mockResolvedValue(event),
    };
    const contexts = {
      validate: jest.fn().mockResolvedValue(undefined),
      dispatchCorrectionMetadata: jest.fn(),
    };
    const service = new EquipmentCustodyCloseService(
      repo as unknown as EquipmentPhysicalRepository,
      history as unknown as EquipmentPhysicalHistoryService,
      contexts as unknown as EquipmentCustodyCloseContextRegistry,
    );
    const run = () =>
      service.returnFromCustody(tx as unknown as Prisma.TransactionClient, c);
    const replay = () => {
      repo.findPhysicalEventByOrigin.mockResolvedValue(event);
      custody.closedAt = closedAt;
      custody.closedById = c.actorId;
    };
    return {
      c,
      asset,
      custody,
      opening,
      event,
      tx,
      repo,
      history,
      contexts,
      run,
      replay,
      closedAt,
    };
  }
  it('locks Asset before Custody, validates tx context, then writes custody/Asset/event with one timestamp', async () => {
    const f = fixture();
    expect(await f.run()).toMatchObject({
      outcome: 'CLOSED',
      revisionBefore: 1,
      revisionAfter: 2,
      closedAt: f.closedAt,
      activeCustodyIdBefore: f.c.custodyId,
      activeCustodyIdAfter: null,
    });
    expect(
      f.repo.lockAssetForPhysicalMutation.mock.invocationCallOrder[0],
    ).toBeLessThan(f.repo.lockCustodyForClose.mock.invocationCallOrder[0]);
    expect(f.contexts.validate).toHaveBeenCalledWith(
      f.tx,
      f.c,
      equipmentCustodyCloseHash(f.c),
      'APPLY',
    );
    expect(f.repo.closeCustodyCas).toHaveBeenCalledWith(
      f.tx,
      f.custody,
      f.closedAt,
      f.c.actorId,
    );
    expect(f.repo.closeCustodyCas.mock.invocationCallOrder[0]).toBeLessThan(
      f.repo.closeAssetFromCustodyCas.mock.invocationCallOrder[0],
    );
    expect(
      f.repo.closeAssetFromCustodyCas.mock.invocationCallOrder[0],
    ).toBeLessThan(f.history.appendCustodyClose.mock.invocationCallOrder[0]);
    expect(f.history.appendCustodyClose).toHaveBeenCalledTimes(1);
    expect(f.history.appendCustodyClose).toHaveBeenCalledWith(
      f.tx,
      f.asset,
      f.c,
      equipmentCustodyCloseHash(f.c),
      f.closedAt,
    );
  });
  it('requires Company lock before any Asset or Custody lock', async () => {
    const f = fixture();
    f.tx.$queryRaw.mockReset().mockResolvedValue([{ held: false }]);
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
    expect(f.repo.lockAssetForPhysicalMutation).not.toHaveBeenCalled();
  });
  it('uses validated correction hash/date for custody and event, preserving the temporal guard', async () => {
    const f = fixture();
    f.c.validatedContext.adapterKey = 'CASE_DISPATCH_CORRECTION_ITEM';
    f.c.durableOrigin.type = 'CASE_DISPATCH_CORRECTION_ITEM';
    f.c.durableOrigin.operation = 'COMPENSATE_NO_HANDOFF_EQUIPMENT';
    const at = new Date('2026-10-01T12:00:00Z');
    const hash = 'a'.repeat(64);
    f.contexts.dispatchCorrectionMetadata.mockResolvedValue({
      requestHash: hash,
      closedAt: at,
    });
    await f.run();
    expect(f.contexts.dispatchCorrectionMetadata).toHaveBeenCalledWith(
      f.tx,
      f.c,
      'APPLY',
    );
    expect(f.repo.closeCustodyCas).toHaveBeenCalledWith(
      f.tx,
      f.custody,
      at,
      f.c.actorId,
    );
    expect(f.history.appendCustodyClose).toHaveBeenCalledWith(
      f.tx,
      f.asset,
      f.c,
      hash,
      at,
    );
  });
  it.each(['before opening', 'future'] as const)(
    'rejects correction date %s without writes',
    async (when) => {
      const f = fixture();
      f.c.durableOrigin.type = 'CASE_DISPATCH_CORRECTION_ITEM';
      f.contexts.dispatchCorrectionMetadata.mockResolvedValue({
        requestHash: 'a'.repeat(64),
        closedAt: when === 'future' ? new Date('2027-01-01Z') : new Date(0),
      });
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
      );
      expect(f.repo.closeCustodyCas).not.toHaveBeenCalled();
    },
  );
  it('uses the persisted correction hash on historical close replay without new writes', async () => {
    const f = fixture();
    f.c.durableOrigin.type = 'CASE_DISPATCH_CORRECTION_ITEM';
    f.event.originType = f.c.durableOrigin.type;
    f.event.requestHash = 'b'.repeat(64);
    f.contexts.dispatchCorrectionMetadata.mockResolvedValue({
      requestHash: f.event.requestHash,
      closedAt: f.closedAt,
    });
    f.replay();
    f.asset.physicalRevision = 99;
    await expect(f.run()).resolves.toHaveProperty('outcome', 'REPLAY');
    expect(f.contexts.dispatchCorrectionMetadata).toHaveBeenCalledWith(
      f.tx,
      f.c,
      'REPLAY',
    );
    expect(f.repo.closeCustodyCas).not.toHaveBeenCalled();
    expect(f.history.appendCustodyClose).not.toHaveBeenCalled();
  });
  it.each(['activeCustodyId', 'physicalLocation', 'physicalRevision'] as const)(
    'rejects current %s mismatch on APPLY',
    async (key) => {
      const f = fixture();
      Object.assign(f.asset, {
        [key]: key === 'physicalRevision' ? 2 : 'different',
      });
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        'RESOURCE_STATE_CHANGED',
      );
      expect(f.repo.closeCustodyCas).not.toHaveBeenCalled();
    },
  );
  it.each(['equipmentAssetId', 'caseId', 'assignmentId'] as const)(
    'rejects historical %s mismatch',
    async (key) => {
      const f = fixture();
      f.custody[key] = randomUUID();
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        'RESOURCE_STATE_CHANGED',
      );
    },
  );
  it('rejects broken history before writes', async () => {
    const f = fixture();
    f.opening.revisionBefore = 4;
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
    expect(f.repo.closeCustodyCas).not.toHaveBeenCalled();
  });
  it('does not require ACTIVE or GOOD for close', async () => {
    const f = fixture();
    f.asset.lifecycle = 'RETIRED';
    f.asset.condition = 'OUT_OF_SERVICE';
    f.opening.lifecycleAfter = 'RETIRED';
    f.opening.conditionAfter = 'OUT_OF_SERVICE';
    await expect(f.run()).resolves.toHaveProperty('outcome', 'CLOSED');
  });
  it('replays historical result despite later Asset state, actor or events', async () => {
    const f = fixture();
    f.replay();
    f.asset.physicalRevision = 99;
    f.asset.condition = 'OUT_OF_SERVICE';
    f.asset.lifecycle = 'RETIRED';
    f.asset.activeCustodyId = randomUUID();
    f.c.actorId = randomUUID();
    const r = await f.run();
    expect(r).toMatchObject({
      outcome: 'REPLAY',
      revisionAfter: 2,
      conditionAfter: 'DAMAGED',
      lifecycleAfter: 'ACTIVE',
      closedById: f.event.actorId,
    });
    expect(f.tx.equipmentAssetPhysicalEvent.findMany).not.toHaveBeenCalled();
    expect(f.repo.lockCustodyForClose).not.toHaveBeenCalled();
    expect(f.repo.closeCustodyCas).not.toHaveBeenCalled();
    expect(f.history.appendCustodyClose).not.toHaveBeenCalled();
    expect(f.contexts.validate).toHaveBeenCalledWith(
      f.tx,
      f.c,
      f.event.requestHash,
      'REPLAY',
    );
  });
  it('hash mismatch precedes adapter and witness checks', async () => {
    const f = fixture();
    f.replay();
    f.event.requestHash = 'x';
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'IDEMPOTENCY_KEY_REUSED',
    );
    expect(f.contexts.validate).not.toHaveBeenCalled();
  });
  it.each([
    'operation',
    'hashVersion',
    'originType',
    'originId',
    'originOperation',
    'companyId',
    'equipmentAssetId',
    'custodyId',
    'revisionBefore',
    'revisionAfter',
    'physicalLocationBefore',
    'physicalLocationAfter',
    'conditionAfter',
    'lifecycleAfter',
    'actorId',
    'createdAt',
  ] as const)('rejects corrupt historical witness %s', async (field) => {
    const f = fixture();
    f.replay();
    Object.assign(f.event, {
      [field]:
        field === 'createdAt'
          ? new Date(0)
          : typeof f.event[field] === 'number'
            ? 42
            : field === 'actorId'
              ? null
              : 'corrupt',
    });
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
    expect(f.repo.closeCustodyCas).not.toHaveBeenCalled();
  });
  it.each(['closedAt', 'closedById'] as const)(
    'rejects corrupt custody %s on replay',
    async (field) => {
      const f = fixture();
      f.replay();
      Object.assign(f.custody, { [field]: null });
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
      );
    },
  );
  it('maps database errors without leaking SQL', async () => {
    const f = fixture();
    f.repo.closeCustodyCas.mockRejectedValue(new Error('secret SQL'));
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
  });
});
