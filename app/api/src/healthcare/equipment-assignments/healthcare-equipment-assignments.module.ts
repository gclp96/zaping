import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareEquipmentCoverageController } from './healthcare-equipment-coverage.controller';
import { HealthcareEquipmentCoverageService } from './healthcare-equipment-coverage.service';
import { HealthcareEquipmentAssignmentsController } from './healthcare-equipment-assignments.controller';
import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthcareEquipmentAssignmentsController,
    HealthcareEquipmentCoverageController,
  ],
  providers: [
    HealthcareEquipmentCoverageService,
    HealthcareEquipmentAssignmentsRepository,
    HealthcareEquipmentAssignmentsService,
  ],
  exports: [HealthcareEquipmentAssignmentsService],
})
export class HealthcareEquipmentAssignmentsModule {}
