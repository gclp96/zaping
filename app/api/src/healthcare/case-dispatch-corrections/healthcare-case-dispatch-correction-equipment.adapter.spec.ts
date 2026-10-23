import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { HealthcareCaseDispatchCorrectionEquipmentAdapter } from './healthcare-case-dispatch-correction-equipment.adapter';
import {
  createDispatchCorrectionRequestHash,
  DISPATCH_CORRECTION_SCOPE,
} from './healthcare-case-dispatch-correction.contract';
import { EquipmentCustodyCloseContextRegistry } from '../../equipment/equipment-custody-close-context.registry';
import { EquipmentCustodyCloseCommand } from '../../equipment/equipment-custody-close.contract';
import { EquipmentCustodyCloseService } from '../../equipment/equipment-custody-close.service';
import { EquipmentPhysicalRepository } from '../../equipment/equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from '../../equipment/equipment-physical-history.service';

function setup() {
  const companyId = randomUUID(),
    caseId = randomUUID(),
    dispatchId = randomUUID(),
    actorId = randomUUID(),
    assetId = randomUUID(),
    custodyId = randomUUID(),
    assignmentId = randomUUID(),
    itemId = randomUUID(),
    sourceId = randomUUID(),
    rootId = randomUUID(),
    kitId = randomUUID();
  const openedAt = new Date('2026-10-01Z'),
    at = new Date('2026-10-02Z');
  const root = {
    id: rootId,
    companyId,
    caseId,
    dispatchId,
    caseKitId: kitId,
    kind: 'NO_PHYSICAL_HANDOFF',
    status: 'CONFIRMED',
    reason: 'Sin entrega 🚑',
    attestedNoHandoff: true as const,
    hashVersion: 1,
    snapshotVersion: 1,
    confirmedById: actorId,
    confirmedAt: at,
    snapshot: null as unknown,
    requestHash: '',
    idempotencyRecordId: randomUUID(),
    idempotencyRecord: {
      id: '',
      companyId,
      scope: DISPATCH_CORRECTION_SCOPE,
      resourceId: rootId,
      requestHash: '',
      key: 'key',
    },
  };
  root.requestHash = createDispatchCorrectionRequestHash(root);
  Object.assign(root.idempotencyRecord, {
    id: root.idempotencyRecordId,
    requestHash: root.requestHash,
  });
  const source = {
    id: sourceId,
    companyId,
    caseId,
    dispatchId,
    caseKitId: kitId,
    lifecycle: 'ACTIVE',
    type: 'EQUIPMENT',
    assetId,
    productId: randomUUID(),
    assignmentId,
    equipmentCustodyId: custodyId,
    equipmentPhysicalEventId: randomUUID(),
    expectedPhysicalRevision: 0,
    snapshot: {},
    dispatch: {
      id: dispatchId,
      companyId,
      caseId,
      caseKitId: kitId,
      status: 'CONFIRMED',
      snapshot: {},
      confirmedAt: openedAt,
      confirmedById: actorId,
    },
    assignment: {
      id: assignmentId,
      companyId,
      caseId,
      equipmentAssetId: assetId,
    },
  };
  const open = {
    id: source.equipmentPhysicalEventId,
    companyId,
    equipmentAssetId: assetId,
    custodyId,
    operation: 'CUSTODY_OPEN',
    originType: 'CASE_DISPATCH_ITEM',
    originId: sourceId,
    originOperation: 'CONFIRM_EQUIPMENT',
    actorId,
    revisionBefore: 0,
    revisionAfter: 1,
    physicalLocationBefore: 'WAREHOUSE',
    physicalLocationAfter: 'CUSTODY',
    conditionAfter: 'GOOD',
    lifecycleAfter: 'ACTIVE',
    createdAt: openedAt,
  };
  const custody = {
    id: custodyId,
    companyId,
    equipmentAssetId: assetId,
    caseId,
    assignmentId,
    openedAt,
    openedById: actorId,
    closedAt: null as Date | null,
    closedById: null as string | null,
  };
  const close = {
    id: randomUUID(),
    companyId,
    equipmentAssetId: assetId,
    custodyId,
    operation: 'CUSTODY_CLOSE',
    hashVersion: 1,
    originType: 'CASE_DISPATCH_CORRECTION_ITEM',
    originId: itemId,
    originOperation: 'COMPENSATE_NO_HANDOFF_EQUIPMENT',
    requestHash: root.requestHash,
    actorId,
    createdAt: at,
    revisionBefore: 1,
    revisionAfter: 2,
    conditionBefore: 'GOOD',
    conditionAfter: 'GOOD',
    lifecycleBefore: 'ACTIVE',
    lifecycleAfter: 'ACTIVE',
    physicalLocationBefore: 'CUSTODY',
    physicalLocationAfter: 'WAREHOUSE',
  };
  const item = {
    id: itemId,
    companyId,
    correctionId: rootId,
    dispatchId,
    sourceDispatchItemId: sourceId,
    type: 'EQUIPMENT',
    assetId,
    equipmentCustodyId: custodyId,
    openPhysicalEventId: open.id,
    closePhysicalEventId: null as string | null,
    snapshot: null as unknown,
    correction: root,
    sourceDispatchItem: source,
    equipmentCustody: custody,
    openPhysicalEvent: open,
    closePhysicalEvent: null as typeof close | null,
  };
  const asset = {
    id: assetId,
    companyId,
    productId: source.productId,
    physicalLocation: 'CUSTODY',
    activeCustodyId: custodyId,
    physicalRevision: 1,
    condition: 'GOOD',
    lifecycle: 'ACTIVE',
  };
  const tx = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: actorId, role: 'ADMIN' }),
    },
    healthcareCaseDispatchCorrectionItem: {
      findFirst: jest.fn().mockResolvedValue(item),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ valid: true }]),
    healthcareCaseReconciliation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    equipmentAssetPhysicalEvent: { count: jest.fn().mockResolvedValue(0) },
    equipmentAsset: { findFirst: jest.fn().mockResolvedValue(asset) },
  };
  const c: EquipmentCustodyCloseCommand = {
    companyId,
    assetId,
    custodyId,
    caseId,
    assignmentId,
    expectedPhysicalRevision: 1,
    reportedCondition: 'GOOD',
    actorId,
    validatedContext: {
      adapterKey: 'CASE_DISPATCH_CORRECTION_ITEM',
      contextId: itemId,
    },
    durableOrigin: {
      type: close.originType,
      id: itemId,
      operation: close.originOperation,
    },
  };
  const registry = new EquipmentCustodyCloseContextRegistry([
    new HealthcareCaseDispatchCorrectionEquipmentAdapter(),
  ]);
  const run = (mode: 'APPLY' | 'REPLAY' = 'APPLY') =>
    registry.dispatchCorrectionMetadata(
      tx as unknown as Prisma.TransactionClient,
      c,
      mode,
    );
  const replay = () => {
    root.snapshot = {};
    item.snapshot = {};
    item.closePhysicalEventId = close.id;
    item.closePhysicalEvent = close;
    custody.closedAt = at;
    custody.closedById = actorId;
  };
  return {
    tx,
    c,
    root,
    source,
    open,
    custody,
    close,
    item,
    asset,
    run,
    replay,
  };
}

