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
  SupplierDocumentBasisStatus,
  SupplierDocumentStatus,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { documentMoney } from './supplier-document-normalization';
import { ApproveReceiptVarianceDto } from './dto/supplier-document-reconciliation.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SupplierReceiptVarianceService {
  constructor(private readonly db: PrismaService) {}

  private hash(data: unknown): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private async read(tx: Tx, companyId: string, receiptId: string) {
    const receipt = await tx.purchaseReceipt.findFirst({
      where: { companyId, id: receiptId },
      include: {
        purchase: { select: { companyId: true, supplierId: true } },
        items: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            quantityReceived: true,
            unitCost: true,
          },
        },
      },
    });
    if (!receipt || receipt.purchase.companyId !== companyId) {
      throw new NotFoundException('Recepción no encontrada');
    }
    const links = await tx.purchaseReceiptDocument.findMany({
      where: { companyId, receiptId },
      orderBy: { id: 'asc' },
      include: {
        document: {
          select: {
            status: true,
            type: true,
            currency: true,
            basisStatus: true,
            revision: true,
            goodsNetAmount: true,
          },
        },
      },
    });
    const active = links.filter(
      (link) =>
        link.isActive && link.document.status === SupplierDocumentStatus.ACTIVE,
    );
    const allocated = active.reduce(
      (sum, link) => sum.plus(link.allocatedSubtotal),
      new Prisma.Decimal(0),
    );
    const legacyEstimate = receipt.items.length
      ? receipt.items
          .reduce(
            (sum, item) =>
              sum.plus(
                new Prisma.Decimal(String(item.unitCost))
                  .times(item.quantityReceived)
                  .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
              ),
            new Prisma.Decimal(0),
          )
          .toFixed(2)
      : null;
    const source = {
      companyId,
      receiptId,
      supplierId: receipt.purchase.supplierId,
      purchaseId: receipt.purchaseId,
      receiptItems: receipt.items.map((item) => ({
        id: item.id,
        quantity: item.quantityReceived,
        historicalUnitCostFloat: String(item.unitCost),
      })),
      links: links.map((link) => ({
        id: link.id,
        documentId: link.documentId,
        amount: link.allocatedSubtotal.toFixed(2),
        revision: link.revision,
        isActive: link.isActive,
        documentRevision: link.document.revision,
        documentStatus: link.document.status,
        documentCurrency: link.document.currency,
        documentBasisStatus: link.document.basisStatus,
        documentGoodsNet: link.document.goodsNetAmount?.toFixed(2) ?? null,
      })),
    };
    return {
      supplierId: receipt.purchase.supplierId,
      purchaseId: receipt.purchaseId,
      source,
      hash: this.hash(source),
      active,
      allocated,
      legacyEstimate,
    };
  }

  async overview(companyId: string, receiptId: string) {
    const state = await this.read(this.db, companyId, receiptId);
    const approval =
      await this.db.purchaseReceiptReconciliationApproval.findFirst({
        where: { companyId, receiptId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    const approvalCurrent =
      approval?.allocationSnapshotHash === state.hash;
    return {
      receiptId,
      supplierId: state.supplierId,
      allocatedTotalAmount: state.allocated.toFixed(2),
      legacyReceiptEstimate: state.legacyEstimate,
      legacyEstimateIsAuthoritative: false,
      activeInvoiceCount: state.active.length,
      snapshotHash: state.hash,
      latestApprovalId: approval?.id ?? null,
      approvalCurrent,
      receiptReviewStatus: approvalCurrent
        ? 'APPROVED_VARIANCE'
        : 'REQUIRES_REVIEW',
      receiptComparableNetAmount: approvalCurrent
        ? approval.receiptNetAmount.toFixed(2)
        : null,
      receiptCurrency: approvalCurrent ? approval.currency : null,
      approvedDifferenceAmount: approvalCurrent
        ? approval.differenceAmount.toFixed(2)
        : null,
      automaticCoverageComplete: false,
      // Legacy Float costs do not establish an authoritative receipt ceiling.
      receiptCeilingVerified: false,
    };
  }

  async approve(
    companyId: string,
    actorId: string,
    key: string,
    receiptId: string,
    dto: ApproveReceiptVarianceDto,
  ) {
    const receiptNet = documentMoney(dto.receiptComparableNetAmount)!;
    const reason = dto.reason.trim();
    const evidence = dto.evidenceReference.trim();
    if (!reason || !evidence) {
      throw new BadRequestException('Justificación y evidencia obligatorias');
    }
    const scope = IdempotencyScope.SUPPLIER_DOCUMENT_VARIANCE_APPROVE;
    const requestHash = this.hash({
      receiptId,
      receiptNet: receiptNet.toFixed(2),
      currency: dto.receiptCurrency,
      reason,
      evidence,
      expectedSnapshotHash: dto.expectedSnapshotHash,
    });
    const prior = await this.replay(companyId, scope, key, requestHash);
    if (prior) return prior;
    const before = await this.read(this.db, companyId, receiptId);
    try {
      return await this.db.$transaction(
        async (tx) => {
          const claim = await tx.idempotencyRecord.create({
            data: { companyId, scope, key, requestHash },
          });
          const locked = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "Supplier" WHERE "id" = ${before.supplierId} AND "companyId" = ${companyId} FOR NO KEY UPDATE`,
          );
          if (locked.length !== 1) {
            throw new NotFoundException('Proveedor no encontrado');
          }
          const state = await this.read(tx, companyId, receiptId);
          if (
            state.supplierId !== before.supplierId ||
            state.hash !== dto.expectedSnapshotHash
          ) {
            throw new ConflictException('Snapshot de conciliación obsoleto');
          }
          if (!state.active.length) {
            throw new ConflictException('Sin facturas activas vinculadas');
          }
          for (const link of state.active) {
            if (
              link.supplierId !== state.supplierId ||
              link.document.type !== SupplierDocumentType.FACTURA ||
              link.document.basisStatus !==
                SupplierDocumentBasisStatus.CONFIRMED ||
              link.document.currency !== dto.receiptCurrency
            ) {
              throw new ConflictException(
                'Facturas sin moneda o base comparable',
              );
            }
          }
          const difference = state.allocated.minus(receiptNet);
          if (difference.isZero()) {
            throw new ConflictException('No hay diferencia que aprobar');
          }
          const already =
            await tx.purchaseReceiptReconciliationApproval.findFirst({
              where: {
                companyId,
                receiptId,
                allocationSnapshotHash: state.hash,
              },
              select: { id: true },
            });
          if (already) throw new ConflictException('Versión ya aprobada');
          const result = await tx.purchaseReceiptReconciliationApproval.create({
            data: {
              companyId,
              supplierId: state.supplierId,
              purchaseId: state.purchaseId,
              receiptId,
              currency: dto.receiptCurrency,
              receiptNetAmount: receiptNet,
              allocatedTotalAmount: state.allocated,
              differenceAmount: difference,
              allocationSnapshotHash: state.hash,
              allocationSnapshot: {
                ...state.source,
                evidenceReference: evidence,
                attestedReceiptNet: receiptNet.toFixed(2),
                legacyReceiptEstimate: state.legacyEstimate,
                legacyEstimateIsAuthoritative: false,
              },
              reason,
              approvedById: actorId,
            },
          });
          await tx.idempotencyRecord.update({
            where: { id: claim.id },
            data: { resourceId: result.id },
          });
          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const found = await this.replay(companyId, scope, key, requestHash);
        if (found) return found;
        throw new ConflictException('Aprobación duplicada o concurrente');
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2003' || err.code === 'P2034')
      ) {
        throw new ConflictException('Conflicto de concurrencia o integridad');
      }
      throw err;
    }
  }

  private async replay(
    companyId: string,
    scope: IdempotencyScope,
    key: string,
    hash: string,
  ) {
    const claim = await this.db.idempotencyRecord.findUnique({
      where: { companyId_scope_key: { companyId, scope, key } },
    });
    if (!claim) return null;
    if (claim.requestHash !== hash) {
      throw new ConflictException(
        'Clave idempotente reutilizada con otros datos',
      );
    }
    if (!claim.resourceId) throw new ConflictException('Operación incompleta');
    const approval =
      await this.db.purchaseReceiptReconciliationApproval.findFirst({
        where: { id: claim.resourceId, companyId },
      });
    if (!approval) throw new ConflictException('Aprobación no encontrada');
    return approval;
  }
}
