import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareRequirementsController } from './healthcare-requirements.controller';
import { HealthcareRequirementsService } from './healthcare-requirements.service';
import {
  NoopRequirementOperationalEvidencePolicy,
  REQUIREMENT_OPERATIONAL_EVIDENCE_POLICY,
} from './requirement-operational-evidence-policy';

@Module({
  imports: [PrismaModule],
  controllers: [HealthcareRequirementsController],
  providers: [
    HealthcareRequirementsService,
    {
      provide: REQUIREMENT_OPERATIONAL_EVIDENCE_POLICY,
      useClass: NoopRequirementOperationalEvidencePolicy,
    },
  ],
  exports: [HealthcareRequirementsService],
})
export class HealthcareRequirementsModule {}
