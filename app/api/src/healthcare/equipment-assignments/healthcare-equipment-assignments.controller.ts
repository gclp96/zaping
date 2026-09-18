import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '@prisma/client';
import { Response } from 'express';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { CreateHealthcareEquipmentAssignmentDto } from './dto/create-healthcare-equipment-assignment.dto';
import { HealthcareEquipmentAssignmentListQueryDto } from './dto/healthcare-equipment-assignment-list-query.dto';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';
import { ReleaseHealthcareEquipmentAssignmentDto } from './dto/release-healthcare-equipment-assignment.dto';

const readRoles = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES,
  UserRole.WAREHOUSE,
];

const mutationRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare/equipment-assignments')
export class HealthcareEquipmentAssignmentsController {
  constructor(
    private readonly service: HealthcareEquipmentAssignmentsService,
  ) {}

  @Get()
  @Roles(...readRoles)
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: HealthcareEquipmentAssignmentListQueryDto,
  ) {
    return this.service.findAll(request.user.companyId, query);
  }

  @Get(':assignmentId')
  @Roles(...readRoles)
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.service.findOne(request.user.companyId, assignmentId);
  }

  @Post()
  @Roles(...mutationRoles)
  async create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: CreateHealthcareEquipmentAssignmentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.create(
      request.user.companyId,
      request.user.id,
      this.validateIdempotencyKey(idempotencyKeyHeader),
      dto,
    );

    response.status(
      result.outcome === 'CREATED' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return result;
  }

  @Post(':assignmentId/release')
  @HttpCode(HttpStatus.OK)
  @Roles(...mutationRoles)
  release(
    @Req() request: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: ReleaseHealthcareEquipmentAssignmentDto,
  ) {
    return this.service.release(
      request.user.companyId,
      request.user.id,
      assignmentId,
      dto,
    );
  }

  private validateIdempotencyKey(value: string | undefined): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue || normalizedValue.length > 128) {
      throw new BadRequestException(
        'Se requiere una clave Idempotency-Key válida',
      );
    }

    return normalizedValue;
  }
}
