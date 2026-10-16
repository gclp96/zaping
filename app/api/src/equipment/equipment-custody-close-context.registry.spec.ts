import { Prisma } from '@prisma/client';
import {
  EquipmentCustodyCloseContextAdapter,
  EquipmentCustodyCloseContextRegistry,
} from './equipment-custody-close-context.registry';
import { EquipmentCustodyCloseCommand } from './equipment-custody-close.contract';

describe('Equipment close context registry', () => {
  const tx = {} as Prisma.TransactionClient;
  const c: EquipmentCustodyCloseCommand = {
    companyId: 'company',
    assetId: 'asset',
    custodyId: 'custody',
    caseId: 'case',
    assignmentId: 'assignment',
    actorId: 'actor',
    expectedPhysicalRevision: 2,
    reportedCondition: 'GOOD',
    validatedContext: { adapterKey: 'TEST', contextId: 'context' },
    durableOrigin: { type: 'TEST_CLOSE', id: 'origin', operation: 'CLOSE' },
  };
  const proof = {
    companyId: c.companyId,
    assetId: c.assetId,
    custodyId: c.custodyId,
    caseId: c.caseId,
    assignmentId: c.assignmentId,
    actorId: c.actorId,
    contextId: c.validatedContext.contextId,
    originType: c.durableOrigin.type,
    originId: c.durableOrigin.id,
    originOperation: c.durableOrigin.operation,
    requestHash: 'hash',
  };
  const adapter = (): EquipmentCustodyCloseContextAdapter => ({
    key: 'TEST',
    originType: 'TEST_CLOSE',
    originOperation: 'CLOSE',
    validate: jest.fn().mockResolvedValue(proof),
  });
  it.each(['APPLY', 'REPLAY'] as const)(
    'empty production registry fails closed for %s',
    async (mode) => {
      await expect(
        new EquipmentCustodyCloseContextRegistry().validate(
          tx,
          c,
          'hash',
          mode,
        ),
      ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
    },
  );
  it.each(['APPLY', 'REPLAY'] as const)(
    'passes tx and %s to authenticated adapter',
    async (mode) => {
      const a = adapter();
      await new EquipmentCustodyCloseContextRegistry([a]).validate(
        tx,
        c,
        'hash',
        mode,
      );
      expect(a.validate).toHaveBeenCalledWith(tx, c, 'hash', mode);
    },
  );
  it.each(Object.keys(proof) as (keyof typeof proof)[])(
    'rejects mismatched %s proof',
    async (key) => {
      const a = {
        ...adapter(),
        validate: jest.fn().mockResolvedValue({ ...proof, [key]: 'foreign' }),
      };
      await expect(
        new EquipmentCustodyCloseContextRegistry([a]).validate(
          tx,
          c,
          'hash',
          'APPLY',
        ),
      ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
    },
  );
  it('copies and freezes registrations', async () => {
    const list: EquipmentCustodyCloseContextAdapter[] = [];
    const registry = new EquipmentCustodyCloseContextRegistry(list);
    list.push(adapter());
    await expect(
      registry.validate(tx, c, 'hash', 'APPLY'),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
  });
  it('rejects duplicate and incompatible registrations', async () => {
    expect(
      () => new EquipmentCustodyCloseContextRegistry([adapter(), adapter()]),
    ).toThrow('Duplicate');
    await expect(
      new EquipmentCustodyCloseContextRegistry([
        { ...adapter(), originOperation: 'OTHER' },
      ]).validate(tx, c, 'hash', 'REPLAY'),
    ).rejects.toHaveProperty('code', 'RESOURCE_STATE_CHANGED');
  });
});
