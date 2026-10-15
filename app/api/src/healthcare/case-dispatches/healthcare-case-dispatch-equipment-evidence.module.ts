import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseDispatchEquipmentContextAdapter } from './healthcare-case-dispatch-equipment-context.adapter';
import { HealthcareCaseDispatchEquipmentEvidenceRepository } from './healthcare-case-dispatch-equipment-evidence.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    HealthcareCaseDispatchEquipmentEvidenceRepository,
    HealthcareCaseDispatchEquipmentContextAdapter,
  ],
  exports: [HealthcareCaseDispatchEquipmentContextAdapter],
})
export class HealthcareCaseDispatchEquipmentEvidenceModule {}
