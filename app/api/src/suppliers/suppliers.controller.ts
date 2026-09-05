import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '@prisma/client';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  findAll(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.suppliersService.findAll(req.user.companyId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  findOne(@Req() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.suppliersService.findOne(req.user.companyId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Req() req: any, @Body() body: CreateSupplierDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.suppliersService.create(req.user.companyId, body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.suppliersService.update(req.user.companyId, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Req() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.suppliersService.remove(req.user.companyId, id);
  }
}
