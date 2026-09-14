import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { CreateHealthcareRequirementDto } from './dto/create-healthcare-requirement.dto';
import { HealthcareRequirementListQueryDto } from './dto/healthcare-requirement-list-query.dto';
import { ReactivateHealthcareRequirementDto } from './dto/reactivate-healthcare-requirement.dto';
import { ReorderHealthcareRequirementsDto } from './dto/reorder-healthcare-requirements.dto';
import { RetireHealthcareRequirementDto } from './dto/retire-healthcare-requirement.dto';
import { UpdateHealthcareRequirementDto } from './dto/update-healthcare-requirement.dto';
import { HealthcareRequirementsService } from './healthcare-requirements.service';

const requirementRoles = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES,
  UserRole.WAREHOUSE,
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare')
export class HealthcareRequirementsController {
  constructor(
    private readonly healthcareRequirementsService: HealthcareRequirementsService,
  ) {}

  @Get('cases/:caseId/requirements')
  @Roles(...requirementRoles)
  findAllForCase(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query() query: HealthcareRequirementListQueryDto,
  ) {
    return this.healthcareRequirementsService.findAllForCase(
      request.user.companyId,
      caseId,
      query,
    );
  }

  @Post('cases/:caseId/requirements')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...requirementRoles)
  create(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateHealthcareRequirementDto,
  ) {
    return this.healthcareRequirementsService.create(
      request.user.companyId,
      request.user.id,
      caseId,
      dto,
    );
  }

  @Patch('cases/:caseId/requirements/reorder')
  @Roles(...requirementRoles)
  reorder(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ReorderHealthcareRequirementsDto,
  ) {
    return this.healthcareRequirementsService.reorder(
      request.user.companyId,
      caseId,
      dto,
    );
  }

  @Get('requirements/:requirementId')
  @Roles(...requirementRoles)
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    return this.healthcareRequirementsService.findOne(
      request.user.companyId,
      requirementId,
    );
  }

  @Patch('requirements/:requirementId')
  @Roles(...requirementRoles)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() dto: UpdateHealthcareRequirementDto,
  ) {
    return this.healthcareRequirementsService.update(
      request.user.companyId,
      requirementId,
      dto,
    );
  }

  @Post('requirements/:requirementId/retire')
  @HttpCode(HttpStatus.OK)
  @Roles(...requirementRoles)
  retire(
    @Req() request: AuthenticatedRequest,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() dto: RetireHealthcareRequirementDto,
  ) {
    return this.healthcareRequirementsService.retire(
      request.user.companyId,
      request.user.id,
      requirementId,
      dto,
    );
  }

  @Post('requirements/:requirementId/reactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(...requirementRoles)
  reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() dto: ReactivateHealthcareRequirementDto,
  ) {
    void dto;

    return this.healthcareRequirementsService.reactivate(
      request.user.companyId,
      request.user.id,
      requirementId,
    );
  }
}
