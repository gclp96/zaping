import { createHash } from 'node:crypto';
import { normalizeHealthcareDisplayText } from '../common/healthcare-normalization';
import {
  DispatchCommandContext,
  DispatchCommandIntent,
} from './healthcare-case-dispatch-command.types';
import { DispatchCustodianDto } from './dto/create-healthcare-case-dispatch.dto';
export function createDispatchConfirmRequestHash(
  c: DispatchCommandContext,
  expectedRevision: number,
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        operation: 'CONFIRM',
        companyId: c.companyId,
        caseId: c.caseId,
        dispatchId: c.dispatchId,
        expectedRevision,
      }),
    )
    .digest('hex');
}
export function normalizeDispatchCustodian(c: DispatchCustodianDto) {
  return {
    type: c.type,
    displayName: normalizeHealthcareDisplayText(c.displayName),
    userId: c.userId ?? null,
  };
}
export function createDispatchRequestHash(
  c: DispatchCommandContext,
  i: DispatchCommandIntent,
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
      custodian: normalizeDispatchCustodian(i.dto.custodian),
    };
  else {
    const b = {
      ...base,
      dispatchId: c.dispatchId,
      expectedRevision: i.dto.expectedRevision,
    };
    switch (i.operation) {
      case 'CUSTODIAN_SET':
        payload = {
          ...b,
          custodian: normalizeDispatchCustodian(i.dto.custodian),
        };
        break;
      case 'ITEM_ADD':
        payload =
          i.dto.type === 'MATERIAL'
            ? {
                ...b,
                type: i.dto.type,
                sourceCaseKitItemId: i.dto.sourceCaseKitItemId,
                quantity: i.dto.quantity,
                sourcePositionId: i.dto.sourcePositionId,
                batchId: i.dto.batchId,
              }
            : {
                ...b,
                type: i.dto.type,
                sourceCaseKitItemId: i.dto.sourceCaseKitItemId,
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
