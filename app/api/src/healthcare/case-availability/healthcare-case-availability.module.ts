import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseKitsModule } from '../case-kits/healthcare-case-kits.module';
import { HealthcareEquipmentAssignmentsModule } from '../equipment-assignments/healthcare-equipment-assignments.module';
import { HealthcareCaseAvailabilityController } from './healthcare-case-availability.controller';
import { HealthcareCaseAvailabilityRepository } from './healthcare-case-availability.repository';
import { HealthcareCaseAvailabilityService } from './healthcare-case-availability.service';

@Module({
  imports: [
    PrismaModule,
    HealthcareEquipmentAssignmentsModule,
    HealthcareCaseKitsModule,
  ],
  controllers: [HealthcareCaseAvailabilityController],
  providers: [
    HealthcareCaseAvailabilityRepository,
    HealthcareCaseAvailabilityService,
  ],
})
export class HealthcareCaseAvailabilityModule {}
