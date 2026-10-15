import { InventoryRuntimeCompatibilityService } from '../inventory/physical/inventory-runtime-compatibility.service';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [InventoryRuntimeCompatibilityService, HealthService],
})
export class HealthModule {}
