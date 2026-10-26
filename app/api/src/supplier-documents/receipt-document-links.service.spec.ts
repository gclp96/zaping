import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReceiptDocumentLinksService } from './receipt-document-links.service';

describe('ReceiptDocumentLinksService', () => {
  const companyId = 'company-a';
  const actorId = 'actor-a';
  const receiptId = 'receipt-a';
  const documentId = 'document-a';

  const tx = {
    purchaseReceipt: { findFirst: jest.fn() },
    supplierDocument: { findFirst: jest.fn() },
    purchaseReceiptSupplierDocumentLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    purchaseReceiptSupplierDocumentLink: { ...tx.purchaseReceiptSupplierDocumentLink, findMany: jest.fn(), updateMany: jest.fn() },
  };
  const service = new ReceiptDocumentLinksService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.purchaseReceipt.findFirst.mockResolvedValue({ id: receiptId, purchase: { supplierId: 'supplier-a' } });
    tx.supplierDocument.findFirst.mockResolvedValue({ id: documentId, supplierId: 'supplier-a', status: 'ACTIVE' });
    tx.purchaseReceiptSupplierDocumentLink.findUnique.mockResolvedValue(null);
    tx.purchaseReceiptSupplierDocumentLink.create.mockResolvedValue({ id: 'link-a' });
  });

  it('requires a receipt in the requesting company', async () => {
    tx.purchaseReceipt.findFirst.mockResolvedValue(null);
    await expect(service.link(companyId, actorId, receiptId, documentId)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.purchaseReceipt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: receiptId, companyId } }));
    expect(tx.purchaseReceiptSupplierDocumentLink.create).not.toHaveBeenCalled();
  });

  it('rejects a supplier mismatch without creating a link', async () => {
    tx.supplierDocument.findFirst.mockResolvedValue({ id: documentId, supplierId: 'supplier-b', status: 'ACTIVE' });
    await expect(service.link(companyId, actorId, receiptId, documentId)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.purchaseReceiptSupplierDocumentLink.create).not.toHaveBeenCalled();
  });

  it('rejects a cancelled document', async () => {
    tx.supplierDocument.findFirst.mockResolvedValue({ id: documentId, supplierId: 'supplier-a', status: 'CANCELLED' });
    await expect(service.link(companyId, actorId, receiptId, documentId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a tenant-scoped association, not a monetary allocation', async () => {
    await service.link(companyId, actorId, receiptId, documentId);
    expect(tx.purchaseReceiptSupplierDocumentLink.create).toHaveBeenCalledWith({
      data: { companyId, receiptId, documentId, createdById: actorId },
    });
  });

  it('replays an existing active link without duplicating it', async () => {
    const prior = { id: 'link-existing', removedAt: null };
    tx.purchaseReceiptSupplierDocumentLink.findUnique.mockResolvedValue(prior);
    await expect(service.link(companyId, actorId, receiptId, documentId)).resolves.toBe(prior);
    expect(tx.purchaseReceiptSupplierDocumentLink.create).not.toHaveBeenCalled();
  });

  it('does not list documents of a missing receipt', async () => {
    tx.purchaseReceipt.findFirst.mockResolvedValue(null);
    await expect(service.list(companyId, receiptId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.purchaseReceiptSupplierDocumentLink.findMany).not.toHaveBeenCalled();
  });
});
