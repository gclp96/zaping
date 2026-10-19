import { createHash } from 'node:crypto';
export function createReconciliationConfirmRequestHash(
  c: { companyId: string; caseId: string; reconciliationId: string },
  expectedRevision: number,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        operation: 'CONFIRM',
        companyId: c.companyId,
        caseId: c.caseId,
        reconciliationId: c.reconciliationId,
        expectedRevision,
      }),
    )
    .digest('hex');
}
import {
  ReconciliationCommandContext,
  ReconciliationCommandIntent,
} from './healthcare-case-reconciliation-command.types';
export function createReconciliationRequestHash(
  c: ReconciliationCommandContext,
  i: ReconciliationCommandIntent,
) {
  const base = {
    version: 1,
    operation: i.operation,
    companyId: c.companyId,
    caseId: c.caseId,
  };
  let payload: object;
  if (i.operation === 'CREATE')
    payload = {
      ...base,
      dispatchId: i.dto.dispatchId,
      observation: i.dto.observation?.trim() ?? null,
    };
  else {
    const b = {
      ...base,
      reconciliationId: c.reconciliationId,
      expectedRevision: i.dto.expectedRevision,
    };
    switch (i.operation) {
      case 'ITEM_ADD':
        payload = { ...b, sourceDispatchItemId: i.dto.sourceDispatchItemId };
        break;
      case 'OUTCOME_SET':
        payload =
          i.dto.type === 'MATERIAL'
            ? {
                ...b,
                itemId: c.itemId,
                type: i.dto.type,
                returnedQty: i.dto.returnedQty,
                usedQty: i.dto.usedQty,
              }
            : {
                ...b,
                itemId: c.itemId,
                type: i.dto.type,
                outcome: i.dto.outcome,
                reportedCondition: i.dto.reportedCondition,
              };
        break;
      case 'ITEM_EXCLUDE':
        payload = { ...b, itemId: c.itemId, reason: i.dto.reason.trim() };
        break;
      case 'CANCEL':
        payload = { ...b, reason: i.dto.reason.trim() };
        break;
    }
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
