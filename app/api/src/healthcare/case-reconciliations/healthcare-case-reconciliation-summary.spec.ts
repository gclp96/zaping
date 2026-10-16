import { healthcarePersistenceException } from '../common/healthcare-errors';
import { SummarySource } from './healthcare-case-reconciliations.repository';
import { deriveReconciliationSummary as derive } from './healthcare-case-reconciliation-summary';
function material(qty = 2, used = 0): SummarySource {
  return {
    id: 'source',
    companyId: 'company',
    caseId: 'case',
    type: 'MATERIAL',
    quantity: 2,
    productId: 'product',
    batchId: null,
    destinationPosition: {
      id: 'custody',
      companyId: 'company',
      productId: 'product',
      inventoryBatchId: null,
      state: 'CUSTODY',
      contextType: 'CASE_DISPATCH_ITEM',
      contextId: 'source',
      quantity: qty,
    },
    physicalEffect: {
      kind: 'TRANSFER',
      originType: 'CASE_DISPATCH',
      originId: 'dispatch',
      originOperation: 'CONFIRM_QUANTITY',
      lines: [{ positionId: 'custody', delta: 2 }],
    },
    reconciliationItems: used
      ? [
          {
            type: 'MATERIAL',
            sourceCustodyPositionId: 'custody',
            returnedQty: 0,
            usedQty: used,
            reconciliationId: 'rr',
            reconciliation: { confirmedById: 'actor' },
            returnedPhysicalEffect: null,
            usedPhysicalEffect: {
              companyId: 'company',
              originType: 'CASE_RECONCILIATION',
              originId: 'rr',
              originOperation: 'CONFIRM_USED',
              actorId: 'actor',
              kind: 'DEFINITIVE_OUT',
              lines: [{ positionId: 'custody', delta: -used }],
            },
          },
        ]
      : [],
  } as unknown as SummarySource;
}
function equipment(closed = false): SummarySource {
  return {
    id: 'eq',
    companyId: 'company',
    caseId: 'case',
    type: 'EQUIPMENT',
    assetId: 'asset',
    assignmentId: 'assignment',
    equipmentCustody: {
      id: 'custody',
      companyId: 'company',
      equipmentAssetId: 'asset',
      caseId: 'case',
      assignmentId: 'assignment',
      closedAt: closed ? new Date() : null,
      closedById: closed ? 'actor' : null,
    },
    equipmentPhysicalEvent: {
      operation: 'CUSTODY_OPEN',
      custodyId: 'custody',
      originType: 'CASE_DISPATCH_ITEM',
      originId: 'eq',
      originOperation: 'CONFIRM_EQUIPMENT',
    },
    asset: { activeCustodyId: 'custody', physicalLocation: 'CUSTODY' },
    reconciliationItems: closed
      ? [
          {
            id: 'item',
            type: 'EQUIPMENT',
            assetId: 'asset',
            assignmentId: 'assignment',
            equipmentCustodyId: 'custody',
            outcome: 'RETURNED',
            reportedCondition: 'INSPECTION_PENDING',
            expectedPhysicalRevision: 1,
            closePhysicalEventId: 'close',
            reconciliation: { confirmedById: 'actor' },
            closePhysicalEvent: {
              id: 'close',
              operation: 'CUSTODY_CLOSE',
              companyId: 'company',
              equipmentAssetId: 'asset',
              custodyId: 'custody',
              originType: 'CASE_RECONCILIATION_ITEM',
              originId: 'item',
              originOperation: 'CONFIRM_EQUIPMENT_RETURN',
              actorId: 'actor',
              revisionBefore: 1,
              revisionAfter: 2,
              conditionAfter: 'INSPECTION_PENDING',
              physicalLocationBefore: 'CUSTODY',
              physicalLocationAfter: 'WAREHOUSE',
              lifecycleBefore: 'RETIRED',
              lifecycleAfter: 'RETIRED',
            },
          },
        ]
      : [],
  } as unknown as SummarySource;
}
describe('Reconciliation derived physical summary integrity', () => {
  it('UNRECONCILED without physical progress', () => {
    expect(derive('dispatch', [material(), equipment()]).status).toBe(
      'UNRECONCILED',
    );
  });
  it('PARTIALLY_RECONCILED', () => {
    expect(derive('dispatch', [material(1, 1)]).status).toBe(
      'PARTIALLY_RECONCILED',
    );
  });
  it('FULLY_RECONCILED independent of pending inspection', () => {
    expect(derive('dispatch', [material(0, 2), equipment(true)]).status).toBe(
      'FULLY_RECONCILED',
    );
  });
  it('old closed custody permits later Asset redispatch', () => {
    const s = equipment(true);
    s.asset = { activeCustodyId: 'later-custody', physicalLocation: 'CUSTODY' };
    expect(derive('dispatch', [s]).status).toBe('FULLY_RECONCILED');
  });
  it('observational zero/zero counts no progress', () => {
    const s = material(2, 0);
    const r = material(2, 1).reconciliationItems[0];
    s.reconciliationItems = [{ ...r, usedQty: 0, usedPhysicalEffect: null }];
    expect(derive('dispatch', [s]).status).toBe('UNRECONCILED');
  });
  it.each([material(1, 0), material(0, 1), material(0, 3)])(
    'fails closed on business/physical quantity mismatch',
    (s) => {
      expect(() => derive('dispatch', [s])).toThrow(
        healthcarePersistenceException(),
      );
    },
  );
  it('requires durable effect origin', () => {
    const s = material(1, 1);
    s.reconciliationItems[0].usedPhysicalEffect!.originId = 'wrong';
    expect(() => derive('dispatch', [s])).toThrow();
  });
  it('rejects closed custody without business closure witness', () => {
    const s = equipment(true);
    s.reconciliationItems = [];
    expect(() => derive('dispatch', [s])).toThrow();
  });
  it('rejects duplicate physical closure witnesses', () => {
    const s = equipment(true);
    s.reconciliationItems.push({ ...s.reconciliationItems[0] });
    expect(() => derive('dispatch', [s])).toThrow();
  });
  it('open custody validates current pointer', () => {
    const s = equipment();
    s.asset!.activeCustodyId = 'foreign';
    expect(() => derive('dispatch', [s])).toThrow();
  });
  it('rejects wrong close evidence and revival', () => {
    const s = equipment(true);
    s.reconciliationItems[0].closePhysicalEvent!.lifecycleAfter = 'ACTIVE';
    expect(() => derive('dispatch', [s])).toThrow();
  });
  it('never makes empty Dispatch fully reconciled', () => {
    expect(() => derive('dispatch', [])).toThrow();
  });
});
