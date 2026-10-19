import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HealthcareCaseReconciliationCommandRepository } from './healthcare-case-reconciliation-command.repository';
import { ReconciliationCommandContext } from './healthcare-case-reconciliation-command.types';
import { PhysicalInventoryRepository } from '../../inventory/physical/physical-inventory.repository';
import { PositionKey } from '../../inventory/physical/physical-inventory.contract';
import { AdmissionSource } from './healthcare-case-reconciliation-command.repository';
export type ReconciliationConfirmContext = ReconciliationCommandContext & {
  reconciliationId: string;
};
const include = {
  dispatch: true,
  items: { orderBy: { id: 'asc' }, include: { sourceDispatchItem: true } },
} satisfies Prisma.HealthcareCaseReconciliationInclude;
export type ReconciliationConfirmRoot =
  Prisma.HealthcareCaseReconciliationGetPayload<{ include: typeof include }>;
export type ReconciliationConfirmItem =
  ReconciliationConfirmRoot['items'][number];
type Tx = Prisma.TransactionClient;
const sorted = (ids: string[]) => [...new Set(ids)].sort();
type LockTable =
  | 'HealthcareCase'
  | 'HealthcareCaseDispatch'
  | 'HealthcareCaseDispatchItem'
  | 'HealthcareCaseReconciliation'
  | 'HealthcareCaseReconciliationItem'
  | 'EquipmentAsset'
  | 'EquipmentAssetCustody';
