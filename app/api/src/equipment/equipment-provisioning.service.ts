import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EquipmentAsset,
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentOrigin,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import { EquipmentAssetCodeService } from './equipment-asset-code.service';

@Injectable()
export class EquipmentProvisioningService {
  constructor(
    private readonly equipmentAssetCodeService: EquipmentAssetCodeService,
  ) {}

  // Dormant Receipt can reserve codes before acquiring Product roots.
  async prepareReceiptCodes(
    tx: Prisma.TransactionClient,
    companyId: string,
    quantity: number,
  ) {
    const codes: string[] = [];
    for (let i = 0; i < quantity; i++) {
      codes.push(
        await this.equipmentAssetCodeService.allocateNextAvailableAssetCode(
          tx,
          companyId,
        ),
      );
    }
    return codes;
  }

  async provisionFromPurchaseReceiptItem(
    tx: Prisma.TransactionClient,
    companyId: string,
    purchaseReceiptItemId: string,
    preparedCodes?: string[],
  ): Promise<EquipmentAsset[]> {
    const receiptItem = await tx.purchaseReceiptItem.findFirst({
      where: {
        id: purchaseReceiptItemId,
        companyId,
      },
      select: {
        id: true,
        productId: true,
        quantityReceived: true,
        batchId: true,
        product: {
          select: {
            inventoryTracking: true,
          },
        },
      },
    });

    if (!receiptItem) {
      throw new NotFoundException('Partida de recepción no encontrada');
    }

    if (
      receiptItem.product.inventoryTracking !== ProductInventoryTracking.ASSET
    ) {
      return [];
    }

    const equipmentAssets: EquipmentAsset[] = [];

    if (
      preparedCodes &&
      preparedCodes.length !== receiptItem.quantityReceived
    ) {
      throw new Error('Prepared Equipment code count mismatch');
    }

    for (let index = 0; index < receiptItem.quantityReceived; index += 1) {
      const assetCode =
        preparedCodes?.[index] ??
        (await this.equipmentAssetCodeService.allocateNextAvailableAssetCode(
          tx,
          companyId,
        ));

      const equipmentAsset = await tx.equipmentAsset.create({
        data: {
          companyId,
          productId: receiptItem.productId,
          assetCode,
          serialNumber: null,
          serialNumberKey: null,
          lifecycle: EquipmentLifecycle.ACTIVE,
          condition: EquipmentCondition.INSPECTION_PENDING,
          origin: EquipmentOrigin.PURCHASE_RECEIPT,
          purchaseReceiptItemId: receiptItem.id,
          batchId: receiptItem.batchId,
        },
      });

      equipmentAssets.push(equipmentAsset);
    }

    return equipmentAssets;
  }
}
