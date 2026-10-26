import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdempotencyScope,
  Prisma,
  SupplierDocument,
  SupplierDocumentAuditOperation,
  SupplierDocumentBasisStatus,
  SupplierDocumentStatus,
  SupplierDocumentType,
  SupplierDocumentCancellationSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmSupplierDocumentBasisDto,
  CreateSupplierDocumentAllocationDto,
  ReviseSupplierDocumentAllocationDto,
  AllocationRevisionAction,
  CorrectSupplierDocumentBasisDto,
  CancelSupplierDocumentDto,
} from './dto/supplier-document-reconciliation.dto';
import { documentMoney } from './supplier-document-normalization';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SupplierDocumentReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async allocations(companyId: string, documentId: string) {
    const document = await this.prisma.supplierDocument.findFirst({
      where: { id: documentId, companyId },
      select: { id: true },
    });
    if (!document) throw new NotFoundException('Documento no encontrado');
    return this.prisma.purchaseReceiptDocument.findMany({
      where: { companyId, documentId },
      include: {
        receipt: { select: { id: true, folio: true, purchaseId: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async confirmBasis(
    companyId: string,
    actorId: string,
    key: string,
    documentId: string,
    dto: ConfirmSupplierDocumentBasisDto,
  ) {
    const amount = documentMoney(dto.goodsNetAmount)!;
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Justificación obligatoria');
    const payload = {
      documentId,
      amount: amount.toFixed(2),
      currency: dto.currency,
      reason,
      expectedRevision: dto.expectedRevision,
    };
    return this.execute(
      companyId,
      actorId,
      key,
      IdempotencyScope.SUPPLIER_DOCUMENT_BASIS_CONFIRM,
      payload,
      async (tx, doc) => {
        if (doc.type !== SupplierDocumentType.FACTURA) {
          throw new ConflictException('Solo facturas permiten conciliación');
        }
        if (doc.basisStatus === SupplierDocumentBasisStatus.CONFIRMED) {
          throw new ConflictException(
            'Base ya confirmada; usar corrección auditada',
          );
        }
        const before = {
          goodsNetAmount: doc.goodsNetAmount?.toFixed(2) ?? null,
          currency: doc.currency,
          basisStatus: doc.basisStatus,
        };
        await tx.supplierDocument.update({
          where: { id: doc.id },
          data: {
            currency: dto.currency,
            goodsNetAmount: amount,
            basisStatus: SupplierDocumentBasisStatus.CONFIRMED,
            revision: { increment: 1 },
          },
        });
        return this.audit(
          tx,
          companyId,
          actorId,
          doc.id,
          SupplierDocumentAuditOperation.BASIS_CONFIRMED,
          doc.revision,
          reason,
          {
            before,
            after: {
              goodsNetAmount: amount.toFixed(2),
              currency: dto.currency,
              basisStatus: SupplierDocumentBasisStatus.CONFIRMED,
            },
          },
        );
      },
    );
  }

  async createAllocation(
    companyId: string,
    actorId: string,
    key: string,
    documentId: string,
    dto: CreateSupplierDocumentAllocationDto,
  ) {
    const amount = documentMoney(dto.allocatedSubtotal)!;
    if (amount.lte(0))
      throw new BadRequestException('Importe debe ser positivo');
    const payload = {
      documentId,
      receiptId: dto.receiptId,
      amount: amount.toFixed(2),
      expectedRevision: dto.expectedRevision,
    };
    return this.execute(
      companyId,
      actorId,
      key,
      IdempotencyScope.SUPPLIER_DOCUMENT_ALLOCATION_CREATE,
      payload,
      async (tx, doc) => {
        if (
          doc.type !== SupplierDocumentType.FACTURA ||
          doc.basisStatus !== SupplierDocumentBasisStatus.CONFIRMED ||
          !doc.goodsNetAmount ||
          !doc.currency
        ) {
          throw new ConflictException(
            'Factura requiere base y moneda verificadas',
          );
        }
        const receipt = await tx.purchaseReceipt.findFirst({
          where: { id: dto.receiptId, companyId },
          select: {
            id: true,
            purchaseId: true,
            purchase: { select: { companyId: true, supplierId: true } },
          },
        });
        if (
          !receipt ||
          receipt.purchase.companyId !== companyId ||
          receipt.purchase.supplierId !== doc.supplierId
        ) {
          throw new NotFoundException('Recepción del proveedor no encontrada');
        }
        const duplicate = await tx.purchaseReceiptDocument.findFirst({
          where: { companyId, documentId, receiptId: receipt.id },
          select: { id: true },
        });
        if (duplicate) {
          throw new ConflictException('Ya existe vínculo factura-recepción');
        }
        const sum = await tx.purchaseReceiptDocument.aggregate({
          where: { companyId, documentId, isActive: true },
          _sum: { allocatedSubtotal: true },
        });
        const previous = sum._sum.allocatedSubtotal ?? new Prisma.Decimal(0);
        const next = previous.plus(amount);
        if (next.gt(doc.goodsNetAmount)) {
          throw new ConflictException(
            'Se excede el neto conciliable de la factura',
          );
        }
        const link = await tx.purchaseReceiptDocument.create({
          data: {
            companyId,
            supplierId: doc.supplierId,
            purchaseId: receipt.purchaseId,
            receiptId: receipt.id,
            documentId,
            allocatedSubtotal: amount,
            createdById: actorId,
          },
        });
        await tx.supplierDocument.update({
          where: { id: doc.id },
          data: { revision: { increment: 1 } },
        });
        return this.audit(
          tx,
          companyId,
          actorId,
          doc.id,
          SupplierDocumentAuditOperation.ALLOCATION_CREATED,
          doc.revision,
          null,
          {
            allocationId: link.id,
            receiptId: receipt.id,
            purchaseId: receipt.purchaseId,
            allocatedSubtotal: amount.toFixed(2),
            sumBefore: previous.toFixed(2),
            sumAfter: next.toFixed(2),
          },
        );
      },
    );
  }

  async reviseAllocation(
    companyId: string,
    actorId: string,
    key: string,
    documentId: string,
    dto: ReviseSupplierDocumentAllocationDto,
  ) {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Motivo obligatorio');
    const replace = dto.action === AllocationRevisionAction.REPLACE_AMOUNT;
    if (replace !== (dto.allocatedSubtotal !== undefined)) {
      throw new BadRequestException(
        'Importe requerido solo para REPLACE_AMOUNT',
      );
    }
    const amount = replace ? documentMoney(dto.allocatedSubtotal)! : null;
    if (amount && amount.lte(0)) {
      throw new BadRequestException('Importe corregido debe ser positivo');
    }
    return this.execute(
      companyId,
      actorId,
      key,
      IdempotencyScope.SUPPLIER_DOCUMENT_ALLOCATION_REVISE,
      {
        documentId,
        allocationId: dto.allocationId,
        action: dto.action,
        amount: amount?.toFixed(2) ?? null,
        reason,
        expectedAllocationRevision: dto.expectedAllocationRevision,
        expectedRevision: dto.expectedRevision,
      },
      async (tx, doc) => {
        const link = await tx.purchaseReceiptDocument.findFirst({
          where: {
            id: dto.allocationId,
            documentId,
            companyId,
            isActive: true,
          },
        });
        if (!link)
          throw new NotFoundException('Asignación activa no encontrada');
        if (link.revision !== dto.expectedAllocationRevision) {
          throw new ConflictException('Versión de asignación obsoleta');
        }
        const totals = await tx.purchaseReceiptDocument.aggregate({
          where: { companyId, documentId, isActive: true },
          _sum: { allocatedSubtotal: true },
        });
        const beforeTotal =
          totals._sum.allocatedSubtotal ?? new Prisma.Decimal(0);
        const afterTotal = beforeTotal
          .minus(link.allocatedSubtotal)
          .plus(amount ?? new Prisma.Decimal(0));
        if (!doc.goodsNetAmount || afterTotal.gt(doc.goodsNetAmount)) {
          throw new ConflictException('Corrección excede el neto conciliable');
        }
        await tx.purchaseReceiptDocument.update({
          where: { id: link.id },
          data: {
            ...(amount ? { allocatedSubtotal: amount } : { isActive: false }),
            revision: { increment: 1 },
          },
        });
        await tx.supplierDocument.update({
          where: { id: doc.id },
          data: { revision: { increment: 1 } },
        });
        return this.audit(
          tx,
          companyId,
          actorId,
          doc.id,
          SupplierDocumentAuditOperation.ALLOCATION_REVISED,
          doc.revision,
          reason,
          {
            allocationId: link.id,
            receiptId: link.receiptId,
            before: {
              amount: link.allocatedSubtotal.toFixed(2),
              active: link.isActive,
              revision: link.revision,
              documentAllocatedTotal: beforeTotal.toFixed(2),
            },
            after: {
              amount: amount?.toFixed(2) ?? link.allocatedSubtotal.toFixed(2),
              active: Boolean(amount),
              revision: link.revision + 1,
              documentAllocatedTotal: afterTotal.toFixed(2),
            },
          },
        );
      },
    );
  }

  async correctBasis(
    companyId: string,
    actorId: string,
    key: string,
    documentId: string,
    dto: CorrectSupplierDocumentBasisDto,
  ) {
    const amount = documentMoney(dto.goodsNetAmount)!;
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Motivo obligatorio');
    return this.execute(
      companyId,
      actorId,
      key,
      IdempotencyScope.SUPPLIER_DOCUMENT_CORRECT,
      {
        documentId,
        expectedRevision: dto.expectedRevision,
        amount: amount.toFixed(2),
        currency: dto.currency,
        reason,
      },
      async (tx, doc) => {
        if (
          doc.type !== SupplierDocumentType.FACTURA ||
          doc.basisStatus !== SupplierDocumentBasisStatus.CONFIRMED
        ) {
          throw new ConflictException(
            'Solo factura confirmada permite corrección',
          );
        }
        const active = await tx.purchaseReceiptDocument.aggregate({
          where: { documentId, companyId, isActive: true },
          _sum: { allocatedSubtotal: true },
          _count: { _all: true },
        });
        const allocated =
          active._sum.allocatedSubtotal ?? new Prisma.Decimal(0);
        if (allocated.gt(amount)) {
          throw new ConflictException(
            'Reducir primero las asignaciones activas',
          );
        }
        if (active._count._all > 0 && dto.currency !== doc.currency) {
          throw new ConflictException('No cambiar moneda con vínculos activos');
        }
        if (
          amount.eq(doc.goodsNetAmount ?? -1) &&
          dto.currency === doc.currency
        ) {
          throw new ConflictException('No hay diferencias que corregir');
        }
        const before = {
          goodsNetAmount: doc.goodsNetAmount?.toFixed(2) ?? null,
          currency: doc.currency,
        };
        await tx.supplierDocument.update({
          where: { id: doc.id },
          data: {
            goodsNetAmount: amount,
            currency: dto.currency,
            revision: { increment: 1 },
          },
        });
        return this.audit(
          tx,
          companyId,
          actorId,
          doc.id,
          SupplierDocumentAuditOperation.DOCUMENT_CORRECTED,
          doc.revision,
          reason,
          {
            before,
            after: {
              goodsNetAmount: amount.toFixed(2),
              currency: dto.currency,
            },
            allocatedAtCorrection: allocated.toFixed(2),
          },
        );
      },
    );
  }

  async cancelDocument(
    companyId: string,
    actorId: string,
    key: string,
    documentId: string,
    dto: CancelSupplierDocumentDto,
  ) {
    const reason = dto.reason.trim();
    const evidenceReference = dto.evidenceReference?.trim() || null;
    if (!reason) throw new BadRequestException('Motivo obligatorio');
    if (
      dto.source === SupplierDocumentCancellationSource.EXTERNAL_REPORTED &&
      !evidenceReference
    ) {
      throw new BadRequestException('Reporte externo requiere evidencia');
    }
    if (dto.replacedByDocumentId === documentId) {
      throw new BadRequestException('No puede sustituirse a sí misma');
    }
    return this.execute(
      companyId,
      actorId,
      key,
      IdempotencyScope.SUPPLIER_DOCUMENT_CANCEL,
      {
        documentId,
        expectedRevision: dto.expectedRevision,
        source: dto.source,
        reason,
        evidenceReference,
        replacedByDocumentId: dto.replacedByDocumentId ?? null,
      },
      async (tx, doc) => {
        if (doc.type !== SupplierDocumentType.FACTURA) {
          throw new ConflictException('Solo facturas admiten esta cancelación');
        }
        if (dto.replacedByDocumentId) {
          const replacement = await tx.supplierDocument.findFirst({
            where: {
              id: dto.replacedByDocumentId,
              companyId,
              supplierId: doc.supplierId,
              type: SupplierDocumentType.FACTURA,
              status: SupplierDocumentStatus.ACTIVE,
              replacedByDocumentId: null,
            },
          });
          if (!replacement) {
            throw new NotFoundException(
              'Factura sustituta activa no encontrada',
            );
          }
          const prior = await tx.supplierDocument.findFirst({
            where: {
              companyId,
              supplierId: doc.supplierId,
              replacedByDocumentId: replacement.id,
            },
            select: { id: true },
          });
          if (prior)
            throw new ConflictException('La sustituta ya fue utilizada');
        }
        const links = await tx.purchaseReceiptDocument.findMany({
          where: { companyId, documentId, isActive: true },
          orderBy: { id: 'asc' },
        });
        await tx.purchaseReceiptDocument.updateMany({
          where: { companyId, documentId, isActive: true },
          data: { isActive: false, revision: { increment: 1 } },
        });
        await tx.supplierDocument.update({
          where: { id: doc.id },
          data: {
            status: SupplierDocumentStatus.CANCELLED,
            cancellationSource: dto.source,
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledById: actorId,
            replacedByDocumentId: dto.replacedByDocumentId ?? null,
            revision: { increment: 1 },
          },
        });
        return this.audit(
          tx,
          companyId,
          actorId,
          doc.id,
          SupplierDocumentAuditOperation.DOCUMENT_CANCELLED,
          doc.revision,
          reason,
          {
            source: dto.source,
            evidenceReference,
            replacedByDocumentId: dto.replacedByDocumentId ?? null,
            deactivatedAllocations: links.map((link) => ({
              id: link.id,
              receiptId: link.receiptId,
              amount: link.allocatedSubtotal.toFixed(2),
              revisionBefore: link.revision,
            })),
            zeroActiveCoverageAfterCancellation: true,
          },
        );
      },
    );
  }

  private async execute(
    companyId: string,
    actorId: string,
    key: string,
    scope: IdempotencyScope,
    payload: {
      documentId: string;
      expectedRevision: number;
      [key: string]: unknown;
    },
    operation: (
      tx: Tx,
      document: SupplierDocument,
    ) => Promise<{
      id: string;
      documentId: string;
      revisionAfter: number;
      operation: SupplierDocumentAuditOperation;
      change: Prisma.JsonValue;
    }>,
  ) {
    const requestHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const existing = await this.replay(companyId, scope, key, requestHash);
    if (existing) return existing;

    const current = await this.prisma.supplierDocument.findFirst({
      where: { companyId, id: payload.documentId },
      select: { supplierId: true },
    });
    if (!current) throw new NotFoundException('Documento no encontrado');

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const claim = await tx.idempotencyRecord.create({
            data: { companyId, scope, key, requestHash },
          });
          const locked = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "Supplier" WHERE "id" = ${current.supplierId} AND "companyId" = ${companyId} FOR NO KEY UPDATE`,
          );
          if (locked.length !== 1) {
            throw new NotFoundException('Proveedor no encontrado');
          }
          const doc = await tx.supplierDocument.findFirst({
            where: {
              id: payload.documentId,
              companyId,
              supplierId: current.supplierId,
            },
          });
          if (!doc) throw new NotFoundException('Documento no encontrado');
          if (doc.status !== SupplierDocumentStatus.ACTIVE) {
            throw new ConflictException('Documento cancelado');
          }
          if (doc.revision !== payload.expectedRevision) {
            throw new ConflictException('Revisión obsoleta');
          }
          const audit = await operation(tx, doc);
          await tx.idempotencyRecord.update({
            where: { id: claim.id },
            data: { resourceId: audit.id },
          });
          return this.response(audit);
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
        const saved = await this.replay(companyId, scope, key, requestHash);
        if (saved) return saved;
        throw new ConflictException('Conflicto de escritura concurrente');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2034')
      ) {
        throw new ConflictException('Conflicto de integridad o concurrencia');
      }
      throw error;
    }
  }

  private audit(
    tx: Tx,
    companyId: string,
    actorId: string,
    documentId: string,
    operation: SupplierDocumentAuditOperation,
    revisionBefore: number,
    reason: string | null,
    change: Prisma.InputJsonValue,
  ) {
    return tx.supplierDocumentAudit.create({
      data: {
        companyId,
        documentId,
        actorId,
        operation,
        revisionBefore,
        revisionAfter: revisionBefore + 1,
        reason,
        change,
      },
    });
  }

  private response(audit: {
    id: string;
    documentId: string;
    revisionAfter: number;
    operation: SupplierDocumentAuditOperation;
    change: Prisma.JsonValue;
  }) {
    return {
      eventId: audit.id,
      documentId: audit.documentId,
      revision: audit.revisionAfter,
      operation: audit.operation,
      change: audit.change,
    };
  }

  private async replay(
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
    if (!record.resourceId) {
      throw new ConflictException('Operación idempotente incompleta');
    }
    const audit = await this.prisma.supplierDocumentAudit.findFirst({
      where: { id: record.resourceId, companyId },
    });
    if (!audit) throw new ConflictException('Evento idempotente no disponible');
    return this.response(audit);
  }
}
