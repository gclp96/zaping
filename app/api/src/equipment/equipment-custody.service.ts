import { Injectable } from '@nestjs/common';
import {
  EquipmentAsset,
  EquipmentAssetPhysicalEvent,
  Prisma,
} from '@prisma/client';
import { deriveHealthcareCompanyLockKey } from '../healthcare/common/healthcare-company-lock-key';
import { equipmentAssetNotEligibleException } from '../healthcare/common/healthcare-errors';
import {
  EquipmentCustodyCommand,
  EquipmentCustodyContextRegistry,
} from './equipment-custody-context.registry';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from './equipment-physical-history.service';
import { evaluateEquipmentPhysicalEligibility } from './equipment-physical-eligibility';
import {
  equipmentPhysicalAssert,
  equipmentPhysicalFailure,
  equipmentPhysicalHash,
  physicalId,
  physicalRevision,
  physicalText,
} from './equipment-physical.contract';

@Injectable()
export class EquipmentCustodyService {
  constructor(
    private readonly repository: EquipmentPhysicalRepository,
    private readonly history: EquipmentPhysicalHistoryService,
    private readonly contexts: EquipmentCustodyContextRegistry,
  ) {}

  // Caller owns transaction, authorization and Company-first ordering. Never acquires
  // an Inventory fence or a Company lock after business locks. No public controller.
  async transferToCustody(
    tx: Prisma.TransactionClient,
    c: EquipmentCustodyCommand,
  ) {
    try {
      for (const id of [
        c.companyId,
        c.assetId,
        c.caseId,
        c.assignmentId,
        c.actorId,
        c.durableOrigin?.id,
      ])
        physicalId(id);
      physicalRevision(c.expectedPhysicalRevision);
      equipmentPhysicalAssert(
        physicalText(c.validatedContext?.adapterKey, 64) &&
          physicalText(c.validatedContext?.contextId, 128) &&
          physicalText(c.durableOrigin.type, 64) &&
          physicalText(c.durableOrigin.operation, 64),
      );
      const key = BigInt.asUintN(
        64,
        deriveHealthcareCompanyLockKey(c.companyId),
      );
      const [lock] = await tx.$queryRaw<{ held: boolean }[]>(Prisma.sql`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory'
          AND pid=pg_backend_pid() AND granted AND mode='ExclusiveLock'
          AND classid=(${key >> 32n}::bigint)::oid AND objid=(${key & 0xffffffffn}::bigint)::oid
          AND objsubid=1) AS held`);
      equipmentPhysicalAssert(lock?.held, 'RESOURCE_STATE_CHANGED');
      const asset = await this.repository.lockAssetForPhysicalMutation(
        tx,
        c.companyId,
        c.assetId,
      );
      const hash = equipmentPhysicalHash({
        version: 1,
        companyId: c.companyId,
        assetId: c.assetId,
        caseId: c.caseId,
        assignmentId: c.assignmentId,
        expectedPhysicalRevision: c.expectedPhysicalRevision,
        adapterKey: c.validatedContext.adapterKey,
        contextId: c.validatedContext.contextId,
        originType: c.durableOrigin.type,
        originId: c.durableOrigin.id,
        originOperation: c.durableOrigin.operation,
      });
      const previous = await this.repository.findPhysicalEventByOrigin(
        tx,
        c.companyId,
        c.assetId,
        c.durableOrigin.type,
        c.durableOrigin.id,
        c.durableOrigin.operation,
      );
      if (previous)
        equipmentPhysicalAssert(
          previous.hashVersion === 1 &&
            previous.requestHash === hash &&
            previous.operation === 'CUSTODY_OPEN',
          'IDEMPOTENCY_KEY_REUSED',
        );
      await this.history.requireReceiptActor(tx, c.companyId, c.actorId);
      await this.contexts.validate(tx, c, hash, previous ? 'REPLAY' : 'APPLY');
      if (previous) {
        const custody = await this.proveReplay(tx, asset, previous, c);
        return { outcome: 'REPLAY' as const, custody, event: previous };
      }
      const assignment = await tx.healthcareEquipmentAssignment.findFirst({
        where: {
          id: c.assignmentId,
          companyId: c.companyId,
          caseId: c.caseId,
          equipmentAssetId: c.assetId,
          lifecycle: 'RESERVED',
        },
      });
      equipmentPhysicalAssert(assignment, 'RESOURCE_STATE_CHANGED');
      const healthcareCase = await tx.healthcareCase.findFirst({
        where: { id: c.caseId, companyId: c.companyId },
      });
      equipmentPhysicalAssert(healthcareCase, 'RESOURCE_STATE_CHANGED');
      const eligibility = evaluateEquipmentPhysicalEligibility(asset);
      if (!eligibility.available)
        throw equipmentAssetNotEligibleException(eligibility.reasons);
      equipmentPhysicalAssert(
        asset.physicalRevision === c.expectedPhysicalRevision,
        'RESOURCE_STATE_CHANGED',
      );
      const open = await tx.equipmentAssetCustody.findFirst({
        where: {
          companyId: c.companyId,
          equipmentAssetId: c.assetId,
          closedAt: null,
        },
      });
      equipmentPhysicalAssert(!open, 'RESOURCE_STATE_CHANGED');
      const custody = await tx.equipmentAssetCustody.create({
        data: {
          companyId: c.companyId,
          equipmentAssetId: c.assetId,
          caseId: c.caseId,
          assignmentId: c.assignmentId,
          openedById: c.actorId,
        },
      });
      await this.repository.openCustody(tx, asset, custody.id);
      const event = await this.repository.appendPhysicalEvent(tx, {
        companyId: c.companyId,
        equipmentAssetId: c.assetId,
        custodyId: custody.id,
        operation: 'CUSTODY_OPEN',
        originType: c.durableOrigin.type,
        originId: c.durableOrigin.id,
        originOperation: c.durableOrigin.operation,
        hashVersion: 1,
        requestHash: hash,
        physicalLocationBefore: 'WAREHOUSE',
        physicalLocationAfter: 'CUSTODY',
        conditionBefore: asset.condition,
        conditionAfter: asset.condition,
        lifecycleBefore: asset.lifecycle,
        lifecycleAfter: asset.lifecycle,
        revisionBefore: asset.physicalRevision,
        revisionAfter: asset.physicalRevision + 1,
        actorId: c.actorId,
        reasonCode: 'CUSTODY_OPEN',
      });
      return { outcome: 'OPENED' as const, custody, event };
    } catch (error) {
      equipmentPhysicalFailure(error);
    }
  }

