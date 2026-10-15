import { healthcarePersistenceException } from '../common/healthcare-errors';
import {
  DispatchDetailRow,
  DispatchSummaryRow,
} from './healthcare-case-dispatches.repository';
import {
  parseDispatchAuditChange,
  parseDispatchItemSnapshot,
  parseDispatchRootSnapshot,
} from './healthcare-case-dispatch.snapshot';
function historical(row: DispatchSummaryRow) {
  if (row.status !== 'CONFIRMED') return null;
  if (row.snapshotVersion !== 1) throw healthcarePersistenceException();
  const s = parseDispatchRootSnapshot(row.snapshot);
  if (
    s.case.id !== row.caseId ||
    s.dispatchedBy.id !== row.confirmedBy?.id ||
    s.custodian.type !== row.custodianType ||
    s.custodian.userId !== row.custodianUserId ||
    s.custodian.displayName !== row.custodianDisplayName ||
    new Date(s.dispatchedAt).getTime() !== row.confirmedAt?.getTime()
  )
    throw healthcarePersistenceException();
  return s;
}
export function mapDispatchSummary(row: DispatchSummaryRow) {
  const s = historical(row);
  return {
    id: row.id,
    caseId: row.caseId,
    caseKitId: row.caseKitId,
    status: row.status,
    revision: row.revision,
    custodian: s?.custodian ?? {
      type: row.custodianType,
      userId: row.custodianUserId,
      displayName: row.custodianDisplayName,
    },
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    dispatchedBy: s?.dispatchedBy ?? null,
    dispatchedAt: s?.dispatchedAt ?? null,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}
export function mapDispatchDetail(row: DispatchDetailRow) {
  const s = historical(row);
  return {
    ...mapDispatchSummary(row),
    confirmedFromRevision: row.confirmedFromRevision,
    cancellationReason: row.cancellationReason,
    case: s?.case ?? {
      ...row.healthcareCase,
      scheduledStart: row.healthcareCase.scheduledStart?.toISOString() ?? null,
      scheduledEnd: row.healthcareCase.scheduledEnd?.toISOString() ?? null,
    },
    items: row.items.map((i) => {
      const snap = s ? parseDispatchItemSnapshot(i.snapshot) : null;
      if (
        snap &&
        (snap.product.id !== i.productId ||
          snap.preparation.sourceCaseKitItemId !== i.sourceCaseKitItemId ||
          snap.preparation.assignmentId !== i.assignmentId ||
          (i.type === 'MATERIAL' && (snap.batch?.id ?? null) !== i.batchId) ||
          (i.type === 'EQUIPMENT' && snap.equipment?.id !== i.assetId))
      )
        throw healthcarePersistenceException();
      return {
        id: i.id,
        type: i.type,
        lifecycle: i.lifecycle,
        quantity: i.quantity,
        product: snap ? snap.product : i.product,
        batch: snap
          ? snap.batch
          : i.batch
            ? {
                ...i.batch,
                expirationDate: i.batch.expirationDate?.toISOString() ?? null,
              }
            : null,
        equipment: snap ? snap.equipment : i.asset,
        preparation: snap
          ? snap.preparation
          : {
              sourceCaseKitItemId: i.sourceCaseKitItem.id,
              requirementId: i.sourceCaseKitItem.requirementId,
              assignmentId: i.sourceCaseKitItem.equipmentAssignmentId,
              preparedQuantity: i.sourceCaseKitItem.preparedQuantity,
            },
        sourcePositionId: i.sourcePositionId,
        expectedPositionRevision: i.expectedPositionRevision,
        destinationPositionId: i.destinationPositionId,
        physicalEffectId: i.physicalEffectId,
        assignmentId: i.assignmentId,
        assetId: i.assetId,
        expectedPhysicalRevision: i.expectedPhysicalRevision,
        equipmentCustodyId: i.equipmentCustodyId,
        equipmentPhysicalEventId: i.equipmentPhysicalEventId,
        addedBy: i.addedBy,
        createdAt: i.createdAt.toISOString(),
        excludedBy: i.excludedBy,
        excludedAt: i.excludedAt?.toISOString() ?? null,
        exclusionReason: i.exclusionReason,
      };
    }),
    audit: row.audit.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      change: parseDispatchAuditChange(a.change, a.operation),
    })),
  };
}
