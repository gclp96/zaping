import {
  parseReconciliationAuditChange as audit,
  parseReconciliationItemSnapshot as item,
  parseReconciliationRootSnapshot as root,
} from './healthcare-case-reconciliation.snapshot';
const actor = { id: 'actor', firstName: 'Historical', lastName: 'Actor' };
const time = '2026-10-15T12:00:00.000Z';
const history = {
  version: 1,
  product: {
    id: 'product',
    sku: 'HISTORIC',
    name: 'Historic Product',
    inventoryTracking: 'QUANTITY',
    lotTracking: 'NONE',
  },
  preparation: {
    sourceCaseKitItemId: 'source',
    requirementId: null,
    assignmentId: null,
    preparedQuantity: 2,
  },
  batch: null,
  equipment: null,
};
const dispatchHistory = {
  version: 1,
  case: { id: 'case', folio: 'HC-1', scheduledStart: null, scheduledEnd: null },
  custodian: { type: 'EXTERNAL_PERSON', userId: null, displayName: 'Receiver' },
  dispatchedBy: actor,
  dispatchedAt: time,
};
const material = () => ({
  version: 1,
  sourceDispatchItemId: 'source',
  history,
  dispatchedQty: 2,
  capturedAt: time,
  result: {
    type: 'MATERIAL',
    returnedQty: 0,
    usedQty: 1,
    unresolvedBefore: 2,
    unresolvedAfter: 1,
    source: { positionId: 'custody', revision: 1, quantity: 2 },
    returnedDestinationPositionId: null,
    returnedPhysicalEffectId: null,
    usedPhysicalEffectId: 'used',
  },
});
const observation = {
  condition: 'GOOD',
  lifecycle: 'RETIRED',
  location: 'CUSTODY',
  revision: 4,
};
const equipment = () => ({
  version: 1,
  sourceDispatchItemId: 'source',
  history: {
    ...history,
    product: { ...history.product, inventoryTracking: 'ASSET' },
    equipment: { id: 'asset', assetCode: 'OLD', serialNumber: null },
  },
  dispatchedQty: null,
  capturedAt: time,
  result: {
    type: 'EQUIPMENT',
    custodyId: 'custody',
    assignmentId: 'assignment',
    openPhysicalEventId: 'open',
    outcome: 'UNRESOLVED',
    reportedCondition: null,
    before: observation,
    after: observation,
    closePhysicalEventId: null,
    custodyClosedAt: null,
  },
});
describe('Reconciliation bounded typed snapshots and audit', () => {
  it('parses historical root without current descriptions', () => {
    expect(
      root({
        version: 1,
        reconciliationId: 'rr',
        sourceDispatch: {
          id: 'dispatch',
          caseId: 'case',
          caseKitId: 'kit',
          history: dispatchHistory,
        },
        confirmedBy: actor,
        confirmedAt: time,
        observation: 'Pending review',
        episodeFacts: {
          materialItemCount: 1,
          equipmentItemCount: 0,
          hasPhysicalMutation: false,
        },
      }),
    ).toMatchObject({
      confirmedBy: actor,
      sourceDispatch: { history: dispatchHistory },
    });
  });
  it.each([
    null,
    {},
    [],
    { version: 2 },
    { version: 1, observation: 'x'.repeat(32769) },
  ])('rejects malformed root %p', (v) => {
    expect(() => root(v)).toThrow();
  });
  it('parses typed material results', () => {
    expect(item(material()).result).toMatchObject({
      type: 'MATERIAL',
      usedQty: 1,
      unresolvedAfter: 1,
    });
  });
  it('supports observational 0/0', () => {
    const v = material();
    Object.assign(v.result, {
      usedQty: 0,
      usedPhysicalEffectId: null,
      unresolvedAfter: 2,
    });
    expect(item(v).result).toMatchObject({ usedQty: 0 });
  });
  it.each([
    { usedQty: -1 },
    { usedQty: 2147483648 },
    { usedQty: 1.2 },
    { usedPhysicalEffectId: null },
    { returnedDestinationPositionId: 'dest' },
    { unresolvedAfter: 0 },
    { source: { positionId: 'p', revision: 0, quantity: 1 } },
  ])('rejects malformed material result %p', (patch) => {
    const v = material();
    Object.assign(v.result, patch);
    expect(() => item(v)).toThrow();
  });
  it('excluded descriptive snapshot has no result', () => {
    expect(item({ ...material(), result: null }).result).toBeNull();
  });
  it('UNRESOLVED preserves RETIRED physical observations', () => {
    expect(item(equipment()).result).toMatchObject({
      type: 'EQUIPMENT',
      before: { lifecycle: 'RETIRED' },
      closePhysicalEventId: null,
    });
  });
  it('RETURNED retains RETIRED and records inspection pending', () => {
    const v = equipment();
    Object.assign(v.result, {
      outcome: 'RETURNED',
      reportedCondition: 'INSPECTION_PENDING',
      after: {
        ...observation,
        condition: 'INSPECTION_PENDING',
        location: 'WAREHOUSE',
        revision: 5,
      },
      closePhysicalEventId: 'close',
      custodyClosedAt: time,
    });
    expect(item(v).result).toMatchObject({
      after: { lifecycle: 'RETIRED', condition: 'INSPECTION_PENDING' },
    });
  });
  it.each([
    { reportedCondition: 'GOOD' },
    { closePhysicalEventId: 'close' },
    { after: { ...observation, revision: 5 } },
  ])('rejects unresolved with physical mutation %p', (patch) => {
    const v = equipment();
    Object.assign(v.result, patch);
    expect(() => item(v)).toThrow();
  });
  it('rejects oversized item', () => {
    const v = material();
    v.history.product.name = 'x'.repeat(32769);
    expect(() => item(v)).toThrow();
  });
  it.each(['CREATE', 'ITEM_ADD', 'CONFIRM'] as const)(
    'parses minimal %s audit',
    (operation) => {
      expect(audit({ version: 1, operation }, operation)).toEqual({
        version: 1,
        operation,
      });
      expect(() =>
        audit({ version: 1, operation, request: 'body' }, operation),
      ).toThrow();
    },
  );
  it.each(['ITEM_EXCLUDE', 'CANCEL'] as const)(
    'parses reason-only %s audit',
    (operation) => {
      expect(
        audit({ version: 1, operation, reason: 'Reason' }, operation),
      ).toMatchObject({ reason: 'Reason' });
      expect(() =>
        audit({ version: 1, operation, reason: '  ' }, operation),
      ).toThrow();
    },
  );
  it('parses MATERIAL outcome audit', () => {
    const v = {
      version: 1,
      operation: 'OUTCOME_SET',
      type: 'MATERIAL',
      before: { returnedQty: 0, usedQty: 0 },
      after: { returnedQty: 1, usedQty: 2 },
    };
    expect(audit(v, 'OUTCOME_SET')).toEqual(v);
  });
  it('parses Equipment outcome audit', () => {
    const v = {
      version: 1,
      operation: 'OUTCOME_SET',
      type: 'EQUIPMENT',
      before: { outcome: 'UNRESOLVED', reportedCondition: null },
      after: { outcome: 'RETURNED', reportedCondition: 'DAMAGED' },
    };
    expect(audit(v, 'OUTCOME_SET')).toEqual(v);
  });
  it('does not add observation mutation semantics to audit', () => {
    expect(() =>
      audit(
        {
          version: 1,
          operation: 'OUTCOME_SET',
          type: 'MATERIAL',
          before: { returnedQty: 0, usedQty: 0 },
          after: { returnedQty: 1, usedQty: 0 },
          observationBefore: null,
          observationAfter: 'note',
        },
        'OUTCOME_SET',
      ),
    ).toThrow();
  });
  it.each([
    { version: 1, operation: 'CANCEL', reason: 'x'.repeat(8193) },
    { version: 2, operation: 'CREATE' },
    { operation: 'CREATE' },
    {
      version: 1,
      operation: 'OUTCOME_SET',
      type: 'EQUIPMENT',
      before: { outcome: 'UNRESOLVED', reportedCondition: 'GOOD' },
      after: { outcome: 'RETURNED', reportedCondition: null },
    },
  ])('rejects invalid audit %p', (v) => {
    expect(() =>
      audit(v, 'operation' in v ? (v.operation as 'CREATE') : 'CREATE'),
    ).toThrow();
  });
});
