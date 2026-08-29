import { PrismaService } from '../prisma/prisma.service';

import { PurchasesService } from './purchases.service';

function createPurchase(
  id: string,
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
  }>,
  status = 'CONFIRMED',
) {
  return {
    id,
    companyId: 'company-1',
    folio: `OC-${id}`,
    supplier: {
      id: `supplier-${id}`,
      name: 'Proveedor de prueba',
    },
    subtotal: 0,
    iva: 0,
    total: 0,
    status,
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    updatedAt: new Date('2026-08-29T00:00:00.000Z'),
    items: items.map((item) => ({
      ...item,
      price: 10,
      subtotal: item.quantity * 10,
      product: {
        id: item.productId,
        sku: `SKU-${item.productId}`,
        name: `Producto ${item.productId}`,
      },
    })),
  };
}

describe('PurchasesService — receipt progress', () => {
  let service: PurchasesService;
  let prismaMock: {
    purchase: {
      findMany: jest.Mock;
    };
    purchaseReceiptItem: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      purchase: {
        findMany: jest.fn(),
      },
      purchaseReceiptItem: {
        findMany: jest.fn(),
      },
    };

    service = new PurchasesService(prismaMock as unknown as PrismaService);
  });

  it('returns zero progress for a purchase without receipts', async () => {
    const purchase = createPurchase('no-receipts', [
      { id: 'item-1', productId: 'product-1', quantity: 5 },
      { id: 'item-2', productId: 'product-2', quantity: 2 },
    ]);
    prismaMock.purchase.findMany.mockResolvedValue([purchase]);
    prismaMock.purchaseReceiptItem.findMany.mockResolvedValue([]);

    const result = await service.findAll('company-1');

    expect(result[0].receiptProgress).toEqual({
      orderedUnits: 7,
      receivedUnits: 0,
      pendingUnits: 7,
      orderedLines: 2,
      completedLines: 0,
    });
  });

  it('returns zero progress without querying receipt items for an empty purchase', async () => {
    prismaMock.purchase.findMany.mockResolvedValue([
      createPurchase('empty', []),
    ]);

    const result = await service.findAll('company-1');

    expect(result[0].receiptProgress).toEqual({
      orderedUnits: 0,
      receivedUnits: 0,
      pendingUnits: 0,
      orderedLines: 0,
      completedLines: 0,
    });
    expect(prismaMock.purchaseReceiptItem.findMany).not.toHaveBeenCalled();
  });

  it('aggregates multiple receipts by purchaseItemId across multiple lines', async () => {
    const firstPurchase = createPurchase('first', [
      { id: 'item-a', productId: 'product-1', quantity: 10 },
      { id: 'item-b', productId: 'product-1', quantity: 5 },
      { id: 'item-c', productId: 'product-2', quantity: 2 },
    ]);
    const secondPurchase = createPurchase('second', [
      { id: 'item-d', productId: 'product-3', quantity: 4 },
    ]);
    prismaMock.purchase.findMany.mockResolvedValue([
      firstPurchase,
      secondPurchase,
    ]);
    prismaMock.purchaseReceiptItem.findMany.mockResolvedValue([
      { purchaseItemId: 'item-a', quantityReceived: 3 },
      { purchaseItemId: 'item-a', quantityReceived: 2 },
      { purchaseItemId: 'item-b', quantityReceived: 5 },
      { purchaseItemId: 'item-c', quantityReceived: 1 },
    ]);

    const result = await service.findAll('company-1');

    expect(result.map((purchase) => purchase.id)).toEqual(['first', 'second']);
    expect(result[0].receiptProgress).toEqual({
      orderedUnits: 17,
      receivedUnits: 11,
      pendingUnits: 6,
      orderedLines: 3,
      completedLines: 1,
    });
    expect(result[1].receiptProgress).toEqual({
      orderedUnits: 4,
      receivedUnits: 0,
      pendingUnits: 4,
      orderedLines: 1,
      completedLines: 0,
    });
    expect(prismaMock.purchaseReceiptItem.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.purchaseReceiptItem.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        purchaseItemId: {
          in: ['item-a', 'item-b', 'item-c', 'item-d'],
        },
      },
      select: {
        purchaseItemId: true,
        quantityReceived: true,
      },
    });
  });

  it('reports fully received lines and never emits negative quantities', async () => {
    const purchase = createPurchase(
      'complete',
      [
        { id: 'item-complete', productId: 'product-1', quantity: 3 },
        { id: 'item-empty', productId: 'product-2', quantity: 0 },
      ],
      'RECEIVED',
    );
    prismaMock.purchase.findMany.mockResolvedValue([purchase]);
    prismaMock.purchaseReceiptItem.findMany.mockResolvedValue([
      { purchaseItemId: 'item-complete', quantityReceived: 3 },
      { purchaseItemId: 'item-empty', quantityReceived: -2 },
    ]);

    const result = await service.findAll('company-1');

    expect(result[0].status).toBe('RECEIVED');
    expect(result[0].receiptProgress).toEqual({
      orderedUnits: 3,
      receivedUnits: 3,
      pendingUnits: 0,
      orderedLines: 2,
      completedLines: 2,
    });
    expect(
      Object.values(result[0].receiptProgress).every((value) => value >= 0),
    ).toBe(true);
  });

  it('scopes receipt aggregation to the requesting company', async () => {
    const purchase = createPurchase('tenant-a', [
      { id: 'item-tenant-a', productId: 'product-1', quantity: 5 },
    ]);
    prismaMock.purchase.findMany.mockResolvedValue([purchase]);
    prismaMock.purchaseReceiptItem.findMany.mockImplementation(
      (args: {
        where: {
          companyId: string;
          purchaseItemId: { in: string[] };
        };
      }) => {
        expect(args.where.companyId).toBe('company-a');

        return args.where.companyId === 'company-a'
          ? [
              {
                purchaseItemId: 'item-tenant-a',
                quantityReceived: 2,
              },
            ]
          : [
              {
                purchaseItemId: 'item-tenant-a',
                quantityReceived: 99,
              },
            ];
      },
    );

    const result = await service.findAll('company-a');

    expect(result[0].receiptProgress.receivedUnits).toBe(2);
    expect(prismaMock.purchaseReceiptItem.findMany).toHaveBeenCalledTimes(1);
  });
});
