import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ProductsService } from './products.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.findAll(req.user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @Post()
  create(@Request() req: any, @Body() dto: CreateProductDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.create(req.user.companyId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.update(req.user.companyId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.remove(req.user.companyId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('low-stock')
  findLowStock(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.lowStock(req.user.companyId);
  }
}
