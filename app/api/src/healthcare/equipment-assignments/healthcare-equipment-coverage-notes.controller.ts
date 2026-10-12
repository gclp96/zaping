import {
  Body,
  Controller,
  Headers,
  HttpCode,
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
import { invalidRequestBodyException } from '../common/healthcare-errors';
import { CreateHealthcareEquipmentCoverageNoteDto } from './dto/create-healthcare-equipment-coverage-note.dto';
import { HealthcareEquipmentCoverageNotesService } from './healthcare-equipment-coverage-notes.service';

@Controller(
  'healthcare/cases/:caseId/requirements/:requirementId/equipment-coverage-notes',
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE)
export class HealthcareEquipmentCoverageNotesController {
  constructor(
    private readonly service: HealthcareEquipmentCoverageNotesService,
  ) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateHealthcareEquipmentCoverageNoteDto,
  ) {
    return this.service.create(
      request.user.companyId,
      request.user.id,
      caseId,
      requirementId,
      key,
      dto,
    );
  }

  @Post(':noteId/resolve')
  @HttpCode(200)
  resolve(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length !== 0)
    ) {
      throw invalidRequestBodyException();
    }
    return this.service.resolve(
      request.user.companyId,
      request.user.id,
      caseId,
      requirementId,
      noteId,
      key,
    );
  }
}
