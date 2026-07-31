import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  Res,
} from '@nestjs/common';

import { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalesService } from './sales.service';

import { CreateSaleDto } from './dto/create-sale.dto';

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateSaleDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.salesService.create(req.user.companyId, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.salesService.findAll(req.user.companyId);
  }

  @Patch(':id/approve')
  approve(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.salesService.approve(req.user.companyId, id);
  }

  @Get(':id/pdf')
  async getPdf(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.salesService.generatePDF(req.user.companyId, id, res);
  }

  @Post('from-quote/:id')
  createFromQuote(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.salesService.createFromQuote(req.user.companyId, id);
  }

  @Patch(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.salesService.cancel(req.user.companyId, id);
  }
}
