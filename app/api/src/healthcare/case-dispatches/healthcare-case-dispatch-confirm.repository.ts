import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { healthcareCaseKitSelect } from '../case-kits/healthcare-case-kits.repository';
import { HealthcareEquipmentAssignmentsRepository } from '../equipment-assignments/healthcare-equipment-assignments.repository';
import { HealthcareCaseDispatchCommandRepository } from './healthcare-case-dispatch-command.repository';
import { DispatchCommandContext } from './healthcare-case-dispatch-command.types';
import { PhysicalInventoryRepository } from '../../inventory/physical/physical-inventory.repository';
import { PositionKey } from '../../inventory/physical/physical-inventory.contract';

export type ConfirmContext = DispatchCommandContext & { dispatchId: string };
type Tx = Prisma.TransactionClient;
const include = {
  healthcareCase: true,
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: true,
      batch: true,
      asset: true,
      assignment: true,
      sourceCaseKitItem: {
        include: { requirement: true, equipmentAssignment: true },
      },
    },
  },
} satisfies Prisma.HealthcareCaseDispatchInclude;
export type ConfirmRoot = Prisma.HealthcareCaseDispatchGetPayload<{
  include: typeof include;
}>;
export type ConfirmItem = ConfirmRoot['items'][number];
export type ConfirmKit = NonNullable<
  Awaited<ReturnType<HealthcareCaseDispatchConfirmRepository['kit']>>
>;
const sorted = (ids: string[]) => [...new Set(ids)].sort();
type Table =
  | 'HealthcareCaseKit'
  | 'HealthcareCaseDispatch'
  | 'HealthcareCaseDispatchItem'
  | 'HealthcareCaseKitItem'
  | 'EquipmentAsset'
  | 'HealthcareCaseRequirement'
  | 'HealthcareEquipmentAssignment';

