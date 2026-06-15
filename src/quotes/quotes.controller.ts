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

import { QuotesService } from './quotes.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { Response } from 'express';

import { CreateQuoteDto } from './dto/create-quote.dto';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() dto: CreateQuoteDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.quotesService.create(req.user.companyId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.quotesService.findAll(req.user.companyId);
  }
  //probar mas adelante con o sin el jwt guard para la descarga del pdf, ya que no se si el token se envia en la peticion o no
  @UseGuards(JwtAuthGuard)
  @Get(':id/pdf')
  generatePdf(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.quotesService.generatePDF(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      req.user?.companyId ?? 'aabb1d06-3720-4456-a2e8-e3afe407dbf2',
      id,
      res,
    );
  }
  //Nuevo endpoint para aprobar una cotización(venta)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/approve')
  approve(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.quotesService.approve(req.user.companyId, id);
  }
  //Nuevo endpoint para cancelar una cotización(venta)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.quotesService.cancel(req.user.companyId, id);
  }
}
