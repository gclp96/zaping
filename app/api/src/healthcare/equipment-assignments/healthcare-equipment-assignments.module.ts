import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareEquipmentAssignmentsController } from './healthcare-equipment-assignments.controller';
import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthcareEquipmentAssignmentsController],
  providers: [
    HealthcareEquipmentAssignmentsRepository,
    HealthcareEquipmentAssignmentsService,
  ],
  exports: [HealthcareEquipmentAssignmentsService],
})
export class HealthcareEquipmentAssignmentsModule {}
