import { Module } from '@nestjs/common';
import { HealthcareCaseDispatchEquipmentEvidenceModule } from '../healthcare/case-dispatches/healthcare-case-dispatch-equipment-evidence.module';
import { HealthcareCaseDispatchEquipmentContextAdapter } from '../healthcare/case-dispatches/healthcare-case-dispatch-equipment-context.adapter';

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
import { EquipmentCustodyCloseService } from './equipment-custody-close.service';
import {
  EquipmentCustodyCloseContextRegistry,
  EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS,
} from './equipment-custody-close-context.registry';
import {
  EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS,
  EquipmentCustodyContextRegistry,
} from './equipment-custody-context.registry';

@Module({
  imports: [
    CompanySequencesModule,
    HealthcareCaseDispatchEquipmentEvidenceModule,
  ],
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    EquipmentAssetCodeService,
    EquipmentAvailabilityService,
    EquipmentProvisioningService,
    EquipmentPhysicalRepository,
    EquipmentPhysicalHistoryService,
    EquipmentCustodyService,
    EquipmentCustodyCloseService,
    EquipmentCustodyCloseContextRegistry,
    {
      provide: EQUIPMENT_CUSTODY_CLOSE_CONTEXT_ADAPTERS,
      useValue: Object.freeze([]),
    },
    EquipmentCustodyContextRegistry,
    {
      provide: EQUIPMENT_CUSTODY_CONTEXT_ADAPTERS,
      useFactory: (adapter: HealthcareCaseDispatchEquipmentContextAdapter) =>
        Object.freeze([adapter]),
      inject: [HealthcareCaseDispatchEquipmentContextAdapter],
    },
    PrismaService,
  ],
  exports: [
    EquipmentProvisioningService,
    EquipmentCustodyService,
    EquipmentCustodyCloseService,
  ],
})
export class EquipmentModule {}
