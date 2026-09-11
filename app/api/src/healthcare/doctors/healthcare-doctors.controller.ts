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
import { CreateHealthcareDoctorDto } from './dto/create-healthcare-doctor.dto';
import { UpdateHealthcareDoctorDto } from './dto/update-healthcare-doctor.dto';
import { HealthcareDoctorsService } from './healthcare-doctors.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthcare/doctors')
export class HealthcareDoctorsController {
  constructor(
    private readonly healthcareDoctorsService: HealthcareDoctorsService,
    private readonly healthcareDoctorHospitalAffiliationsService: HealthcareDoctorHospitalAffiliationsService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: HealthcareMasterListQueryDto,
  ) {
    return this.healthcareDoctorsService.findAll(request.user.companyId, query);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateHealthcareDoctorDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.healthcareDoctorsService.create(
      request.user.companyId,
      dto,
    );

    response.status(
      result.outcome === 'CREATED' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return result;
  }

  @Get(':doctorId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.healthcareDoctorsService.findOne(
      request.user.companyId,
      doctorId,
    );
  }

  @Get(':doctorId/hospitals')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findHospitals(
    @Req() request: AuthenticatedRequest,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: HealthcareMasterListQueryDto,
  ) {
    return this.healthcareDoctorHospitalAffiliationsService.findHospitalsForDoctor(
      request.user.companyId,
      doctorId,
      query,
    );
  }

  @Patch(':doctorId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: UpdateHealthcareDoctorDto,
  ) {
    return this.healthcareDoctorsService.update(
      request.user.companyId,
      doctorId,
      dto,
    );
  }

  @Post(':doctorId/deactivate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.healthcareDoctorsService.deactivate(
      request.user.companyId,
      doctorId,
    );
  }

  @Post(':doctorId/reactivate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.healthcareDoctorsService.reactivate(
      request.user.companyId,
      doctorId,
    );
  }
}
