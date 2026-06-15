import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';

import { Response } from 'express';

import { PurchasesService } from './purchases.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() dto: CreatePurchaseDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.purchasesService.create(req.user.companyId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.purchasesService.findAll(req.user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/approve')
  approve(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.purchasesService.approve(req.user.companyId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/pdf')
  generatePDF(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.purchasesService.generatePDF(req.user.companyId, id, res);
  }
}