@Injectable()
export class HealthcareCaseReconciliationConfirmRepository {
  // Load shared ledgers once. A 1000-source Confirm must not duplicate the same
  // grouped effect's 2000 lines in every source JSON document.
  async sources(
    tx: Tx,
    c: ReconciliationConfirmContext,
    dispatchId: string,
  ): Promise<AdmissionSource[]> {
    const rows = await tx.healthcareCaseDispatchItem.findMany({
      where: {
        companyId: c.companyId,
        caseId: c.caseId,
        dispatchId,
        lifecycle: 'ACTIVE',
      },
      orderBy: { id: 'asc' },
      include: {
        destinationPosition: true,
        asset: true,
        equipmentCustody: true,
        equipmentPhysicalEvent: true,
        reconciliationItems: {
          where: {
            lifecycle: 'ACTIVE',
            reconciliation: { status: 'CONFIRMED' },
          },
          include: {
            reconciliation: { select: { id: true, confirmedById: true } },
            returnedDestinationPosition: true,
            closePhysicalEvent: true,
          },
        },
      },
    });
    const ids = [
      ...new Set(
        rows
          .flatMap((s) => [
            s.physicalEffectId,
            ...s.reconciliationItems.flatMap((r) => [
              r.returnedPhysicalEffectId,
              r.usedPhysicalEffectId,
            ]),
          ])
          .filter((id): id is string => id !== null),
      ),
    ];
    const effects = await tx.inventoryPhysicalEffect.findMany({
      where: { companyId: c.companyId, id: { in: ids } },
      include: { lines: true },
    });
    const byId = new Map(effects.map((e) => [e.id, e]));
    return rows.map((s) => ({
      ...s,
      physicalEffect: s.physicalEffectId
        ? (byId.get(s.physicalEffectId) ?? null)
        : null,
      reconciliationItems: s.reconciliationItems.map((r) => ({
        ...r,
        returnedPhysicalEffect: r.returnedPhysicalEffectId
          ? (byId.get(r.returnedPhysicalEffectId) ?? null)
          : null,
        usedPhysicalEffect: r.usedPhysicalEffectId
          ? (byId.get(r.usedPhysicalEffectId) ?? null)
          : null,
      })),
    }));
  }
  constructor(
    readonly commands: HealthcareCaseReconciliationCommandRepository,
    private readonly physical: PhysicalInventoryRepository,
  ) {}
  async root(tx: Tx, c: ReconciliationConfirmContext) {
    return tx.healthcareCaseReconciliation.findFirst({
      where: {
        id: c.reconciliationId,
        companyId: c.companyId,
        caseId: c.caseId,
      },
      include,
    });
  }
  bindings(root: ReconciliationConfirmRoot): string {
    return JSON.stringify([
      root.id,
      root.companyId,
      root.caseId,
      root.dispatchId,
      root.caseKitId,
      root.status,
      root.revision,
      root.observation,
      root.items.map((i) => [
        i.id,
        i.lifecycle,
        i.type,
        i.sourceDispatchItemId,
        i.sourceCustodyPositionId,
        i.equipmentCustodyId,
        i.assetId,
        i.assignmentId,
        i.expectedSourceRevision,
        i.expectedPhysicalRevision,
        i.returnedQty,
        i.usedQty,
        i.outcome,
        i.reportedCondition,
        i.sourceDispatchItem,
      ]),
    ]);
  }
  private async lock(
    tx: Tx,
    companyId: string,
    table: LockTable,
    ids: string[],
    mode: 'FOR UPDATE' | 'FOR SHARE' = 'FOR UPDATE',
  ) {
    if (!ids.length) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM ${Prisma.raw('"' + table + '"')} WHERE "companyId"=${companyId} AND id IN (${Prisma.join(sorted(ids))}) ORDER BY id ${Prisma.raw(mode)}`,
    );
  }
  async lockStructure(
    tx: Tx,
    c: ReconciliationConfirmContext,
    root: ReconciliationConfirmRoot,
  ) {
    await this.lock(tx, c.companyId, 'HealthcareCase', [c.caseId], 'FOR SHARE');
    await this.lock(
      tx,
      c.companyId,
      'HealthcareCaseDispatch',
      [root.dispatchId],
      'FOR SHARE',
    );
    await this.lock(
      tx,
      c.companyId,
      'HealthcareCaseDispatchItem',
      root.items.map((i) => i.sourceDispatchItemId),
    );
    await this.lock(tx, c.companyId, 'HealthcareCaseReconciliation', [root.id]);
    await this.lock(
      tx,
      c.companyId,
      'HealthcareCaseReconciliationItem',
      root.items.map((i) => i.id),
    );
  }
  destinations(root: ReconciliationConfirmRoot): PositionKey[] {
    return root.items
      .filter(
        (i) =>
          i.lifecycle === 'ACTIVE' &&
          i.type === 'MATERIAL' &&
          (i.returnedQty ?? 0) > 0,
      )
      .map((i) => ({
        productId: i.sourceDispatchItem.productId,
        inventoryBatchId: i.sourceDispatchItem.batchId,
        state: 'AVAILABLE',
        contextType: null,
        contextId: null,
      }));
  }
  async lockPhysical(
    tx: Tx,
    c: ReconciliationConfirmContext,
    root: ReconciliationConfirmRoot,
  ) {
    const active = root.items.filter((i) => i.lifecycle === 'ACTIVE'),
      material = active.filter((i) => i.type === 'MATERIAL');
    const products = sorted(
      material.map((i) => i.sourceDispatchItem.productId),
    );
    if (products.length)
      await this.physical.lockProducts(tx, c.companyId, products);
    await this.physical.lockBatches(
      tx,
      c.companyId,
      sorted(
        material.flatMap((i) =>
          i.sourceDispatchItem.batchId ? [i.sourceDispatchItem.batchId] : [],
        ),
      ),
    );
    if (material.length)
      await this.physical.lockPositions(
        tx,
        c.companyId,
        sorted(
          material.flatMap((i) =>
            i.sourceCustodyPositionId ? [i.sourceCustodyPositionId] : [],
          ),
        ),
        this.destinations(root),
      );
    // All referenced Assets, including RETIRED, are UPDATE before any Custody.
    await this.lock(
      tx,
      c.companyId,
      'EquipmentAsset',
      active.flatMap((i) => (i.assetId ? [i.assetId] : [])),
    );
    await this.lock(
      tx,
      c.companyId,
      'EquipmentAssetCustody',
      active.flatMap((i) =>
        i.equipmentCustodyId ? [i.equipmentCustodyId] : [],
      ),
    );
  }
  async timestamp(tx: Tx) {
    const [row] = await tx.$queryRaw<
      { at: Date }[]
    >`SELECT transaction_timestamp()::timestamp(3) AS at`;
    return row.at;
  }
  async audit(
    tx: Tx,
    c: ReconciliationConfirmContext,
    revision: number,
    at: Date,
  ) {
    return tx.healthcareCaseReconciliationAudit.create({
      data: {
        companyId: c.companyId,
        reconciliationId: c.reconciliationId,
        operation: 'CONFIRM',
        actorId: c.actorId,
        revisionBefore: revision,
        revisionAfter: revision + 1,
        createdAt: at,
        change: { version: 1, operation: 'CONFIRM' },
      },
    });
  }
  async itemEvidence(
    tx: Tx,
    c: ReconciliationConfirmContext,
    id: string,
    data: Pick<
      Prisma.HealthcareCaseReconciliationItemUncheckedUpdateManyInput,
      | 'returnedDestinationPositionId'
      | 'returnedPhysicalEffectId'
      | 'usedPhysicalEffectId'
      | 'closePhysicalEventId'
    >,
  ) {
    return tx.healthcareCaseReconciliationItem.updateMany({
      where: {
        id,
        companyId: c.companyId,
        reconciliationId: c.reconciliationId,
        lifecycle: 'ACTIVE',
      },
      data,
    });
  }
  async itemSnapshot(
    tx: Tx,
    c: ReconciliationConfirmContext,
    id: string,
    snapshot: Prisma.InputJsonValue,
  ) {
    return tx.healthcareCaseReconciliationItem.updateMany({
      where: {
        id,
        companyId: c.companyId,
        reconciliationId: c.reconciliationId,
      },
      data: { snapshot },
    });
  }
  async finalize(
    tx: Tx,
    c: ReconciliationConfirmContext,
    revision: number,
    at: Date,
    snapshot: Prisma.InputJsonValue,
  ) {
    return tx.healthcareCaseReconciliation.updateMany({
      where: {
        id: c.reconciliationId,
        companyId: c.companyId,
        caseId: c.caseId,
        status: 'DRAFT',
        revision,
      },
      data: {
        status: 'CONFIRMED',
        revision: revision + 1,
        confirmedFromRevision: revision,
        confirmedById: c.actorId,
        confirmedAt: at,
        snapshotVersion: 1,
        snapshot,
      },
    });
  }
}
