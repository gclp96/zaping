import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierDocumentsController } from './supplier-documents.controller';
import { SupplierDocumentsService } from './supplier-documents.service';
import { SupplierDocumentReconciliationService } from './supplier-document-reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierDocumentsController],
  providers: [SupplierDocumentsService, SupplierDocumentReconciliationService],
})
export class SupplierDocumentsModule {}
