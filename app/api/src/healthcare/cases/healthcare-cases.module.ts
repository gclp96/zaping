import { Module } from '@nestjs/common';

import { CompanySequencesModule } from '../../company-sequences/company-sequences.module';
import { PrismaService } from '../../prisma/prisma.service';

import { HealthcareCaseFolioService } from './healthcare-case-folio.service';
import { HealthcareCaseService } from './healthcare-case.service';

@Module({
  imports: [CompanySequencesModule],
  providers: [HealthcareCaseFolioService, HealthcareCaseService, PrismaService],
})
export class HealthcareCasesModule {}
