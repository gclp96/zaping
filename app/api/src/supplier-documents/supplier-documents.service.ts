import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdempotencyScope,
  Prisma,
  SupplierDocumentAuditOperation,
  SupplierDocumentTaxTreatment,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDocumentDto,
  CreateSupplierDocumentExceptionDto,
  ListSupplierDocumentsQueryDto,
} from './dto/create-supplier-document.dto';
import {
  createSupplierDocumentRequestHash,
  documentDate,
  documentMoney,
  normalizedIdentity,
} from './supplier-document-normalization';

@Injectable()
export class SupplierDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string, query: ListSupplierDocumentsQueryDto) {
    return this.prisma.supplierDocument.findMany({
      where: {
        companyId,
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { taxBreakdowns: true },
    });
  }

  async detail(companyId: string, id: string) {
    const document = await this.prisma.supplierDocument.findFirst({
      where: { companyId, id },
      include: {
        taxBreakdowns: true,
        audits: { orderBy: { revisionAfter: 'asc' } },
      },
    });
    if (!document) throw new NotFoundException('Documento no encontrado');
    return document;
  }

  create(
    companyId: string,
    actorId: string,
    key: string,
    dto: CreateSupplierDocumentDto,
  ) {
    return this.persist(companyId, actorId, key, dto, false);
  }

  createException(
    companyId: string,
    actorId: string,
    key: string,
    dto: CreateSupplierDocumentExceptionDto,
  ) {
    return this.persist(companyId, actorId, key, dto, true);
  }

