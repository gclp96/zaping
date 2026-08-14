import { BadRequestException, NotFoundException } from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { SalesService } from './sales.service';

const companyId = '11111111-1111-4111-8111-111111111111';

const quoteId = '22222222-2222-4222-8222-222222222222';

const customerId = '33333333-3333-4333-8333-333333333333';

const productId = '44444444-4444-4444-8444-444444444444';

const saleId = '55555555-5555-4555-8555-555555555555';

const quote = {
  id: quoteId,
  companyId,
  customerId,
  folio: 'COT-001',
  subtotal: 200,
  iva: 32,
  total: 232,
  status: 'CONFIRMED',
  convertedToSale: false,
  items: [
    {
      id: 'quote-item-1',
      productId,
      quantity: 2,
      price: 100,
      subtotal: 200,
    },
  ],
};

const transactionMock = {
  quote: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },

  sale: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },

  product: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },

  inventoryMovement: {
    create: jest.fn(),
  },
};

type TransactionCallback = (tx: typeof transactionMock) => Promise<unknown>;

const prismaMock = {
  $transaction: jest.fn(),
};

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: TransactionCallback) => callback(transactionMock),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<SalesService>(SalesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('createFromQuote', () => {
    it('convierte una cotización confirmada en una venta confirmada y descuenta inventario', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        companyId,
        customerId,
        quoteId,
        folio: 'V-1700000000000',
        subtotal: 200,
        iva: 32,
        total: 232,
        status: 'CONFIRMED',
      });

      transactionMock.product.findFirst
        .mockResolvedValueOnce({
          id: productId,
          name: 'Producto médico',
          cost: 65,
        })
        .mockResolvedValueOnce({
          stock: 8,
        });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.inventoryMovement.create.mockResolvedValue({
        id: 'movement-1',
      });

      const convertedSale = {
        id: saleId,
        companyId,
        customerId,
        quoteId,
        folio: 'V-1700000000000',
        subtotal: 200,
        iva: 32,
        total: 232,
        status: 'CONFIRMED',
        quote,
      };

      transactionMock.sale.findFirst.mockResolvedValue(convertedSale);

      const result = await service.createFromQuote(companyId, quoteId);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(transactionMock.quote.findFirst).toHaveBeenCalledWith({
        where: {
          id: quoteId,
          companyId,
        },
        include: {
          items: true,
        },
      });

      expect(transactionMock.quote.updateMany).toHaveBeenCalledWith({
        where: {
          id: quoteId,
          companyId,
          status: 'CONFIRMED',
          convertedToSale: false,
        },
        data: {
          convertedToSale: true,
        },
      });

      expect(transactionMock.sale.create).toHaveBeenCalledWith({
        data: {
          companyId,
          customerId,
          quoteId,
          folio: 'V-1700000000000',
          subtotal: 200,
          iva: 32,
          total: 232,
          status: 'CONFIRMED',
          items: {
            create: [
              {
                productId,
                quantity: 2,
                price: 100,
                subtotal: 200,
              },
            ],
          },
        },
      });

      expect(transactionMock.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: productId,
          companyId,
          isActive: true,
          stock: {
            gte: 2,
          },
        },
        data: {
          stock: {
            decrement: 2,
          },
        },
      });

      expect(transactionMock.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          companyId,
          productId,
          movementType: 'OUT',
          quantity: 2,
          unitCost: 65,
          balance: 8,
          referenceType: 'SALE',
          referenceId: saleId,
          notes: 'Venta V-1700000000000 generada desde cotización COT-001',
        },
      });

      expect(transactionMock.sale.findFirst).toHaveBeenCalledWith({
        where: {
          id: saleId,
          companyId,
        },
        include: {
          customer: true,
          quote: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      expect(result).toEqual(convertedSale);
    });

    it('rechaza una cotización inexistente o de otra empresa', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(null);

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza una cotización que no está confirmada', async () => {
      transactionMock.quote.findFirst.mockResolvedValue({
        ...quote,
        status: 'DRAFT',
      });

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException(
          'La cotización debe estar aprobada antes de convertirse en venta',
        ),
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza una cotización ya convertida', async () => {
      transactionMock.quote.findFirst.mockResolvedValue({
        ...quote,
        convertedToSale: true,
      });

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException('La cotización ya fue convertida a venta'),
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza una cotización sin productos', async () => {
      transactionMock.quote.findFirst.mockResolvedValue({
        ...quote,
        items: [],
      });

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException('La cotización no contiene productos'),
      );

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('bloquea una segunda conversión concurrente', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException(
          'La cotización ya fue convertida o ya no puede convertirse',
        ),
      );

      expect(transactionMock.sale.create).not.toHaveBeenCalled();

      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un producto inexistente, inactivo o de otra empresa', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        folio: 'V-123',
      });

      transactionMock.product.findFirst.mockResolvedValue(null);

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();

      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza la conversión cuando no existe stock suficiente', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        folio: 'V-123',
      });

      transactionMock.product.findFirst
        .mockResolvedValueOnce({
          id: productId,
          name: 'Producto médico',
          cost: 65,
        })
        .mockResolvedValueOnce({
          stock: 1,
        });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException(
          'Stock insuficiente para Producto médico. Disponible: 1',
        ),
      );

      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();

      expect(transactionMock.sale.findFirst).not.toHaveBeenCalled();
    });

    it('usa el costo del producto y no el precio de venta en el movimiento de inventario', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        folio: 'V-1700000000000',
      });

      transactionMock.product.findFirst
        .mockResolvedValueOnce({
          id: productId,
          name: 'Producto médico',
          cost: 55.75,
        })
        .mockResolvedValueOnce({
          stock: 8,
        });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.inventoryMovement.create.mockResolvedValue({
        id: 'movement-1',
      });

      transactionMock.sale.findFirst.mockResolvedValue({
        id: saleId,
      });

      await service.createFromQuote(companyId, quoteId);

      expect(transactionMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            unitCost: 55.75,
          }),
        }),
      );
    });

    it('registra el saldo real del producto después del descuento', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        folio: 'V-123',
      });

      transactionMock.product.findFirst
        .mockResolvedValueOnce({
          id: productId,
          name: 'Producto médico',
          cost: 65,
        })
        .mockResolvedValueOnce({
          stock: 27,
        });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.inventoryMovement.create.mockResolvedValue({
        id: 'movement-1',
      });

      transactionMock.sale.findFirst.mockResolvedValue({
        id: saleId,
      });

      await service.createFromQuote(companyId, quoteId);

      expect(transactionMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            balance: 27,
          }),
        }),
      );
    });
  });
});
