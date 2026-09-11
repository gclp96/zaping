import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareDoctorHospitalAffiliationsModule } from '../doctor-hospital-affiliations/healthcare-doctor-hospital-affiliations.module';
import { HealthcareDoctorsController } from './healthcare-doctors.controller';
import { HealthcareDoctorsService } from './healthcare-doctors.service';

@Module({
  imports: [PrismaModule, HealthcareDoctorHospitalAffiliationsModule],
  controllers: [HealthcareDoctorsController],
  providers: [HealthcareDoctorsService],
  exports: [HealthcareDoctorsService],
})
export class HealthcareDoctorsModule {}
