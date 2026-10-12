import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HealthcareCaseAvailabilityService } from './healthcare-case-availability.service';

@Controller('healthcare/cases/:caseId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthcareCaseAvailabilityController {
  constructor(private readonly service: HealthcareCaseAvailabilityService) {}

  @Get('availability')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  findAvailability(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    return this.service.findAvailability(request.user.companyId, caseId);
  }
}
