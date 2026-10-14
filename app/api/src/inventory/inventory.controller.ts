import {
  BadRequestException,
  Headers,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreatePhysicalMovementDto } from './dto/create-physical-movement.dto';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InventoryMovementType, UserRole } from '@prisma/client';

import { CreateMovementDto } from './dto/create-movement.dto';

import { InventoryService } from './inventory.service';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guards';

type InventoryRequest = {
  user: Pick<AuthenticatedUser, 'companyId' | 'role'>;
};
type PhysicalInventoryRequest = {
  user: Pick<AuthenticatedUser, 'id' | 'companyId' | 'role'>;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findInventory(@Request() req: InventoryRequest) {
    return this.inventoryService.findInventory(req.user.companyId);
  }

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  findMovements(@Request() req: InventoryRequest) {
    return this.inventoryService.findMovements(req.user.companyId);
  }

  @Get('physical-positions/:productId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  physicalPositions(
    @Request() req: InventoryRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.inventoryService.findPhysicalPositions(
      req.user.companyId,
      productId,
    );
  }

  @Post('physical-movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  physicalMovement(
    @Request() req: PhysicalInventoryRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreatePhysicalMovementDto,
  ) {
    if (!key?.trim() || key.trim().length > 128)
      throw new BadRequestException(
        'Idempotency-Key requerido (1-128 caracteres)',
      );
    if (
      dto.kind === 'COUNT_CORRECTION' &&
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.MANAGER
    )
      throw new ForbiddenException(
        'Solo ADMIN y MANAGER pueden corregir conteos',
      );
    return this.inventoryService.createPhysicalMovement({
      companyId: req.user.companyId,
      actorId: req.user.id,
      key: key.trim(),
      reason: dto.reason,
      operation: CreatePhysicalMovementDto.operation(dto),
    });
  }

  @Post('movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  createMovement(
    @Request() req: InventoryRequest,
    @Body() dto: CreateMovementDto,
  ) {
    if (
      dto.movementType === InventoryMovementType.ADJUSTMENT &&
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Solo ADMIN y MANAGER pueden realizar ajustes de inventario',
      );
    }

    return this.inventoryService.createMovement(req.user.companyId, dto);
  }
}