@Injectable()
export class HealthcareCaseDispatchConfirmRepository {
  constructor(
    readonly prisma: PrismaService,
    readonly commands: HealthcareCaseDispatchCommandRepository,
    readonly assignments: HealthcareEquipmentAssignmentsRepository,
    readonly physical: PhysicalInventoryRepository,
  ) {}
  root(tx: Tx, c: ConfirmContext) {
    return tx.healthcareCaseDispatch.findFirst({
      where: { id: c.dispatchId, companyId: c.companyId, caseId: c.caseId },
      include,
    });
  }
  kit(tx: Tx, c: ConfirmContext) {
    return tx.healthcareCaseKit.findUnique({
      where: { companyId_caseId: { companyId: c.companyId, caseId: c.caseId } },
      select: healthcareCaseKitSelect,
    });
  }
  private async lock(
    tx: Tx,
    companyId: string,
    table: Table,
    ids: string[],
    mode: 'FOR UPDATE' | 'FOR SHARE' = 'FOR UPDATE',
  ) {
    if (!ids.length) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM ${Prisma.raw('"' + table + '"')} WHERE "companyId"=${companyId} AND id IN (${Prisma.join(sorted(ids))}) ORDER BY id ${Prisma.raw(mode)}`,
    );
  }
  async lockCases(tx: Tx, c: ConfirmContext, assetIds: string[]) {
    await this.assignments.acquireSettingsSharedAdvisoryLock(tx, c.companyId);
    const reservations = assetIds.length
      ? await this.assignments.findReservedAssignmentsForAssets(
          c.companyId,
          assetIds,
          tx,
        )
      : [];
    await this.assignments.lockHealthcareCasesForShare(
      tx,
      c.companyId,
      sorted([c.caseId, ...reservations.map((r) => r.caseId)]),
    );
    return this.assignments.findSettingsForShare(tx, c.companyId);
  }
  async lockStructure(
    tx: Tx,
    c: ConfirmContext,
    root: ConfirmRoot,
    kit: ConfirmKit,
  ) {
    await this.lock(tx, c.companyId, 'HealthcareCaseKit', [kit.id]);
    await this.lock(tx, c.companyId, 'HealthcareCaseDispatch', [root.id]);
    await this.lock(
      tx,
      c.companyId,
      'HealthcareCaseDispatchItem',
      root.items.map((i) => i.id),
    );
    await this.lock(tx, c.companyId, 'HealthcareCaseKitItem', [
      ...root.items.map((i) => i.sourceCaseKitItemId),
      ...kit.items.filter((i) => i.lifecycle === 'ACTIVE').map((i) => i.id),
    ]);
  }
  assetIds(root: ConfirmRoot, kit: ConfirmKit) {
    return sorted([
      ...root.items
        .filter((i) => i.lifecycle === 'ACTIVE' && i.assetId)
        .map((i) => i.assetId!),
      ...kit.items
        .filter((i) => i.lifecycle === 'ACTIVE' && i.equipmentAssignment)
        .map((i) => i.equipmentAssignment!.equipmentAsset.id),
    ]);
  }
  destinations(root: ConfirmRoot): PositionKey[] {
    return root.items
      .filter((i) => i.lifecycle === 'ACTIVE' && i.type === 'MATERIAL')
      .map((i) => ({
        productId: i.productId,
        inventoryBatchId: i.batchId,
        state: 'CUSTODY',
        contextType: 'CASE_DISPATCH_ITEM',
        contextId: i.id,
      }));
  }
  async lockPhysical(
    tx: Tx,
    c: ConfirmContext,
    root: ConfirmRoot,
    kit: ConfirmKit,
  ) {
    const activeKit = kit.items.filter((i) => i.lifecycle === 'ACTIVE');
    const productIds = sorted([
      ...root.items.map((i) => i.productId),
      ...activeKit.flatMap((i) =>
        i.requirement
          ? [i.requirement.productId]
          : i.equipmentAssignment
            ? [i.equipmentAssignment.equipmentAsset.product.id]
            : [],
      ),
    ]);
    if (productIds.length)
      await this.physical.lockProducts(tx, c.companyId, productIds);
    await this.physical.lockBatches(
      tx,
      c.companyId,
      sorted(root.items.flatMap((i) => (i.batchId ? [i.batchId] : []))),
    );
    await this.physical.lockPositions(
      tx,
      c.companyId,
      sorted(
        root.items
          .filter((i) => i.lifecycle === 'ACTIVE' && i.sourcePositionId)
          .map((i) => i.sourcePositionId!),
      ),
      this.destinations(root),
    );
    // All physical mutation Assets are UPDATE from the outset: custody must never
    // introduce a SHARE -> UPDATE upgrade after Assignment locks.
    await this.lock(
      tx,
      c.companyId,
      'EquipmentAsset',
      this.assetIds(root, kit),
    );
    await this.lock(
      tx,
      c.companyId,
      'HealthcareCaseRequirement',
      sorted([
        ...kit.healthcareCase.requirements.map((r) => r.id),
        ...activeKit.flatMap((i) => (i.requirementId ? [i.requirementId] : [])),
      ]),
      'FOR SHARE',
    );
    await this.lock(
      tx,
      c.companyId,
      'HealthcareEquipmentAssignment',
      sorted([
        ...root.items
          .filter((i) => i.lifecycle === 'ACTIVE' && i.assignmentId)
          .map((i) => i.assignmentId!),
        ...activeKit.flatMap((i) =>
          i.equipmentAssignmentId ? [i.equipmentAssignmentId] : [],
        ),
      ]),
      'FOR SHARE',
    );
  }
  bindings(root: ConfirmRoot, kit: ConfirmKit) {
    return JSON.stringify({
      root: [root.id, root.caseKitId, root.revision],
      items: root.items.map((i) => [
        i.id,
        i.lifecycle,
        i.sourceCaseKitItemId,
        i.productId,
        i.batchId,
        i.sourcePositionId,
        i.assignmentId,
        i.assetId,
        i.expectedPositionRevision,
        i.expectedPhysicalRevision,
        i.quantity,
      ]),
      kit: [
        kit.id,
        kit.items.map((i) => [
          i.id,
          i.lifecycle,
          i.requirementId,
          i.requirement?.productId,
          i.equipmentAssignmentId,
          i.equipmentAssignment?.equipmentAsset.id,
          i.equipmentAssignment?.equipmentAsset.product.id,
        ]),
      ],
    });
  }
  async materialConsumed(tx: Tx, c: ConfirmContext, sourceId: string) {
    const result = await tx.healthcareCaseDispatchItem.aggregate({
      where: {
        companyId: c.companyId,
        sourceCaseKitItemId: sourceId,
        lifecycle: 'ACTIVE',
        type: 'MATERIAL',
        dispatch: { status: 'CONFIRMED' },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }
  equipmentConsumed(tx: Tx, c: ConfirmContext, sourceId: string) {
    return tx.healthcareCaseDispatchItem.findFirst({
      where: {
        companyId: c.companyId,
        sourceCaseKitItemId: sourceId,
        equipmentCustodyId: { not: null },
        dispatch: { status: 'CONFIRMED' },
      },
      select: { id: true },
    });
  }
  async audit(tx: Tx, c: ConfirmContext, revision: number, at?: Date) {
    return tx.healthcareCaseDispatchAudit.create({
      data: {
        companyId: c.companyId,
        dispatchId: c.dispatchId,
        actorId: c.actorId,
        createdAt: at ?? (await this.timestamp(tx)),
        operation: 'CONFIRM',
        revisionBefore: revision,
        revisionAfter: revision + 1,
        change: { version: 1, operation: 'CONFIRM', reason: null },
      },
    });
  }
  async timestamp(tx: Tx) {
    const [row] = await tx.$queryRaw<
      { at: Date }[]
    >`SELECT transaction_timestamp()::timestamp(3) AS at`;
    return row.at;
  }
  async itemEvidence(
    tx: Tx,
    c: ConfirmContext,
    id: string,
    data: Pick<
      Prisma.HealthcareCaseDispatchItemUncheckedUpdateManyInput,
      | 'destinationPositionId'
      | 'physicalEffectId'
      | 'equipmentCustodyId'
      | 'equipmentPhysicalEventId'
    >,
  ) {
    return tx.healthcareCaseDispatchItem.updateMany({
      where: {
        id,
        companyId: c.companyId,
        dispatchId: c.dispatchId,
        lifecycle: 'ACTIVE',
      },
      data,
    });
  }
  async itemSnapshot(
    tx: Tx,
    c: ConfirmContext,
    id: string,
    snapshot: Prisma.InputJsonValue,
  ) {
    return tx.healthcareCaseDispatchItem.updateMany({
      where: { id, companyId: c.companyId, dispatchId: c.dispatchId },
      data: { snapshot },
    });
  }
  async finalize(
    tx: Tx,
    c: ConfirmContext,
    revision: number,
    at: Date,
    snapshot: Prisma.InputJsonValue,
  ) {
    return tx.healthcareCaseDispatch.updateMany({
      where: {
        id: c.dispatchId,
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
