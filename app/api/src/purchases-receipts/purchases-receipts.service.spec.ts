import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EquipmentProvisioningService } from '../equipment/equipment-provisioning.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { createPurchaseReceiptRequestHash } from './purchase-receipt-request-hash';
import { PurchaseReceiptsService } from './purchases-receipts.service';
import {
  IdempotencyScope,
  InventoryMovementType,
  Prisma,
  ProductLotTracking,
  PurchaseStatus,
} from '@prisma/client';

type LotTrackingReceiptItemFixture = {
  purchaseItemId: string;
  productId: string;
  sku: string;
  lotTracking: ProductLotTracking;
  quantityReceived?: number;
  lotNumber?: string | null;
  expirationDate?: string | null;
};

type TransactionClientMock = {
  idempotencyRecord: {
    create: jest.Mock;
    update: jest.Mock;
  };
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
    create: jest.Mock<Promise<unknown>, [InventoryBatchCreateArgs]>;
    update: jest.Mock;
  };
  inventoryMovement: {
    create: jest.Mock;
  };
};

type PrismaServiceMock = {
  $transaction: jest.Mock;
  idempotencyRecord: {
    findUnique: jest.Mock;
  };
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
  const defaultIdempotencyKey = 'purchase-receipt-test-key';
  const lotTrackingCompanyId = '33333333-3333-4333-8333-333333333333';
  const lotTrackingUserId = '44444444-4444-4444-8444-444444444444';
  const lotTrackingPurchaseId = '22222222-2222-4222-8222-222222222222';
  const firstPurchaseItemId = '11111111-1111-4111-8111-111111111111';
  const secondPurchaseItemId = '77777777-7777-4777-8777-777777777777';
  const firstProductId = '55555555-5555-4555-8555-555555555555';
  const secondProductId = '99999999-9999-4999-8999-999999999999';

  let service: PurchaseReceiptsService;
  let prisma: PrismaServiceMock;
  let transactionClient: TransactionClientMock;
  let equipmentProvisioningService: EquipmentProvisioningServiceMock;

  beforeEach(async () => {
    transactionClient = {
      idempotencyRecord: {
        create: jest.fn().mockResolvedValue({
          id: 'idempotency-record-1',
        }),
        update: jest.fn(),
      },
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
        create: jest.fn<Promise<unknown>, [InventoryBatchCreateArgs]>(),
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
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
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

  function createReceipt(
    companyId: string,
    receivedBy: string | undefined,
    dto: CreatePurchaseReceiptDto,
    idempotencyKey = defaultIdempotencyKey,
  ) {
    return service.create(companyId, receivedBy, idempotencyKey, dto);
  }

  function arrangeLotTrackingReceipt(
    items: LotTrackingReceiptItemFixture[],
  ): CreatePurchaseReceiptDto {
    const receiptId = '66666666-6666-4666-8666-666666666666';

    transactionClient.purchase.findFirst.mockResolvedValue({
      id: lotTrackingPurchaseId,
      companyId: lotTrackingCompanyId,
      folio: 'OC-LOTES-001',
      status: PurchaseStatus.CONFIRMED,
      items: items.map((item) => ({
        id: item.purchaseItemId,
        productId: item.productId,
        quantity: 10,
        price: 125,
        receiptItems: [],
      })),
    });

    transactionClient.product.findMany.mockResolvedValue(
      items.map((item) => ({
        id: item.productId,
        sku: item.sku,
        lotTracking: item.lotTracking,
      })),
    );

    transactionClient.purchaseReceipt.create.mockResolvedValue({
      id: receiptId,
      folio: 'REC-LOTES-001',
    });

    transactionClient.inventoryBatch.findUnique.mockResolvedValue(null);
    transactionClient.inventoryBatch.create.mockImplementation(
      (args: InventoryBatchCreateArgs) =>
        Promise.resolve({
          id: `batch-${args.data.productId}`,
          ...args.data,
        }),
    );

    transactionClient.purchaseReceiptItem.create.mockImplementation(
      (args: PurchaseReceiptItemCreateArgs) =>
        Promise.resolve({
          id: `receipt-item-${args.data.productId}`,
          ...args.data,
        }),
    );

    transactionClient.product.update.mockResolvedValue({
      stock: 12,
    });
    transactionClient.purchase.update.mockResolvedValue({
      id: lotTrackingPurchaseId,
      status: PurchaseStatus.PARTIALLY_RECEIVED,
    });
    transactionClient.purchaseReceipt.findUniqueOrThrow.mockResolvedValue({
      id: receiptId,
      folio: 'REC-LOTES-001',
    });

    return {
      purchaseId: lotTrackingPurchaseId,
      items: items.map((item) => ({
        purchaseItemId: item.purchaseItemId,
        quantityReceived: item.quantityReceived ?? 2,
        lotNumber: item.lotNumber,
        expirationDate: item.expirationDate,
      })),
    } as unknown as CreatePurchaseReceiptDto;
  }

  function createLotTrackingItem(
    lotTracking: ProductLotTracking,
    overrides: Partial<LotTrackingReceiptItemFixture> = {},
  ): LotTrackingReceiptItemFixture {
    return {
      purchaseItemId: firstPurchaseItemId,
      productId: firstProductId,
      sku: 'SKU-LOTE-001',
      lotTracking,
      ...overrides,
    };
  }

  function expectNoReceiptMutations(): void {
    expect(transactionClient.purchaseReceipt.create).not.toHaveBeenCalled();
    expect(transactionClient.purchaseReceiptItem.create).not.toHaveBeenCalled();
    expect(transactionClient.inventoryBatch.create).not.toHaveBeenCalled();
    expect(transactionClient.inventoryBatch.update).not.toHaveBeenCalled();
    expect(transactionClient.product.update).not.toHaveBeenCalled();
    expect(transactionClient.inventoryMovement.create).not.toHaveBeenCalled();
    expect(
      equipmentProvisioningService.provisionFromPurchaseReceiptItem,
    ).not.toHaveBeenCalled();
    expect(transactionClient.purchase.update).not.toHaveBeenCalled();
  }

  function expectBatchCreatedWith(
    expectedData: Partial<InventoryBatchCreateArgs['data']>,
  ): void {
    const batchCreateArgs =
      transactionClient.inventoryBatch.create.mock.calls[0]?.[0];

    expect(batchCreateArgs?.data).toMatchObject(expectedData);
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reproduce una recepción completada sin abrir otra transacción ni repetir mutaciones', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';
    const idempotencyKey = 'completed-receipt-key';
    const receiptId = '66666666-6666-4666-8666-666666666666';
    const dto: CreatePurchaseReceiptDto = {
      purchaseId: '22222222-2222-4222-8222-222222222222',
      notes: 'Recepción idempotente',
      items: [
        {
          purchaseItemId: '11111111-1111-4111-8111-111111111111',
          quantityReceived: 2,
          lotNumber: 'LOTE-001',
          expirationDate: '2099-12-31',
        },
      ],
    };
    const existingReceipt = {
      id: receiptId,
      folio: 'REC-IDEMPOTENTE-001',
    };

    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      companyId,
      scope: IdempotencyScope.PURCHASE_RECEIPT_CREATE,
      key: idempotencyKey,
      requestHash: createPurchaseReceiptRequestHash(dto),
      resourceId: receiptId,
    });
    prisma.purchaseReceipt.findFirst.mockResolvedValue(existingReceipt);

    await expect(
      createReceipt(companyId, lotTrackingUserId, dto, idempotencyKey),
    ).resolves.toEqual(existingReceipt);

    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_scope_key: {
          companyId,
          scope: IdempotencyScope.PURCHASE_RECEIPT_CREATE,
          key: idempotencyKey,
        },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expectNoReceiptMutations();
    expect(transactionClient.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('reproduce la misma solicitud cuando las partidas llegan en distinto orden', async () => {
    const idempotencyKey = 'reordered-items-key';
    const originalDto: CreatePurchaseReceiptDto = {
      purchaseId: lotTrackingPurchaseId,
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 1,
        },
        {
          purchaseItemId: secondPurchaseItemId,
          quantityReceived: 2,
        },
      ],
    };
    const reorderedDto: CreatePurchaseReceiptDto = {
      ...originalDto,
      items: [...originalDto.items].reverse(),
    };
    const existingReceipt = {
      id: '66666666-6666-4666-8666-666666666666',
      folio: 'REC-IDEMPOTENTE-002',
    };

    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: createPurchaseReceiptRequestHash(originalDto),
      resourceId: existingReceipt.id,
    });
    prisma.purchaseReceipt.findFirst.mockResolvedValue(existingReceipt);

    await expect(
      createReceipt(
        lotTrackingCompanyId,
        lotTrackingUserId,
        reorderedDto,
        idempotencyKey,
      ),
    ).resolves.toEqual(existingReceipt);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expectNoReceiptMutations();
  });

  it('rechaza la reutilización de una clave con un payload diferente', async () => {
    const idempotencyKey = 'conflicting-payload-key';
    const originalDto: CreatePurchaseReceiptDto = {
      purchaseId: lotTrackingPurchaseId,
      notes: 'Solicitud original',
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 1,
        },
      ],
    };
    const changedDto: CreatePurchaseReceiptDto = {
      ...originalDto,
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 2,
        },
      ],
    };

    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: createPurchaseReceiptRequestHash(originalDto),
      resourceId: '66666666-6666-4666-8666-666666666666',
    });

    const error = await createReceipt(
      lotTrackingCompanyId,
      lotTrackingUserId,
      changedDto,
      idempotencyKey,
    ).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error).toMatchObject({
      message:
        'La clave de idempotencia ya fue utilizada con una solicitud diferente',
      status: 409,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expectNoReceiptMutations();
  });

  it('permite reintentar con la misma clave después de un rollback simulado', async () => {
    const idempotencyKey = 'rolled-back-receipt-key';
    const item = createLotTrackingItem(ProductLotTracking.OPTIONAL);
    const dto = arrangeLotTrackingReceipt([item]);

    transactionClient.purchase.findFirst.mockResolvedValueOnce(null);

    await expect(
      createReceipt(
        lotTrackingCompanyId,
        lotTrackingUserId,
        dto,
        idempotencyKey,
      ),
    ).rejects.toThrow('Compra no encontrada');

    await expect(
      createReceipt(
        lotTrackingCompanyId,
        lotTrackingUserId,
        dto,
        idempotencyKey,
      ),
    ).resolves.toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      folio: 'REC-LOTES-001',
    });

    expect(transactionClient.idempotencyRecord.create).toHaveBeenCalledTimes(2);
    expect(transactionClient.idempotencyRecord.update).toHaveBeenCalledTimes(1);
    expect(transactionClient.purchaseReceipt.create).toHaveBeenCalledTimes(1);
  });

  it('no trata un P2002 de otro índice como conflicto concurrente de idempotencia', async () => {
    const dto: CreatePurchaseReceiptDto = {
      purchaseId: lotTrackingPurchaseId,
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 1,
        },
      ],
    };
    const unrelatedUniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          target: ['companyId', 'folio'],
        },
      },
    );

    prisma.$transaction.mockRejectedValue(unrelatedUniqueError);

    await expect(
      createReceipt(
        lotTrackingCompanyId,
        lotTrackingUserId,
        dto,
        'unrelated-p2002-key',
      ),
    ).rejects.toBe(unrelatedUniqueError);

    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledTimes(1);
  });

  it('mantiene aislada la misma clave literal entre empresas', async () => {
    const firstCompanyId = '33333333-3333-4333-8333-333333333333';
    const secondCompanyId = '34343434-3434-4343-8343-343434343434';
    const idempotencyKey = 'shared-company-key';
    const dto: CreatePurchaseReceiptDto = {
      purchaseId: lotTrackingPurchaseId,
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 1,
        },
      ],
    };
    const requestHash = createPurchaseReceiptRequestHash(dto);
    const firstReceipt = { id: 'receipt-company-a' };
    const secondReceipt = { id: 'receipt-company-b' };

    prisma.idempotencyRecord.findUnique
      .mockResolvedValueOnce({
        requestHash,
        resourceId: firstReceipt.id,
      })
      .mockResolvedValueOnce({
        requestHash,
        resourceId: secondReceipt.id,
      });
    prisma.purchaseReceipt.findFirst
      .mockResolvedValueOnce(firstReceipt)
      .mockResolvedValueOnce(secondReceipt);

    await expect(
      createReceipt(firstCompanyId, lotTrackingUserId, dto, idempotencyKey),
    ).resolves.toEqual(firstReceipt);
    await expect(
      createReceipt(secondCompanyId, lotTrackingUserId, dto, idempotencyKey),
    ).resolves.toEqual(secondReceipt);

    expect(prisma.idempotencyRecord.findUnique.mock.calls).toEqual([
      [
        {
          where: {
            companyId_scope_key: {
              companyId: firstCompanyId,
              scope: IdempotencyScope.PURCHASE_RECEIPT_CREATE,
              key: idempotencyKey,
            },
          },
        },
      ],
      [
        {
          where: {
            companyId_scope_key: {
              companyId: secondCompanyId,
              scope: IdempotencyScope.PURCHASE_RECEIPT_CREATE,
              key: idempotencyKey,
            },
          },
        },
      ],
    ]);
    expect(prisma.purchaseReceipt.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: firstReceipt.id, companyId: firstCompanyId },
      }),
    );
    expect(prisma.purchaseReceipt.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: secondReceipt.id, companyId: secondCompanyId },
      }),
    );
  });

  it('resuelve un P2002 concurrente releyendo el recibo ganador fuera de la transacción', async () => {
    const companyId = lotTrackingCompanyId;
    const idempotencyKey = 'concurrent-receipt-key';
    const receiptId = '66666666-6666-4666-8666-666666666666';
    const dto: CreatePurchaseReceiptDto = {
      purchaseId: lotTrackingPurchaseId,
      items: [
        {
          purchaseItemId: firstPurchaseItemId,
          quantityReceived: 1,
        },
      ],
    };
    const requestHash = createPurchaseReceiptRequestHash(dto);
    const winningReceipt = { id: receiptId, folio: 'REC-GANADOR-001' };
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          target: ['companyId', 'scope', 'key'],
        },
      },
    );

    prisma.idempotencyRecord.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        requestHash,
        resourceId: receiptId,
      });
    prisma.$transaction.mockRejectedValue(uniqueError);
    prisma.purchaseReceipt.findFirst.mockResolvedValue(winningReceipt);

    await expect(
      createReceipt(companyId, lotTrackingUserId, dto, idempotencyKey),
    ).resolves.toEqual(winningReceipt);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledTimes(2);
    expect(transactionClient.purchaseReceipt.create).not.toHaveBeenCalled();
    expectNoReceiptMutations();
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

    const action = createReceipt(
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

    const action = createReceipt(
      companyId,
      '44444444-4444-4444-8444-444444444444',
      dto,
    );

    await expect(action).rejects.toMatchObject({
      message: 'Compra no encontrada',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.idempotencyRecord.create).toHaveBeenCalledWith({
      data: {
        companyId,
        scope: IdempotencyScope.PURCHASE_RECEIPT_CREATE,
        key: defaultIdempotencyKey,
        requestHash: createPurchaseReceiptRequestHash(dto),
      },
    });
    expect(transactionClient.idempotencyRecord.update).not.toHaveBeenCalled();
    expect(transactionClient.purchaseReceipt.create).not.toHaveBeenCalled();

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

      const action = createReceipt(
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

    const action = createReceipt(
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

  it('permite recibir un producto con lotTracking NONE sin lote ni caducidad', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.NONE),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).resolves.toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      folio: 'REC-LOTES-001',
    });

    expect(transactionClient.product.findMany).toHaveBeenCalledWith({
      where: {
        companyId: lotTrackingCompanyId,
        id: {
          in: [firstProductId],
        },
      },
      select: {
        id: true,
        sku: true,
        lotTracking: true,
      },
    });
    expect(transactionClient.inventoryBatch.findUnique).not.toHaveBeenCalled();
    expect(transactionClient.inventoryBatch.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'número de lote',
      lotNumber: 'LOTE-NO-PERMITIDO',
      expirationDate: undefined,
    },
    {
      caseName: 'fecha de caducidad',
      lotNumber: undefined,
      expirationDate: '2099-12-31',
    },
    {
      caseName: 'lote y fecha de caducidad',
      lotNumber: 'LOTE-NO-PERMITIDO',
      expirationDate: '2099-12-31',
    },
  ])(
    'rechaza lotTracking NONE con $caseName sin mutaciones',
    async ({ lotNumber, expirationDate }) => {
      const dto = arrangeLotTrackingReceipt([
        createLotTrackingItem(ProductLotTracking.NONE, {
          lotNumber,
          expirationDate,
        }),
      ]);

      await expect(
        createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
      ).rejects.toThrow(
        'El producto SKU-LOTE-001 no permite seguimiento por lote',
      );

      expectNoReceiptMutations();
    },
  );

  it.each([
    {
      caseName: 'sin lote ni caducidad',
      lotNumber: undefined,
      expirationDate: undefined,
      createsBatch: false,
    },
    {
      caseName: 'con lote',
      lotNumber: '  LOTE-OPCIONAL  ',
      expirationDate: undefined,
      createsBatch: true,
    },
    {
      caseName: 'con lote y caducidad',
      lotNumber: 'LOTE-OPCIONAL',
      expirationDate: '2099-12-31',
      createsBatch: true,
    },
  ])(
    'permite lotTracking OPTIONAL $caseName',
    async ({ lotNumber, expirationDate, createsBatch }) => {
      const dto = arrangeLotTrackingReceipt([
        createLotTrackingItem(ProductLotTracking.OPTIONAL, {
          lotNumber,
          expirationDate,
        }),
      ]);

      await expect(
        createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
      ).resolves.toEqual({
        id: '66666666-6666-4666-8666-666666666666',
        folio: 'REC-LOTES-001',
      });

      if (createsBatch) {
        expectBatchCreatedWith({
          lotNumber: 'LOTE-OPCIONAL',
        });
      } else {
        expect(
          transactionClient.inventoryBatch.findUnique,
        ).not.toHaveBeenCalled();
        expect(transactionClient.inventoryBatch.create).not.toHaveBeenCalled();
      }
    },
  );

  it('rechaza lotTracking OPTIONAL con caducidad sin lote', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.OPTIONAL, {
        expirationDate: '2099-12-31',
      }),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).rejects.toThrow(
      'No se puede registrar una fecha de caducidad sin número de lote',
    );

    expectNoReceiptMutations();
  });

  it('preserva el rechazo de caducidad inválida para lotTracking OPTIONAL', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.OPTIONAL, {
        lotNumber: 'LOTE-CADUCADO',
        expirationDate: '2020-01-01',
      }),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).rejects.toThrow(
      'La fecha de caducidad no puede ser anterior a la fecha de recepción',
    );

    expectNoReceiptMutations();
  });

  it.each([
    {
      caseName: 'ausente',
      lotNumber: undefined,
    },
    {
      caseName: 'null',
      lotNumber: null,
    },
    {
      caseName: 'vacío',
      lotNumber: '',
    },
    {
      caseName: 'solo espacios',
      lotNumber: '   ',
    },
  ])(
    'rechaza lotTracking REQUIRED con lote $caseName',
    async ({ lotNumber }) => {
      const dto = arrangeLotTrackingReceipt([
        createLotTrackingItem(ProductLotTracking.REQUIRED, {
          lotNumber,
        }),
      ]);

      await expect(
        createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
      ).rejects.toThrow('El producto SKU-LOTE-001 requiere número de lote');

      expectNoReceiptMutations();
    },
  );

  it('permite lotTracking REQUIRED con lote y caducidad opcional', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.REQUIRED, {
        lotNumber: '  LOTE-REQUERIDO  ',
      }),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).resolves.toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      folio: 'REC-LOTES-001',
    });

    expectBatchCreatedWith({
      lotNumber: 'LOTE-REQUERIDO',
      expirationDate: undefined,
    });
  });

  it('permite lotTracking REQUIRED con lote y caducidad válida', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.REQUIRED, {
        lotNumber: 'LOTE-REQUERIDO',
        expirationDate: '2099-12-31',
      }),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).resolves.toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      folio: 'REC-LOTES-001',
    });

    expectBatchCreatedWith({
      lotNumber: 'LOTE-REQUERIDO',
      expirationDate: new Date('2099-12-31'),
    });
  });

  it('rechaza toda la recepción con OPTIONAL válido y REQUIRED inválido', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.OPTIONAL, {
        lotNumber: 'LOTE-OPCIONAL',
      }),
      createLotTrackingItem(ProductLotTracking.REQUIRED, {
        purchaseItemId: secondPurchaseItemId,
        productId: secondProductId,
        sku: 'SKU-LOTE-002',
      }),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).rejects.toThrow('El producto SKU-LOTE-002 requiere número de lote');

    expectNoReceiptMutations();
  });

  it('rechaza toda la recepción con REQUIRED válido y NONE inválido', async () => {
    const dto = arrangeLotTrackingReceipt([
      createLotTrackingItem(ProductLotTracking.REQUIRED, {
        lotNumber: 'LOTE-REQUERIDO',
      }),
      createLotTrackingItem(ProductLotTracking.NONE, {
        purchaseItemId: secondPurchaseItemId,
        productId: secondProductId,
        sku: 'SKU-LOTE-002',
        lotNumber: 'LOTE-NO-PERMITIDO',
      }),
    ]);

    await expect(
      createReceipt(lotTrackingCompanyId, lotTrackingUserId, dto),
    ).rejects.toThrow(
      'El producto SKU-LOTE-002 no permite seguimiento por lote',
    );

    expectNoReceiptMutations();
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

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: productId,
        sku: 'SKU-PRUEBA-001',
        lotTracking: ProductLotTracking.OPTIONAL,
      },
    ]);

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

    const action = createReceipt(
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

    transactionClient.product.findMany.mockResolvedValue([
      {
        id: productId,
        sku: 'SKU-PRUEBA-001',
        lotTracking: ProductLotTracking.OPTIONAL,
      },
    ]);

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

    const action = createReceipt(
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

    const action = createReceipt(
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
        sku: 'SKU-PRUEBA-001',
        lotTracking: ProductLotTracking.OPTIONAL,
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

    const result = await createReceipt(companyId, userId, dto);

    expect(result).toEqual(expectedResult);

    expect(transactionClient.idempotencyRecord.create).toHaveBeenCalledWith({
      data: {
        companyId,
        scope: IdempotencyScope.PURCHASE_RECEIPT_CREATE,
        key: defaultIdempotencyKey,
        requestHash: createPurchaseReceiptRequestHash(dto),
      },
    });
    expect(transactionClient.idempotencyRecord.update).toHaveBeenCalledWith({
      where: {
        id: 'idempotency-record-1',
      },
      data: {
        resourceId: receiptId,
      },
    });

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

    const [inventoryBatchCreateArgs] =
      transactionClient.inventoryBatch.create.mock.calls[0];

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
        sku: 'SKU-PRUEBA-001',
        lotTracking: ProductLotTracking.OPTIONAL,
      },
      {
        id: secondProductId,
        sku: 'SKU-PRUEBA-002',
        lotTracking: ProductLotTracking.OPTIONAL,
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

    const result = await createReceipt(companyId, userId, dto);

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
          sku: 'SKU-PRUEBA-001',
          lotTracking: ProductLotTracking.OPTIONAL,
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

      const result = await createReceipt(companyId, userId, dto);

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
        sku: 'SKU-PRUEBA-001',
        lotTracking: ProductLotTracking.OPTIONAL,
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

    await expect(createReceipt(companyId, userId, dto)).rejects.toThrow(
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
        sku: 'SKU-PRUEBA-001',
        lotTracking: ProductLotTracking.OPTIONAL,
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

    const result = await createReceipt(companyId, userId, dto);

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
