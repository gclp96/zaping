import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PurchaseReceiptsController } from './purchases-receipts.controller';
import { PurchaseReceiptsService } from './purchases-receipts.service';

@Module({
  imports: [PrismaModule],
  controllers: [PurchaseReceiptsController],
  providers: [PurchaseReceiptsService],
  exports: [PurchaseReceiptsService],
})
export class PurchaseReceiptsModule {}
