import { Injectable } from '@nestjs/common';
import { EquipmentAsset, IdempotencyScope, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../common/healthcare-company-transaction-timeout-policy';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import {
  HealthcareCaseReconciliationsRepository,
  SummarySource,
} from './healthcare-case-reconciliations.repository';
import { ReconciliationCommandContext as Context } from './healthcare-case-reconciliation-command.types';
import { ReconciliationAuditChange } from './healthcare-case-reconciliation.types';
type Tx = Prisma.TransactionClient;
export type AdmissionSource = SummarySource & { asset: EquipmentAsset | null };
@Injectable()
export class HealthcareCaseReconciliationCommandRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reads: HealthcareCaseReconciliationsRepository,
  ) {}
  runInTransaction<T>(
    fn: (tx: Tx) => Promise<T>,
    p: HealthcareCompanyTransactionTimeoutPolicy,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await applyHealthcareSubsequentTransactionTimeouts(tx, p);
        return fn(tx);
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: p.prismaMaxWaitMs,
        timeout: p.prismaTransactionTimeoutMs,
      },
    );
  }
  runInReadSnapshot<T>(fn: (tx: Tx) => Promise<T>) {
    return this.reads.runInReadSnapshot(fn);
  }
  detail(c: Context, id: string, tx: Tx) {
    return this.reads.detail(c.companyId, c.caseId, id, tx);
  }
  findClaim(c: Context, scope: IdempotencyScope, tx: Tx) {
    return tx.idempotencyRecord.findUnique({
      where: {
        companyId_scope_key: { companyId: c.companyId, scope, key: c.key },
      },
      select: { id: true, requestHash: true, resourceId: true },
    });
  }
  async createClaim(
    c: Context,
    scope: IdempotencyScope,
    requestHash: string,
    tx: Tx,
  ) {
    return tx.idempotencyRecord.create({
      data: { companyId: c.companyId, scope, key: c.key, requestHash },
      select: { id: true },
    });
  }
  completeClaim(id: string, resourceId: string, tx: Tx) {
    return tx.idempotencyRecord.update({ where: { id }, data: { resourceId } });
  }
  identity(c: Context, tx: Tx) {
    return tx.healthcareCaseReconciliation.findFirst({
      where: {
        id: c.reconciliationId,
        companyId: c.companyId,
        caseId: c.caseId,
      },
    });
  }
  itemIdentity(c: Context, tx: Tx) {
    return tx.healthcareCaseReconciliationItem.findFirst({
      where: {
        id: c.itemId,
        reconciliationId: c.reconciliationId,
        companyId: c.companyId,
        caseId: c.caseId,
      },
    });
  }
  async lockSourcePrefix(
    c: Context,
    dispatchId: string,
    sourceId: string | undefined,
    tx: Tx,
  ) {
    await tx.$queryRaw`SELECT id FROM "HealthcareCase" WHERE id=${c.caseId} AND "companyId"=${c.companyId} FOR KEY SHARE`;
    await tx.$queryRaw`SELECT id FROM "HealthcareCaseDispatch" WHERE id=${dispatchId} AND "caseId"=${c.caseId} AND "companyId"=${c.companyId} FOR KEY SHARE`;
    if (sourceId)
      await tx.$queryRaw`SELECT id FROM "HealthcareCaseDispatchItem" WHERE id=${sourceId} AND "dispatchId"=${dispatchId} AND "caseId"=${c.caseId} AND "companyId"=${c.companyId} FOR KEY SHARE`;
  }
  findCase(c: Context, tx: Tx) {
    return this.reads.findCase(c.companyId, c.caseId, tx);
  }
  sourceDispatch(c: Context, id: string, tx: Tx) {
    return tx.healthcareCaseDispatch.findFirst({
      where: { id, companyId: c.companyId, caseId: c.caseId },
      select: { id: true, caseKitId: true, status: true },
    });
  }
  sourceItem(c: Context, dispatchId: string, id: string, tx: Tx) {
    return tx.healthcareCaseDispatchItem.findFirst({
      where: { id, dispatchId, companyId: c.companyId, caseId: c.caseId },
    });
  }
  async lockDraftById(c: Context, tx: Tx) {
    await tx.$queryRaw`SELECT id FROM "HealthcareCaseReconciliation" WHERE id=${c.reconciliationId} AND "companyId"=${c.companyId} AND "caseId"=${c.caseId} FOR UPDATE`;
    return this.identity(c, tx);
  }
  async lockItem(c: Context, tx: Tx) {
    await tx.$queryRaw`SELECT id FROM "HealthcareCaseReconciliationItem" WHERE id=${c.itemId} AND "reconciliationId"=${c.reconciliationId} AND "companyId"=${c.companyId} AND "caseId"=${c.caseId} FOR UPDATE`;
    return this.itemIdentity(c, tx);
  }
  createDraft(
    c: Context,
    dispatchId: string,
    caseKitId: string,
    observation: string | null,
    tx: Tx,
  ) {
    return tx.healthcareCaseReconciliation.create({
      data: {
        companyId: c.companyId,
        caseId: c.caseId,
        dispatchId,
        caseKitId,
        createdById: c.actorId,
        observation,
      },
    });
  }
  activeSource(c: Context, sourceDispatchItemId: string, tx: Tx) {
    return tx.healthcareCaseReconciliationItem.findFirst({
      where: {
        companyId: c.companyId,
        reconciliationId: c.reconciliationId,
        sourceDispatchItemId,
        lifecycle: 'ACTIVE',
      },
      select: { id: true },
    });
  }
  insertMaterialItem(
    data: Prisma.HealthcareCaseReconciliationItemUncheckedCreateInput,
    tx: Tx,
  ) {
    return tx.healthcareCaseReconciliationItem.create({ data });
  }
  insertEquipmentItem(
    data: Prisma.HealthcareCaseReconciliationItemUncheckedCreateInput,
    tx: Tx,
  ) {
    return tx.healthcareCaseReconciliationItem.create({ data });
  }
  async setMaterialOutcome(
    c: Context,
    returnedQty: number,
    usedQty: number,
    expectedSourceRevision: number,
    tx: Tx,
  ) {
    return tx.healthcareCaseReconciliationItem.updateMany({
      where: this.itemWhere(c),
      data: { returnedQty, usedQty, expectedSourceRevision },
    });
  }
  setEquipmentOutcome(
    c: Context,
    outcome: 'RETURNED' | 'UNRESOLVED',
    reportedCondition: Prisma.HealthcareCaseReconciliationItemUncheckedUpdateInput['reportedCondition'],
    expectedPhysicalRevision: number,
    tx: Tx,
  ) {
    return tx.healthcareCaseReconciliationItem.updateMany({
      where: this.itemWhere(c),
      data: { outcome, reportedCondition, expectedPhysicalRevision },
    });
  }
  private itemWhere(c: Context) {
    return {
      id: c.itemId,
      companyId: c.companyId,
      caseId: c.caseId,
      reconciliationId: c.reconciliationId,
      lifecycle: 'ACTIVE' as const,
    };
  }
  excludeItem(c: Context, reason: string, tx: Tx) {
    return tx.healthcareCaseReconciliationItem.updateMany({
      where: this.itemWhere(c),
      data: {
        lifecycle: 'EXCLUDED',
        excludedById: c.actorId,
        excludedAt: new Date(),
        exclusionReason: reason,
      },
    });
  }
  advanceRevision(c: Context, revision: number, tx: Tx) {
    return tx.healthcareCaseReconciliation.updateMany({
      where: {
        id: c.reconciliationId,
        companyId: c.companyId,
        caseId: c.caseId,
        status: 'DRAFT',
        revision,
      },
      data: { revision: { increment: 1 } },
    });
  }
  cancelDraft(c: Context, revision: number, reason: string, tx: Tx) {
    return tx.healthcareCaseReconciliation.updateMany({
      where: {
        id: c.reconciliationId,
        companyId: c.companyId,
        caseId: c.caseId,
        status: 'DRAFT',
        revision,
      },
      data: {
        status: 'CANCELLED',
        revision: { increment: 1 },
        cancelledById: c.actorId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
  }
  appendAudit(
    c: Context,
    before: number | null,
    itemId: string | null,
    change: ReconciliationAuditChange,
    tx: Tx,
  ) {
    return tx.healthcareCaseReconciliationAudit.create({
      data: {
        companyId: c.companyId,
        reconciliationId: c.reconciliationId!,
        reconciliationItemId: itemId,
        operation: change.operation,
        actorId: c.actorId,
        revisionBefore: before,
        revisionAfter: before === null ? 0 : before + 1,
        change,
      },
    });
  }
  findWitness(c: Context, id: string, revisionAfter: number, tx: Tx) {
    return tx.healthcareCaseReconciliationAudit.findUnique({
      where: {
        companyId_reconciliationId_revisionAfter: {
          companyId: c.companyId,
          reconciliationId: id,
          revisionAfter,
        },
      },
    });
  }
  replayItem(c: Context, id: string, tx: Tx) {
    return tx.healthcareCaseReconciliationItem.findFirst({
      where: { id, companyId: c.companyId, caseId: c.caseId },
      select: {
        id: true,
        reconciliationId: true,
        sourceDispatchItemId: true,
        type: true,
      },
    });
  }
  // One SQL statement gives provenance, physical facts and confirmed business totals
  // one MVCC snapshot. No physical locks or writes; JSON dates are only observed as null/non-null.
  async admissionSources(
    c: Context,
    dispatchId: string,
    tx: Tx,
  ): Promise<AdmissionSource[]> {
    const rows = await tx.$queryRaw<{ facts: AdmissionSource }[]>`
 SELECT to_jsonb(s)||jsonb_build_object(
 'destinationPosition',to_jsonb(p),'asset',to_jsonb(a),
 'equipmentCustody',to_jsonb(cu),'equipmentPhysicalEvent',to_jsonb(oe),
 'physicalEffect',(SELECT to_jsonb(e)||jsonb_build_object('lines',COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."companyId"=s."companyId"),'[]'::jsonb)) FROM "InventoryPhysicalEffect" e WHERE e.id=s."physicalEffectId" AND e."companyId"=s."companyId"),
 'reconciliationItems',COALESCE((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object(
 'reconciliation',jsonb_build_object('id',r.id,'confirmedById',r."confirmedById"),
 'returnedDestinationPosition',to_jsonb(dest),'closePhysicalEvent',to_jsonb(ce),
 'returnedPhysicalEffect',(SELECT to_jsonb(e)||jsonb_build_object('lines',COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."companyId"=s."companyId"),'[]'::jsonb)) FROM "InventoryPhysicalEffect" e WHERE e.id=i."returnedPhysicalEffectId" AND e."companyId"=s."companyId"),
 'usedPhysicalEffect',(SELECT to_jsonb(e)||jsonb_build_object('lines',COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."companyId"=s."companyId"),'[]'::jsonb)) FROM "InventoryPhysicalEffect" e WHERE e.id=i."usedPhysicalEffectId" AND e."companyId"=s."companyId")
 )) FROM "HealthcareCaseReconciliationItem" i
 JOIN "HealthcareCaseReconciliation" r ON r.id=i."reconciliationId" AND r."companyId"=i."companyId" AND r.status='CONFIRMED'
 LEFT JOIN "InventoryPosition" dest ON dest.id=i."returnedDestinationPositionId" AND dest."companyId"=i."companyId"
 LEFT JOIN "EquipmentAssetPhysicalEvent" ce ON ce.id=i."closePhysicalEventId" AND ce."companyId"=i."companyId"
 WHERE i."companyId"=s."companyId" AND i."sourceDispatchItemId"=s.id AND i.lifecycle='ACTIVE'),'[]'::jsonb)) AS facts
 FROM "HealthcareCaseDispatchItem" s
 JOIN "HealthcareCaseDispatch" d ON d.id=s."dispatchId" AND d."companyId"=s."companyId" AND d.status='CONFIRMED'
 LEFT JOIN "InventoryPosition" p ON p.id=s."destinationPositionId" AND p."companyId"=s."companyId"
 LEFT JOIN "EquipmentAsset" a ON a.id=s."assetId" AND a."companyId"=s."companyId"
 LEFT JOIN "EquipmentAssetCustody" cu ON cu.id=s."equipmentCustodyId" AND cu."companyId"=s."companyId"
 LEFT JOIN "EquipmentAssetPhysicalEvent" oe ON oe.id=s."equipmentPhysicalEventId" AND oe."companyId"=s."companyId"
 WHERE s."companyId"=${c.companyId} AND s."caseId"=${c.caseId} AND s."dispatchId"=${dispatchId} AND s.lifecycle='ACTIVE' ORDER BY s.id`;
    return rows.map((r) => r.facts);
  }
}
