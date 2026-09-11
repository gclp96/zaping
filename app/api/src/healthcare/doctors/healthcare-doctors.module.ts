import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareDoctorsController } from './healthcare-doctors.controller';
import { HealthcareDoctorsService } from './healthcare-doctors.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthcareDoctorsController],
  providers: [HealthcareDoctorsService],
  exports: [HealthcareDoctorsService],
})
export class HealthcareDoctorsModule {}
