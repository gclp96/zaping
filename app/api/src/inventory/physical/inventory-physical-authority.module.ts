import { Module } from '@nestjs/common';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';
import { PhysicalInventoryReadService } from './physical-inventory-read.service';

// Deliberately not imported by AppModule or any productive module.
@Module({
  providers: [
    PhysicalInventoryRepository,
    PhysicalInventoryService,
    PhysicalInventoryReadService,
  ],
  exports: [PhysicalInventoryService, PhysicalInventoryReadService],
})
export class InventoryPhysicalAuthorityModule {}
