import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentPhysicalLocation,
  HealthcareCaseReconciliationEquipmentOutcome as Outcome,
} from '@prisma/client';
import { healthcarePersistenceException } from '../common/healthcare-errors';
import {
  parseDispatchItemSnapshot,
  parseDispatchRootSnapshot,
} from '../case-dispatches/healthcare-case-dispatch.snapshot';
import {
  EquipmentObservation,
  ReconciliationAuditChange,
  ReconciliationItemSnapshot,
  ReconciliationRootSnapshot,
  ReconciliationOperation,
} from './healthcare-case-reconciliation.types';
export function reconciliationFailure(): never {
  throw healthcarePersistenceException();
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    return reconciliationFailure();
  return v as Record<string, unknown>;
}
function bounded(v: unknown, max = 32768) {
  const o = object(v);
  if (o.version !== 1 || Buffer.byteLength(JSON.stringify(v)) > max)
    return reconciliationFailure();
  return o;
}
function text(v: unknown, max = 128): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    return reconciliationFailure();
  return v;
}
function nullable(v: unknown) {
  return v === null ? null : text(v);
}
function date(v: unknown): string {
  const s = text(v, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(s) ||
    !Number.isFinite(Date.parse(s))
  )
    return reconciliationFailure();
  return s;
}
function integer(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 2147483647)
    return reconciliationFailure();
  return v;
}
function member<T extends string>(v: unknown, e: Record<string, T>): T {
  if (typeof v !== 'string' || !Object.values(e).includes(v as T))
    return reconciliationFailure();
  return v as T;
}
function exact(o: Record<string, unknown>, keys: string[]) {
  if (Object.keys(o).length !== keys.length || keys.some((k) => !(k in o)))
    reconciliationFailure();
}
function observation(v: unknown): EquipmentObservation {
  const o = object(v);
  return {
    condition: member(o.condition, EquipmentCondition),
    lifecycle: member(o.lifecycle, EquipmentLifecycle),
    location: member(o.location, EquipmentPhysicalLocation),
    revision: integer(o.revision),
  };
}
function intent(v: unknown) {
  const o = object(v);
  exact(o, ['outcome', 'reportedCondition']);
  const outcome = member(o.outcome, Outcome),
    reportedCondition =
      o.reportedCondition === null
        ? null
        : member(o.reportedCondition, EquipmentCondition);
  if ((outcome === 'RETURNED') !== (reportedCondition !== null))
    return reconciliationFailure();
  return { outcome, reportedCondition };
}
export function parseReconciliationRootSnapshot(
  v: unknown,
): ReconciliationRootSnapshot {
  const o = bounded(v),
    s = object(o.sourceDispatch),
    a = object(o.confirmedBy),
    f = object(o.episodeFacts);
  const note = o.observation === null ? null : text(o.observation, 1000);
  if (note !== null && note !== note.trim()) return reconciliationFailure();
  if (typeof f.hasPhysicalMutation !== 'boolean')
    return reconciliationFailure();
  return {
    version: 1,
    reconciliationId: text(o.reconciliationId),
    sourceDispatch: {
      id: text(s.id),
      caseId: text(s.caseId),
      caseKitId: text(s.caseKitId),
      history: parseDispatchRootSnapshot(s.history),
    },
    confirmedBy: {
      id: text(a.id),
      firstName: text(a.firstName, 256),
      lastName: text(a.lastName, 256),
    },
    confirmedAt: date(o.confirmedAt),
    observation: note,
    episodeFacts: {
      materialItemCount: integer(f.materialItemCount),
      equipmentItemCount: integer(f.equipmentItemCount),
      hasPhysicalMutation: f.hasPhysicalMutation,
    },
  };
}
export function parseReconciliationItemSnapshot(
  v: unknown,
): ReconciliationItemSnapshot {
  const o = bounded(v),
    base = {
      version: 1 as const,
      sourceDispatchItemId: text(o.sourceDispatchItemId),
      history: parseDispatchItemSnapshot(o.history),
      dispatchedQty: o.dispatchedQty === null ? null : integer(o.dispatchedQty),
      capturedAt: date(o.capturedAt),
    };
  if (o.result === null) return { ...base, result: null };
  const r = object(o.result);
  if (r.type === 'MATERIAL') {
    const s = object(r.source),
      result = {
        type: 'MATERIAL' as const,
        returnedQty: integer(r.returnedQty),
        usedQty: integer(r.usedQty),
        unresolvedBefore: integer(r.unresolvedBefore),
        unresolvedAfter: integer(r.unresolvedAfter),
        source: {
          positionId: text(s.positionId),
          revision: integer(s.revision),
          quantity: integer(s.quantity),
        },
        returnedDestinationPositionId: nullable(
          r.returnedDestinationPositionId,
        ),
        returnedPhysicalEffectId: nullable(r.returnedPhysicalEffectId),
        usedPhysicalEffectId: nullable(r.usedPhysicalEffectId),
      };
    if (
      base.dispatchedQty === null ||
      base.history.equipment !== null ||
      base.history.product.inventoryTracking !== 'QUANTITY' ||
      result.unresolvedBefore - result.returnedQty - result.usedQty !==
        result.unresolvedAfter ||
      result.source.quantity !== result.unresolvedBefore ||
      result.returnedQty > 0 !== (result.returnedPhysicalEffectId !== null) ||
      (result.returnedPhysicalEffectId !== null) !==
        (result.returnedDestinationPositionId !== null) ||
      result.usedQty > 0 !== (result.usedPhysicalEffectId !== null)
    )
      return reconciliationFailure();
    return { ...base, result };
  }
  if (r.type !== 'EQUIPMENT') return reconciliationFailure();
  const i = intent({
      outcome: r.outcome,
      reportedCondition: r.reportedCondition,
    }),
    before = observation(r.before),
    after = observation(r.after),
    close = nullable(r.closePhysicalEventId),
    closed = r.custodyClosedAt === null ? null : date(r.custodyClosedAt);
  if (
    base.dispatchedQty !== null ||
    !base.history.equipment ||
    before.location !== 'CUSTODY' ||
    (i.outcome === 'RETURNED' &&
      (!close ||
        !closed ||
        after.location !== 'WAREHOUSE' ||
        after.revision !== before.revision + 1 ||
        after.condition !== i.reportedCondition ||
        after.lifecycle !== before.lifecycle)) ||
    (i.outcome === 'UNRESOLVED' &&
      (close !== null ||
        closed !== null ||
        JSON.stringify(before) !== JSON.stringify(after)))
  )
    return reconciliationFailure();
  return {
    ...base,
    result: {
      type: 'EQUIPMENT',
      custodyId: text(r.custodyId),
      assignmentId: text(r.assignmentId),
      openPhysicalEventId: text(r.openPhysicalEventId),
      ...i,
      before,
      after,
      closePhysicalEventId: close,
      custodyClosedAt: closed,
    },
  };
}
export function parseReconciliationAuditChange(
  v: unknown,
  op: ReconciliationOperation,
): ReconciliationAuditChange {
  const o = bounded(v, 8192);
  if (o.operation !== op) return reconciliationFailure();
  if (op === 'CREATE' || op === 'ITEM_ADD' || op === 'CONFIRM') {
    exact(o, ['version', 'operation']);
    return { version: 1, operation: op };
  }
  if (op === 'ITEM_EXCLUDE' || op === 'CANCEL') {
    exact(o, ['version', 'operation', 'reason']);
    const reason = text(o.reason, 1000);
    if (reason !== reason.trim()) return reconciliationFailure();
    return { version: 1, operation: op, reason };
  }
  exact(o, ['version', 'operation', 'type', 'before', 'after']);
  if (o.type === 'EQUIPMENT')
    return {
      version: 1,
      operation: 'OUTCOME_SET',
      type: 'EQUIPMENT',
      before: intent(o.before),
      after: intent(o.after),
    };
  if (o.type !== 'MATERIAL') return reconciliationFailure();
  const qty = (v: unknown) => {
    const q = object(v);
    exact(q, ['returnedQty', 'usedQty']);
    return { returnedQty: integer(q.returnedQty), usedQty: integer(q.usedQty) };
  };
  return {
    version: 1,
    operation: 'OUTCOME_SET',
    type: 'MATERIAL',
    before: qty(o.before),
    after: qty(o.after),
  };
}
