import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  EquipmentCustodyCloseCommand,
  equipmentCustodyCloseHash,
} from '../../equipment/equipment-custody-close.contract';
import { HealthcareCaseReconciliationEquipmentContextAdapter } from './healthcare-case-reconciliation-equipment-context.adapter';

describe('productive Reconciliation Equipment close evidence', () => {
  function fixture() {
    const itemId = randomUUID(),
      companyId = randomUUID(),
      caseId = randomUUID(),
      assetId = randomUUID(),
      assignmentId = randomUUID(),
      custodyId = randomUUID(),
      actorId = randomUUID(),
      dispatchId = randomUUID(),
      rootId = randomUUID(),
      kitId = randomUUID();
    const c: EquipmentCustodyCloseCommand = {
      companyId,
      caseId,
      assetId,
      assignmentId,
      custodyId,
      actorId,
      expectedPhysicalRevision: 7,
      reportedCondition: 'DAMAGED',
      validatedContext: {
        adapterKey: 'CASE_RECONCILIATION_ITEM',
        contextId: itemId,
      },
      durableOrigin: {
        type: 'CASE_RECONCILIATION_ITEM',
        id: itemId,
        operation: 'CONFIRM_EQUIPMENT_RETURN',
      },
    };
    const root = {
      id: rootId,
      companyId,
      caseId,
      caseKitId: kitId,
      dispatchId,
      status: 'DRAFT',
      revision: 4,
      confirmedFromRevision: null,
      confirmedById: null,
      confirmedAt: null,
      snapshot: null,
    };
    const custody = {
      id: custodyId,
      companyId,
      caseId,
      equipmentAssetId: assetId,
      assignmentId,
      closedAt: null,
      closedById: null,
    };
    const item = {
      id: itemId,
      companyId,
      caseId,
      lifecycle: 'ACTIVE',
      type: 'EQUIPMENT',
      outcome: 'RETURNED',
      assetId,
      assignmentId,
      equipmentCustodyId: custodyId,
      expectedPhysicalRevision: 7,
      reportedCondition: 'DAMAGED',
      closePhysicalEventId: null,
      reconciliation: root,
      sourceDispatchItem: {
        companyId,
        caseId,
        dispatchId,
        lifecycle: 'ACTIVE',
        type: 'EQUIPMENT',
        assetId,
        assignmentId,
        equipmentCustodyId: custodyId,
        dispatch: { companyId, caseId, caseKitId: kitId, status: 'CONFIRMED' },
      },
      equipmentCustody: custody,
      assignment: {
        companyId,
        caseId,
        equipmentAssetId: assetId,
        lifecycle: 'RELEASED',
      },
    };
    const audit = {
      actorId,
      createdAt: new Date(),
      change: { version: 1, operation: 'CONFIRM' },
    };
    const evidence = {
      item: jest.fn().mockResolvedValue(item),
      audit: jest.fn().mockResolvedValue(audit),
      claim: jest.fn().mockResolvedValue({ id: randomUUID() }),
      actor: jest.fn().mockResolvedValue({ id: actorId }),
    };
    const adapter = new HealthcareCaseReconciliationEquipmentContextAdapter(
      evidence,
    );
    const run = (mode: 'APPLY' | 'REPLAY' = 'APPLY') =>
      adapter.validate(
        {} as Prisma.TransactionClient,
        c,
        equipmentCustodyCloseHash(c),
        mode,
      );
    return { c, item, root, custody, audit, evidence, run };
  }
  it('proves APPLY using same-tx claim/audit and historical RELEASED Assignment', async () => {
    const f = fixture();
    expect(await f.run()).toMatchObject({
      companyId: f.c.companyId,
      custodyId: f.c.custodyId,
      actorId: f.c.actorId,
      contextId: f.item.id,
      requestHash: equipmentCustodyCloseHash(f.c),
    });
    expect(f.evidence.claim).toHaveBeenCalledWith(
      {},
      f.c.companyId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      null,
    );
  });
  it.each([
    'companyId',
    'caseId',
    'assetId',
    'assignmentId',
    'equipmentCustodyId',
    'expectedPhysicalRevision',
    'reportedCondition',
    'lifecycle',
    'type',
    'outcome',
  ] as const)('rejects mismatched item %s', async (key) => {
    const f = fixture();
    Object.assign(f.item, {
      [key]: key === 'expectedPhysicalRevision' ? 6 : 'wrong',
    });
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
  });
  it.each([
    'companyId',
    'caseId',
    'caseKitId',
    'dispatchId',
    'status',
  ] as const)('rejects root %s mismatch', async (key) => {
    const f = fixture();
    Object.assign(f.root, { [key]: 'wrong' });
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
  });
  it.each(['item', 'audit', 'claim', 'actor'] as const)(
    'fails closed without %s evidence',
    async (key) => {
      const f = fixture();
      f.evidence[key].mockResolvedValue(null);
      await expect(f.run()).rejects.toHaveProperty(
        'code',
        key === 'actor'
          ? 'EQUIPMENT_PHYSICAL_ACTOR_INVALID'
          : 'RESOURCE_STATE_CHANGED',
      );
    },
  );
  it('does not accept a foreign audit actor', async () => {
    const f = fixture();
    f.audit.actorId = randomUUID();
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
  });
  it('REPLAY rejects a DRAFT root', async () => {
    await expect(fixture().run('REPLAY')).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
  });
  it('APPLY requires custody open', async () => {
    const f = fixture();
    Object.assign(f.custody, { closedAt: new Date(), closedById: f.c.actorId });
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
  });
  it('rejects arbitrary context/origin binding', async () => {
    const f = fixture();
    f.c.durableOrigin.id = randomUUID();
    await expect(f.run()).rejects.toHaveProperty(
      'code',
      'RESOURCE_STATE_CHANGED',
    );
    expect(f.evidence.item).not.toHaveBeenCalled();
  });
});
