import { Module } from '@nestjs/common';

import { CompanySequencesModule } from '../company-sequences/company-sequences.module';

import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentAssetCodeService } from './equipment-asset-code.service';
import { EquipmentAvailabilityService } from './equipment-availability.service';
import { EquipmentProvisioningService } from './equipment-provisioning.service';

@Module({
  imports: [CompanySequencesModule],
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    EquipmentAssetCodeService,
    EquipmentAvailabilityService,
    EquipmentProvisioningService,
    PrismaService,
  ],
  exports: [EquipmentProvisioningService],
})
export class EquipmentModule {}
