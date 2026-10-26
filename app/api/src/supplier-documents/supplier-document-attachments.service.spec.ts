import { NotFoundException } from '@nestjs/common';
import { SupplierDocumentAttachmentStatus } from '@prisma/client';
import { SupplierDocumentAttachmentsService } from './supplier-document-attachments.service';

describe('SupplierDocumentAttachmentsService', () => {
  const prisma = {
    supplierDocument: { findFirst: jest.fn() },
    supplierDocumentAttachment: { findMany: jest.fn() },
  };
  const service = new SupplierDocumentAttachmentsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.supplierDocument.findFirst.mockResolvedValue({ id: 'document-a' });
    prisma.supplierDocumentAttachment.findMany.mockResolvedValue([]);
  });

  it('never lists attachments without a tenant-scoped document', async () => {
    prisma.supplierDocument.findFirst.mockResolvedValue(null);
    await expect(
      service.listAvailable('company-a', 'document-from-company-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supplierDocument.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'company-a', id: 'document-from-company-b' },
      select: { id: true },
    });
    expect(prisma.supplierDocumentAttachment.findMany).not.toHaveBeenCalled();
  });

  it('returns only available metadata and never the private object key', async () => {
    await service.listAvailable('company-a', 'document-a');
    expect(prisma.supplierDocumentAttachment.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        documentId: 'document-a',
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
  });
});
