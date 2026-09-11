import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareHospitalsController } from './healthcare-hospitals.controller';
import { HealthcareHospitalsService } from './healthcare-hospitals.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthcareHospitalsController],
  providers: [HealthcareHospitalsService],
  exports: [HealthcareHospitalsService],
})
export class HealthcareHospitalsModule {}
