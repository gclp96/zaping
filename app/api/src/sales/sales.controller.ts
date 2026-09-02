import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import type { Request as ExpressRequest, Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guards';

import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

type AuthenticatedRequest = ExpressRequest & {
  user: {
    id: string;
    companyId: string;
    email: string;
    role: string;
  };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) {
    return this.salesService.create(req.user.companyId, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.salesService.findAll(req.user.companyId);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.findOne(req.user.companyId, id);
  }

  @Patch(':id/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.approve(req.user.companyId, id);
  }

  @Get(':id/pdf')
  getPdf(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.salesService.generatePDF(req.user.companyId, id, res);
  }

  @Post('from-quote/:quoteId')
  createFromQuote(
    @Req() req: AuthenticatedRequest,
    @Param('quoteId', ParseUUIDPipe)
    quoteId: string,
  ) {
    return this.salesService.createFromQuote(req.user.companyId, quoteId);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.cancel(req.user.companyId, id);
  }
}
