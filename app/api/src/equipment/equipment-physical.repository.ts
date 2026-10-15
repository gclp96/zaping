import { Injectable } from '@nestjs/common';
import { EquipmentAsset, Prisma } from '@prisma/client';
import { equipmentPhysicalAssert } from './equipment-physical.contract';

@Injectable()
export class EquipmentPhysicalRepository {
  async lockAssetForPhysicalMutation(
    tx: Prisma.TransactionClient,
    companyId: string,
    assetId: string,
  ) {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "EquipmentAsset" WHERE "companyId" = ${companyId} AND "id" = ${assetId} FOR UPDATE
    `);
    equipmentPhysicalAssert(rows.length === 1, 'EQUIPMENT_ASSET_NOT_FOUND');
    return this.readPhysicalState(tx, companyId, assetId);
  }
  async readPhysicalState(
    tx: Prisma.TransactionClient,
    companyId: string,
    assetId: string,
  ) {
    const asset = await tx.equipmentAsset.findFirst({
      where: { id: assetId, companyId },
    });
    equipmentPhysicalAssert(asset, 'EQUIPMENT_ASSET_NOT_FOUND');
    return asset;
  }
  findPhysicalEventByOrigin(
    tx: Prisma.TransactionClient,
    companyId: string,
    assetId: string,
    originType: string,
    originId: string,
    originOperation: string,
  ) {
    return tx.equipmentAssetPhysicalEvent.findUnique({
      where: {
        companyId_equipmentAssetId_originType_originId_originOperation: {
          companyId,
          equipmentAssetId: assetId,
          originType,
          originId,
          originOperation,
        },
      },
    });
  }
  async establishWarehouse(
    tx: Prisma.TransactionClient,
    before: EquipmentAsset,
  ) {
    const result = await tx.equipmentAsset.updateMany({
      where: {
        id: before.id,
        companyId: before.companyId,
        physicalRevision: before.physicalRevision,
        physicalLocation: 'UNVERIFIED',
        activeCustodyId: null,
        condition: before.condition,
        lifecycle: before.lifecycle,
      },
      data: {
        physicalLocation: 'WAREHOUSE',
        physicalRevision: { increment: 1 },
      },
    });
    equipmentPhysicalAssert(result.count === 1, 'RESOURCE_STATE_CHANGED');
  }
  appendPhysicalEvent(
    tx: Prisma.TransactionClient,
    data: Prisma.EquipmentAssetPhysicalEventUncheckedCreateInput,
  ) {
    return tx.equipmentAssetPhysicalEvent.create({ data });
  }
}
