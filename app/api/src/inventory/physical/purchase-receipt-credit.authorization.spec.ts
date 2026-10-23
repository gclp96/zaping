import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { createPurchaseReceiptRequestHash } from '../../purchases-receipts/purchase-receipt-request-hash';
import { authorizePurchaseReceiptCredit } from './purchase-receipt-credit.authorization';
import { PhysicalInventoryService } from './physical-inventory.service';
import { PhysicalInventoryRepository } from './physical-inventory.repository';

describe('W1 receipt credit durable authorization', () => {
  function arrange(expirationDate?: string) {
    const companyId = randomUUID();
    const actorId = randomUUID();
    const receiptId = randomUUID();
    const productId = randomUUID();
    const purchaseId = randomUUID();
    const purchaseItemId = randomUUID();
    const dto = {
      purchaseId,
      items: [{ purchaseItemId, quantityReceived: 2, expirationDate }],
    };
    const ordered = {
      id: purchaseItemId,
      productId,
      purchaseId,
      price: 20,
      quantity: 4,
      receiptItems: [{ quantityReceived: 2 }],
    };
    const item = {
      companyId,
      productId,
      purchaseItemId,
      batchId: null as string | null,
      batch: null as null | {
        companyId: string;
        productId: string;
        lotNumber: string;
        expirationDate: Date | null;
      },
      lotNumber: null as string | null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      quantityReceived: 2,
      unitCost: 20,
      product: { companyId, inventoryTracking: 'QUANTITY' },
      purchaseItem: ordered,
    };
    const receipt = {
      id: receiptId,
      companyId,
      purchaseId,
      receivedBy: actorId,
      supplierDocumentType: null,
      supplierDocumentNumber: null,
      notes: null,
      items: [item],
      purchase: { companyId, status: 'CONFIRMED', items: [ordered] },
    };
    const claim = {
      resourceId: receiptId,
      requestHash: createPurchaseReceiptRequestHash(dto),
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ purchaseId, current: true }]),
      user: { findFirst: jest.fn().mockResolvedValue({ role: 'WAREHOUSE' }) },
      purchaseReceipt: { findFirst: jest.fn().mockResolvedValue(receipt) },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(claim) },
      inventoryMovement: { count: jest.fn().mockResolvedValue(0) },
    };
    const input = { companyId, actorId, receiptId, idempotencyKey: 'key' };
    const authorize = () =>
      authorizePurchaseReceiptCredit(
        tx as unknown as Prisma.TransactionClient,
        input,
      );
    return {
      tx,
      input,
      authorize,
      receipt,
      item,
      ordered,
      claim,
      dto,
      productId,
    };
  }

  it.each([undefined, '2035-08-15'])(
    'reconstructs only the durable receipt credit for %s',
    async (date) => {
      const a = arrange(date);
      const { request } = await a.authorize();
      expect(request).toMatchObject({
        companyId: a.input.companyId,
        actorId: a.input.actorId,
        origin: {
          type: 'PURCHASE_RECEIPT',
          id: a.input.receiptId,
          operation: 'RECEIVE_QUANTITY',
        },
        operation: {
          kind: 'CREDIT',
          credits: [
            {
              quantity: 2,
              target: {
                productId: a.productId,
                inventoryBatchId: null,
                ...(date ? { expirationDate: date } : {}),
              },
            },
          ],
        },
      });
      if (request.operation.kind !== 'CREDIT') throw new Error('fixture');
      expect(request.operation.credits[0].target.expirationDate).toBe(date);
      expect(a.tx.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: a.input.actorId,
          companyId: a.input.companyId,
          isActive: true,
        },
      });
    },
  );

  it.each(['committed', 'missing'] as const)(
    'rejects %s receipt evidence',
    async (kind) => {
      const a = arrange();
      a.tx.$queryRaw.mockResolvedValue(
        kind === 'missing'
          ? []
          : [{ purchaseId: a.dto.purchaseId, current: false }],
      );
      await expect(a.authorize()).rejects.toMatchObject({
        code: 'PHYSICAL_EFFECT_MISMATCH',
      });
      expect(a.tx.purchaseReceipt.findFirst).not.toHaveBeenCalled();
    },
  );

  it.each(['ADMIN', 'MANAGER', 'WAREHOUSE'])(
    'permits current authorized %s',
    async (role) => {
      const a = arrange();
      a.tx.user.findFirst.mockResolvedValue({ role });
      await expect(a.authorize()).resolves.toHaveProperty('request');
    },
  );

  it('preserves a real Batch without adding a second calendar identity', async () => {
    const a = arrange('2035-08-15');
    a.item.batchId = randomUUID();
    a.item.lotNumber = 'REAL';
    a.item.batch = {
      companyId: a.input.companyId,
      productId: a.productId,
      lotNumber: 'REAL',
      expirationDate: a.item.expirationDate,
    };
    a.claim.requestHash = createPurchaseReceiptRequestHash({
      ...a.dto,
      items: [{ ...a.dto.items[0], lotNumber: 'REAL' }],
    });
    const { request } = await a.authorize();
    if (request.operation.kind !== 'CREDIT') throw new Error('fixture');
    expect(request.operation.credits[0].target.inventoryBatchId).toBe(
      a.item.batchId,
    );
    expect(request.operation.credits[0].target).not.toHaveProperty(
      'expirationDate',
    );
  });

  it.each([
    'role',
    'tenant',
    'actor',
    'purchase',
    'quantity',
    'product',
    'cost',
    'hash',
    'claim',
    'audit',
    'batch',
    'document',
  ] as const)('rejects inconsistent %s', async (kind) => {
    const a = arrange();
    if (kind === 'role')
      a.tx.user.findFirst.mockResolvedValue({ role: 'SALES' });
    if (kind === 'tenant') a.tx.user.findFirst.mockResolvedValue(null);
    if (kind === 'actor') a.receipt.receivedBy = randomUUID();
    if (kind === 'purchase') a.receipt.purchase.status = 'DRAFT';
    if (kind === 'quantity') a.ordered.quantity = 1;
    if (kind === 'product') a.item.product.companyId = randomUUID();
    if (kind === 'cost') a.item.unitCost = 100;
    if (kind === 'hash') a.claim.requestHash = 'wrong';
    if (kind === 'claim') a.claim.resourceId = randomUUID();
    if (kind === 'audit') a.tx.inventoryMovement.count.mockResolvedValue(1);
    if (kind === 'batch') a.item.batchId = randomUUID();
    if (kind === 'document')
      Object.assign(a.receipt, { supplierDocumentType: 'FACTURA' });
    await expect(a.authorize()).rejects.toMatchObject({
      code: ['role', 'tenant'].includes(kind)
        ? 'INVENTORY_TENANT_MISMATCH'
        : 'PHYSICAL_EFFECT_MISMATCH',
    });
  });

  it('does not turn a caller-supplied origin into a receipt permit', async () => {
    const repository = { findEffect: jest.fn() };
    const physical = new PhysicalInventoryService(
      repository as unknown as PhysicalInventoryRepository,
    );
    const a = arrange();
    await expect(
      physical.creditAvailable(
        a.tx as unknown as Prisma.TransactionClient,
        {
          companyId: a.input.companyId,
          actorId: a.input.actorId,
          origin: {
            type: 'PURCHASE_RECEIPT',
            id: a.input.receiptId,
            operation: 'RECEIVE_QUANTITY',
          },
        },
        [
          {
            target: {
              productId: a.productId,
              inventoryBatchId: null,
              state: 'AVAILABLE',
              contextType: null,
              contextId: null,
              expirationDate: '2035-08-15',
            },
            quantity: 2,
          },
        ],
      ),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    expect(repository.findEffect).not.toHaveBeenCalled();
    expect(a.tx.$queryRaw).not.toHaveBeenCalled();
  });
});
