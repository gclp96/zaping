import { Injectable, NotFoundException } from '@nestjs/common';
import { SupplierDocumentAttachmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupplierDocumentAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fail-closed inventory only. Do not expose storageKey, hash, scanner details
   * or download URLs. No object can be served until an isolated scanner has
   * accepted it and a separate authenticated download adapter is in place.
   */
  async listAvailable(companyId: string, documentId: string) {
    const document = await this.prisma.supplierDocument.findFirst({
      where: { companyId, id: documentId },
      select: { id: true },
    });
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return this.prisma.supplierDocumentAttachment.findMany({
      where: {
        companyId,
        documentId,
        status: SupplierDocumentAttachmentStatus.AVAILABLE,
        removedAt: null,
      },
      select: {
        id: true,
        originalName: true,
        contentType: true,
        sizeBytes: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
  }
}
