import { Injectable } from '@nestjs/common';
import {
  EquipmentAsset,
  EquipmentAssetCustody,
  EquipmentAssetPhysicalEvent,
  Prisma,
} from '@prisma/client';
import { deriveHealthcareCompanyLockKey } from '../healthcare/common/healthcare-company-lock-key';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from './equipment-physical-history.service';
import { EquipmentCustodyCloseContextRegistry } from './equipment-custody-close-context.registry';
import {
  EquipmentCustodyCloseCommand,
  EquipmentCustodyCloseResult,
  equipmentCustodyCloseHash,
  validateEquipmentCustodyClose,
} from './equipment-custody-close.contract';
import {
  equipmentPhysicalAssert,
  equipmentPhysicalFailure,
} from './equipment-physical.contract';

@Injectable()
export class EquipmentCustodyCloseService {
  constructor(
    private readonly repository: EquipmentPhysicalRepository,
    private readonly history: EquipmentPhysicalHistoryService,
    private readonly contexts: EquipmentCustodyCloseContextRegistry,
  ) {}
  // Caller owns tx and Company-first ordering; multi-Asset callers prelock Assets sorted.
  async returnFromCustody(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCloseCommand,
  ): Promise<EquipmentCustodyCloseResult> {
    try {
      validateEquipmentCustodyClose(c);
      const key = BigInt.asUintN(
        64,
        deriveHealthcareCompanyLockKey(c.companyId),
      );
      const [lock] = await tx.$queryRaw<{ held: boolean }[]>(Prisma.sql`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory'
        AND pid=pg_backend_pid() AND granted AND mode='ExclusiveLock'
        AND classid=(${key >> 32n}::bigint)::oid AND objid=(${key & 0xffffffffn}::bigint)::oid AND objsubid=1) AS held`);
      equipmentPhysicalAssert(lock?.held, 'RESOURCE_STATE_CHANGED');
      const asset = await this.repository.lockAssetForPhysicalMutation(
        tx,
        c.companyId,
        c.assetId,
      );
      const hash = equipmentCustodyCloseHash(c);
      const previous = await this.repository.findPhysicalEventByOrigin(
        tx,
        c.companyId,
        c.assetId,
        c.durableOrigin.type,
        c.durableOrigin.id,
        c.durableOrigin.operation,
      );
      if (previous) {
        equipmentPhysicalAssert(
          previous.requestHash === hash,
          'IDEMPOTENCY_KEY_REUSED',
        );
        await this.contexts.validate(tx, c, hash, 'REPLAY');
        // Only immutable historical facts: later custody/revision/condition are irrelevant.
        const custody = await tx.equipmentAssetCustody.findFirst({
          where: { id: c.custodyId, companyId: c.companyId },
        });
        this.proveWitness(previous, custody, c, hash);
        return this.result(previous, 'REPLAY');
      }
      const custody = await this.repository.lockCustodyForClose(
        tx,
        c.companyId,
        c.custodyId,
      );
      equipmentPhysicalAssert(
        custody.equipmentAssetId === c.assetId &&
          custody.caseId === c.caseId &&
          custody.assignmentId === c.assignmentId,
        'RESOURCE_STATE_CHANGED',
      );
      if (custody.closedAt !== null || custody.closedById !== null) {
        await this.history.requireReceiptActor(tx, c.companyId, c.actorId);
        await this.contexts.validate(tx, c, hash, 'APPLY');
        const closes = await tx.equipmentAssetPhysicalEvent.findMany({
          where: {
            companyId: c.companyId,
            equipmentAssetId: c.assetId,
            custodyId: c.custodyId,
            operation: 'CUSTODY_CLOSE',
          },
        });
        equipmentPhysicalAssert(
          closes.length === 1,
          'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
        );
        const original = closes[0];
        this.proveWitness(
          original,
          custody,
          {
            ...c,
            expectedPhysicalRevision: original.revisionBefore,
            reportedCondition: original.conditionAfter,
            durableOrigin: {
              type: original.originType,
              id: original.originId,
              operation: original.originOperation,
            },
          },
          original.requestHash,
        );
        equipmentPhysicalAssert(false, 'EQUIPMENT_CUSTODY_ALREADY_CLOSED');
      }
      equipmentPhysicalAssert(
        asset.physicalLocation === 'CUSTODY' &&
          asset.activeCustodyId === custody.id &&
          asset.physicalRevision === c.expectedPhysicalRevision,
        'RESOURCE_STATE_CHANGED',
      );
      await this.proveApplyHistory(tx, asset, custody);
      const [clock] = await tx.$queryRaw<{ closedAt: Date }[]>(
        Prisma.sql`SELECT date_trunc('milliseconds', clock_timestamp()) AS "closedAt"`,
      );
      equipmentPhysicalAssert(
        clock?.closedAt instanceof Date && clock.closedAt >= custody.openedAt,
        'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
      );
      await this.history.requireReceiptActor(tx, c.companyId, c.actorId);
      await this.contexts.validate(tx, c, hash, 'APPLY');
      await this.repository.closeCustodyCas(
        tx,
        custody,
        clock.closedAt,
        c.actorId,
      );
      await this.repository.closeAssetFromCustodyCas(
        tx,
        asset,
        custody.id,
        c.reportedCondition,
      );
      const event = await this.history.appendCustodyClose(
        tx,
        asset,
        c,
        hash,
        clock.closedAt,
      );
      return this.result(event, 'CLOSED');
    } catch (error) {
      equipmentPhysicalFailure(error);
    }
  }
  private async proveApplyHistory(
    tx: Prisma.TransactionClient,
    asset: EquipmentAsset,
    custody: EquipmentAssetCustody,
  ) {
    const open = await tx.equipmentAssetCustody.findMany({
      where: {
        companyId: asset.companyId,
        equipmentAssetId: asset.id,
        closedAt: null,
      },
    });
    const chain = await tx.equipmentAssetPhysicalEvent.findMany({
      where: { companyId: asset.companyId, equipmentAssetId: asset.id },
      orderBy: { revisionAfter: 'asc' },
    });
    let revision = 0;
    let previous: EquipmentAssetPhysicalEvent | undefined;
    let opening: EquipmentAssetPhysicalEvent | undefined;
    for (const event of chain) {
      equipmentPhysicalAssert(
        event.revisionBefore === revision &&
          event.revisionAfter === revision + 1 &&
          (!previous ||
            (event.physicalLocationBefore === previous.physicalLocationAfter &&
              event.conditionBefore === previous.conditionAfter &&
              event.lifecycleBefore === previous.lifecycleAfter)),
        'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
      );
      if (event.operation === 'CUSTODY_OPEN' && event.custodyId === custody.id)
        opening = event;
      revision = event.revisionAfter;
      previous = event;
    }
    equipmentPhysicalAssert(
      open.length === 1 &&
        open[0].id === custody.id &&
        opening &&
        opening.physicalLocationBefore === 'WAREHOUSE' &&
        opening.physicalLocationAfter === 'CUSTODY' &&
        opening.actorId === custody.openedById &&
        previous &&
        revision === asset.physicalRevision &&
        previous.physicalLocationAfter === asset.physicalLocation &&
        previous.conditionAfter === asset.condition &&
        previous.lifecycleAfter === asset.lifecycle &&
        previous.custodyId === custody.id,
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
  }
  private proveWitness(
    e: EquipmentAssetPhysicalEvent,
    custody: EquipmentAssetCustody | null,
    c: EquipmentCustodyCloseCommand,
    hash: string,
  ): void {
    equipmentPhysicalAssert(
      custody &&
        custody.id === c.custodyId &&
        custody.companyId === c.companyId &&
        custody.equipmentAssetId === c.assetId &&
        custody.caseId === c.caseId &&
        custody.assignmentId === c.assignmentId &&
        e.operation === 'CUSTODY_CLOSE' &&
        e.hashVersion === 1 &&
        e.requestHash === hash &&
        e.originType === c.durableOrigin.type &&
        e.originId === c.durableOrigin.id &&
        e.originOperation === c.durableOrigin.operation &&
        e.companyId === c.companyId &&
        e.equipmentAssetId === c.assetId &&
        e.custodyId === c.custodyId &&
        e.revisionBefore === c.expectedPhysicalRevision &&
        e.revisionAfter === e.revisionBefore + 1 &&
        e.physicalLocationBefore === 'CUSTODY' &&
        e.physicalLocationAfter === 'WAREHOUSE' &&
        e.conditionAfter === c.reportedCondition &&
        e.lifecycleBefore === e.lifecycleAfter &&
        e.actorId !== null &&
        custody.closedById === e.actorId &&
        custody.closedAt?.getTime() === e.createdAt.getTime() &&
        e.createdAt >= custody.openedAt,
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
  }
  private result(
    e: EquipmentAssetPhysicalEvent,
    outcome: EquipmentCustodyCloseResult['outcome'],
  ): EquipmentCustodyCloseResult {
    equipmentPhysicalAssert(
      e.custodyId && e.actorId,
      'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR',
    );
    return {
      outcome,
      custodyId: e.custodyId,
      physicalEventId: e.id,
      assetId: e.equipmentAssetId,
      revisionBefore: e.revisionBefore,
      revisionAfter: e.revisionAfter,
      conditionBefore: e.conditionBefore,
      conditionAfter: e.conditionAfter,
      lifecycleBefore: e.lifecycleBefore,
      lifecycleAfter: e.lifecycleAfter,
      locationBefore: 'CUSTODY',
      locationAfter: 'WAREHOUSE',
      activeCustodyIdBefore: e.custodyId,
      activeCustodyIdAfter: null,
      closedAt: e.createdAt,
      closedById: e.actorId,
    };
  }
}
