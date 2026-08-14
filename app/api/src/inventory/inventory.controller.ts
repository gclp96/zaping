import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { CreateMovementDto } from './dto/create-movement.dto';

import { InventoryService } from './inventory.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findInventory(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.inventoryService.findInventory(req.user.companyId);
  }

  @Get('movements')
  findMovements(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.inventoryService.findMovements(req.user.companyId);
  }

  @Post('movements')
  createMovement(@Request() req: any, @Body() dto: CreateMovementDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.inventoryService.createMovement(req.user.companyId, dto);
  }
}
