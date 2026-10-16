import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseReconciliationsController } from './healthcare-case-reconciliations.controller';
import { HealthcareCaseReconciliationReadService } from './healthcare-case-reconciliation-read.service';
import { HealthcareCaseReconciliationsRepository } from './healthcare-case-reconciliations.repository';
@Module({
  imports: [PrismaModule],
  controllers: [HealthcareCaseReconciliationsController],
  providers: [
    HealthcareCaseReconciliationReadService,
    HealthcareCaseReconciliationsRepository,
  ],
})
export class HealthcareCaseReconciliationModule {}
