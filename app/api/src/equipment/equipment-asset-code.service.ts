import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const EQUIPMENT_ASSET_CODE_SEQUENCE_KEY = 'EQUIPMENT_ASSET_CODE';

@Injectable()
export class EquipmentAssetCodeService {
  async allocateNextAvailableAssetCode(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    await this.ensureEquipmentAssetCodeSequence(tx, companyId);

    while (true) {
      const nextValue = await this.allocateNextEquipmentSequenceValue(
        tx,
        companyId,
      );

      const assetCode = this.formatEquipmentAssetCode(nextValue);

      const existingAssetCode = await tx.equipmentAsset.findFirst({
        where: {
          companyId,
          assetCode,
        },
        select: {
          id: true,
        },
      });

      if (!existingAssetCode) {
        return assetCode;
      }
    }
  }

  private async ensureEquipmentAssetCodeSequence(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    await tx.companySequence.createMany({
      data: [
        {
          companyId,
          key: EQUIPMENT_ASSET_CODE_SEQUENCE_KEY,
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async allocateNextEquipmentSequenceValue(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    const sequence = await tx.companySequence.update({
      where: {
        companyId_key: {
          companyId,
          key: EQUIPMENT_ASSET_CODE_SEQUENCE_KEY,
        },
      },
      data: {
        nextValue: {
          increment: 1,
        },
      },
      select: {
        nextValue: true,
      },
    });

    return sequence.nextValue - 1;
  }

  private formatEquipmentAssetCode(value: number) {
    return `EQ-${value.toString().padStart(6, '0')}`;
  }
}
