import { Module } from '@nestjs/common';

import { CompanySequencesModule } from '../company-sequences/company-sequences.module';

import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentAssetCodeService } from './equipment-asset-code.service';
import { EquipmentAvailabilityService } from './equipment-availability.service';
import { EquipmentProvisioningService } from './equipment-provisioning.service';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from './equipment-physical-history.service';
import { EquipmentCustodyService } from './equipment-custody.service';
import {
  EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS,
  EquipmentCustodyContextRegistry,
} from './equipment-custody-context.registry';

@Module({
  imports: [CompanySequencesModule],
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    EquipmentAssetCodeService,
    EquipmentAvailabilityService,
    EquipmentProvisioningService,
    EquipmentPhysicalRepository,
    EquipmentPhysicalHistoryService,
    EquipmentCustodyService,
    EquipmentCustodyContextRegistry,
    {
      provide: EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS,
      useValue: Object.freeze([]),
    },
    PrismaService,
  ],
  exports: [EquipmentProvisioningService, EquipmentCustodyService],
})
export class EquipmentModule {}
