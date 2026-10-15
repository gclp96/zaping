import { HealthcareCaseDispatchCommandService } from './healthcare-case-dispatch-command.service';
import { HealthcareCaseDispatchCommandRepository } from './healthcare-case-dispatch-command.repository';
import { Module } from '@nestjs/common';
import { HealthcareCaseDispatchConfirmService } from './healthcare-case-dispatch-confirm.service';
import { HealthcareCaseDispatchConfirmRepository } from './healthcare-case-dispatch-confirm.repository';
import { EquipmentModule } from '../../equipment/equipment.module';
import { InventoryPhysicalAuthorityModule } from '../../inventory/physical/inventory-physical-authority.module';
import { HealthcareEquipmentAssignmentsModule } from '../equipment-assignments/healthcare-equipment-assignments.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseDispatchesController } from './healthcare-case-dispatches.controller';
import { HealthcareCaseDispatchReadService } from './healthcare-case-dispatch-read.service';
import { HealthcareCaseDispatchesRepository } from './healthcare-case-dispatches.repository';
@Module({
  imports: [
    PrismaModule,
    EquipmentModule,
    InventoryPhysicalAuthorityModule,
    HealthcareEquipmentAssignmentsModule,
  ],
  controllers: [HealthcareCaseDispatchesController],
  providers: [
    HealthcareCaseDispatchConfirmService,
    HealthcareCaseDispatchConfirmRepository,
    HealthcareCaseDispatchCommandService,
    HealthcareCaseDispatchCommandRepository,
    HealthcareCaseDispatchReadService,
    HealthcareCaseDispatchesRepository,
  ],
})
export class HealthcareCaseDispatchModule {}
