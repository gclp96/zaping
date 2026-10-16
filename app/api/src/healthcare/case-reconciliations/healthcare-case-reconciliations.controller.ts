import { HttpCode } from '@nestjs/common';
import { Body, Headers, HttpStatus, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthcareCaseReconciliationCommandService } from './healthcare-case-reconciliation-command.service';
import { CreateHealthcareCaseReconciliationDto } from './dto/create-healthcare-case-reconciliation.dto';
import { AddHealthcareCaseReconciliationItemDto } from './dto/add-healthcare-case-reconciliation-item.dto';
import { SetHealthcareCaseReconciliationOutcomeDto } from './dto/set-healthcare-case-reconciliation-outcome.dto';
import { ExcludeHealthcareCaseReconciliationItemDto } from './dto/exclude-healthcare-case-reconciliation-item.dto';
import { CancelHealthcareCaseReconciliationDto } from './dto/cancel-healthcare-case-reconciliation.dto';
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
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
export class HealthcareCaseReconciliationsController {
  constructor(
    private readonly service: HealthcareCaseReconciliationReadService,
    private readonly commands: HealthcareCaseReconciliationCommandService,
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

  @Post('reconciliations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateHealthcareCaseReconciliationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        key: key!,
      },
      { operation: 'CREATE', dto },
    );
    response.status(result.replay ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Post('reconciliations/:reconciliationId/items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async addItem(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: AddHealthcareCaseReconciliationItemDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        reconciliationId,
        key: key!,
      },
      { operation: 'ITEM_ADD', dto },
    );
    response.status(result.replay ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Post('reconciliations/:reconciliationId/items/:itemId/outcome')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async setOutcome(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: SetHealthcareCaseReconciliationOutcomeDto,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        reconciliationId,
        itemId,
        key: key!,
      },
      { operation: 'OUTCOME_SET', dto },
    );
    return result;
  }

  @Post('reconciliations/:reconciliationId/items/:itemId/exclude')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async excludeItem(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: ExcludeHealthcareCaseReconciliationItemDto,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        reconciliationId,
        itemId,
        key: key!,
      },
      { operation: 'ITEM_EXCLUDE', dto },
    );
    return result;
  }

  @Post('reconciliations/:reconciliationId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CancelHealthcareCaseReconciliationDto,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        reconciliationId,
        key: key!,
      },
      { operation: 'CANCEL', dto },
    );
    return result;
  }
}
