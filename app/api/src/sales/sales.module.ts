import { InventoryPhysicalAuthorityModule } from '../inventory/physical/inventory-physical-authority.module';
import { SalesPhysicalIntegrationService } from '../inventory/physical/sales-physical-integration.service';
import { SalesPhysicalSourceResolver } from '../inventory/physical/sales-physical-source-resolver';
import { Module } from '@nestjs/common';
import { CompanySequencesModule } from '../company-sequences/company-sequences.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './sales.controller';
import { SalesFolioService } from './sales-folio.service';
import { SalesService } from './sales.service';

@Module({
  imports: [
    InventoryPhysicalAuthorityModule,
    PrismaModule,
    CompanySequencesModule,
  ],
  controllers: [SalesController],
  providers: [
    SalesPhysicalIntegrationService,
    SalesPhysicalSourceResolver,
    SalesFolioService,
    SalesService,
  ],
})
export class SalesModule {}
