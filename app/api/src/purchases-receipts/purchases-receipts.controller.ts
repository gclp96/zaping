import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { PurchaseReceiptsService } from './purchases-receipts.service';

@UseGuards(JwtAuthGuard)
@Controller('purchase-receipts')
export class PurchaseReceiptsController {
  constructor(
    private readonly purchaseReceiptsService: PurchaseReceiptsService,
  ) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: CreatePurchaseReceiptDto,
  ) {
    const idempotencyKey = this.validateIdempotencyKey(idempotencyKeyHeader);

    return this.purchaseReceiptsService.create(
      request.user.companyId,
      request.user.id,
      idempotencyKey,
      dto,
    );
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.purchaseReceiptsService.findAll(request.user.companyId);
  }

  @Get('purchase/:purchaseId')
  findByPurchase(
    @Req() request: AuthenticatedRequest,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.purchaseReceiptsService.findByPurchase(
      request.user.companyId,
      purchaseId,
    );
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id') receiptId: string,
  ) {
    return this.purchaseReceiptsService.findOne(
      request.user.companyId,
      receiptId,
    );
  }

  private validateIdempotencyKey(value: string | undefined): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue || normalizedValue.length > 128) {
      throw new BadRequestException(
        'Se requiere una clave Idempotency-Key válida',
      );
    }

    return normalizedValue;
  }
}
