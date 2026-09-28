import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import {
  idempotencyKeyRequiredException,
  invalidIdempotencyKeyException,
} from '../common/healthcare-errors';
import { AddHealthcareCaseKitItemDto } from './dto/add-healthcare-case-kit-item.dto';
import { CreateHealthcareCaseKitDto } from './dto/create-healthcare-case-kit.dto';
import { HealthcareCaseKitsService } from './healthcare-case-kits.service';

const readRoles = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES,
  UserRole.WAREHOUSE,
];
const mutationRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare')
export class HealthcareCaseKitsController {
  constructor(private readonly service: HealthcareCaseKitsService) {}

  @Get('cases/:caseId/case-kit')
  @Roles(...readRoles)
  get(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    return this.service.get(request.user.companyId, caseId);
  }

  @Post('cases/:caseId/case-kit')
  @Roles(...mutationRoles)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() _dto: CreateHealthcareCaseKitDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.create(
      request.user.companyId,
      request.user.id,
      caseId,
      this.validateIdempotencyKey(key),
    );
    response.status(result.replay ? HttpStatus.OK : HttpStatus.CREATED);
    return result.data;
  }

  @Post('case-kits/:caseKitId/items')
  @Roles(...mutationRoles)
  async addItem(
    @Req() request: AuthenticatedRequest,
    @Param('caseKitId', ParseUUIDPipe) caseKitId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: AddHealthcareCaseKitItemDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.addItem(
      request.user.companyId,
      request.user.id,
      caseKitId,
      this.validateIdempotencyKey(key),
      dto,
    );
    response.status(result.replay ? HttpStatus.OK : HttpStatus.CREATED);
    return result.data;
  }

  private validateIdempotencyKey(value: string | undefined): string {
    if (value === undefined) throw idempotencyKeyRequiredException();
    const normalized = value.trim();
    if (!normalized || normalized.length > 128) {
      throw invalidIdempotencyKeyException();
    }
    return normalized;
  }
}
