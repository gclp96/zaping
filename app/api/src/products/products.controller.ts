import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ProductsService } from './products.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guards';

import { CreateProductDto } from './dto/create-product.dto';

import { UpdateProductDto } from './dto/update-product.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findAll(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.findAll(req.user.companyId);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findLowStock(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.lowStock(req.user.companyId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Request() req: any, @Body() dto: CreateProductDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.create(req.user.companyId, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findOne(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.findOne(req.user.companyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.update(req.user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Request() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.productsService.remove(req.user.companyId, id);
  }
}
