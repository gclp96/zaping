import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { InventoryService } from './inventory.service';

type TransactionClientMock = {
  product: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  inventoryMovement: {
    create: jest.Mock;
  };
};

type PrismaServiceMock = {
  $transaction: jest.Mock;
  product: {
    findFirst: jest.Mock;
  };
};

describe('InventoryService', () => {
  const companyId = '33333333-3333-4333-8333-333333333333';
  const productId = '55555555-5555-4555-8555-555555555555';

  let service: InventoryService;
  let prisma: PrismaServiceMock;
  let transactionClient: TransactionClientMock;

  beforeEach(() => {
    transactionClient = {
      product: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: productId }),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(
        async (operation: (tx: TransactionClientMock) => Promise<unknown>) =>
          operation(transactionClient),
      ),
      product: {
        findFirst: jest.fn(),
      },
    };

    service = new InventoryService(prisma as unknown as PrismaService);
  });

  function movementData(
    movementType: InventoryMovementType,
    quantity: number,
    notes?: string,
  ): CreateMovementDto {
    return {
      productId,
      movementType,
      quantity,
      notes,
    };
  }

  function arrangeProduct(stock: number): void {
    transactionClient.product.findFirst.mockResolvedValue({
      id: productId,
      companyId,
      stock,
    });
  }

  function expectSerializableTransaction(): void {
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  function p2034Error(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
      {
        code: 'P2034',
        clientVersion: 'test',
      },
    );
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registra un movimiento IN dentro de una transacción Serializable', async () => {
    arrangeProduct(10);
    const movement = {
      id: 'movement-in',
      movementType: InventoryMovementType.IN,
      quantity: 2,
      balance: 12,
    };
    transactionClient.inventoryMovement.create.mockResolvedValue(movement);

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.IN, 2, 'Entrada'),
      ),
    ).resolves.toEqual(movement);

    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(transactionClient.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: productId,
        companyId,
      },
    });
    expect(transactionClient.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        companyId,
        productId,
        movementType: InventoryMovementType.IN,
        quantity: 2,
        balance: 12,
        notes: 'Entrada',
      },
    });
    expect(transactionClient.product.update).toHaveBeenCalledWith({
      where: {
        id_companyId: {
          id: productId,
          companyId,
        },
      },
      data: {
        stock: 12,
      },
    });
    expectSerializableTransaction();
  });

  it('registra un movimiento OUT cuando existe stock suficiente', async () => {
    arrangeProduct(5);
    const movement = {
      id: 'movement-out',
      movementType: InventoryMovementType.OUT,
      quantity: 2,
      balance: 3,
    };
    transactionClient.inventoryMovement.create.mockResolvedValue(movement);

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.OUT, 2),
      ),
    ).resolves.toEqual(movement);

    expect(transactionClient.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        companyId,
        productId,
        movementType: InventoryMovementType.OUT,
        quantity: 2,
        balance: 3,
        notes: undefined,
      },
    });
    expect(transactionClient.product.update).toHaveBeenCalledWith({
      where: {
        id_companyId: {
          id: productId,
          companyId,
        },
      },
      data: { stock: 3 },
    });
    expectSerializableTransaction();
  });

  it('rechaza OUT por stock insuficiente sin crear movimiento', async () => {
    arrangeProduct(1);

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.OUT, 2),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.inventoryMovement.create).not.toHaveBeenCalled();
    expect(transactionClient.product.update).not.toHaveBeenCalled();
  });

  it('preserva ADJUSTMENT como stock absoluto', async () => {
    arrangeProduct(10);
    const movement = {
      id: 'movement-adjustment',
      movementType: InventoryMovementType.ADJUSTMENT,
      quantity: 7,
      balance: 7,
    };
    transactionClient.inventoryMovement.create.mockResolvedValue(movement);

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.ADJUSTMENT, 7),
      ),
    ).resolves.toEqual(movement);

    expect(transactionClient.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        companyId,
        productId,
        movementType: InventoryMovementType.ADJUSTMENT,
        quantity: 7,
        balance: 7,
        notes: undefined,
      },
    });
    expect(transactionClient.product.update).toHaveBeenCalledWith({
      where: {
        id_companyId: {
          id: productId,
          companyId,
        },
      },
      data: { stock: 7 },
    });
  });

  it('mantiene el lookup tenant-safe y oculta un producto de otra empresa', async () => {
    transactionClient.product.findFirst.mockResolvedValue(null);

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.IN, 1),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(transactionClient.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: productId,
        companyId,
      },
    });
    expect(transactionClient.inventoryMovement.create).not.toHaveBeenCalled();
    expect(transactionClient.product.update).not.toHaveBeenCalled();
  });

  it('propaga el fallo posterior al movimiento para que la transacción haga rollback', async () => {
    arrangeProduct(10);
    const databaseError = new Error('product update failed');
    transactionClient.inventoryMovement.create.mockResolvedValue({
      id: 'movement-rollback',
    });
    transactionClient.product.update.mockRejectedValue(databaseError);

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.IN, 1),
      ),
    ).rejects.toBe(databaseError);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(transactionClient.product.update).toHaveBeenCalledTimes(1);
  });

  it('reintenta P2034 ejecutando de nuevo la transacción y releyendo el stock', async () => {
    transactionClient.product.findFirst
      .mockResolvedValueOnce({ id: productId, companyId, stock: 10 })
      .mockResolvedValueOnce({ id: productId, companyId, stock: 11 });
    transactionClient.inventoryMovement.create
      .mockResolvedValueOnce({ id: 'aborted-movement', balance: 11 })
      .mockResolvedValueOnce({ id: 'committed-movement', balance: 12 });

    let transactionAttempt = 0;
    prisma.$transaction.mockImplementation(
      async (operation: (tx: TransactionClientMock) => Promise<unknown>) => {
        transactionAttempt += 1;
        const result = await operation(transactionClient);

        if (transactionAttempt === 1) {
          throw p2034Error();
        }

        return result;
      },
    );

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.IN, 1),
      ),
    ).resolves.toEqual({ id: 'committed-movement', balance: 12 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transactionClient.product.findFirst).toHaveBeenCalledTimes(2);
    expect(transactionClient.inventoryMovement.create).toHaveBeenNthCalledWith(
      2,
      {
        data: {
          companyId,
          productId,
          movementType: InventoryMovementType.IN,
          quantity: 1,
          balance: 12,
          notes: undefined,
        },
      },
    );
    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('agota exactamente tres intentos ante P2034 y propaga el conflicto', async () => {
    arrangeProduct(10);
    const conflict = p2034Error();
    prisma.$transaction.mockImplementation(
      async (operation: (tx: TransactionClientMock) => Promise<unknown>) => {
        await operation(transactionClient);
        throw conflict;
      },
    );

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.IN, 1),
      ),
    ).rejects.toBe(conflict);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(transactionClient.product.findFirst).toHaveBeenCalledTimes(3);
  });

  it('no reintenta errores que no sean P2034', async () => {
    arrangeProduct(10);
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );
    prisma.$transaction.mockImplementation(
      async (operation: (tx: TransactionClientMock) => Promise<unknown>) => {
        await operation(transactionClient);
        throw conflict;
      },
    );

    await expect(
      service.createMovement(
        companyId,
        movementData(InventoryMovementType.IN, 1),
      ),
    ).rejects.toBe(conflict);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
