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
import { HealthcareCaseDispatchReadService } from './healthcare-case-dispatch-read.service';
import { HealthcareCaseDispatchListQueryDto } from './dto/healthcare-case-dispatch-list-query.dto';
@Controller('healthcare/cases/:caseId/dispatches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthcareCaseDispatchesController {
  constructor(private readonly service: HealthcareCaseDispatchReadService) {}
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  list(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query() q: HealthcareCaseDispatchListQueryDto,
  ) {
    return this.service.list(req.user.companyId, caseId, q);
  }
  @Get(':dispatchId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  detail(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('dispatchId', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(req.user.companyId, caseId, id);
  }
}