  private async proveReplay(
    tx: Prisma.TransactionClient,
    asset: EquipmentAsset,
    event: EquipmentAssetPhysicalEvent,
    c: EquipmentCustodyCommand,
  ) {
    const custody = await tx.equipmentAssetCustody.findFirst({
      where: {
        id: event.custodyId ?? '',
        companyId: c.companyId,
        equipmentAssetId: c.assetId,
        caseId: c.caseId,
        assignmentId: c.assignmentId,
      },
    });
    equipmentPhysicalAssert(
      custody &&
        custody.openedById === event.actorId &&
        event.revisionBefore === c.expectedPhysicalRevision &&
        event.revisionAfter === event.revisionBefore + 1 &&
        event.physicalLocationBefore === 'WAREHOUSE' &&
        event.physicalLocationAfter === 'CUSTODY' &&
        event.conditionBefore === 'GOOD' &&
        event.conditionAfter === 'GOOD' &&
        event.lifecycleBefore === 'ACTIVE' &&
        event.lifecycleAfter === 'ACTIVE',
      'RESOURCE_STATE_CHANGED',
    );
    const events = await tx.equipmentAssetPhysicalEvent.findMany({
      where: {
        companyId: c.companyId,
        equipmentAssetId: c.assetId,
        revisionAfter: { gte: event.revisionAfter },
      },
      orderBy: { revisionAfter: 'asc' },
    });
    let last = event;
    equipmentPhysicalAssert(
      events[0]?.id === event.id,
      'RESOURCE_STATE_CHANGED',
    );
    for (const next of events.slice(1)) {
      equipmentPhysicalAssert(
        next.revisionBefore === last.revisionAfter &&
          next.revisionAfter === next.revisionBefore + 1 &&
          next.physicalLocationBefore === last.physicalLocationAfter &&
          next.conditionBefore === last.conditionAfter &&
          next.lifecycleBefore === last.lifecycleAfter,
        'RESOURCE_STATE_CHANGED',
      );
      last = next;
    }
    const open = await tx.equipmentAssetCustody.findMany({
      where: {
        companyId: c.companyId,
        equipmentAssetId: c.assetId,
        closedAt: null,
      },
    });
    equipmentPhysicalAssert(
      asset.physicalRevision === last.revisionAfter &&
        asset.condition === last.conditionAfter &&
        asset.lifecycle === last.lifecycleAfter &&
        asset.physicalLocation === last.physicalLocationAfter &&
        (asset.physicalLocation === 'CUSTODY'
          ? open.length === 1 &&
            open[0].id === asset.activeCustodyId &&
            last.custodyId === asset.activeCustodyId
          : open.length === 0 && asset.activeCustodyId === null) &&
        (custody.closedAt === null
          ? asset.activeCustodyId === custody.id
          : asset.activeCustodyId !== custody.id),
      'RESOURCE_STATE_CHANGED',
    );
    if (custody.closedAt !== null)
      equipmentPhysicalAssert(
        events.some(
          (e) =>
            e.operation === 'CUSTODY_CLOSE' &&
            e.custodyId === custody.id &&
            e.physicalLocationBefore === 'CUSTODY' &&
            e.physicalLocationAfter === 'WAREHOUSE' &&
            e.actorId === custody.closedById,
        ),
        'RESOURCE_STATE_CHANGED',
      );
    return custody;
  }
}
