import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareDoctorHospitalAffiliationsModule } from '../doctor-hospital-affiliations/healthcare-doctor-hospital-affiliations.module';
import { HealthcareHospitalsController } from './healthcare-hospitals.controller';
import { HealthcareHospitalsService } from './healthcare-hospitals.service';

@Module({
  imports: [PrismaModule, HealthcareDoctorHospitalAffiliationsModule],
  controllers: [HealthcareHospitalsController],
  providers: [HealthcareHospitalsService],
  exports: [HealthcareHospitalsService],
})
export class HealthcareHospitalsModule {}
