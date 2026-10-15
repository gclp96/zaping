import { Body, Headers, HttpStatus, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthcareCaseDispatchCommandService } from './healthcare-case-dispatch-command.service';
import { CreateHealthcareCaseDispatchDto } from './dto/create-healthcare-case-dispatch.dto';
import { SetHealthcareCaseDispatchCustodianDto } from './dto/set-healthcare-case-dispatch-custodian.dto';
import { AddHealthcareCaseDispatchItemDto } from './dto/add-healthcare-case-dispatch-item.dto';
import { ExcludeHealthcareCaseDispatchItemDto } from './dto/exclude-healthcare-case-dispatch-item.dto';
import { CancelHealthcareCaseDispatchDto } from './dto/cancel-healthcare-case-dispatch.dto';
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
  constructor(
    private readonly service: HealthcareCaseDispatchReadService,
    private readonly commands: HealthcareCaseDispatchCommandService,
  ) {}
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

  @Post('')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateHealthcareCaseDispatchDto,
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

  @Post(':dispatchId/custodian')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async setCustodian(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('dispatchId', ParseUUIDPipe) dispatchId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: SetHealthcareCaseDispatchCustodianDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        dispatchId,
        key: key!,
      },
      { operation: 'CUSTODIAN_SET', dto },
    );
    response.status(HttpStatus.OK);
    return result;
  }

  @Post(':dispatchId/items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async addItem(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('dispatchId', ParseUUIDPipe) dispatchId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: AddHealthcareCaseDispatchItemDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        dispatchId,
        key: key!,
      },
      { operation: 'ITEM_ADD', dto },
    );
    response.status(result.replay ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Post(':dispatchId/items/:itemId/exclude')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async excludeItem(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('dispatchId', ParseUUIDPipe) dispatchId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: ExcludeHealthcareCaseDispatchItemDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        dispatchId,
        itemId,
        key: key!,
      },
      { operation: 'ITEM_EXCLUDE', dto },
    );
    response.status(HttpStatus.OK);
    return result;
  }

  @Post(':dispatchId/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('dispatchId', ParseUUIDPipe) dispatchId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CancelHealthcareCaseDispatchDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.execute(
      {
        companyId: req.user.companyId,
        actorId: req.user.id,
        caseId,
        dispatchId,
        key: key!,
      },
      { operation: 'CANCEL', dto },
    );
    response.status(HttpStatus.OK);
    return result;
  }
}
