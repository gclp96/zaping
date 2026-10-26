import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierDocumentsController } from './supplier-documents.controller';
import { SupplierDocumentsService } from './supplier-documents.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierDocumentsController],
  providers: [SupplierDocumentsService],
})
export class SupplierDocumentsModule {}
