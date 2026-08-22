import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';

import { CreateEquipmentInspectionDto } from './dto/create-equipment-inspection.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { RetireEquipmentDto } from './dto/retire-equipment.dto';
import { EquipmentService } from './equipment.service';

type EquipmentRequest = {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  findAll(@Request() req: EquipmentRequest) {
    return this.equipmentService.findAll(req.user.companyId);
  }

  @Get(':equipmentId/inspections')
  findInspections(
    @Request() req: EquipmentRequest,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentService.findInspections(
      req.user.companyId,
      equipmentId,
    );
  }

  @Get(':id')
  findOne(@Request() req: EquipmentRequest, @Param('id') id: string) {
    return this.equipmentService.findOne(req.user.companyId, id);
  }

  @Post()
  create(@Request() req: EquipmentRequest, @Body() dto: CreateEquipmentDto) {
    return this.equipmentService.create(req.user.companyId, dto);
  }

  @Post(':equipmentId/inspections')
  createInspection(
    @Request() req: EquipmentRequest,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: CreateEquipmentInspectionDto,
  ) {
    return this.equipmentService.createInspection(
      req.user.companyId,
      req.user.id,
      equipmentId,
      dto,
    );
  }

  @Post(':equipmentId/retirement')
  retire(
    @Request() req: EquipmentRequest,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: RetireEquipmentDto,
  ) {
    return this.equipmentService.retire(
      req.user.companyId,
      req.user.id,
      equipmentId,
      dto,
    );
  }
}
