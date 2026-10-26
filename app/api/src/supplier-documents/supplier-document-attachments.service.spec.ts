import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { NotFoundException } from '@nestjs/common';
import { SupplierDocumentAttachmentStatus } from '@prisma/client';
import { SupplierDocumentAttachmentsService } from './supplier-document-attachments.service';

describe('SupplierDocumentAttachmentsService', () => {
  const prisma = {
    supplierDocument: { findFirst: jest.fn() },
    supplierDocumentAttachment: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const storage = { openReadOnly: jest.fn() };
  const service = new SupplierDocumentAttachmentsService(
    prisma as never,
    storage,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.supplierDocument.findFirst.mockResolvedValue({ id: 'document-a' });
    prisma.supplierDocumentAttachment.findMany.mockResolvedValue([]);
    prisma.supplierDocumentAttachment.findFirst.mockResolvedValue(null);
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

  it('does not access private storage if the requesting tenant lacks the document', async () => {
    prisma.supplierDocument.findFirst.mockResolvedValue(null);
    await expect(
      service.verifiedDownload('company-b', 'company-a-document', 'file-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.openReadOnly).not.toHaveBeenCalled();
  });

  it('does not access private storage when an attachment is missing or quarantined', async () => {
    await expect(
      service.verifiedDownload('company-a', 'document-a', 'quarantined-file'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supplierDocumentAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'company-a',
          documentId: 'document-a',
          id: 'quarantined-file',
          status: SupplierDocumentAttachmentStatus.AVAILABLE,
          removedAt: null,
        },
      }),
    );
    expect(storage.openReadOnly).not.toHaveBeenCalled();
  });

  it('passes the authenticated Company to the private storage boundary', async () => {
    const bytes = Buffer.from('verified-private-object');
    const hash = createHash('sha256').update(bytes).digest('hex');
    prisma.supplierDocumentAttachment.findFirst.mockResolvedValue({
      storageKey: 'private-internal-key',
      originalName: 'attachment.pdf',
      contentType: 'application/pdf',
      sizeBytes: bytes.length,
      sha256: hash,
    });
    storage.openReadOnly.mockResolvedValueOnce(Readable.from([bytes]));

    await expect(
      service.verifiedDownload('company-a', 'document-a', 'attachment-a'),
    ).resolves.toMatchObject({
      bytes,
      contentType: 'application/pdf',
      originalName: 'attachment.pdf',
    });
    expect(storage.openReadOnly).toHaveBeenCalledWith(
      'private-internal-key',
      'company-a',
    );
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
