import { SummarySource } from './healthcare-case-reconciliations.repository';
import { reconciliationFailure as fail } from './healthcare-case-reconciliation.snapshot';
export function deriveReconciliationSummary(
  dispatchId: string,
  sources: SummarySource[],
) {
  let progress = false,
    remaining = false;
  // A returned effect may credit one canonical AVAILABLE Position for several sources.
  const destinationTotals = new Map<string, number>();
  for (const source of sources)
    for (const r of source.reconciliationItems) {
      if (r.returnedPhysicalEffectId && r.returnedDestinationPositionId) {
        const key =
          r.returnedPhysicalEffectId + ':' + r.returnedDestinationPositionId;
        destinationTotals.set(
          key,
          (destinationTotals.get(key) ?? 0) + (r.returnedQty ?? 0),
        );
      }
    }
  const items = sources.map((s) => {
    const rows = s.reconciliationItems;
    if (s.type === 'MATERIAL') {
      const p = s.destinationPosition,
        e = s.physicalEffect;
      if (
        !p ||
        !e ||
        s.quantity === null ||
        s.quantity < 1 ||
        p.companyId !== s.companyId ||
        p.productId !== s.productId ||
        p.inventoryBatchId !== s.batchId ||
        p.state !== 'CUSTODY' ||
        p.contextType !== 'CASE_DISPATCH_ITEM' ||
        p.contextId !== s.id ||
        e.kind !== 'TRANSFER' ||
        e.originType !== 'CASE_DISPATCH' ||
        e.originId !== dispatchId ||
        e.originOperation !== 'CONFIRM_QUANTITY' ||
        !e.lines.some((l) => l.positionId === p.id && l.delta === s.quantity)
      )
        return fail();
      let returned = 0,
        used = 0;
      for (const r of rows) {
        if (
          r.type !== 'MATERIAL' ||
          r.sourceCustodyPositionId !== p.id ||
          r.returnedQty === null ||
          r.usedQty === null ||
          r.returnedQty < 0 ||
          r.usedQty < 0
        )
          return fail();
        returned += r.returnedQty;
        used += r.usedQty;
        for (const [kind, qty, effect] of [
          ['RETURNED', r.returnedQty, r.returnedPhysicalEffect],
          ['USED', r.usedQty, r.usedPhysicalEffect],
        ] as const) {
          if (!qty) {
            if (effect) return fail();
            continue;
          }
          if (
            !effect ||
            effect.companyId !== s.companyId ||
            effect.originType !== 'CASE_RECONCILIATION' ||
            effect.originId !== r.reconciliationId ||
            effect.originOperation !== `CONFIRM_${kind}` ||
            effect.actorId !== r.reconciliation.confirmedById ||
            effect.kind !==
              (kind === 'RETURNED' ? 'TRANSFER' : 'DEFINITIVE_OUT') ||
            !effect.lines.some((l) => l.positionId === p.id && l.delta === -qty)
          )
            return fail();
          if (kind === 'RETURNED') {
            const dest = r.returnedDestinationPosition;
            if (
              !dest ||
              dest.companyId !== s.companyId ||
              dest.productId !== s.productId ||
              dest.inventoryBatchId !== s.batchId ||
              dest.state !== 'AVAILABLE' ||
              dest.contextType !== null ||
              dest.contextId !== null ||
              !effect.lines.some(
                (l) =>
                  l.positionId === dest.id &&
                  l.delta === destinationTotals.get(effect.id + ':' + dest.id),
              )
            )
              return fail();
          }
        }
      }
      const unresolved = s.quantity - returned - used;
      if (
        !Number.isSafeInteger(returned + used) ||
        unresolved < 0 ||
        p.quantity !== unresolved
      )
        return fail();
      progress ||= returned + used > 0;
      remaining ||= unresolved > 0;
      return {
        type: 'MATERIAL' as const,
        sourceDispatchItemId: s.id,
        dispatchedQty: s.quantity,
        confirmedReturnedQty: returned,
        confirmedUsedQty: used,
        unresolvedQty: unresolved,
        sourceCustodyPositionId: p.id,
      };
    }
    const c = s.equipmentCustody,
      open = s.equipmentPhysicalEvent;
    if (
      !c ||
      !open ||
      c.companyId !== s.companyId ||
      c.equipmentAssetId !== s.assetId ||
      c.caseId !== s.caseId ||
      c.assignmentId !== s.assignmentId ||
      open.operation !== 'CUSTODY_OPEN' ||
      open.custodyId !== c.id ||
      open.originType !== 'CASE_DISPATCH_ITEM' ||
      open.originId !== s.id ||
      open.originOperation !== 'CONFIRM_EQUIPMENT'
    )
      return fail();
    const closes = rows.filter((r) => r.closePhysicalEventId !== null);
    for (const r of rows)
      if (
        r.type !== 'EQUIPMENT' ||
        r.equipmentCustodyId !== c.id ||
        r.assetId !== s.assetId ||
        r.assignmentId !== s.assignmentId ||
        (r.outcome === 'RETURNED') !== (r.closePhysicalEventId !== null)
      )
        return fail();
    if (c.closedAt === null) {
      if (
        closes.length ||
        c.closedById !== null ||
        s.asset?.activeCustodyId !== c.id ||
        s.asset.physicalLocation !== 'CUSTODY'
      )
        return fail();
      remaining = true;
      return {
        type: 'EQUIPMENT' as const,
        sourceDispatchItemId: s.id,
        equipmentCustodyId: c.id,
        custodyStatus: 'OPEN' as const,
        closeEvidence: null,
      };
    }
    if (closes.length !== 1) return fail();
    const r = closes[0],
      event = r.closePhysicalEvent;
    if (
      !event ||
      event.operation !== 'CUSTODY_CLOSE' ||
      event.companyId !== s.companyId ||
      event.equipmentAssetId !== s.assetId ||
      event.custodyId !== c.id ||
      event.originType !== 'CASE_RECONCILIATION_ITEM' ||
      event.originId !== r.id ||
      event.originOperation !== 'CONFIRM_EQUIPMENT_RETURN' ||
      event.actorId !== c.closedById ||
      event.actorId !== r.reconciliation.confirmedById ||
      event.revisionBefore !== r.expectedPhysicalRevision ||
      event.revisionAfter !== event.revisionBefore + 1 ||
      event.conditionAfter !== r.reportedCondition ||
      event.physicalLocationBefore !== 'CUSTODY' ||
      event.physicalLocationAfter !== 'WAREHOUSE' ||
      event.lifecycleBefore !== event.lifecycleAfter
    )
      return fail();
    // Historical closure is independent of the Asset's current location/pointer.
    progress = true;
    return {
      type: 'EQUIPMENT' as const,
      sourceDispatchItemId: s.id,
      equipmentCustodyId: c.id,
      custodyStatus: 'CLOSED' as const,
      closeEvidence: {
        id: event.id,
        closedAt: c.closedAt,
        condition: event.conditionAfter,
      },
    };
  });
  if (!sources.length) return fail();
  return {
    dispatchId,
    status: !remaining
      ? 'FULLY_RECONCILED'
      : progress
        ? 'PARTIALLY_RECONCILED'
        : 'UNRECONCILED',
    items,
  };
}