  private async persist(
    companyId: string,
    actorId: string,
    key: string,
    dto: CreateSupplierDocumentDto | CreateSupplierDocumentExceptionDto,
    exception: boolean,
  ) {
    const number = dto.number.trim();
    const normalizedNumber = normalizedIdentity(number);
    if (!normalizedNumber)
      throw new BadRequestException('Número documental obligatorio');
    const series = dto.series?.trim() || null;
    const normalizedSeries = normalizedIdentity(series ?? '');
    const date = documentDate(dto.documentDate);
    const cfdiUuid = dto.cfdiUuid?.toLowerCase() ?? null;
    if (cfdiUuid && dto.type !== SupplierDocumentType.FACTURA) {
      throw new BadRequestException('UUID fiscal solo permitido en FACTURA');
    }
    const taxBreakdowns = dto.taxBreakdowns ?? [];
    const taxKeys = new Set<string>();
    for (const line of taxBreakdowns) {
      const taxKey = line.area + ':' + line.treatment;
      if (taxKeys.has(taxKey))
        throw new BadRequestException('Desglose fiscal duplicado');
      taxKeys.add(taxKey);
      if (
        line.treatment !== SupplierDocumentTaxTreatment.TAXABLE_16 &&
        !documentMoney(line.ivaAmount)!.isZero()
      ) {
        throw new BadRequestException('Tasa 0% y exento deben tener IVA cero');
      }
    }
    const extra = exception
      ? (dto as CreateSupplierDocumentExceptionDto)
      : null;
    if (extra && (!extra.reason.trim() || !extra.evidenceReference.trim())) {
      throw new BadRequestException('Motivo y evidencia son obligatorios');
    }
    const scope = exception
      ? IdempotencyScope.SUPPLIER_DOCUMENT_EXCEPTION_CREATE
      : IdempotencyScope.SUPPLIER_DOCUMENT_CREATE;
    const requestHash = createSupplierDocumentRequestHash(dto);
    const previous = await this.findReplay(companyId, scope, key, requestHash);
    if (previous) return previous;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const claim = await tx.idempotencyRecord.create({
            data: { companyId, scope, key, requestHash },
          });

          // SQL is constant and both values are bound parameters, never interpolated.
          // R2A document writes serialize per tenant/supplier; no stock locks or writes.
          const locked = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "Supplier"
              WHERE "id" = ${dto.supplierId} AND "companyId" = ${companyId}
              FOR NO KEY UPDATE`,
          );
          if (!locked.length)
            throw new NotFoundException('Proveedor no encontrado');

          const identity = {
            companyId,
            supplierId: dto.supplierId,
            type: dto.type,
            normalizedSeries,
            normalizedNumber,
          };
          const existing = await tx.supplierDocument.findMany({
            where: identity,
            orderBy: { identityOccurrence: 'asc' },
            select: { id: true, identityOccurrence: true },
          });
          if (cfdiUuid) {
            const sameUuid = await tx.supplierDocument.findFirst({
              where: { companyId, cfdiUuid },
              select: { id: true },
            });
            if (sameUuid)
              throw new ConflictException({
                code: 'SUPPLIER_DOCUMENT_UUID_EXISTS',
                existingDocumentId: sameUuid.id,
              });
          }

          let occurrence = 1;
          let exceptionBasedOnDocumentId: string | null = null;
          if (!extra) {
            if (existing.length)
              throw new ConflictException({
                code: 'SUPPLIER_DOCUMENT_IDENTITY_EXISTS',
                existingDocumentId: existing[0].id,
              });
          } else {
            const base = existing.find(
              (x) => x.id === extra.duplicateOfDocumentId,
            );
            if (!base || base.identityOccurrence !== 1) {
              throw new ConflictException(
                'Referencia de excepción incompatible',
              );
            }
            occurrence =
              Math.max(...existing.map((x) => x.identityOccurrence)) + 1;
            exceptionBasedOnDocumentId = base.id;
          }

          const document = await tx.supplierDocument.create({
            data: {
              companyId,
              supplierId: dto.supplierId,
              type: dto.type,
              series,
              number,
              normalizedSeries,
              normalizedNumber,
              identityOccurrence: occurrence,
              documentDate: date,
              cfdiUuid,
              issuerRfc: dto.issuerRfc?.toUpperCase() ?? null,
              receiverRfc: dto.receiverRfc?.toUpperCase() ?? null,
              currency: dto.currency?.toUpperCase() ?? null,
              subtotalAmount: documentMoney(dto.subtotalAmount),
              discountAmount: documentMoney(dto.discountAmount),
              freightAmount: documentMoney(dto.freightAmount),
              ivaAmount: documentMoney(dto.ivaAmount),
              withholdingAmount: documentMoney(dto.withholdingAmount),
              totalAmount: documentMoney(dto.totalAmount),
              goodsNetAmount: documentMoney(dto.goodsNetAmount),
              basisStatus: 'PENDING_REVIEW',
              createdById: actorId,
              exceptionBasedOnDocumentId,
              exceptionReason: extra?.reason.trim() ?? null,
              exceptionEvidenceReference:
                extra?.evidenceReference.trim() ?? null,
              exceptionReviewedById: extra ? actorId : null,
              exceptionReviewedAt: extra ? new Date() : null,
            },
          });

          if (taxBreakdowns.length) {
            await tx.supplierDocumentTaxBreakdown.createMany({
              data: taxBreakdowns.map((line) => ({
                companyId,
                documentId: document.id,
                area: line.area,
                treatment: line.treatment,
                baseAmount: documentMoney(line.baseAmount)!,
                ivaAmount: documentMoney(line.ivaAmount)!,
              })),
            });
          }

          const operation = extra
            ? SupplierDocumentAuditOperation.DOCUMENT_CREATED_BY_EXCEPTION
            : SupplierDocumentAuditOperation.DOCUMENT_CREATED;
          await tx.supplierDocumentAudit.create({
            data: {
              companyId,
              documentId: document.id,
              actorId,
              operation,
              revisionBefore: null,
              revisionAfter: 0,
              reason: extra?.reason.trim() ?? null,
              change: {
                version: 1,
                operation,
                snapshot: {
                  supplierId: document.supplierId,
                  type: document.type,
                  series: document.series,
                  number: document.number,
                  documentDate: dto.documentDate,
                  cfdiUuid: document.cfdiUuid,
                  issuerRfc: document.issuerRfc,
                  receiverRfc: document.receiverRfc,
                  currency: document.currency,
                  subtotalAmount: document.subtotalAmount?.toFixed(2) ?? null,
                  discountAmount: document.discountAmount?.toFixed(2) ?? null,
                  freightAmount: document.freightAmount?.toFixed(2) ?? null,
                  ivaAmount: document.ivaAmount?.toFixed(2) ?? null,
                  totalAmount: document.totalAmount?.toFixed(2) ?? null,
                  goodsNetAmount: document.goodsNetAmount?.toFixed(2) ?? null,
                  withholdingAmount:
                    document.withholdingAmount?.toFixed(2) ?? null,
                  taxBreakdowns: taxBreakdowns.map((line) => ({
                    area: line.area,
                    treatment: line.treatment,
                    baseAmount: documentMoney(line.baseAmount)!.toFixed(2),
                    ivaAmount: documentMoney(line.ivaAmount)!.toFixed(2),
                  })),
                  identityOccurrence: document.identityOccurrence,
                  exceptionBasedOnDocumentId,
                  evidenceReference: extra?.evidenceReference.trim() ?? null,
                },
              },
            },
          });
          await tx.idempotencyRecord.update({
            where: { id: claim.id },
            data: { resourceId: document.id },
          });
          return tx.supplierDocument.findUniqueOrThrow({
            where: { id: document.id },
            include: { taxBreakdowns: true },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.findReplay(
          companyId,
          scope,
          key,
          requestHash,
        );
        if (replay) return replay;
        throw new ConflictException('Ya existe un documento con esa identidad');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Conflicto de relación o concurrencia; reintenta la operación',
        );
      }
      throw error;
    }
  }

  private async findReplay(
    companyId: string,
    scope: IdempotencyScope,
    key: string,
    hash: string,
  ) {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { companyId_scope_key: { companyId, scope, key } },
    });
    if (!record) return null;
    if (record.requestHash !== hash) {
      throw new ConflictException(
        'Idempotency-Key reutilizada con otro contenido',
      );
    }
    if (!record.resourceId)
      throw new ConflictException('Operación idempotente incompleta');
    const document = await this.prisma.supplierDocument.findFirst({
      where: { companyId, id: record.resourceId },
      include: { taxBreakdowns: true },
    });
    if (!document)
      throw new ConflictException('No se encontró el documento idempotente');
    return document;
  }
}
