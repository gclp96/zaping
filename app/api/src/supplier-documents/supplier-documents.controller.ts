import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guards';
import {
  CreateSupplierDocumentDto,
  CreateSupplierDocumentExceptionDto,
  ListSupplierDocumentsQueryDto,
} from './dto/create-supplier-document.dto';
import { SupplierDocumentsService } from './supplier-documents.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('supplier-documents')
export class SupplierDocumentsController {
  constructor(private readonly documents: SupplierDocumentsService) {}

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListSupplierDocumentsQueryDto,
  ) {
    return this.documents.list(req.user.companyId, query);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.documents.detail(req.user.companyId, id);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateSupplierDocumentDto,
  ) {
    return this.documents.create(
      req.user.companyId,
      req.user.id,
      this.requireKey(key),
      dto,
    );
  }

  @Post('exceptions')
  createException(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateSupplierDocumentExceptionDto,
  ) {
    return this.documents.createException(
      req.user.companyId,
      req.user.id,
      this.requireKey(key),
      dto,
    );
  }

  private requireKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException('Se requiere Idempotency-Key válida');
    }
    return key;
  }
}
