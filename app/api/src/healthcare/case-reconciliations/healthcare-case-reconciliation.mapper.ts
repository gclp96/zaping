import {
  ReconciliationDetailRow,
  ReconciliationRow,
} from './healthcare-case-reconciliations.repository';
import {
  parseReconciliationAuditChange,
  parseReconciliationItemSnapshot,
  parseReconciliationRootSnapshot,
  reconciliationFailure,
} from './healthcare-case-reconciliation.snapshot';
import {
  parseDispatchItemSnapshot,
  parseDispatchRootSnapshot,
} from '../case-dispatches/healthcare-case-dispatch.snapshot';
export function mapReconciliation(row: ReconciliationRow) {
  const snapshot =
    row.status === 'CONFIRMED'
      ? parseReconciliationRootSnapshot(row.snapshot)
      : null;
  if (
    snapshot &&
    (row.snapshotVersion !== 1 ||
      snapshot.reconciliationId !== row.id ||
      snapshot.sourceDispatch.id !== row.dispatchId ||
      snapshot.sourceDispatch.caseId !== row.caseId ||
      snapshot.sourceDispatch.caseKitId !== row.caseKitId ||
      snapshot.confirmedBy.id !== row.confirmedBy?.id ||
      Date.parse(snapshot.confirmedAt) !== row.confirmedAt?.getTime() ||
      snapshot.observation !== row.observation)
  )
    reconciliationFailure();
  return {
    id: row.id,
    caseId: row.caseId,
    dispatchId: row.dispatchId,
    caseKitId: row.caseKitId,
    status: row.status,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    confirmedFromRevision: row.confirmedFromRevision,
    confirmedAt: row.confirmedAt,
    confirmedBy: snapshot?.confirmedBy ?? row.confirmedBy,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    observation: row.observation,
    sourceDispatch: snapshot?.sourceDispatch ?? {
      id: row.dispatch.id,
      caseId: row.dispatch.caseId,
      caseKitId: row.dispatch.caseKitId,
      history: parseDispatchRootSnapshot(row.dispatch.snapshot),
    },
    snapshot,
  };
}
export function mapReconciliationDetail(row: ReconciliationDetailRow) {
  const root = mapReconciliation(row);
  const items = row.items.map((i) => {
    const snapshot =
      row.status === 'CONFIRMED'
        ? parseReconciliationItemSnapshot(i.snapshot)
        : null;
    if (snapshot) {
      const r = snapshot.result;
      if (
        snapshot.sourceDispatchItemId !== i.sourceDispatchItemId ||
        snapshot.history.product.id !== i.sourceDispatchItem.productId ||
        snapshot.history.batch?.id !==
          (i.sourceDispatchItem.batchId ?? undefined) ||
        snapshot.history.equipment?.id !== (i.assetId ?? undefined) ||
        snapshot.dispatchedQty !== i.sourceDispatchItem.quantity ||
        Date.parse(snapshot.capturedAt) !== row.confirmedAt?.getTime() ||
        (i.lifecycle === 'EXCLUDED' && r !== null) ||
        (i.lifecycle === 'ACTIVE' && (!r || r.type !== i.type))
      )
        reconciliationFailure();
      if (
        r?.type === 'MATERIAL' &&
        (r.returnedQty !== i.returnedQty ||
          r.usedQty !== i.usedQty ||
          r.source.positionId !== i.sourceCustodyPositionId ||
          r.source.revision !== i.expectedSourceRevision ||
          r.returnedDestinationPositionId !== i.returnedDestinationPositionId ||
          r.returnedPhysicalEffectId !== i.returnedPhysicalEffectId ||
          r.usedPhysicalEffectId !== i.usedPhysicalEffectId)
      )
        reconciliationFailure();
      if (
        r?.type === 'EQUIPMENT' &&
        (r.custodyId !== i.equipmentCustodyId ||
          r.assignmentId !== i.assignmentId ||
          r.openPhysicalEventId !==
            i.sourceDispatchItem.equipmentPhysicalEventId ||
          r.before.revision !== i.expectedPhysicalRevision ||
          r.outcome !== i.outcome ||
          r.reportedCondition !== i.reportedCondition ||
          r.closePhysicalEventId !== i.closePhysicalEventId)
      )
        reconciliationFailure();
    }
    const {
      companyId: _company,
      createdById: _creator,
      excludedById: _excluded,
      snapshot: _raw,
      sourceDispatchItem: _source,
      ...metadata
    } = i;
    void _company;
    void _creator;
    void _excluded;
    void _raw;
    void _source;
    return {
      ...metadata,
      presentation:
        snapshot?.history ??
        parseDispatchItemSnapshot(i.sourceDispatchItem.snapshot),
      snapshot,
    };
  });
  if (root.snapshot) {
    const active = items.filter((i) => i.lifecycle === 'ACTIVE'),
      f = root.snapshot.episodeFacts;
    if (
      !active.length ||
      f.materialItemCount !==
        active.filter((i) => i.type === 'MATERIAL').length ||
      f.equipmentItemCount !==
        active.filter((i) => i.type === 'EQUIPMENT').length ||
      f.hasPhysicalMutation !==
        active.some(
          (i) =>
            !!(
              i.returnedPhysicalEffectId ||
              i.usedPhysicalEffectId ||
              i.closePhysicalEventId
            ),
        ) ||
      (!f.hasPhysicalMutation && !root.observation)
    )
      reconciliationFailure();
  }
  return {
    ...root,
    items,
    audit: row.audit.map((a) => ({
      ...a,
      change: parseReconciliationAuditChange(a.change, a.operation),
    })),
  };
}
