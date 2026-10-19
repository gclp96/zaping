import { HealthcareCaseReconciliationCommandService } from './healthcare-case-reconciliation-command.service';
import { HealthcareCaseReconciliationCommandRepository } from './healthcare-case-reconciliation-command.repository';
import { Module } from '@nestjs/common';
import { EquipmentModule } from '../../equipment/equipment.module';
import { InventoryPhysicalAuthorityModule } from '../../inventory/physical/inventory-physical-authority.module';
import { HealthcareCaseReconciliationConfirmService } from './healthcare-case-reconciliation-confirm.service';
import { HealthcareCaseReconciliationConfirmRepository } from './healthcare-case-reconciliation-confirm.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseReconciliationsController } from './healthcare-case-reconciliations.controller';
import { HealthcareCaseReconciliationReadService } from './healthcare-case-reconciliation-read.service';
import { HealthcareCaseReconciliationsRepository } from './healthcare-case-reconciliations.repository';
@Module({
  imports: [PrismaModule, EquipmentModule, InventoryPhysicalAuthorityModule],
  controllers: [HealthcareCaseReconciliationsController],
  providers: [
    HealthcareCaseReconciliationConfirmService,
    HealthcareCaseReconciliationConfirmRepository,
    HealthcareCaseReconciliationCommandService,
    HealthcareCaseReconciliationCommandRepository,
    HealthcareCaseReconciliationReadService,
    HealthcareCaseReconciliationsRepository,
  ],
})
export class HealthcareCaseReconciliationModule {}
