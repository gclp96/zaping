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

import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuotesService } from './quotes.service';

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
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(req.user.companyId, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.quotesService.findAll(req.user.companyId);
  }

  @Get(':id/pdf')
  generatePdf(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.quotesService.generatePDF(req.user.companyId, id, res);
  }

  @Patch(':id/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotesService.approve(req.user.companyId, id);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotesService.cancel(req.user.companyId, id);
  }
}
