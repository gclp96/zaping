import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HealthcareEquipmentCoverageService } from './healthcare-equipment-coverage.service';
import { HealthcareEquipmentCoverageNotesQueryDto } from './dto/healthcare-equipment-coverage-notes-query.dto';

@Controller('healthcare/cases/:caseId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthcareEquipmentCoverageController {
  constructor(private readonly service: HealthcareEquipmentCoverageService) {}

  @Get('equipment-coverage')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findCoverage(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    return this.service.findCoverage(request.user.companyId, caseId);
  }

  @Get('requirements/:requirementId/equipment-coverage-notes')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findNotes(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Query() query: HealthcareEquipmentCoverageNotesQueryDto,
  ) {
    return this.service.findNotes(
      request.user.companyId,
      caseId,
      requirementId,
      query,
    );
  }
}
