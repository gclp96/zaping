import { randomUUID } from 'node:crypto';
import {
  EquipmentCustodyCloseCommand,
  equipmentCustodyCloseHash,
  validateEquipmentCustodyClose,
  EQUIPMENT_CUSTODY_CLOSE_CONDITIONS,
} from './equipment-custody-close.contract';
import {
  EquipmentPhysicalError,
  MAX_EQUIPMENT_PHYSICAL_REVISION,
} from './equipment-physical.contract';

const command = (): EquipmentCustodyCloseCommand => ({
  companyId: randomUUID(),
  assetId: randomUUID(),
  custodyId: randomUUID(),
  caseId: randomUUID(),
  assignmentId: randomUUID(),
  actorId: randomUUID(),
  expectedPhysicalRevision: 2,
  reportedCondition: 'GOOD',
  validatedContext: { adapterKey: 'TEST', contextId: randomUUID() },
  durableOrigin: { type: 'TEST_CLOSE', id: randomUUID(), operation: 'CLOSE' },
});
describe('Equipment custody close contract', () => {
  it.each(EQUIPMENT_CUSTODY_CLOSE_CONDITIONS)(
    'accepts %s explicitly',
    (reportedCondition) =>
      expect(() =>
        validateEquipmentCustodyClose({ ...command(), reportedCondition }),
      ).not.toThrow(),
  );
  it.each(['UNKNOWN', '', null, undefined, ' good ', 1])(
    'rejects runtime condition %s',
    (reportedCondition) =>
      expect(() =>
        validateEquipmentCustodyClose({
          ...command(),
          reportedCondition,
        } as EquipmentCustodyCloseCommand),
      ).toThrow(EquipmentPhysicalError),
  );
  it.each([-1, 1.5, NaN, MAX_EQUIPMENT_PHYSICAL_REVISION])(
    'rejects unsafe revision %s',
    (expectedPhysicalRevision) =>
      expect(() =>
        validateEquipmentCustodyClose({
          ...command(),
          expectedPhysicalRevision,
        }),
      ).toThrow(EquipmentPhysicalError),
  );
  it('accepts last incrementable revision', () =>
    expect(() =>
      validateEquipmentCustodyClose({
        ...command(),
        expectedPhysicalRevision: MAX_EQUIPMENT_PHYSICAL_REVISION - 1,
      }),
    ).not.toThrow());
  it('canonicalizes field order and excludes retry actor', () => {
    const c = command();
    const hash = equipmentCustodyCloseHash(c);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      equipmentCustodyCloseHash(
        Object.fromEntries(
          Object.entries(c).reverse(),
        ) as EquipmentCustodyCloseCommand,
      ),
    ).toBe(hash);
    expect(equipmentCustodyCloseHash({ ...c, actorId: randomUUID() })).toBe(
      hash,
    );
  });
  it.each([
    'companyId',
    'assetId',
    'custodyId',
    'caseId',
    'assignmentId',
  ] as const)('binds %s', (field) => {
    const c = command();
    expect(equipmentCustodyCloseHash({ ...c, [field]: randomUUID() })).not.toBe(
      equipmentCustodyCloseHash(c),
    );
    expect(() =>
      validateEquipmentCustodyClose({ ...c, [field]: 'invalid' }),
    ).toThrow(EquipmentPhysicalError);
  });
  it('binds condition, revision, context and complete origin', () => {
    const c = command();
    for (const changed of [
      { ...c, reportedCondition: 'DAMAGED' as const },
      { ...c, expectedPhysicalRevision: 3 },
      {
        ...c,
        validatedContext: { ...c.validatedContext, contextId: randomUUID() },
      },
      {
        ...c,
        validatedContext: { ...c.validatedContext, adapterKey: 'OTHER' },
      },
      ...(['type', 'id', 'operation'] as const).map((field) => ({
        ...c,
        durableOrigin: { ...c.durableOrigin, [field]: randomUUID() },
      })),
    ])
      expect(equipmentCustodyCloseHash(changed)).not.toBe(
        equipmentCustodyCloseHash(c),
      );
  });
  it.each([
    'EQUIPMENT_CUSTODY_NOT_FOUND',
    'EQUIPMENT_CUSTODY_ALREADY_CLOSED',
  ] as const)('maps %s without SQL', (code) => {
    const error = new EquipmentPhysicalError(code);
    expect(error.getStatus()).toBe(
      code === 'EQUIPMENT_CUSTODY_NOT_FOUND' ? 404 : 409,
    );
    expect(error.getResponse()).toEqual({
      code,
      message: code,
      statusCode: error.getStatus(),
    });
  });
});
