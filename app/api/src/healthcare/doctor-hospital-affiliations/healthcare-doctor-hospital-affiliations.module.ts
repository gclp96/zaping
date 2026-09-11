import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareDoctorHospitalAffiliationsController } from './healthcare-doctor-hospital-affiliations.controller';
import { HealthcareDoctorHospitalAffiliationsService } from './healthcare-doctor-hospital-affiliations.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthcareDoctorHospitalAffiliationsController],
  providers: [HealthcareDoctorHospitalAffiliationsService],
  exports: [HealthcareDoctorHospitalAffiliationsService],
})
export class HealthcareDoctorHospitalAffiliationsModule {}
