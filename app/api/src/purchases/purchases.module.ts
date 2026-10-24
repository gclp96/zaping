import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { CompanySequencesModule } from '../company-sequences/company-sequences.module';
import { PurchasesFolioService } from './purchases-folio.service';

@Module({
  imports: [PrismaModule, CompanySequencesModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchasesFolioService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
