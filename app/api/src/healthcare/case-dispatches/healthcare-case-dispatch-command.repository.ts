import { Injectable } from '@nestjs/common';
import { IdempotencyScope, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  healthcareCaseKitSelect,
  HealthcareCaseKitRecord,
} from '../case-kits/healthcare-case-kits.repository';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../common/healthcare-company-transaction-timeout-policy';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import {
  DispatchCommandContext,
  DraftOperation,
} from './healthcare-case-dispatch-command.types';
import { normalizeDispatchCustodian } from './healthcare-case-dispatch-request-hash';
import { DispatchCustodianDto } from './dto/create-healthcare-case-dispatch.dto';
import { HealthcareCaseDispatchesRepository } from './healthcare-case-dispatches.repository';
type Tx = Prisma.TransactionClient;
type SourceTable =
  | 'HealthcareCase'
  | 'HealthcareCaseKit'
  | 'HealthcareCaseKitItem'
  | 'HealthcareCaseRequirement'
  | 'HealthcareEquipmentAssignment'
  | 'Product'
  | 'InventoryBatch'
  | 'InventoryPosition'
  | 'EquipmentAsset';
@Injectable()
export class HealthcareCaseDispatchCommandRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reads: HealthcareCaseDispatchesRepository,
  ) {}
  runInTransaction<T>(
    f: (tx: Tx) => Promise<T>,
    p: HealthcareCompanyTransactionTimeoutPolicy,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await applyHealthcareSubsequentTransactionTimeouts(tx, p);
        return f(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: p.prismaMaxWaitMs,
        timeout: p.prismaTransactionTimeoutMs,
      },
    );
  }
  runInReadSnapshot<T>(f: (tx: Tx) => Promise<T>) {
    return this.reads.runInReadSnapshot(f);
  }
  detail(c: DispatchCommandContext, id: string, tx: Tx) {
    return this.reads.detail(c.companyId, c.caseId, id, tx);
  }
  findClaim(c: DispatchCommandContext, scope: IdempotencyScope, tx: Tx) {
    return tx.idempotencyRecord.findUnique({
      where: {
        companyId_scope_key: { companyId: c.companyId, scope, key: c.key },
      },
      select: { id: true, requestHash: true, resourceId: true },
    });
  }
  async createClaim(
    c: DispatchCommandContext,
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
    return tx.idempotencyRecord.update({
      where: { id },
      data: { resourceId },
      select: { id: true },
    });
  }
  async lockSources(
    table: SourceTable,
    ids: string[],
    companyId: string,
    tx: Tx,
    exclusive = false,
  ) {
    if (!ids.length) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM ${Prisma.raw('"' + table + '"')} WHERE "companyId"=${companyId} AND id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY id ${Prisma.raw(exclusive ? 'FOR UPDATE' : 'FOR SHARE')}`,
    );
  }
  lockCaseForShare(companyId: string, caseId: string, tx: Tx) {
    return this.lockSources('HealthcareCase', [caseId], companyId, tx);
  }
  async lockProductForKeyShare(companyId: string, productId: string, tx: Tx) {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE "companyId"=${companyId} AND id=${productId} FOR KEY SHARE`;
  }
  lockAssetsForShare(companyId: string, ids: string[], tx: Tx) {
    return this.lockSources('EquipmentAsset', ids, companyId, tx);
  }
  lockAssignmentsForShare(companyId: string, ids: string[], tx: Tx) {
    return this.lockSources(
      'HealthcareEquipmentAssignment',
      ids,
      companyId,
      tx,
    );
  }
  findIdentity(c: DispatchCommandContext, tx: Tx) {
    return tx.healthcareCaseDispatch.findFirst({
      where: { id: c.dispatchId, companyId: c.companyId, caseId: c.caseId },
      select: { id: true },
    });
  }
  async lockDraftById(c: DispatchCommandContext, tx: Tx) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "HealthcareCaseDispatch" WHERE id=${c.dispatchId} AND "companyId"=${c.companyId} AND "caseId"=${c.caseId} FOR UPDATE`,
    );
    return tx.healthcareCaseDispatch.findFirst({
      where: { id: c.dispatchId, companyId: c.companyId, caseId: c.caseId },
    });
  }
  async lockItem(c: DispatchCommandContext, tx: Tx) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "HealthcareCaseDispatchItem" WHERE id=${c.itemId} AND "dispatchId"=${c.dispatchId} AND "companyId"=${c.companyId} AND "caseId"=${c.caseId} FOR UPDATE`,
    );
    return tx.healthcareCaseDispatchItem.findFirst({
      where: {
        id: c.itemId,
        dispatchId: c.dispatchId,
        companyId: c.companyId,
        caseId: c.caseId,
      },
    });
  }
  findCase(c: DispatchCommandContext, tx: Tx) {
    return tx.healthcareCase.findFirst({
      where: { id: c.caseId, companyId: c.companyId },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });
  }
  findKit(c: DispatchCommandContext, tx: Tx) {
    return tx.healthcareCaseKit.findUnique({
      where: { companyId_caseId: { companyId: c.companyId, caseId: c.caseId } },
      select: healthcareCaseKitSelect,
    });
  }
  async lockReadiness(
    kit: HealthcareCaseKitRecord,
    c: DispatchCommandContext,
    tx: Tx,
  ) {
    const active = kit.items.filter((i) => i.lifecycle === 'ACTIVE');
    await this.lockSources(
      'HealthcareCaseKitItem',
      active.map((i) => i.id),
      c.companyId,
      tx,
    );
    await this.lockSources(
      'Product',
      active.flatMap((i) =>
        i.requirement
          ? [i.requirement.productId]
          : i.equipmentAssignment
            ? [i.equipmentAssignment.equipmentAsset.product.id]
            : [],
      ),
      c.companyId,
      tx,
    );
    await this.lockAssetsForShare(
      c.companyId,
      active.flatMap((i) =>
        i.equipmentAssignment ? [i.equipmentAssignment.equipmentAsset.id] : [],
      ),
      tx,
    );
    await this.lockSources(
      'HealthcareCaseRequirement',
      kit.healthcareCase.requirements.map((r) => r.id),
      c.companyId,
      tx,
    );
    await this.lockAssignmentsForShare(
      c.companyId,
      active.flatMap((i) =>
        i.equipmentAssignmentId ? [i.equipmentAssignmentId] : [],
      ),
      tx,
    );
  }
  findSource(c: DispatchCommandContext, kitId: string, id: string, tx: Tx) {
    return tx.healthcareCaseKitItem.findFirst({
      where: { id, companyId: c.companyId, caseId: c.caseId, caseKitId: kitId },
      include: { requirement: true, equipmentAssignment: true },
    });
  }
  findProduct(companyId: string, id: string, tx: Tx) {
    return tx.product.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        isActive: true,
        inventoryTracking: true,
        lotTracking: true,
      },
    });
  }
  findPosition(companyId: string, id: string, tx: Tx) {
    return tx.inventoryPosition.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        productId: true,
        inventoryBatchId: true,
        state: true,
        contextType: true,
        contextId: true,
        quantity: true,
        revision: true,
      },
    });
  }
  findBatch(companyId: string, id: string, tx: Tx) {
    return tx.inventoryBatch.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        productId: true,
        isActive: true,
        expirationDate: true,
      },
    });
  }
  findAsset(companyId: string, id: string, tx: Tx) {
    return tx.equipmentAsset.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        productId: true,
        lifecycle: true,
        condition: true,
        physicalLocation: true,
        physicalRevision: true,
        activeCustodyId: true,
      },
    });
  }
  findCustodianUser(companyId: string, id: string, tx: Tx) {
    return tx.user.findFirst({
      where: { companyId, id },
      select: { id: true },
    });
  }
  createDraft(
    c: DispatchCommandContext,
    caseKitId: string,
    custodian: DispatchCustodianDto,
    tx: Tx,
  ) {
    const u = normalizeDispatchCustodian(custodian);
    return tx.healthcareCaseDispatch.create({
      data: {
        companyId: c.companyId,
        caseId: c.caseId,
        caseKitId,
        createdById: c.actorId,
        custodianType: u.type,
        custodianUserId: u.userId,
        custodianDisplayName: u.displayName,
      },
    });
  }
  private casWhere(c: DispatchCommandContext, revision: number) {
    return {
      id: c.dispatchId,
      companyId: c.companyId,
      caseId: c.caseId,
      status: 'DRAFT' as const,
      revision,
    };
  }
  setCustodianWithExpectedRevision(
    c: DispatchCommandContext,
    revision: number,
    custodian: DispatchCustodianDto,
    tx: Tx,
  ) {
    const u = normalizeDispatchCustodian(custodian);
    return tx.healthcareCaseDispatch.updateMany({
      where: this.casWhere(c, revision),
      data: {
        custodianType: u.type,
        custodianUserId: u.userId,
        custodianDisplayName: u.displayName,
        revision: { increment: 1 },
      },
    });
  }
  advanceItemRevision(c: DispatchCommandContext, revision: number, tx: Tx) {
    return tx.healthcareCaseDispatch.updateMany({
      where: this.casWhere(c, revision),
      data: { revision: { increment: 1 } },
    });
  }
  insertMaterialItem(
    data: Prisma.HealthcareCaseDispatchItemUncheckedCreateInput,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatchItem.create({ data });
  }
  insertEquipmentItem(
    data: Prisma.HealthcareCaseDispatchItemUncheckedCreateInput,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatchItem.create({ data });
  }
  excludeItemWithExpectedRevision(
    c: DispatchCommandContext,
    reason: string,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatchItem.updateMany({
      where: {
        id: c.itemId,
        dispatchId: c.dispatchId,
        companyId: c.companyId,
        caseId: c.caseId,
        lifecycle: 'ACTIVE',
      },
      data: {
        lifecycle: 'EXCLUDED',
        excludedById: c.actorId,
        excludedAt: new Date(),
        exclusionReason: reason,
      },
    });
  }
  cancelDraftWithExpectedRevision(
    c: DispatchCommandContext,
    revision: number,
    reason: string,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatch.updateMany({
      where: this.casWhere(c, revision),
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
    c: DispatchCommandContext,
    operation: DraftOperation,
    before: number | null,
    reason: string | null,
    itemId: string | null,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatchAudit.create({
      data: {
        companyId: c.companyId,
        dispatchId: c.dispatchId!,
        dispatchItemId: itemId,
        operation,
        actorId: c.actorId,
        revisionBefore: before,
        revisionAfter: before === null ? 0 : before + 1,
        change: { version: 1, operation, reason },
      },
    });
  }
  findWitness(
    companyId: string,
    dispatchId: string,
    revisionAfter: number,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatchAudit.findUnique({
      where: {
        companyId_dispatchId_revisionAfter: {
          companyId,
          dispatchId,
          revisionAfter,
        },
      },
    });
  }
  findReplayItem(companyId: string, id: string, tx: Tx) {
    return tx.healthcareCaseDispatchItem.findFirst({
      where: { companyId, id },
      select: { id: true, dispatchId: true, caseId: true },
    });
  }
  async materialCapacity(
    c: DispatchCommandContext,
    sourceId: string,
    positionId: string,
    tx: Tx,
  ) {
    const [confirmed, local, position] = await Promise.all([
      tx.healthcareCaseDispatchItem.aggregate({
        where: {
          companyId: c.companyId,
          sourceCaseKitItemId: sourceId,
          type: 'MATERIAL',
          lifecycle: 'ACTIVE',
          dispatch: { status: 'CONFIRMED' },
        },
        _sum: { quantity: true },
      }),
      tx.healthcareCaseDispatchItem.aggregate({
        where: {
          companyId: c.companyId,
          dispatchId: c.dispatchId,
          sourceCaseKitItemId: sourceId,
          type: 'MATERIAL',
          lifecycle: 'ACTIVE',
        },
        _sum: { quantity: true },
      }),
      tx.healthcareCaseDispatchItem.aggregate({
        where: {
          companyId: c.companyId,
          dispatchId: c.dispatchId,
          sourcePositionId: positionId,
          type: 'MATERIAL',
          lifecycle: 'ACTIVE',
        },
        _sum: { quantity: true },
      }),
    ]);
    return {
      confirmed: confirmed._sum.quantity ?? 0,
      local: local._sum.quantity ?? 0,
      position: position._sum.quantity ?? 0,
    };
  }
  equipmentConsumed(companyId: string, sourceId: string, tx: Tx) {
    return tx.healthcareCaseDispatchItem.findFirst({
      where: {
        companyId,
        sourceCaseKitItemId: sourceId,
        type: 'EQUIPMENT',
        lifecycle: 'ACTIVE',
        equipmentCustodyId: { not: null },
        equipmentPhysicalEventId: { not: null },
        dispatch: { status: 'CONFIRMED' },
      },
      select: { id: true },
    });
  }
  localSource(
    c: DispatchCommandContext,
    sourceId: string,
    positionId: string | null,
    assetId: string | null,
    tx: Tx,
  ) {
    return tx.healthcareCaseDispatchItem.findFirst({
      where: {
        companyId: c.companyId,
        dispatchId: c.dispatchId,
        lifecycle: 'ACTIVE',
        OR: assetId
          ? [{ sourceCaseKitItemId: sourceId }, { assetId }]
          : [{ sourceCaseKitItemId: sourceId, sourcePositionId: positionId }],
      },
      select: { id: true },
    });
  }
}
