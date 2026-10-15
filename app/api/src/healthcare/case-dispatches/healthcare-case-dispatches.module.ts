import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthcareCaseDispatchesController } from './healthcare-case-dispatches.controller';
import { HealthcareCaseDispatchReadService } from './healthcare-case-dispatch-read.service';
import { HealthcareCaseDispatchesRepository } from './healthcare-case-dispatches.repository';
@Module({
  imports: [PrismaModule],
  controllers: [HealthcareCaseDispatchesController],
  providers: [
    HealthcareCaseDispatchReadService,
    HealthcareCaseDispatchesRepository,
  ],
})
export class HealthcareCaseDispatchModule {}
