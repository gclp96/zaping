import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CompanySequenceAllocatorService } from '../company-sequences/company-sequence-allocator.service';

const EQUIPMENT_ASSET_CODE_SEQUENCE_KEY = 'EQUIPMENT_ASSET_CODE';

@Injectable()
export class EquipmentAssetCodeService {
  constructor(
    private readonly companySequenceAllocator: CompanySequenceAllocatorService,
  ) {}

  async allocateNextAvailableAssetCode(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    while (true) {
      const nextValue = await this.companySequenceAllocator.allocateNext(
        tx,
        companyId,
        EQUIPMENT_ASSET_CODE_SEQUENCE_KEY,
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

  private formatEquipmentAssetCode(value: number) {
    return `EQ-${value.toString().padStart(6, '0')}`;
  }
}
