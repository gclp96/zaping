import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { HealthcareMasterListQueryDto } from '../common/dto/healthcare-master-list-query.dto';
import { HealthcareDoctorHospitalAffiliationsService } from '../doctor-hospital-affiliations/healthcare-doctor-hospital-affiliations.service';
import { CreateHealthcareHospitalDto } from './dto/create-healthcare-hospital.dto';
import { HealthcareHospitalListQueryDto } from './dto/healthcare-hospital-list-query.dto';
import { UpdateHealthcareHospitalDto } from './dto/update-healthcare-hospital.dto';
import { HealthcareHospitalsService } from './healthcare-hospitals.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare/hospitals')
export class HealthcareHospitalsController {
  constructor(
    private readonly healthcareHospitalsService: HealthcareHospitalsService,
    private readonly healthcareDoctorHospitalAffiliationsService: HealthcareDoctorHospitalAffiliationsService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: HealthcareHospitalListQueryDto,
  ) {
    return this.healthcareHospitalsService.findAll(
      request.user.companyId,
      query,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateHealthcareHospitalDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.healthcareHospitalsService.create(
      request.user.companyId,
      dto,
    );

    response.status(
      result.outcome === 'CREATED' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return result;
  }

  @Get(':hospitalId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    return this.healthcareHospitalsService.findOne(
      request.user.companyId,
      hospitalId,
    );
  }

  @Get(':hospitalId/doctors')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findDoctors(
    @Req() request: AuthenticatedRequest,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query() query: HealthcareMasterListQueryDto,
  ) {
    return this.healthcareDoctorHospitalAffiliationsService.findDoctorsForHospital(
      request.user.companyId,
      hospitalId,
      query,
    );
  }

  @Patch(':hospitalId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Body() dto: UpdateHealthcareHospitalDto,
  ) {
    return this.healthcareHospitalsService.update(
      request.user.companyId,
      hospitalId,
      dto,
    );
  }

  @Post(':hospitalId/deactivate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    return this.healthcareHospitalsService.deactivate(
      request.user.companyId,
      hospitalId,
    );
  }

  @Post(':hospitalId/reactivate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    return this.healthcareHospitalsService.reactivate(
      request.user.companyId,
      hospitalId,
    );
  }
}
