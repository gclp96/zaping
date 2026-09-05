import { Module } from '@nestjs/common';
import { CompanySequencesModule } from '../company-sequences/company-sequences.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './sales.controller';
import { SalesFolioService } from './sales-folio.service';
import { SalesService } from './sales.service';

@Module({
  imports: [PrismaModule, CompanySequencesModule],
  controllers: [SalesController],
  providers: [SalesFolioService, SalesService],
})
export class SalesModule {}
