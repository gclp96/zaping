import { Test, TestingModule } from '@nestjs/testing';

import { EquipmentProvisioningService } from '../equipment/equipment-provisioning.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { PurchaseReceiptsService } from './purchases-receipts.service';
import { InventoryMovementType, PurchaseStatus } from '@prisma/client';

type TransactionClientMock = {
  purchase: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  product: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
  purchaseReceipt: {
    create: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  purchaseReceiptItem: {
    create: jest.Mock;
  };
  inventoryBatch: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  inventoryMovement: {
    create: jest.Mock;
  };
};

type PrismaServiceMock = {
  $transaction: jest.Mock;
  purchaseReceipt: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  purchase: {
    findFirst: jest.Mock;
  };
};

type EquipmentProvisioningServiceMock = {
  provisionFromPurchaseReceiptItem: jest.Mock;
};

type PurchaseReceiptCreateArgs = {
  data: {
    companyId: string;
    purchaseId: string;
    receivedBy?: string;
    notes?: string;
    folio: string;
    receivedAt: Date;
  };
};

type InventoryBatchCreateArgs = {
  data: {
    companyId: string;
    productId: string;
    lotNumber: string;
    expirationDate?: Date;
    initialQuantity: number;
    availableQuantity: number;
    unitCost: number;
    receivedAt: Date;
  };
};

type PurchaseReceiptItemCreateArgs = {
  data: {
    companyId: string;
    receiptId: string;
    purchaseItemId: string;
    productId: string;
    quantityReceived: number;
    lotNumber?: string;
    expirationDate?: Date;
    unitCost: number;
    batchId?: string;
  };
};

type InventoryMovementCreateArgs = {
  data: {
    companyId: string;
    productId: string;
    batchId?: string;
    movementType: InventoryMovementType;
    quantity: number;
    balance: number;
    referenceType: string;
    referenceId: string;
    notes?: string;
    createdBy?: string;
    unitCost: number;
  };
};

type InventoryBatchUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    initialQuantity: {
      increment: number;
    };
    availableQuantity: {
      increment: number;
    };
    unitCost: number;
    expirationDate?: Date;
    isActive: boolean;
  };
};

type ReceiptFindManyArgs = {
  where: {
    companyId: string;
    purchaseId?: string;
  };
  orderBy: {
    receivedAt: 'desc';
  };
};

type ReceiptFindFirstArgs = {
  where: {
    id: string;
    companyId: string;
  };
};

type PurchaseFindFirstArgs = {
  where: {
    id: string;
    companyId: string;
  };
  select: {
    id: true;
  };
};

