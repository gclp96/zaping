import { InventoryCompatibilityProjectionService } from './inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from './inventory-compatibility-history.service';
import { InventoryAuthorityResolver } from './inventory-authority-resolver';
import { InventoryAuthorityTransactionService } from './inventory-authority-transaction.service';
import { InventoryRuntimeCompatibilityService } from './inventory-runtime-compatibility.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { Module } from '@nestjs/common';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';
import { PhysicalInventoryReadService } from './physical-inventory-read.service';

// Shared authority boundary; OPENING tooling is never registered here.
@Module({
  imports: [PrismaModule],
  providers: [
    InventoryCompatibilityProjectionService,
    InventoryCompatibilityHistoryService,
    InventoryAuthorityResolver,
    InventoryAuthorityTransactionService,
    InventoryRuntimeCompatibilityService,
    PhysicalInventoryRepository,
    PhysicalInventoryService,
    PhysicalInventoryReadService,
  ],
  exports: [
    PhysicalInventoryRepository,
    PhysicalInventoryService,
    PhysicalInventoryReadService,
    InventoryCompatibilityProjectionService,
    InventoryCompatibilityHistoryService,
    InventoryAuthorityResolver,
    InventoryAuthorityTransactionService,
    InventoryRuntimeCompatibilityService,
  ],
})
export class InventoryPhysicalAuthorityModule {}
