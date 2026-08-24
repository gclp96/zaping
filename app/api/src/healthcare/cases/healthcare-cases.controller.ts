import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

import { CreateHealthcareCaseDto } from './dto/create-healthcare-case.dto';
import {
  CreateHealthcareCaseInput,
  HealthcareCaseService,
} from './healthcare-case.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare/cases')
export class HealthcareCasesController {
  constructor(private readonly healthcareCaseService: HealthcareCaseService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateHealthcareCaseDto,
  ) {
    return this.healthcareCaseService.create(
      request.user.companyId,
      request.user.id,
      this.toCreateInput(dto),
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findAll(@Req() request: AuthenticatedRequest) {
    return this.healthcareCaseService.findAll(request.user.companyId);
  }

  @Get(':caseId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    return this.healthcareCaseService.findOne(request.user.companyId, caseId);
  }

  private toCreateInput(
    dto: CreateHealthcareCaseDto,
  ): CreateHealthcareCaseInput {
    return {
      title: dto.title,
      procedureDescription: dto.procedureDescription,
      scheduledStart: this.toOptionalDate(dto.scheduledStart),
      scheduledEnd: this.toOptionalDate(dto.scheduledEnd),
      responsibleUserId: dto.responsibleUserId,
    };
  }

  private toOptionalDate(value?: string | null) {
    if (value === undefined || value === null) {
      return value;
    }

    return new Date(value);
  }
}
