import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentAssetCodeService } from './equipment-asset-code.service';

@Module({
  controllers: [EquipmentController],
  providers: [EquipmentService, EquipmentAssetCodeService, PrismaService],
  exports: [EquipmentAssetCodeService],
})
export class EquipmentModule {}
