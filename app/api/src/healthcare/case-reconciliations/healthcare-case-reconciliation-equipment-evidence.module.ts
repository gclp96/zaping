import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseReconciliationEquipmentContextAdapter } from './healthcare-case-reconciliation-equipment-context.adapter';
import { HealthcareCaseReconciliationEquipmentEvidenceRepository } from './healthcare-case-reconciliation-equipment-evidence.repository';
@Module({
  imports: [PrismaModule],
  providers: [
    HealthcareCaseReconciliationEquipmentContextAdapter,
    HealthcareCaseReconciliationEquipmentEvidenceRepository,
  ],
  exports: [HealthcareCaseReconciliationEquipmentContextAdapter],
})
export class HealthcareCaseReconciliationEquipmentEvidenceModule {}
