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
import { HealthcareCaseReconciliationReadService } from './healthcare-case-reconciliation-read.service';
import { HealthcareCaseReconciliationListQueryDto } from './dto/healthcare-case-reconciliation-list-query.dto';
@Controller('healthcare/cases/:caseId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE, UserRole.SALES)
export class HealthcareCaseReconciliationsController {
  constructor(
    private readonly service: HealthcareCaseReconciliationReadService,
  ) {}
  @Get('reconciliations')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query() q: HealthcareCaseReconciliationListQueryDto,
  ) {
    return this.service.list(req.user.companyId, caseId, q);
  }
  @Get('reconciliations/:reconciliationId')
  detail(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('reconciliationId', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(req.user.companyId, caseId, id);
  }
  @Get('dispatches/:dispatchId/reconciliation-summary')
  summary(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('dispatchId', ParseUUIDPipe) id: string,
  ) {
    return this.service.summary(req.user.companyId, caseId, id);
  }
}
