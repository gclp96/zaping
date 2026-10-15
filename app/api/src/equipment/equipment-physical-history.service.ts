import { Injectable } from '@nestjs/common';
import { EquipmentAsset, Prisma } from '@prisma/client';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import {
  equipmentPhysicalAssert,
  equipmentPhysicalHash,
} from './equipment-physical.contract';

@Injectable()
export class EquipmentPhysicalHistoryService {
  constructor(
    private readonly repository: EquipmentPhysicalRepository = new EquipmentPhysicalRepository(),
  ) {}
  appendInspection(
    tx: Prisma.TransactionClient,
    before: EquipmentAsset,
    inspectionId: string,
    actorId: string,
    conditionAfter: EquipmentAsset['condition'],
  ) {
    return this.appendTransition(
      tx,
      before,
      'CONDITION_CHANGE',
      'EQUIPMENT_INSPECTION',
      inspectionId,
      'RECORD_RESULT',
      actorId,
      conditionAfter,
      before.lifecycle,
    );
  }
  appendRetirement(
    tx: Prisma.TransactionClient,
    before: EquipmentAsset,
    actorId: string,
  ) {
    return this.appendTransition(
      tx,
      before,
      'LIFECYCLE_CHANGE',
      'EQUIPMENT_RETIREMENT',
      before.id,
      'RETIRE',
      actorId,
      before.condition,
      'RETIRED',
    );
  }
  private appendTransition(
    tx: Prisma.TransactionClient,
    before: EquipmentAsset,
    operation: 'CONDITION_CHANGE' | 'LIFECYCLE_CHANGE',
    originType: string,
    originId: string,
    originOperation: string,
    actorId: string,
    conditionAfter: EquipmentAsset['condition'],
    lifecycleAfter: EquipmentAsset['lifecycle'],
  ) {
    return this.repository.appendPhysicalEvent(tx, {
      companyId: before.companyId,
      equipmentAssetId: before.id,
      custodyId: before.activeCustodyId,
      operation,
      originType,
      originId,
      originOperation,
      hashVersion: 1,
      requestHash: equipmentPhysicalHash({
        version: 1,
        companyId: before.companyId,
        assetId: before.id,
        operation,
        originType,
        originId,
        originOperation,
        actorId,
        revisionBefore: before.physicalRevision,
        conditionAfter,
        lifecycleAfter,
      }),
      physicalLocationBefore: before.physicalLocation,
      physicalLocationAfter: before.physicalLocation,
      conditionBefore: before.condition,
      conditionAfter,
      lifecycleBefore: before.lifecycle,
      lifecycleAfter,
      revisionBefore: before.physicalRevision,
      revisionAfter: before.physicalRevision + 1,
      actorId,
      reasonCode: originOperation,
    });
  }
  async requireReceiptActor(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string | undefined,
  ) {
    equipmentPhysicalAssert(actorId, 'EQUIPMENT_PHYSICAL_ACTOR_INVALID');
    const actor = await tx.user.findFirst({
      where: { id: actorId, companyId, isActive: true },
      select: { id: true, role: true },
    });
    equipmentPhysicalAssert(
      actor && ['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(actor.role),
      'EQUIPMENT_PHYSICAL_ACTOR_INVALID',
    );
    return actor.id;
  }
  async initializeReceipt(
    tx: Prisma.TransactionClient,
    asset: EquipmentAsset,
    receiptItemId: string,
    actorId: string,
  ) {
    equipmentPhysicalAssert(
      asset.purchaseReceiptItemId === receiptItemId &&
        asset.physicalRevision === 0 &&
        asset.physicalLocation === 'UNVERIFIED' &&
        asset.activeCustodyId === null &&
        asset.lifecycle === 'ACTIVE' &&
        asset.condition === 'INSPECTION_PENDING',
      'RESOURCE_STATE_CHANGED',
    );
    // NEW identity, never published outside the caller Receipt transaction. No HC lock.
    await this.repository.establishWarehouse(tx, asset);
    await this.repository.appendPhysicalEvent(tx, {
      companyId: asset.companyId,
      equipmentAssetId: asset.id,
      operation: 'RECEIPT_INITIALIZATION',
      originType: 'PURCHASE_RECEIPT_ITEM',
      originId: receiptItemId,
      originOperation: 'INITIALIZE_ASSET',
      hashVersion: 1,
      requestHash: equipmentPhysicalHash({
        version: 1,
        companyId: asset.companyId,
        assetId: asset.id,
        receiptItemId,
        actorId,
        location: 'WAREHOUSE',
        condition: 'INSPECTION_PENDING',
        lifecycle: 'ACTIVE',
        revision: 1,
      }),
      physicalLocationBefore: 'UNVERIFIED',
      physicalLocationAfter: 'WAREHOUSE',
      conditionBefore: asset.condition,
      conditionAfter: asset.condition,
      lifecycleBefore: asset.lifecycle,
      lifecycleAfter: asset.lifecycle,
      revisionBefore: 0,
      revisionAfter: 1,
      actorId,
      reasonCode: 'RECEIPT_INITIALIZATION',
    });
    return {
      ...asset,
      physicalLocation: 'WAREHOUSE' as const,
      physicalRevision: 1,
    };
  }
}
