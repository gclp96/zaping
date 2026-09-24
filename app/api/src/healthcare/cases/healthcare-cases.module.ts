import { Module } from '@nestjs/common';

import { CompanySequencesModule } from '../../company-sequences/company-sequences.module';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthcareEquipmentAssignmentsModule } from '../equipment-assignments/healthcare-equipment-assignments.module';

import { HealthcareCaseFolioService } from './healthcare-case-folio.service';
import { HealthcareCaseService } from './healthcare-case.service';
import { HealthcareCasesController } from './healthcare-cases.controller';

@Module({
  imports: [CompanySequencesModule, HealthcareEquipmentAssignmentsModule],
  controllers: [HealthcareCasesController],
  providers: [HealthcareCaseFolioService, HealthcareCaseService, PrismaService],
})
export class HealthcareCasesModule {}
