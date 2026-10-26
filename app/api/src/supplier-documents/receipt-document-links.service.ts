import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceiptDocumentLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, receiptId: string) {
    await this.requireReceipt(companyId, receiptId);
    return this.prisma.purchaseReceiptSupplierDocumentLink.findMany({
      where: { companyId, receiptId, removedAt: null },
      include: {
        document: {
          select: {
            id: true,
            type: true,
            series: true,
            number: true,
            documentDate: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async link(companyId: string, actorId: string, receiptId: string, documentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.findFirst({
        where: { id: receiptId, companyId },
        select: { id: true, purchase: { select: { supplierId: true } } },
      });
      if (!receipt) throw new NotFoundException('Recepción no encontrada');

      const document = await tx.supplierDocument.findFirst({
        where: { id: documentId, companyId },
        select: { id: true, supplierId: true, status: true },
      });
      if (!document) throw new NotFoundException('Documento no encontrado');
      if (receipt.purchase.supplierId !== document.supplierId) {
        throw new ConflictException('El proveedor del documento no coincide con la recepción');
      }
      if (document.status !== 'ACTIVE') {
        throw new ConflictException('No se puede vincular un documento cancelado');
      }

      const previous = await tx.purchaseReceiptSupplierDocumentLink.findUnique({
        where: { companyId_receiptId_documentId: { companyId, receiptId, documentId } },
      });
      if (previous) {
        if (previous.removedAt === null) return previous;
        return tx.purchaseReceiptSupplierDocumentLink.update({
          where: { id: previous.id },
          data: { removedAt: null, removedById: null, reason: null, createdById: actorId, createdAt: new Date() },
        });
      }

      return tx.purchaseReceiptSupplierDocumentLink.create({
        data: { companyId, receiptId, documentId, createdById: actorId },
      });
    });
  }

  async unlink(companyId: string, actorId: string, receiptId: string, documentId: string, reason: string) {
    await this.requireReceipt(companyId, receiptId);
    const changed = await this.prisma.purchaseReceiptSupplierDocumentLink.updateMany({
      where: { companyId, receiptId, documentId, removedAt: null },
      data: { removedAt: new Date(), removedById: actorId, reason: reason.trim() },
    });
    if (changed.count === 0) throw new NotFoundException('Vínculo documental activo no encontrado');
    return { unlinked: true };
  }

  private async requireReceipt(companyId: string, receiptId: string) {
    const receipt = await this.prisma.purchaseReceipt.findFirst({
      where: { id: receiptId, companyId },
      select: { id: true },
    });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
  }
}
