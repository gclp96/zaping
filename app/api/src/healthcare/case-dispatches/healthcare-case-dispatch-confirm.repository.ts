import { healthcarePersistenceException } from '../common/healthcare-errors';
import { DispatchItemSnapshot } from './healthcare-case-dispatch.types';
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
export type DispatchItemEvidence = { id: string } & (
  | {
      type: 'MATERIAL';
      destinationPositionId: string;
      physicalEffectId: string;
    }
  | {
      type: 'EQUIPMENT';
      equipmentCustodyId: string;
      equipmentPhysicalEventId: string;
    }
);
export type DispatchItemSnapshotWrite = {
  id: string;
  lifecycle: 'ACTIVE' | 'EXCLUDED';
  snapshot: DispatchItemSnapshot;
};
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
  private uniqueItems(rows: { id: string }[]) {
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw healthcarePersistenceException();
  }
  private exactItems(expected: { id: string }[], actual: { id: string }[]) {
    const ids = new Set(actual.map((r) => r.id));
    if (
      actual.length !== expected.length ||
      ids.size !== expected.length ||
      !expected.every((r) => ids.has(r.id))
    )
      throw healthcarePersistenceException();
  }
  // Caller already holds the root and every item lock in canonical order.
  async itemEvidenceBulk(
    tx: Tx,
    c: ConfirmContext,
    rows: DispatchItemEvidence[],
  ) {
    this.uniqueItems(rows);
    for (let offset = 0; offset < rows.length; offset += 250) {
      const chunk = rows.slice(offset, offset + 250);
      const values = chunk.map(
        (r) => Prisma.sql`(${r.id}::text, ${r.type}::text,
        ${r.type === 'MATERIAL' ? r.destinationPositionId : null}::text,
        ${r.type === 'MATERIAL' ? r.physicalEffectId : null}::text,
        ${r.type === 'EQUIPMENT' ? r.equipmentCustodyId : null}::text,
        ${r.type === 'EQUIPMENT' ? r.equipmentPhysicalEventId : null}::text)`,
      );
      const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "HealthcareCaseDispatchItem" i SET
          "destinationPositionId"=v.destination, "physicalEffectId"=v.effect,
          "equipmentCustodyId"=v.custody, "equipmentPhysicalEventId"=v.event
        FROM (VALUES ${Prisma.join(values)}) v(id, type, destination, effect, custody, event),
          "HealthcareCaseDispatch" d
        WHERE i.id=v.id AND i."companyId"=${c.companyId} AND i."dispatchId"=${c.dispatchId}
          AND i.lifecycle='ACTIVE' AND i.type::text=v.type AND i.snapshot IS NULL
          AND i."physicalEffectId" IS NULL AND i."destinationPositionId" IS NULL
          AND i."equipmentCustodyId" IS NULL AND i."equipmentPhysicalEventId" IS NULL
          AND d.id=i."dispatchId" AND d."companyId"=i."companyId"
          AND d."caseId"=${c.caseId} AND d.status='DRAFT'
          AND ((v.type='MATERIAL' AND EXISTS (
            SELECT 1 FROM "InventoryPosition" p JOIN "InventoryPhysicalEffect" e
              ON e.id=v.effect AND e."companyId"=i."companyId"
            JOIN "InventoryPhysicalEffectLine" l ON l."effectId"=e.id
              AND l."companyId"=e."companyId" AND l."positionId"=p.id
            WHERE p.id=v.destination AND p."companyId"=i."companyId"
              AND p."productId"=i."productId" AND p."inventoryBatchId" IS NOT DISTINCT FROM i."batchId"
              AND p.state='CUSTODY' AND p."contextType"='CASE_DISPATCH_ITEM' AND p."contextId"=i.id
              AND e.kind='TRANSFER' AND e."originType"='CASE_DISPATCH' AND e."originId"=d.id
              AND e."originOperation"='CONFIRM_QUANTITY' AND l.delta=i.quantity
          )) OR (v.type='EQUIPMENT' AND EXISTS (
            SELECT 1 FROM "EquipmentAssetCustody" u JOIN "EquipmentAssetPhysicalEvent" e
              ON e.id=v.event AND e."companyId"=u."companyId" AND e."custodyId"=u.id
            WHERE u.id=v.custody AND u."companyId"=i."companyId" AND u."equipmentAssetId"=i."assetId"
              AND u."caseId"=i."caseId" AND u."assignmentId"=i."assignmentId"
              AND e."equipmentAssetId"=i."assetId" AND e.operation='CUSTODY_OPEN'
              AND e."originType"='CASE_DISPATCH_ITEM' AND e."originId"=i.id
              AND e."originOperation"='CONFIRM_EQUIPMENT'
          ))) RETURNING i.id`);
      this.exactItems(chunk, updated);
    }
    return { count: rows.length };
  }
  async itemSnapshotsBulk(
    tx: Tx,
    c: ConfirmContext,
    rows: DispatchItemSnapshotWrite[],
  ) {
    this.uniqueItems(rows);
    for (let offset = 0; offset < rows.length; offset += 250) {
      const chunk = rows.slice(offset, offset + 250);
      const values = chunk.map(
        (r) =>
          Prisma.sql`(${r.id}::text, ${r.lifecycle}::text, ${JSON.stringify(r.snapshot)}::jsonb)`,
      );
      const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "HealthcareCaseDispatchItem" i SET snapshot=v.snapshot
        FROM (VALUES ${Prisma.join(values)}) v(id, lifecycle, snapshot), "HealthcareCaseDispatch" d
        WHERE i.id=v.id AND i."companyId"=${c.companyId} AND i."dispatchId"=${c.dispatchId}
          AND i.lifecycle::text=v.lifecycle AND i.snapshot IS NULL
          AND d.id=i."dispatchId" AND d."companyId"=i."companyId"
          AND d."caseId"=${c.caseId} AND d.status='DRAFT'
          AND v.snapshot->>'version'='1'
        RETURNING i.id`);
      this.exactItems(chunk, updated);
    }
    return { count: rows.length };
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
