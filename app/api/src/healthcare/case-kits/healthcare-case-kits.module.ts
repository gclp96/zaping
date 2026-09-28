import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseKitsController } from './healthcare-case-kits.controller';
import { HealthcareCaseKitsRepository } from './healthcare-case-kits.repository';
import { HealthcareCaseKitsService } from './healthcare-case-kits.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthcareCaseKitsController],
  providers: [HealthcareCaseKitsRepository, HealthcareCaseKitsService],
})
export class HealthcareCaseKitsModule {}