describe('01D durable Equipment correction evidence', () => {
  it.each(['GOOD', 'INSPECTION_PENDING', 'DAMAGED', 'OUT_OF_SERVICE'] as const)(
    'real adapter/registry/close/history composition preserves %s and root metadata',
    async (condition) => {
      const f = setup();
      f.c.reportedCondition = condition;
      f.open.conditionAfter = condition;
      f.asset.condition = condition;
      f.asset.lifecycle = 'RETIRED';
      f.open.lifecycleAfter = 'RETIRED';
      f.tx.$queryRaw.mockResolvedValue([
        { valid: true, held: true, closedAt: new Date('2026-10-03Z') },
      ]);
      const tx = {
        ...f.tx,
        equipmentAssetCustody: {
          findMany: jest.fn().mockResolvedValue([f.custody]),
        },
        equipmentAssetPhysicalEvent: {
          ...f.tx.equipmentAssetPhysicalEvent,
          findMany: jest.fn().mockResolvedValue([f.open]),
        },
      };
      const repository = {
        lockAssetForPhysicalMutation: jest.fn().mockResolvedValue(f.asset),
        lockCustodyForClose: jest.fn().mockResolvedValue(f.custody),
        findPhysicalEventByOrigin: jest.fn().mockResolvedValue(null),
        closeCustodyCas: jest.fn().mockResolvedValue(undefined),
        closeAssetFromCustodyCas: jest.fn().mockResolvedValue(undefined),
        appendPhysicalEvent: jest
          .fn()
          .mockImplementation((_tx: unknown, data: Record<string, unknown>) =>
            Promise.resolve({ id: randomUUID(), ...data }),
          ),
      };
      const physical = repository as unknown as EquipmentPhysicalRepository;
      const service = new EquipmentCustodyCloseService(
        physical,
        new EquipmentPhysicalHistoryService(physical),
        new EquipmentCustodyCloseContextRegistry([
          new HealthcareCaseDispatchCorrectionEquipmentAdapter(),
        ]),
      );
      await expect(
        service.returnFromCustody(
          tx as unknown as Prisma.TransactionClient,
          f.c,
        ),
      ).resolves.toMatchObject({
        outcome: 'CLOSED',
        revisionBefore: 1,
        revisionAfter: 2,
        conditionBefore: condition,
        conditionAfter: condition,
        lifecycleBefore: 'RETIRED',
        lifecycleAfter: 'RETIRED',
        locationAfter: 'WAREHOUSE',
        activeCustodyIdAfter: null,
        closedAt: f.root.confirmedAt,
      });
      expect(repository.closeCustodyCas).toHaveBeenCalledWith(
        tx,
        f.custody,
        f.root.confirmedAt,
        f.c.actorId,
      );
      expect(repository.appendPhysicalEvent).toHaveBeenCalledTimes(1);
      expect(repository.appendPhysicalEvent).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          requestHash: f.root.requestHash,
          createdAt: f.root.confirmedAt,
          conditionBefore: condition,
          conditionAfter: condition,
          lifecycleBefore: 'RETIRED',
          lifecycleAfter: 'RETIRED',
          originType: 'CASE_DISPATCH_CORRECTION_ITEM',
          originId: f.item.id,
          originOperation: 'COMPENSATE_NO_HANDOFF_EQUIPMENT',
        }),
      );
    },
  );
  it.each(['GOOD', 'INSPECTION_PENDING', 'DAMAGED', 'OUT_OF_SERVICE'] as const)(
    'derives root hash/date preserving %s',
    async (condition) => {
      const f = setup();
      f.open.conditionAfter = condition;
      f.asset.condition = condition;
      f.c.reportedCondition = condition;
      await expect(f.run()).resolves.toEqual({
        requestHash: f.root.requestHash,
        closedAt: f.root.confirmedAt,
      });
    },
  );
  it.each(['SALES', 'WAREHOUSE', 'inactive', 'foreign'] as const)(
    'rejects %s actor',
    async () => {
      const f = setup();
      f.tx.user.findFirst.mockResolvedValue(null);
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        'EQUIPMENT_PHYSICAL_ACTOR_INVALID',
      );
      expect(f.tx.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: f.c.actorId,
          companyId: f.c.companyId,
          isActive: true,
          role: { in: ['ADMIN', 'MANAGER'] },
        },
      });
    },
  );
  it.each(['CONDITION_CHANGE', 'LIFECYCLE_CHANGE', 'CUSTODY_CLOSE'] as const)(
    'rejects later %s by revision, regardless of timestamp',
    async () => {
      const f = setup();
      f.tx.equipmentAssetPhysicalEvent.count.mockResolvedValue(1);
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        'RESOURCE_STATE_CHANGED',
      );
      expect(f.tx.equipmentAssetPhysicalEvent.count).toHaveBeenCalledWith({
        where: {
          companyId: f.c.companyId,
          equipmentAssetId: f.c.assetId,
          revisionAfter: { gt: 1 },
        },
      });
    },
  );
  it.each([
    'companyId',
    'caseId',
    'dispatchId',
    'requestHash',
    'confirmedById',
    'attestedNoHandoff',
  ] as const)('rejects invalid root %s', async (field) => {
    const f = setup();
    Object.assign(f.root, {
      [field]: field === 'attestedNoHandoff' ? false : randomUUID(),
    });
    await expect(f.run()).rejects.toBeDefined();
  });
  it.each([
    'assetId',
    'assignmentId',
    'equipmentCustodyId',
    'equipmentPhysicalEventId',
    'lifecycle',
  ] as const)('rejects mismatched source %s', async (field) => {
    const f = setup();
    Object.assign(f.source, { [field]: randomUUID() });
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
  });
  it('rejects stale revision, closed custody, incompatible RR and alien creating tx', async () => {
    const f = setup();
    f.c.expectedPhysicalRevision = 9;
    await expect(f.run()).rejects.toBeDefined();
    f.c.expectedPhysicalRevision = 1;
    f.custody.closedAt = f.root.confirmedAt;
    await expect(f.run()).rejects.toBeDefined();
    f.custody.closedAt = null;
    f.tx.healthcareCaseReconciliation.findFirst.mockResolvedValue({
      status: 'DRAFT',
    });
    await expect(f.run()).rejects.toBeDefined();
    f.tx.healthcareCaseReconciliation.findFirst.mockResolvedValue(null);
    f.tx.$queryRaw.mockResolvedValue([{ valid: false }]);
    await expect(f.run()).rejects.toBeDefined();
  });
  it('replays immutable evidence with a different authorized actor and no live Asset/history reads', async () => {
    const f = setup();
    f.replay();
    f.c.actorId = randomUUID();
    f.asset.physicalRevision = 100;
    await expect(f.run('REPLAY')).resolves.toEqual({
      requestHash: f.root.requestHash,
      closedAt: f.root.confirmedAt,
    });
    expect(f.tx.equipmentAsset.findFirst).not.toHaveBeenCalled();
    expect(f.tx.equipmentAssetPhysicalEvent.count).not.toHaveBeenCalled();
    expect(f.tx.healthcareCaseReconciliation.findFirst).not.toHaveBeenCalled();
  });
  it.each([
    'requestHash',
    'originId',
    'actorId',
    'custodyId',
    'conditionAfter',
    'revisionAfter',
    'createdAt',
  ] as const)('rejects orphan/corrupt replay %s', async (field) => {
    const f = setup();
    f.replay();
    Object.assign(f.close, {
      [field]:
        field === 'revisionAfter'
          ? 99
          : field === 'createdAt'
            ? new Date(0)
            : randomUUID(),
    });
    await expect(f.run('REPLAY')).rejects.toHaveProperty(
      'code',
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
  });
  it('empty registry cannot authorize correction metadata', async () => {
    const f = setup();
    await expect(
      new EquipmentCustodyCloseContextRegistry().dispatchCorrectionMetadata(
        f.tx as unknown as Prisma.TransactionClient,
        f.c,
        'APPLY',
      ),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
  });
});
