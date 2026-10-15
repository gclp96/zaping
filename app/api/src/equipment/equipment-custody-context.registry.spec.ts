import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS,
  EquipmentCustodyCommand,
  EquipmentCustodyContextAdapter,
  EquipmentCustodyContextRegistry,
} from './equipment-custody-context.registry';

describe('Equipment custody context closed registry', () => {
  const tx = {} as Prisma.TransactionClient;
  const c: EquipmentCustodyCommand = {
    companyId: randomUUID(),
    assetId: randomUUID(),
    caseId: randomUUID(),
    assignmentId: randomUUID(),
    actorId: randomUUID(),
    expectedPhysicalRevision: 1,
    validatedContext: { adapterKey: 'TEST_ONLY', contextId: randomUUID() },
    durableOrigin: { type: 'TEST_ONLY', id: randomUUID(), operation: 'OPEN' },
  };
  const proof = {
    companyId: c.companyId,
    assetId: c.assetId,
    caseId: c.caseId,
    assignmentId: c.assignmentId,
    contextId: c.validatedContext.contextId,
    originId: c.durableOrigin.id,
    requestHash: 'a'.repeat(64),
  };
  const validate = jest.fn();
  const adapter: EquipmentCustodyContextAdapter = {
    key: 'TEST_ONLY',
    originType: 'TEST_ONLY',
    originOperation: 'OPEN',
    validate,
  };
  beforeEach(() => {
    validate.mockReset();
    validate.mockResolvedValue(proof);
  });
  it('rejects plausible arbitrary references in the default registry', async () => {
    await expect(
      new EquipmentCustodyContextRegistry().validate(
        tx,
        c,
        proof.requestHash,
        'APPLY',
      ),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_STATE_CHANGED' } });
    expect(validate).not.toHaveBeenCalled();
  });
  it('allows an explicit DI test adapter and passes replay mode/transaction', async () => {
    const module = await Test.createTestingModule({
      providers: [
        EquipmentCustodyContextRegistry,
        { provide: EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS, useValue: [adapter] },
      ],
    }).compile();
    await module
      .get(EquipmentCustodyContextRegistry)
      .validate(tx, c, proof.requestHash, 'REPLAY');
    expect(validate).toHaveBeenCalledWith(tx, c, proof.requestHash, 'REPLAY');
    await module.close();
  });
  it.each([
    'companyId',
    'assetId',
    'caseId',
    'assignmentId',
    'contextId',
    'originId',
    'requestHash',
  ] as const)('rejects mismatched proof %s', async (field) => {
    validate.mockResolvedValue({ ...proof, [field]: 'foreign' });
    await expect(
      new EquipmentCustodyContextRegistry([adapter]).validate(
        tx,
        c,
        proof.requestHash,
        'APPLY',
      ),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_STATE_CHANGED' } });
  });
  it('restricts origin namespaces to the selected trusted adapter', async () => {
    await expect(
      new EquipmentCustodyContextRegistry([adapter]).validate(
        tx,
        { ...c, durableOrigin: { ...c.durableOrigin, type: 'ARBITRARY' } },
        proof.requestHash,
        'APPLY',
      ),
    ).rejects.toThrow('RESOURCE_STATE_CHANGED');
    expect(validate).not.toHaveBeenCalled();
  });
  it('rejects ambiguous duplicate registration', () => {
    expect(
      () => new EquipmentCustodyContextRegistry([adapter, adapter]),
    ).toThrow('Duplicate');
  });
});