describe('PurchaseReceiptsService', () => {
  let service: PurchaseReceiptsService;
  let prisma: PrismaServiceMock;
  let transactionClient: TransactionClientMock;
  let equipmentProvisioningService: EquipmentProvisioningServiceMock;

  beforeEach(async () => {
    transactionClient = {
      purchase: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      purchaseReceipt: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      purchaseReceiptItem: {
        create: jest.fn(),
      },
      inventoryBatch: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(
        (callback: (tx: TransactionClientMock) => Promise<unknown>) =>
          callback(transactionClient),
      ),
      purchaseReceipt: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      purchase: {
        findFirst: jest.fn(),
      },
    };

    equipmentProvisioningService = {
      provisionFromPurchaseReceiptItem: jest.fn().mockResolvedValue([]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReceiptsService,
        {
          provide: EquipmentProvisioningService,
          useValue: equipmentProvisioningService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = moduleRef.get<PurchaseReceiptsService>(PurchaseReceiptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('debe rechazar partidas duplicadas en la misma recepción', async () => {
    const duplicatedPurchaseItemId = '11111111-1111-4111-8111-111111111111';

    const dto: CreatePurchaseReceiptDto = {
      purchaseId: '22222222-2222-4222-8222-222222222222',
      items: [
        {
          purchaseItemId: duplicatedPurchaseItemId,
          quantityReceived: 2,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
        {
          purchaseItemId: duplicatedPurchaseItemId,
          quantityReceived: 3,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    const action = service.create(
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message:
        `La partida ${duplicatedPurchaseItemId} ` +
        'está repetida en la recepción',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('debe rechazar una compra inexistente de la empresa', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const dto: CreatePurchaseReceiptDto = {
      purchaseId: '22222222-2222-4222-8222-222222222222',
      items: [
        {
          purchaseItemId: '11111111-1111-4111-8111-111111111111',
          quantityReceived: 1,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    transactionClient.purchase.findFirst.mockResolvedValue(null);

    const action = service.create(
      companyId,
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message: 'Compra no encontrada',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(transactionClient.purchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: dto.purchaseId,
          companyId,
        },
      }),
    );
  });

  it.each([
    {
      status: PurchaseStatus.DRAFT,
      expectedMessage: 'La compra debe confirmarse antes de recibir mercancía',
    },
    {
      status: PurchaseStatus.RECEIVED,
      expectedMessage: 'La compra ya fue recibida completamente',
    },
    {
      status: PurchaseStatus.CANCELLED,
      expectedMessage: 'No se puede recibir una compra cancelada',
    },
  ])(
    'debe rechazar una compra con estado $status',
    async ({ status, expectedMessage }) => {
      const companyId = '33333333-3333-4333-8333-333333333333';

      const dto: CreatePurchaseReceiptDto = {
        purchaseId: '22222222-2222-4222-8222-222222222222',
        items: [
          {
            purchaseItemId: '11111111-1111-4111-8111-111111111111',
            quantityReceived: 1,
            lotNumber: 'LOTE-001',
            expirationDate: '2028-12-31',
          },
        ],
      };

      transactionClient.purchase.findFirst.mockResolvedValue({
        id: dto.purchaseId,
        companyId,
        status,
        items: [],
      });

      const action = service.create(
        companyId,
        '44444444-4444-4444-8444-444444444444',
        dto,
      );

      await expect(action).rejects.toMatchObject({
        message: expectedMessage,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    },
  );
  it('debe rechazar una cantidad mayor que la pendiente', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const purchaseItemId = '11111111-1111-4111-8111-111111111111';

    const productId = '55555555-5555-4555-8555-555555555555';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: purchaseItemId,
          productId,
          quantity: 10,
          price: 1347,
          receiptItems: [
            {
              quantityReceived: 8,
            },
          ],
        },
      ],
    });

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      items: [
        {
          purchaseItemId,
          quantityReceived: 3,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    const action = service.create(
      companyId,
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message:
        `La cantidad recibida de la partida ${purchaseItemId} ` +
        'supera la cantidad pendiente (2)',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar una fecha de caducidad sin número de lote', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const purchaseItemId = '11111111-1111-4111-8111-111111111111';

    const productId = '55555555-5555-4555-8555-555555555555';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: purchaseItemId,
          productId,
          quantity: 10,
          price: 1347,
          receiptItems: [],
        },
      ],
    });

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      items: [
        {
          purchaseItemId,
          quantityReceived: 2,
          expirationDate: '2028-12-31',
        },
      ],
    };

    const action = service.create(
      companyId,
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message:
        'No se puede registrar una fecha de caducidad sin número de lote',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar una fecha de caducidad anterior a la recepción', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const purchaseItemId = '11111111-1111-4111-8111-111111111111';

    const productId = '55555555-5555-4555-8555-555555555555';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: purchaseItemId,
          productId,
          quantity: 10,
          price: 1347,
          receiptItems: [],
        },
      ],
    });

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      items: [
        {
          purchaseItemId,
          quantityReceived: 2,
          lotNumber: 'LOTE-CADUCADO-001',
          expirationDate: '2020-01-01',
        },
      ],
    };

    const action = service.create(
      companyId,
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message:
        'La fecha de caducidad no puede ser anterior a la fecha de recepción',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar una partida que no pertenece a la compra', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const existingPurchaseItemId = '11111111-1111-4111-8111-111111111111';

    const requestedPurchaseItemId = '99999999-9999-4999-8999-999999999999';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: existingPurchaseItemId,
          productId: '55555555-5555-4555-8555-555555555555',
          quantity: 10,
          price: 1347,
          receiptItems: [],
        },
      ],
    });

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      items: [
        {
          purchaseItemId: requestedPurchaseItemId,
          quantityReceived: 2,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    const action = service.create(
      companyId,
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message:
        `La partida ${requestedPurchaseItemId} ` + 'no pertenece a la compra',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('debe registrar correctamente una recepción parcial', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const userId = '44444444-4444-4444-8444-444444444444';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const purchaseItemId = '11111111-1111-4111-8111-111111111111';

    const productId = '55555555-5555-4555-8555-555555555555';

    const receiptId = '66666666-6666-4666-8666-666666666666';

    const batchId = '77777777-7777-4777-8777-777777777777';

    const createdReceiptItemId = '88888888-8888-4888-8888-888888888888';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: purchaseItemId,
          productId,
          quantity: 10,
          price: 1347,
          receiptItems: [],
        },
      ],
    });

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: productId,
      },
    ]);

    transactionClient.purchaseReceipt.create.mockResolvedValue({
      id: receiptId,
      folio: 'REC-PRUEBA-001',
    });

    transactionClient.inventoryBatch.findUnique.mockResolvedValue(null);

    transactionClient.inventoryBatch.create.mockResolvedValue({
      id: batchId,
      companyId,
      productId,
      lotNumber: 'LOTE-001',
      initialQuantity: 4,
      availableQuantity: 4,
    });

    transactionClient.purchaseReceiptItem.create.mockResolvedValue({
      id: createdReceiptItemId,
    });

    transactionClient.product.update.mockResolvedValue({
      stock: 24,
    });

    transactionClient.inventoryMovement.create.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
    });

    transactionClient.purchase.update.mockResolvedValue({
      id: purchaseId,
      status: PurchaseStatus.PARTIALLY_RECEIVED,
    });

    const expectedResult = {
      id: receiptId,
      purchase: {
        id: purchaseId,
        status: PurchaseStatus.PARTIALLY_RECEIVED,
      },
    };

    transactionClient.purchaseReceipt.findUniqueOrThrow.mockResolvedValue(
      expectedResult,
    );

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      notes: 'Recepción parcial de prueba',
      items: [
        {
          purchaseItemId,
          quantityReceived: 4,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    const result = await service.create(companyId, userId, dto);

    expect(result).toEqual(expectedResult);

    expect(transactionClient.purchaseReceipt.create).toHaveBeenCalledTimes(1);

    const [purchaseReceiptCreateArgs] = transactionClient.purchaseReceipt.create
      .mock.calls[0] as [PurchaseReceiptCreateArgs];

    expect(purchaseReceiptCreateArgs.data.companyId).toBe(companyId);
    expect(purchaseReceiptCreateArgs.data.purchaseId).toBe(purchaseId);
    expect(purchaseReceiptCreateArgs.data.receivedBy).toBe(userId);
    expect(purchaseReceiptCreateArgs.data.notes).toBe(dto.notes);
    expect(typeof purchaseReceiptCreateArgs.data.folio).toBe('string');
    expect(purchaseReceiptCreateArgs.data.receivedAt).toBeInstanceOf(Date);

    expect(transactionClient.inventoryBatch.create).toHaveBeenCalledTimes(1);

    expect(transactionClient.inventoryBatch.update).not.toHaveBeenCalled();

    const [inventoryBatchCreateArgs] = transactionClient.inventoryBatch.create
      .mock.calls[0] as [InventoryBatchCreateArgs];

    expect(inventoryBatchCreateArgs.data.companyId).toBe(companyId);
    expect(inventoryBatchCreateArgs.data.productId).toBe(productId);
    expect(inventoryBatchCreateArgs.data.lotNumber).toBe('LOTE-001');
    expect(inventoryBatchCreateArgs.data.initialQuantity).toBe(4);
    expect(inventoryBatchCreateArgs.data.availableQuantity).toBe(4);
    expect(inventoryBatchCreateArgs.data.unitCost).toBe(1347);
    expect(inventoryBatchCreateArgs.data.expirationDate).toEqual(
      new Date('2028-12-31T00:00:00.000Z'),
    );
    expect(inventoryBatchCreateArgs.data.receivedAt).toBeInstanceOf(Date);

    const [purchaseReceiptItemCreateArgs] = transactionClient
      .purchaseReceiptItem.create.mock.calls[0] as [
      PurchaseReceiptItemCreateArgs,
    ];

    expect(purchaseReceiptItemCreateArgs.data.companyId).toBe(companyId);
    expect(purchaseReceiptItemCreateArgs.data.receiptId).toBe(receiptId);
    expect(purchaseReceiptItemCreateArgs.data.purchaseItemId).toBe(
      purchaseItemId,
    );
    expect(purchaseReceiptItemCreateArgs.data.productId).toBe(productId);
    expect(purchaseReceiptItemCreateArgs.data.quantityReceived).toBe(4);
    expect(purchaseReceiptItemCreateArgs.data.unitCost).toBe(1347);
    expect(purchaseReceiptItemCreateArgs.data.batchId).toBe(batchId);

    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenCalledTimes(1);
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenCalledWith(transactionClient, companyId, createdReceiptItemId);
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      transactionClient.product.update.mock.invocationCallOrder[0],
    );

    expect(transactionClient.product.update).toHaveBeenCalledWith({
      where: {
        id: productId,
      },
      data: {
        stock: {
          increment: 4,
        },
      },
      select: {
        stock: true,
      },
    });

    expect(transactionClient.inventoryMovement.create).toHaveBeenCalledTimes(1);

    const [inventoryMovementCreateArgs] = transactionClient.inventoryMovement
      .create.mock.calls[0] as [InventoryMovementCreateArgs];

    expect(inventoryMovementCreateArgs.data.companyId).toBe(companyId);
    expect(inventoryMovementCreateArgs.data.productId).toBe(productId);
    expect(inventoryMovementCreateArgs.data.batchId).toBe(batchId);
    expect(inventoryMovementCreateArgs.data.movementType).toBe(
      InventoryMovementType.IN,
    );
    expect(inventoryMovementCreateArgs.data.quantity).toBe(4);
    expect(inventoryMovementCreateArgs.data.balance).toBe(24);
    expect(inventoryMovementCreateArgs.data.referenceType).toBe(
      'PURCHASE_RECEIPT',
    );
    expect(inventoryMovementCreateArgs.data.referenceId).toBe(receiptId);
    expect(inventoryMovementCreateArgs.data.createdBy).toBe(userId);
    expect(inventoryMovementCreateArgs.data.unitCost).toBe(1347);

    expect(transactionClient.purchase.update).toHaveBeenCalledWith({
      where: {
        id: purchaseId,
      },
      data: {
        status: PurchaseStatus.PARTIALLY_RECEIVED,
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('debe invocar provisioning una vez por cada PurchaseReceiptItem creado', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const userId = '44444444-4444-4444-8444-444444444444';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const firstPurchaseItemId = '11111111-1111-4111-8111-111111111111';

    const secondPurchaseItemId = '12121212-1212-4121-8121-121212121212';

    const firstProductId = '55555555-5555-4555-8555-555555555555';

    const secondProductId = '56565656-5656-4565-8565-565656565656';

    const receiptId = '66666666-6666-4666-8666-666666666666';

    const firstReceiptItemId = '88888888-8888-4888-8888-888888888888';

    const secondReceiptItemId = '89898989-8989-4898-8898-898989898989';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: firstPurchaseItemId,
          productId: firstProductId,
          quantity: 5,
          price: 100,
          receiptItems: [],
        },
        {
          id: secondPurchaseItemId,
          productId: secondProductId,
          quantity: 7,
          price: 200,
          receiptItems: [],
        },
      ],
    });

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: firstProductId,
      },
      {
        id: secondProductId,
      },
    ]);

    transactionClient.purchaseReceipt.create.mockResolvedValue({
      id: receiptId,
      folio: 'REC-PRUEBA-001',
    });

    transactionClient.purchaseReceiptItem.create
      .mockResolvedValueOnce({
        id: firstReceiptItemId,
      })
      .mockResolvedValueOnce({
        id: secondReceiptItemId,
      });

    transactionClient.product.update
      .mockResolvedValueOnce({
        stock: 12,
      })
      .mockResolvedValueOnce({
        stock: 18,
      });

    transactionClient.inventoryMovement.create.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
    });

    transactionClient.purchase.update.mockResolvedValue({
      id: purchaseId,
      status: PurchaseStatus.PARTIALLY_RECEIVED,
    });

    const expectedResult = {
      id: receiptId,
    };

    transactionClient.purchaseReceipt.findUniqueOrThrow.mockResolvedValue(
      expectedResult,
    );

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 2,
        },
        {
          purchaseItemId: secondPurchaseItemId,
          quantityReceived: 3,
        },
      ],
    };

    const result = await service.create(companyId, userId, dto);

    expect(result).toEqual(expectedResult);
    expect(transactionClient.purchaseReceiptItem.create).toHaveBeenCalledTimes(
      2,
    );
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenCalledTimes(2);
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenNthCalledWith(
      1,
      transactionClient,
      companyId,
      firstReceiptItemId,
    );
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenNthCalledWith(
      2,
      transactionClient,
      companyId,
      secondReceiptItemId,
    );
    expect(transactionClient.product.update).toHaveBeenCalledTimes(2);
    expect(transactionClient.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });

  it.each(['QUANTITY', 'SERIALIZED'])(
    'debe conservar el flujo existente cuando provisioning devuelve [] para %s',
    async () => {
      const companyId = '33333333-3333-4333-8333-333333333333';

      const userId = '44444444-4444-4444-8444-444444444444';

      const purchaseId = '22222222-2222-4222-8222-222222222222';

      const purchaseItemId = '11111111-1111-4111-8111-111111111111';

      const productId = '55555555-5555-4555-8555-555555555555';

      const receiptId = '66666666-6666-4666-8666-666666666666';

      const createdReceiptItemId = '88888888-8888-4888-8888-888888888888';

      equipmentProvisioningService.provisionFromPurchaseReceiptItem.mockResolvedValue(
        [],
      );

      transactionClient.purchase.findFirst.mockResolvedValue({
        id: purchaseId,
        companyId,
        folio: 'OC-PRUEBA-001',
        status: PurchaseStatus.CONFIRMED,
        items: [
          {
            id: purchaseItemId,
            productId,
            quantity: 10,
            price: 1347,
            receiptItems: [],
          },
        ],
      });

      transactionClient.product.findMany.mockResolvedValue([
        {
          id: productId,
        },
      ]);

      transactionClient.purchaseReceipt.create.mockResolvedValue({
        id: receiptId,
        folio: 'REC-PRUEBA-001',
      });

      transactionClient.purchaseReceiptItem.create.mockResolvedValue({
        id: createdReceiptItemId,
      });

      transactionClient.product.update.mockResolvedValue({
        stock: 24,
      });

      transactionClient.inventoryMovement.create.mockResolvedValue({
        id: '99999999-9999-4999-8999-999999999999',
      });

      transactionClient.purchase.update.mockResolvedValue({
        id: purchaseId,
        status: PurchaseStatus.PARTIALLY_RECEIVED,
      });

      const expectedResult = {
        id: receiptId,
      };

      transactionClient.purchaseReceipt.findUniqueOrThrow.mockResolvedValue(
        expectedResult,
      );

      const dto: CreatePurchaseReceiptDto = {
        purchaseId,
        items: [
          {
            purchaseItemId,
            quantityReceived: 4,
          },
        ],
      };

      const result = await service.create(companyId, userId, dto);

      expect(result).toEqual(expectedResult);
      expect(
        equipmentProvisioningService.provisionFromPurchaseReceiptItem,
      ).toHaveBeenCalledWith(
        transactionClient,
        companyId,
        createdReceiptItemId,
      );
      expect(transactionClient.product.update).toHaveBeenCalledTimes(1);
      expect(transactionClient.product.update).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
        data: {
          stock: {
            increment: 4,
          },
        },
        select: {
          stock: true,
        },
      });
      expect(transactionClient.inventoryMovement.create).toHaveBeenCalledTimes(
        1,
      );
    },
  );

  it('debe propagar errores de provisioning y detener operaciones posteriores', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const userId = '44444444-4444-4444-8444-444444444444';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const purchaseItemId = '11111111-1111-4111-8111-111111111111';

    const productId = '55555555-5555-4555-8555-555555555555';

    const receiptId = '66666666-6666-4666-8666-666666666666';

    const createdReceiptItemId = '88888888-8888-4888-8888-888888888888';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.CONFIRMED,
      items: [
        {
          id: purchaseItemId,
          productId,
          quantity: 10,
          price: 1347,
          receiptItems: [],
        },
      ],
    });

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: productId,
      },
    ]);

    transactionClient.purchaseReceipt.create.mockResolvedValue({
      id: receiptId,
      folio: 'REC-PRUEBA-001',
    });

    transactionClient.purchaseReceiptItem.create.mockResolvedValue({
      id: createdReceiptItemId,
    });

    equipmentProvisioningService.provisionFromPurchaseReceiptItem.mockRejectedValue(
      new Error('provisioning failed'),
    );

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      items: [
        {
          purchaseItemId,
          quantityReceived: 4,
        },
      ],
    };

    await expect(service.create(companyId, userId, dto)).rejects.toThrow(
      'provisioning failed',
    );

    expect(transactionClient.purchaseReceiptItem.create).toHaveBeenCalledTimes(
      1,
    );
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenCalledWith(transactionClient, companyId, createdReceiptItemId);
    expect(transactionClient.product.update).not.toHaveBeenCalled();
    expect(transactionClient.inventoryMovement.create).not.toHaveBeenCalled();
    expect(transactionClient.purchase.update).not.toHaveBeenCalled();
    expect(
      transactionClient.purchaseReceipt.findUniqueOrThrow,
    ).not.toHaveBeenCalled();
  });

  it('debe completar la compra actualizando un lote existente', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const userId = '44444444-4444-4444-8444-444444444444';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    const purchaseItemId = '11111111-1111-4111-8111-111111111111';

    const productId = '55555555-5555-4555-8555-555555555555';

    const receiptId = '66666666-6666-4666-8666-666666666666';

    const batchId = '77777777-7777-4777-8777-777777777777';

    const expirationDate = new Date('2028-12-31T00:00:00.000Z');

    const createdReceiptItemId = '88888888-8888-4888-8888-888888888888';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
      companyId,
      folio: 'OC-PRUEBA-001',
      status: PurchaseStatus.PARTIALLY_RECEIVED,
      items: [
        {
          id: purchaseItemId,
          productId,
          quantity: 10,
          price: 1347,
          receiptItems: [
            {
              quantityReceived: 4,
            },
          ],
        },
      ],
    });

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: productId,
      },
    ]);

    transactionClient.purchaseReceipt.create.mockResolvedValue({
      id: receiptId,
      folio: 'REC-PRUEBA-002',
    });

    transactionClient.inventoryBatch.findUnique.mockResolvedValue({
      id: batchId,
      companyId,
      productId,
      lotNumber: 'LOTE-001',
      expirationDate,
      initialQuantity: 4,
      availableQuantity: 4,
      unitCost: 1200,
      isActive: true,
    });

    transactionClient.inventoryBatch.update.mockResolvedValue({
      id: batchId,
      initialQuantity: 10,
      availableQuantity: 10,
      unitCost: 1288.2,
    });

    transactionClient.purchaseReceiptItem.create.mockResolvedValue({
      id: createdReceiptItemId,
    });

    transactionClient.product.update.mockResolvedValue({
      stock: 30,
    });

    transactionClient.inventoryMovement.create.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
    });

    transactionClient.purchase.update.mockResolvedValue({
      id: purchaseId,
      status: PurchaseStatus.RECEIVED,
    });

    const expectedResult = {
      id: receiptId,
      purchase: {
        id: purchaseId,
        status: PurchaseStatus.RECEIVED,
      },
    };

    transactionClient.purchaseReceipt.findUniqueOrThrow.mockResolvedValue(
      expectedResult,
    );

    const dto: CreatePurchaseReceiptDto = {
      purchaseId,
      notes: 'Recepción final de prueba',
      items: [
        {
          purchaseItemId,
          quantityReceived: 6,
          lotNumber: 'LOTE-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    const result = await service.create(companyId, userId, dto);

    expect(result).toEqual(expectedResult);

    expect(transactionClient.inventoryBatch.create).not.toHaveBeenCalled();

    expect(transactionClient.inventoryBatch.update).toHaveBeenCalledTimes(1);

    const [inventoryBatchUpdateArgs] = transactionClient.inventoryBatch.update
      .mock.calls[0] as [InventoryBatchUpdateArgs];

    expect(inventoryBatchUpdateArgs.where.id).toBe(batchId);

    expect(inventoryBatchUpdateArgs.data.initialQuantity.increment).toBe(6);

    expect(inventoryBatchUpdateArgs.data.availableQuantity.increment).toBe(6);

    expect(inventoryBatchUpdateArgs.data.unitCost).toBeCloseTo(1288.2);

    expect(inventoryBatchUpdateArgs.data.expirationDate).toEqual(
      expirationDate,
    );

    expect(inventoryBatchUpdateArgs.data.isActive).toBe(true);

    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenCalledTimes(1);
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).toHaveBeenCalledWith(transactionClient, companyId, createdReceiptItemId);

    expect(transactionClient.product.update).toHaveBeenCalledWith({
      where: {
        id: productId,
      },
      data: {
        stock: {
          increment: 6,
        },
      },
      select: {
        stock: true,
      },
    });

    expect(transactionClient.purchase.update).toHaveBeenCalledWith({
      where: {
        id: purchaseId,
      },
      data: {
        status: PurchaseStatus.RECEIVED,
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('debe listar solamente las recepciones de la empresa', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const expectedResult = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        companyId,
        folio: 'REC-PRUEBA-001',
      },
    ];

    prisma.purchaseReceipt.findMany.mockResolvedValue(expectedResult);

    const result = await service.findAll(companyId);

    expect(result).toEqual(expectedResult);
    expect(prisma.purchaseReceipt.findMany).toHaveBeenCalledTimes(1);

    const [findManyArgs] = prisma.purchaseReceipt.findMany.mock.calls[0] as [
      ReceiptFindManyArgs,
    ];

    expect(findManyArgs.where.companyId).toBe(companyId);
    expect(findManyArgs.orderBy.receivedAt).toBe('desc');
  });

  it('debe consultar una recepción por id y empresa', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const receiptId = '11111111-1111-4111-8111-111111111111';

    const expectedResult = {
      id: receiptId,
      companyId,
      folio: 'REC-PRUEBA-001',
    };

    prisma.purchaseReceipt.findFirst.mockResolvedValue(expectedResult);

    const result = await service.findOne(companyId, receiptId);

    expect(result).toEqual(expectedResult);

    const [findFirstArgs] = prisma.purchaseReceipt.findFirst.mock.calls[0] as [
      ReceiptFindFirstArgs,
    ];

    expect(findFirstArgs.where).toEqual({
      id: receiptId,
      companyId,
    });
  });

  it('debe rechazar una recepción inexistente', async () => {
    prisma.purchaseReceipt.findFirst.mockResolvedValue(null);

    const action = service.findOne(
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
    );

    await expect(action).rejects.toMatchObject({
      message: 'Recepción no encontrada',
    });
  });

  it('debe rechazar el historial de una compra inexistente', async () => {
    prisma.purchase.findFirst.mockResolvedValue(null);

    const action = service.findByPurchase(
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
    );

    await expect(action).rejects.toMatchObject({
      message: 'Compra no encontrada',
    });

    expect(prisma.purchaseReceipt.findMany).not.toHaveBeenCalled();
  });

  it('debe listar las recepciones asociadas a una compra', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';

    const purchaseId = '22222222-2222-4222-8222-222222222222';

    prisma.purchase.findFirst.mockResolvedValue({
      id: purchaseId,
    });

    const expectedResult = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        companyId,
        purchaseId,
        folio: 'REC-PRUEBA-001',
      },
    ];

    prisma.purchaseReceipt.findMany.mockResolvedValue(expectedResult);

    const result = await service.findByPurchase(companyId, purchaseId);

    expect(result).toEqual(expectedResult);

    const [purchaseFindArgs] = prisma.purchase.findFirst.mock.calls[0] as [
      PurchaseFindFirstArgs,
    ];

    expect(purchaseFindArgs.where).toEqual({
      id: purchaseId,
      companyId,
    });

    expect(purchaseFindArgs.select).toEqual({
      id: true,
    });

    const [receiptFindManyArgs] = prisma.purchaseReceipt.findMany.mock
      .calls[0] as [ReceiptFindManyArgs];

    expect(receiptFindManyArgs.where).toEqual({
      companyId,
      purchaseId,
    });

    expect(receiptFindManyArgs.orderBy.receivedAt).toBe('desc');
  });
});
