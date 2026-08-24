import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentAssetCodeService } from './equipment-asset-code.service';
import { EquipmentProvisioningService } from './equipment-provisioning.service';

@Module({
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    EquipmentAssetCodeService,
    EquipmentProvisioningService,
    PrismaService,
  ],
  exports: [EquipmentProvisioningService],
})
export class EquipmentModule {}
