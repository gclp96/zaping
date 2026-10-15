import { InventoryPhysicalAuthorityModule } from './physical/inventory-physical-authority.module';
import { ManualPhysicalInventoryService } from './physical/manual-physical-inventory.service';
import { Module } from '@nestjs/common';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [InventoryPhysicalAuthorityModule],
  controllers: [InventoryController],
  providers: [ManualPhysicalInventoryService, InventoryService, PrismaService],
  exports: [InventoryService],
})
export class InventoryModule {}
