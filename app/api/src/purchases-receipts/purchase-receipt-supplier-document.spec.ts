import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReceiptPhysicalIntegrationService } from '../inventory/physical/receipt-physical-integration.service';
import { PurchaseReceiptsService } from './purchases-receipts.service';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { createPurchaseReceiptRequestHash } from './purchase-receipt-request-hash';

describe('supplier documents across the PHYSICAL receipt boundary', () => {
  const companyId = 'company';
  const actorId = 'actor';
  const key = 'receipt-key';
  const dto: CreatePurchaseReceiptDto = {
    purchaseId: 'purchase',
    items: [{ purchaseItemId: 'item', quantityReceived: 2 }],
  };

  function arrange() {
    const receipt = { id: 'receipt' };
    const tx = {
      $queryRaw: jest.fn(),
      user: { findFirst: jest.fn().mockResolvedValue({ role: 'WAREHOUSE' }) },
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'claim' }),
        update: jest.fn(),
      },
      purchase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'purchase',
          status: 'CONFIRMED',
          items: [
            {
              id: 'item',
              productId: 'product',
              quantity: 5,
              price: 10,
              receiptItems: [],
              product: { companyId, inventoryTracking: 'QUANTITY' },
            },
          ],
        }),
        update: jest.fn(),
      },
      purchaseReceipt: {
        create: jest.fn().mockResolvedValue(receipt),
        findFirst: jest.fn().mockResolvedValue(receipt),
        findFirstOrThrow: jest.fn().mockResolvedValue(receipt),
      },
      purchaseReceiptItem: {
        create: jest
          .fn<
            Promise<
              Prisma.PurchaseReceiptItemUncheckedCreateInput & { id: string }
            >,
            [{ data: Prisma.PurchaseReceiptItemUncheckedCreateInput }]
          >()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'receipt-item', ...data }),
          ),
      },
    };
    const repository = {
      lockProducts: jest
        .fn()
        .mockResolvedValue([
          { id: 'product', inventoryTracking: 'QUANTITY', lotTracking: 'NONE' },
        ]),
      lockBatches: jest.fn(),
    };
    const physical = {
      creditPurchaseReceipt: jest.fn().mockResolvedValue({ replay: false }),
    };
    const projections = { apply: jest.fn() };
    const history = { write: jest.fn() };
    type PhysicalDependencies = ConstructorParameters<
      typeof ReceiptPhysicalIntegrationService
    >;
    const integration = new ReceiptPhysicalIntegrationService(
      repository as unknown as PhysicalDependencies[0],
      physical as unknown as PhysicalDependencies[1],
      projections as unknown as PhysicalDependencies[2],
      history as unknown as PhysicalDependencies[3],
      {} as PhysicalDependencies[4],
    );
    const transaction = tx as unknown as Prisma.TransactionClient;
    const run = jest.fn(
      (
        _company: string,
        callback: (
          tx: Prisma.TransactionClient,
          authority: 'PHYSICAL',
        ) => Promise<unknown>,
      ) => callback(transaction, 'PHYSICAL'),
    );
    type Dependencies = ConstructorParameters<typeof PurchaseReceiptsService>;
    const service = new PurchaseReceiptsService(
      {} as Dependencies[0],
      {} as Dependencies[1],
      { run } as unknown as Dependencies[2],
      integration,
    );
    return {
      tx,
      run,
      service,
      integration,
      transaction,
      physical,
      projections,
      history,
      receipt,
    };
  }

  it.each(['FACTURA', 'REMISION', 'NOTA_ENTREGA'] as const)(
    'persists %s through the real integration with one inventory credit',
    async (type) => {
      const { service, tx, physical } = arrange();
      const input = {
        ...dto,
        supplierDocumentType: type,
        supplierDocumentNumber: '  DOC-42  ',
      };
      await service.create(companyId, actorId, key, input);
      expect(tx.purchaseReceipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          supplierDocumentType: type,
          supplierDocumentNumber: 'DOC-42',
        }) as unknown,
      });
      expect(tx.idempotencyRecord.create).toHaveBeenCalledWith({
        data: {
          companyId,
          scope: 'PURCHASE_RECEIPT_CREATE',
          key,
          requestHash: createPurchaseReceiptRequestHash(input),
        },
      });
      expect(tx.purchaseReceiptItem.create).toHaveBeenCalledTimes(1);
      expect(physical.creditPurchaseReceipt).toHaveBeenCalledTimes(1);
      expect(input.supplierDocumentNumber).toBe('  DOC-42  ');
    },
  );

  it('preserves receipts without a supplier document', async () => {
    const { service, tx } = arrange();
    await service.create(companyId, actorId, key, dto);
    expect(tx.purchaseReceipt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supplierDocumentType: undefined,
        supplierDocumentNumber: undefined,
      }) as unknown,
    });
  });

  it.each([
    { supplierDocumentType: 'FACTURA' as const },
    {
      supplierDocumentType: 'REMISION' as const,
      supplierDocumentNumber: '   ',
    },
    { supplierDocumentNumber: 'DOC-42' },
  ])(
    'rejects an incomplete pair before entering the transaction: %j',
    async (document) => {
      const { service, run, tx } = arrange();
      await expect(
        service.create(companyId, actorId, key, { ...dto, ...document }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(run).not.toHaveBeenCalled();
      expect(tx.idempotencyRecord.create).not.toHaveBeenCalled();
    },
  );

  it.each(['boundary', 'integration'] as const)(
    'replays the normalized document without writes at %s',
    async (entry) => {
      const {
        service,
        integration,
        transaction,
        tx,
        physical,
        projections,
        history,
        receipt,
      } = arrange();
      const original = {
        ...dto,
        supplierDocumentType: 'FACTURA' as const,
        supplierDocumentNumber: 'DOC-42',
      };
      tx.idempotencyRecord.findUnique.mockResolvedValue({
        requestHash: createPurchaseReceiptRequestHash(original),
        resourceId: receipt.id,
      });
      const input = { ...original, supplierDocumentNumber: '  DOC-42  ' };
      await expect(
        entry === 'boundary'
          ? service.create(companyId, actorId, key, input)
          : integration.execute(transaction, companyId, actorId, key, input),
      ).resolves.toEqual(receipt);
      expect(tx.idempotencyRecord.create).not.toHaveBeenCalled();
      expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
      expect(tx.purchaseReceipt.create).not.toHaveBeenCalled();
      expect(tx.purchaseReceiptItem.create).not.toHaveBeenCalled();
      expect(tx.purchase.update).not.toHaveBeenCalled();
      expect(physical.creditPurchaseReceipt).not.toHaveBeenCalled();
      expect(projections.apply).not.toHaveBeenCalled();
      expect(history.write).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      supplierDocumentType: 'REMISION' as const,
      supplierDocumentNumber: 'DOC-42',
    },
    {
      supplierDocumentType: 'FACTURA' as const,
      supplierDocumentNumber: 'DOC-43',
    },
  ])('rejects a different document for the same key: %j', async (document) => {
    const { service, tx, physical } = arrange();
    tx.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: createPurchaseReceiptRequestHash({
        ...dto,
        supplierDocumentType: 'FACTURA',
        supplierDocumentNumber: 'DOC-42',
      }),
      resourceId: 'receipt',
    });
    await expect(
      service.create(companyId, actorId, key, { ...dto, ...document }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.idempotencyRecord.create).not.toHaveBeenCalled();
    expect(tx.purchaseReceipt.create).not.toHaveBeenCalled();
    expect(physical.creditPurchaseReceipt).not.toHaveBeenCalled();
  });
});
