import { Prisma } from '@prisma/client';
import type { EquipmentCustodyCloseContextAdapter } from '../../equipment/equipment-custody-close-context.registry';
import type { EquipmentCustodyCloseCommand } from '../../equipment/equipment-custody-close.contract';
import { equipmentPhysicalAssert as prove } from '../../equipment/equipment-physical.contract';
import {
  createDispatchCorrectionRequestHash,
  DISPATCH_CORRECTION_SCOPE,
} from './healthcare-case-dispatch-correction.contract';

// Internal registry adapter; never registered in a public Nest module.
export class HealthcareCaseDispatchCorrectionEquipmentAdapter implements EquipmentCustodyCloseContextAdapter {
  readonly key = 'CASE_DISPATCH_CORRECTION_ITEM';
  readonly originType = 'CASE_DISPATCH_CORRECTION_ITEM';
  readonly originOperation = 'COMPENSATE_NO_HANDOFF_EQUIPMENT';

  private async evidence(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCloseCommand,
    mode: 'APPLY' | 'REPLAY',
  ) {
    prove(!('$transaction' in tx), 'RESOURCE_STATE_CHANGED');
    prove(
      c.validatedContext.adapterKey === this.key &&
        c.validatedContext.contextId === c.durableOrigin.id &&
        c.durableOrigin.type === this.originType &&
        c.durableOrigin.operation === this.originOperation,
      'RESOURCE_STATE_CHANGED',
    );
    const actor = await tx.user.findFirst({
      where: {
        id: c.actorId,
        companyId: c.companyId,
        isActive: true,
        role: { in: ['ADMIN', 'MANAGER'] },
      },
    });
    prove(actor, 'EQUIPMENT_PHYSICAL_ACTOR_INVALID');
    const item = await tx.healthcareCaseDispatchCorrectionItem.findFirst({
      where: { id: c.validatedContext.contextId, companyId: c.companyId },
      include: {
        correction: { include: { idempotencyRecord: true } },
        sourceDispatchItem: { include: { dispatch: true, assignment: true } },
        equipmentCustody: true,
        openPhysicalEvent: true,
        closePhysicalEvent: true,
      },
    });
    prove(item, 'RESOURCE_STATE_CHANGED');
    const r = item.correction,
      s = item.sourceDispatchItem,
      d = s.dispatch,
      custody = item.equipmentCustody,
      op = item.openPhysicalEvent,
      claim = r.idempotencyRecord,
      assignment = s.assignment;
    prove(
      r.companyId === c.companyId &&
        r.caseId === c.caseId &&
        r.dispatchId === d.id &&
        r.caseKitId === d.caseKitId &&
        r.kind === 'NO_PHYSICAL_HANDOFF' &&
        r.status === 'CONFIRMED' &&
        r.attestedNoHandoff &&
        r.hashVersion === 1 &&
        r.snapshotVersion === 1 &&
        r.confirmedAt instanceof Date &&
        Number.isFinite(r.confirmedAt.getTime()) &&
        d.confirmedAt instanceof Date &&
        r.confirmedAt >= d.confirmedAt &&
        r.reason === r.reason.trim(),
      'RESOURCE_STATE_CHANGED',
    );
    prove(
      r.requestHash ===
        createDispatchCorrectionRequestHash({
          companyId: r.companyId,
          caseId: r.caseId,
          dispatchId: r.dispatchId,
          reason: r.reason,
          attestedNoHandoff: true,
        }) &&
        claim.companyId === r.companyId &&
        claim.id === r.idempotencyRecordId &&
        claim.scope === DISPATCH_CORRECTION_SCOPE &&
        claim.resourceId === r.id &&
        claim.requestHash === r.requestHash &&
        claim.key === claim.key.trim() &&
        claim.key.length > 0 &&
        claim.key.length <= 128,
      'RESOURCE_STATE_CHANGED',
    );
    prove(
      item.type === 'EQUIPMENT' &&
        item.companyId === r.companyId &&
        item.correctionId === r.id &&
        item.sourceDispatchItemId === s.id &&
        item.dispatchId === r.dispatchId &&
        s.companyId === c.companyId &&
        s.caseId === c.caseId &&
        s.dispatchId === r.dispatchId &&
        s.caseKitId === r.caseKitId &&
        s.lifecycle === 'ACTIVE' &&
        s.type === 'EQUIPMENT' &&
        s.snapshot !== null &&
        d.status === 'CONFIRMED' &&
        d.snapshot !== null &&
        d.companyId === c.companyId &&
        d.caseId === c.caseId &&
        item.assetId === c.assetId &&
        s.assetId === c.assetId &&
        item.equipmentCustodyId === c.custodyId &&
        s.equipmentCustodyId === c.custodyId &&
        item.openPhysicalEventId === s.equipmentPhysicalEventId,
      'RESOURCE_STATE_CHANGED',
    );
    prove(
      assignment &&
        assignment.id === c.assignmentId &&
        s.assignmentId === c.assignmentId &&
        assignment.companyId === c.companyId &&
        assignment.caseId === c.caseId &&
        assignment.equipmentAssetId === c.assetId &&
        custody &&
        custody.companyId === c.companyId &&
        custody.id === c.custodyId &&
        custody.caseId === c.caseId &&
        custody.assignmentId === c.assignmentId &&
        custody.equipmentAssetId === c.assetId &&
        custody.openedById === d.confirmedById,
      'RESOURCE_STATE_CHANGED',
    );
    prove(
      op &&
        op.id === item.openPhysicalEventId &&
        op.companyId === c.companyId &&
        op.equipmentAssetId === c.assetId &&
        op.custodyId === c.custodyId &&
        op.operation === 'CUSTODY_OPEN' &&
        op.originType === 'CASE_DISPATCH_ITEM' &&
        op.originId === s.id &&
        op.originOperation === 'CONFIRM_EQUIPMENT' &&
        op.actorId === d.confirmedById &&
        op.revisionBefore === s.expectedPhysicalRevision &&
        op.revisionAfter === op.revisionBefore + 1 &&
        c.expectedPhysicalRevision === op.revisionAfter &&
        op.physicalLocationBefore === 'WAREHOUSE' &&
        op.physicalLocationAfter === 'CUSTODY' &&
        op.createdAt.getTime() === custody.openedAt.getTime() &&
        r.confirmedAt >= op.createdAt &&
        c.reportedCondition === op.conditionAfter,
      'RESOURCE_STATE_CHANGED',
    );
    if (mode === 'APPLY') {
      const [stage] = await tx.$queryRaw<
        { valid: boolean }[]
      >`SELECT snapshot IS NULL AND "creationTransactionId"=pg_current_xact_id() AND current_setting('transaction_isolation')='read committed' AS valid FROM "HealthcareCaseDispatchCorrection" WHERE id=${r.id} AND "companyId"=${r.companyId}`;
      prove(
        stage?.valid &&
          r.snapshot === null &&
          r.confirmedById === c.actorId &&
          item.snapshot === null &&
          item.closePhysicalEventId === null &&
          custody.closedAt === null &&
          custody.closedById === null,
        'RESOURCE_STATE_CHANGED',
      );
      const rr = await tx.healthcareCaseReconciliation.findFirst({
        where: {
          companyId: r.companyId,
          dispatchId: r.dispatchId,
          OR: [
            { status: { not: 'CANCELLED' } },
            {
              items: {
                some: {
                  OR: [
                    { returnedPhysicalEffectId: { not: null } },
                    { usedPhysicalEffectId: { not: null } },
                    { closePhysicalEventId: { not: null } },
                  ],
                },
              },
            },
          ],
        },
      });
      prove(!rr, 'RESOURCE_STATE_CHANGED');
      const later = await tx.equipmentAssetPhysicalEvent.count({
        where: {
          companyId: c.companyId,
          equipmentAssetId: c.assetId,
          revisionAfter: { gt: op.revisionAfter },
        },
      });
      prove(later === 0, 'RESOURCE_STATE_CHANGED');
      const asset = await tx.equipmentAsset.findFirst({
        where: { id: c.assetId, companyId: c.companyId },
      });
      prove(
        asset &&
          asset.physicalLocation === 'CUSTODY' &&
          asset.activeCustodyId === c.custodyId &&
          asset.physicalRevision === op.revisionAfter &&
          asset.condition === op.conditionAfter &&
          asset.lifecycle === op.lifecycleAfter &&
          asset.productId === s.productId,
        'RESOURCE_STATE_CHANGED',
      );
    } else {
      const e = item.closePhysicalEvent;
      prove(
        r.snapshot !== null &&
          item.snapshot !== null &&
          e &&
          e.id === item.closePhysicalEventId &&
          e.companyId === c.companyId &&
          e.equipmentAssetId === c.assetId &&
          e.custodyId === c.custodyId &&
          e.operation === 'CUSTODY_CLOSE' &&
          e.hashVersion === 1 &&
          e.originType === this.originType &&
          e.originId === item.id &&
          e.originOperation === this.originOperation &&
          e.requestHash === r.requestHash &&
          e.actorId === r.confirmedById &&
          e.createdAt.getTime() === r.confirmedAt.getTime() &&
          custody.closedAt?.getTime() === r.confirmedAt.getTime() &&
          custody.closedById === r.confirmedById &&
          e.revisionBefore === op.revisionAfter &&
          e.revisionAfter === e.revisionBefore + 1 &&
          e.conditionBefore === op.conditionAfter &&
          e.conditionAfter === e.conditionBefore &&
          e.lifecycleBefore === op.lifecycleAfter &&
          e.lifecycleAfter === e.lifecycleBefore &&
          e.physicalLocationBefore === 'CUSTODY' &&
          e.physicalLocationAfter === 'WAREHOUSE',
        'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
      );
      // Historical snapshots, not the current Asset or later physical history.
      const [snapshot] = await tx.$queryRaw<
        { valid: boolean }[]
      >`SELECT i.snapshot=public.dispatch_correction_item_snapshot(i.id)
        AND r.snapshot-'confirmedAt'-'confirmedBy'=jsonb_build_object('version',1,'correctionId',r.id,'kind',r.kind,'reason',r.reason,'attestedNoHandoff',true,'requestHash',r."requestHash",'sourceDispatch',jsonb_build_object('id',d.id,'history',d.snapshot))
        AND (r.snapshot->'confirmedBy')-'role'=jsonb_build_object('id',r."confirmedById")
        AND r.snapshot->'confirmedBy'->>'role' IN ('ADMIN','MANAGER')
        AND (r.snapshot->>'confirmedAt')::timestamptz=r."confirmedAt" AT TIME ZONE 'UTC' AS valid
        FROM "HealthcareCaseDispatchCorrectionItem" i
        JOIN "HealthcareCaseDispatchCorrection" r ON r.id=i."correctionId" AND r."companyId"=i."companyId"
        JOIN "HealthcareCaseDispatch" d ON d.id=r."dispatchId" AND d."companyId"=r."companyId"
        WHERE i.id=${item.id} AND i."companyId"=${c.companyId}`;
      prove(snapshot?.valid, 'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR');
    }
    return { r, item };
  }

  async dispatchCorrectionMetadata(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCloseCommand,
    mode: 'APPLY' | 'REPLAY',
  ) {
    const { r } = await this.evidence(tx, c, mode);
    return { requestHash: r.requestHash, closedAt: r.confirmedAt };
  }

  async validate(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCloseCommand,
    hash: string,
    mode: 'APPLY' | 'REPLAY',
  ) {
    const { r } = await this.evidence(tx, c, mode);
    prove(hash === r.requestHash, 'IDEMPOTENCY_KEY_REUSED');
    return {
      companyId: c.companyId,
      caseId: c.caseId,
      assetId: c.assetId,
      custodyId: c.custodyId,
      assignmentId: c.assignmentId,
      actorId: c.actorId,
      contextId: c.validatedContext.contextId,
      originType: this.originType,
      originId: c.durableOrigin.id,
      originOperation: this.originOperation,
      requestHash: r.requestHash,
    };
  }
}
