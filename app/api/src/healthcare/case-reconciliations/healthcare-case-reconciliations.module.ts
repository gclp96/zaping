import { HealthcareCaseReconciliationCommandService } from './healthcare-case-reconciliation-command.service';
import { HealthcareCaseReconciliationCommandRepository } from './healthcare-case-reconciliation-command.repository';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseReconciliationsController } from './healthcare-case-reconciliations.controller';
import { HealthcareCaseReconciliationReadService } from './healthcare-case-reconciliation-read.service';
import { HealthcareCaseReconciliationsRepository } from './healthcare-case-reconciliations.repository';
@Module({
  imports: [PrismaModule],
  controllers: [HealthcareCaseReconciliationsController],
  providers: [
    HealthcareCaseReconciliationCommandService,
    HealthcareCaseReconciliationCommandRepository,
    HealthcareCaseReconciliationReadService,
    HealthcareCaseReconciliationsRepository,
  ],
})
export class HealthcareCaseReconciliationModule {}
