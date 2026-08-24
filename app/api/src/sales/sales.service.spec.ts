import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductInventoryTracking, ProductLotTracking } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesFolioService } from './sales-folio.service';
import { SalesService } from './sales.service';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

const companyId = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';
const customerId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const secondProductId = '77777777-7777-4777-8777-777777777777';
const saleId = '55555555-5555-4555-8555-555555555555';
const incompatibleTrackingMessage =
  'El producto Producto médico no es compatible con el flujo de venta genérico por su tipo de seguimiento de inventario';
const requiredLotMessage =
  'El producto Producto médico requiere selección de lote para completar la venta';

function createProductMock(
  overrides: Partial<{
    id: string;
    companyId: string;
    name: string;
    cost: number;
    price: number;
    stock: number;
    isActive: boolean;
    inventoryTracking: ProductInventoryTracking;
    lotTracking: ProductLotTracking;
  }> = {},
) {
  return {
    id: productId,
    companyId,
    name: 'Producto médico',
    cost: 65,
    price: 100,
    stock: 10,
    isActive: true,
    inventoryTracking: ProductInventoryTracking.QUANTITY,
    lotTracking: ProductLotTracking.OPTIONAL,
    ...overrides,
  };
}

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
    update: jest.fn(),
    updateMany: jest.fn(),
  },

  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },

  inventoryMovement: {
    create: jest.fn(),
  },
};

const draftSale = {
  id: saleId,
  companyId,
  customerId,

  folio: 'V-001',

  subtotal: 200,
  iva: 32,
  total: 232,

  status: 'DRAFT',

  items: [
    {
      id: 'sale-item-1',
      productId,
      quantity: 2,
      price: 100,
      subtotal: 200,

      product: {
        id: productId,
        companyId,
        name: 'Producto médico',
        cost: 65,
        price: 100,
        stock: 10,
        isActive: true,
        inventoryTracking: ProductInventoryTracking.QUANTITY,
        lotTracking: ProductLotTracking.OPTIONAL,
      },
    },
  ],
};

const pdfSale = {
  id: saleId,
  companyId,
  customerId,

  folio: 'V-001',
  status: 'CONFIRMED',

  subtotal: 200,
  iva: 32,
  total: 232,

  createdAt: new Date('2026-08-18T12:00:00.000Z'),

  company: {
    name: 'Empresa Legal',
    tradeName: 'Zaping Medical',
    currency: 'MXN',
  },

  customer: {
    name: 'Hospital de prueba',
    contactName: null,
    email: null,
    phone: null,
  },

  items: [
    {
      quantity: 2,
      price: 100,
      subtotal: 200,

      product: {
        name: 'Producto médico',
      },
    },
  ],
};

const mockPdfDocumentInstance = {
  pipe: jest.fn(),
  fontSize: jest.fn(),
  text: jest.fn(),
  moveDown: jest.fn(),
  end: jest.fn(),
};

jest.mock('pdfkit', () => ({
  __esModule: true,
  default: jest.fn(() => mockPdfDocumentInstance),
}));

type TransactionCallback = (tx: typeof transactionMock) => Promise<unknown>;

const prismaMock = {
  $transaction: jest.fn(),

  customer: {
    findFirst: jest.fn(),
  },

  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },

  sale: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const salesFolioServiceMock = {
  allocateNextAvailableFolio: jest.fn(),
};

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: TransactionCallback) => callback(transactionMock),
    );

    prismaMock.product.findMany.mockResolvedValue([createProductMock()]);
    transactionMock.product.findMany.mockResolvedValue([createProductMock()]);
    transactionMock.sale.create.mockResolvedValue({
      id: saleId,
    });
    salesFolioServiceMock.allocateNextAvailableFolio.mockResolvedValue(
      'V-000001',
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: SalesFolioService,
          useValue: salesFolioServiceMock,
        },
      ],
    }).compile();

    service = moduleRef.get<SalesService>(SalesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();

    (PDFDocument as unknown as jest.Mock).mockImplementation(
      () => mockPdfDocumentInstance,
    );
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rechaza un cliente inexistente, inactivo o de otra empresa', async () => {
      prismaMock.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza una venta sin productos', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      await expect(
        service.create(companyId, {
          customerId,
          items: [],
        }),
      ).rejects.toThrow(
        new BadRequestException('Debe enviar al menos un item'),
      );

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza cantidades que no sean enteros positivos', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 1.5,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.product.findMany).not.toHaveBeenCalled();

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza productos duplicados', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 1,
            },
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow(
        new BadRequestException(`El producto ${productId} está duplicado`),
      );

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza un producto inexistente, inactivo o de otra empresa', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([]);

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [productId],
          },
          companyId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          inventoryTracking: true,
          lotTracking: true,
        },
      });

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('permite crear una venta con producto QUANTITY y lote NONE', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([
        createProductMock({
          lotTracking: ProductLotTracking.NONE,
        }),
      ]);

      await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      });

      expect(transactionMock.sale.create).toHaveBeenCalledTimes(1);
    });

    it('permite crear una venta con producto QUANTITY y lote OPTIONAL', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([createProductMock()]);

      await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      });

      expect(transactionMock.sale.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza crear una venta con producto no QUANTITY', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([
        createProductMock({
          inventoryTracking: ProductInventoryTracking.ASSET,
        }),
      ]);

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(incompatibleTrackingMessage));

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza crear una venta con producto que requiere lote', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([
        createProductMock({
          lotTracking: ProductLotTracking.REQUIRED,
        }),
      ]);

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(requiredLotMessage));

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza completamente una venta mixta con un producto incompatible', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([
        createProductMock(),
        createProductMock({
          id: secondProductId,
          name: 'Producto médico',
          inventoryTracking: ProductInventoryTracking.SERIALIZED,
        }),
      ]);

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 1,
            },
            {
              productId: secondProductId,
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(incompatibleTrackingMessage));

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('crea una venta manual en borrador usando el precio vigente del producto y folio secuencial', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([createProductMock()]);

      const createdSale = {
        id: saleId,
        companyId,
        customerId,
        folio: 'V-000001',
        subtotal: 200,
        iva: 32,
        total: 232,
        status: 'DRAFT',
      };

      transactionMock.sale.create.mockResolvedValue(createdSale);

      const result = await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(
        salesFolioServiceMock.allocateNextAvailableFolio,
      ).toHaveBeenCalledWith(transactionMock, companyId);
      expect(transactionMock.sale.create).toHaveBeenCalledWith({
        data: {
          companyId,
          customerId,
          folio: 'V-000001',
          subtotal: 200,
          iva: 32,
          total: 232,
          status: 'DRAFT',
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
        include: {
          items: true,
        },
      });

      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
      expect(result).toEqual(createdSale);
    });

    it('no usa Date.now para generar el folio de venta directa', async () => {
      const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
        throw new Error('Date.now no debe usarse para folios de venta');
      });

      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      });

      expect(dateNowSpy).not.toHaveBeenCalled();
      expect(transactionMock.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            folio: 'V-000001',
          }),
        }),
      );
    });

    it('crea la venta directa dentro de la misma transacción que la asignación de folio', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      });

      expect(
        salesFolioServiceMock.allocateNextAvailableFolio,
      ).toHaveBeenCalledWith(transactionMock, companyId);
      expect(transactionMock.sale.create).toHaveBeenCalledTimes(1);
      expect(
        salesFolioServiceMock.allocateNextAvailableFolio.mock
          .invocationCallOrder[0],
      ).toBeLessThan(transactionMock.sale.create.mock.invocationCallOrder[0]);
    });

    it('no crea venta directa si falla la asignación de folio', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      salesFolioServiceMock.allocateNextAvailableFolio.mockRejectedValue(
        new Error('sequence unavailable'),
      );

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow('sequence unavailable');

      expect(transactionMock.sale.create).not.toHaveBeenCalled();
    });

    it('propaga un fallo de Sale.create después de asignar folio en la transacción', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      transactionMock.sale.create.mockRejectedValue(
        new Error('sale create failed'),
      );

      await expect(
        service.create(companyId, {
          customerId,
          items: [
            {
              productId,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow('sale create failed');

      expect(
        salesFolioServiceMock.allocateNextAvailableFolio,
      ).toHaveBeenCalledWith(transactionMock, companyId);
      expect(transactionMock.sale.create).toHaveBeenCalledTimes(1);
    });

    it('redondea los importes monetarios a dos decimales', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findMany.mockResolvedValue([
        createProductMock({
          price: 33.335,
        }),
      ]);

      await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 3,
          },
        ],
      });

      expect(transactionMock.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            subtotal: 100.01,
            iva: 16,
            total: 116.01,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('consulta una venta usando id y companyId', async () => {
      const sale = {
        ...draftSale,
        customer: {
          id: customerId,
          companyId,
          name: 'Hospital de prueba',
        },
      };

      prismaMock.sale.findFirst.mockResolvedValue(sale);

      await service.findOne(companyId, saleId);

      expect(prismaMock.sale.findFirst).toHaveBeenCalledWith({
        where: {
          id: saleId,
          companyId,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    it('devuelve la venta con cliente y productos de partidas', async () => {
      const sale = {
        ...draftSale,
        customer: {
          id: customerId,
          companyId,
          name: 'Hospital de prueba',
        },
      };

      prismaMock.sale.findFirst.mockResolvedValue(sale);

      const result = await service.findOne(companyId, saleId);

      expect(result).toEqual(sale);
      expect(result.customer).toEqual(sale.customer);
      expect(result.items[0].product).toEqual(draftSale.items[0].product);
    });

    it('lanza NotFoundException cuando la venta no existe', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(null);

      await expect(service.findOne(companyId, saleId)).rejects.toThrow(
        new NotFoundException('Venta no encontrada'),
      );
    });

    it('no puede devolver una venta de otra empresa', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(null);

      await expect(service.findOne(companyId, saleId)).rejects.toThrow(
        new NotFoundException('Venta no encontrada'),
      );

      expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: saleId,
            companyId,
          },
        }),
      );
    });
  });

  describe('approve', () => {
    it('rechaza una venta inexistente o de otra empresa', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(null);

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una venta ya confirmada', async () => {
      prismaMock.sale.findFirst.mockResolvedValue({
        ...draftSale,
        status: 'CONFIRMED',
      });

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        new BadRequestException('La venta ya fue aprobada'),
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una venta cancelada', async () => {
      prismaMock.sale.findFirst.mockResolvedValue({
        ...draftSale,
        status: 'CANCELLED',
      });

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        BadRequestException,
      );

      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('bloquea una segunda aprobación concurrente', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.sale.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        BadRequestException,
      );

      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();

      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza aprobar una venta con producto no QUANTITY', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock({
          inventoryTracking: ProductInventoryTracking.SERIALIZED,
        }),
      ]);

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        new BadRequestException(incompatibleTrackingMessage),
      );

      expect(transactionMock.sale.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza aprobar una venta con producto que requiere lote', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock({
          lotTracking: ProductLotTracking.REQUIRED,
        }),
      ]);

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        new BadRequestException(requiredLotMessage),
      );

      expect(transactionMock.sale.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza aprobar una venta mixta si una partida es incompatible', async () => {
      prismaMock.sale.findFirst.mockResolvedValue({
        ...draftSale,
        items: [
          ...draftSale.items,
          {
            id: 'sale-item-2',
            productId: secondProductId,
            quantity: 1,
            price: 50,
            subtotal: 50,
          },
        ],
      });

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock(),
        createProductMock({
          id: secondProductId,
          name: 'Producto médico',
          inventoryTracking: ProductInventoryTracking.ASSET,
        }),
      ]);

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        new BadRequestException(incompatibleTrackingMessage),
      );

      expect(transactionMock.sale.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza la aprobación cuando no existe stock suficiente', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.sale.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.product.findFirst.mockResolvedValueOnce({
        stock: 1,
      });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.approve(companyId, saleId)).rejects.toThrow(
        new BadRequestException(
          'Stock insuficiente para Producto médico. Disponible: 1',
        ),
      );

      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('aprueba una venta borrador, descuenta inventario y registra el movimiento', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.sale.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.product.findFirst.mockResolvedValueOnce({
        stock: 8,
      });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.inventoryMovement.create.mockResolvedValue({
        id: 'movement-1',
      });

      const confirmedSale = {
        ...draftSale,
        status: 'CONFIRMED',
      };

      transactionMock.sale.findFirst.mockResolvedValue(confirmedSale);

      const result = await service.approve(companyId, saleId);

      expect(transactionMock.sale.updateMany).toHaveBeenCalledWith({
        where: {
          id: saleId,
          companyId,
          status: 'DRAFT',
        },
        data: {
          status: 'CONFIRMED',
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

          notes: 'Venta aprobada V-001',
        },
      });

      expect(result).toEqual(confirmedSale);
    });

    it('usa el saldo real posterior al descuento', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.sale.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.product.findFirst.mockResolvedValueOnce({
        stock: 27,
      });

      transactionMock.product.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.inventoryMovement.create.mockResolvedValue({
        id: 'movement-1',
      });

      transactionMock.sale.findFirst.mockResolvedValue({
        ...draftSale,
        status: 'CONFIRMED',
      });

      await service.approve(companyId, saleId);

      expect(transactionMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            balance: 27,
            unitCost: 65,
          }),
        }),
      );
    });
  });

  describe('generatePDF', () => {
    function createResponseMock() {
      const setHeader = jest.fn();

      const res = {
        setHeader,
      } as unknown as Response;

      return {
        res,
        setHeader,
      };
    }

    function getRenderedTexts(): string[] {
      return mockPdfDocumentInstance.text.mock.calls.map(([text]) =>
        String(text),
      );
    }

    it('rechaza una venta inexistente o de otra empresa', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(null);

      const { res } = createResponseMock();

      await expect(service.generatePDF(companyId, saleId, res)).rejects.toThrow(
        NotFoundException,
      );

      expect(PDFDocument).not.toHaveBeenCalled();
    });

    it('genera el PDF usando los datos de la empresa y no un nombre hardcodeado', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(pdfSale);

      const { res, setHeader } = createResponseMock();

      await service.generatePDF(companyId, saleId, res);

      expect(prismaMock.sale.findFirst).toHaveBeenCalledWith({
        where: {
          id: saleId,
          companyId,
        },
        include: {
          company: true,
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      const texts = getRenderedTexts();

      expect(texts).toContain('Zaping Medical');

      expect(texts).not.toContain('INSAP');

      expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');

      expect(setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=venta-V-001.pdf',
      );

      expect(mockPdfDocumentInstance.pipe).toHaveBeenCalledWith(res);

      expect(mockPdfDocumentInstance.end).toHaveBeenCalledTimes(1);
    });

    it('usa el nombre legal cuando no existe nombre comercial', async () => {
      prismaMock.sale.findFirst.mockResolvedValue({
        ...pdfSale,

        company: {
          ...pdfSale.company,
          tradeName: '   ',
        },
      });

      const { res } = createResponseMock();

      await service.generatePDF(companyId, saleId, res);

      expect(getRenderedTexts()).toContain('Empresa Legal');
    });

    it('omite los datos opcionales del cliente cuando no existen', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(pdfSale);

      const { res } = createResponseMock();

      await service.generatePDF(companyId, saleId, res);

      const texts = getRenderedTexts();

      expect(texts.some((text) => text.startsWith('Contacto:'))).toBe(false);

      expect(texts.some((text) => text.startsWith('Email:'))).toBe(false);

      expect(texts.some((text) => text.startsWith('Teléfono:'))).toBe(false);
    });

    it('formatea los importes usando la moneda de la empresa', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(pdfSale);

      const { res } = createResponseMock();

      await service.generatePDF(companyId, saleId, res);

      const formatMoney = (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(value);

      const texts = getRenderedTexts();

      expect(texts).toContain(`Subtotal: ${formatMoney(200)}`);

      expect(texts).toContain(`IVA (16%): ${formatMoney(32)}`);

      expect(texts).toContain(`Total: ${formatMoney(232)}`);
    });
  });

  describe('cancel', () => {
    it('rechaza una venta inexistente o de otra empresa', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(null);

      await expect(service.cancel(companyId, saleId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.sale.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza una venta confirmada', async () => {
      prismaMock.sale.findFirst.mockResolvedValue({
        ...draftSale,
        status: 'CONFIRMED',
      });

      await expect(service.cancel(companyId, saleId)).rejects.toThrow(
        new BadRequestException('No se puede cancelar una venta aprobada'),
      );

      expect(prismaMock.sale.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza una venta ya cancelada', async () => {
      prismaMock.sale.findFirst.mockResolvedValue({
        ...draftSale,
        status: 'CANCELLED',
      });

      await expect(service.cancel(companyId, saleId)).rejects.toThrow(
        new BadRequestException('La venta ya está cancelada'),
      );

      expect(prismaMock.sale.updateMany).not.toHaveBeenCalled();
    });

    it('cancela únicamente una venta en borrador', async () => {
      const cancelledSale = {
        ...draftSale,
        status: 'CANCELLED',
      };

      prismaMock.sale.findFirst
        .mockResolvedValueOnce(draftSale)
        .mockResolvedValueOnce(cancelledSale);

      prismaMock.sale.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.cancel(companyId, saleId);

      expect(prismaMock.sale.updateMany).toHaveBeenCalledWith({
        where: {
          id: saleId,
          companyId,
          status: 'DRAFT',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      expect(result).toEqual(cancelledSale);
    });

    it('bloquea una cancelación concurrente', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      prismaMock.sale.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.cancel(companyId, saleId)).rejects.toThrow(
        new BadRequestException(
          'La venta ya fue aprobada, cancelada o ya no puede cancelarse',
        ),
      );

      expect(prismaMock.sale.update).not.toHaveBeenCalled();
    });
  });

  describe('createFromQuote', () => {
    it('convierte una cotización confirmada en una venta confirmada y descuenta inventario', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        companyId,
        customerId,
        quoteId,
        folio: 'V-000001',
        subtotal: 200,
        iva: 32,
        total: 232,
        status: 'CONFIRMED',
      });

      transactionMock.product.findFirst.mockResolvedValueOnce({
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
        folio: 'V-000001',
        subtotal: 200,
        iva: 32,
        total: 232,
        status: 'CONFIRMED',
        quote,
      };

      transactionMock.sale.findFirst.mockResolvedValue(convertedSale);

      const result = await service.createFromQuote(companyId, quoteId);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(
        salesFolioServiceMock.allocateNextAvailableFolio,
      ).toHaveBeenCalledWith(transactionMock, companyId);
      expect(
        salesFolioServiceMock.allocateNextAvailableFolio.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        transactionMock.quote.updateMany.mock.invocationCallOrder[0],
      );

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
          folio: 'V-000001',
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
          notes: 'Venta V-000001 generada desde cotización COT-001',
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

    it('no crea venta ni marca la cotización si falla la asignación de folio', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      salesFolioServiceMock.allocateNextAvailableFolio.mockRejectedValue(
        new Error('sequence unavailable'),
      );

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        'sequence unavailable',
      );

      expect(
        salesFolioServiceMock.allocateNextAvailableFolio,
      ).toHaveBeenCalledWith(transactionMock, companyId);
      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.sale.create).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza un producto inexistente, inactivo o de otra empresa', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.product.findMany.mockResolvedValue([]);

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.sale.create).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza convertir una cotización con producto no QUANTITY', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock({
          inventoryTracking: ProductInventoryTracking.ASSET,
        }),
      ]);

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException(incompatibleTrackingMessage),
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.sale.create).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza convertir una cotización con producto que requiere lote', async () => {
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock({
          lotTracking: ProductLotTracking.REQUIRED,
        }),
      ]);

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException(requiredLotMessage),
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.sale.create).not.toHaveBeenCalled();
      expect(transactionMock.product.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rechaza convertir una cotización mixta si una partida es incompatible', async () => {
      transactionMock.quote.findFirst.mockResolvedValue({
        ...quote,
        items: [
          ...quote.items,
          {
            id: 'quote-item-2',
            productId: secondProductId,
            quantity: 1,
            price: 50,
            subtotal: 50,
          },
        ],
      });

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock(),
        createProductMock({
          id: secondProductId,
          name: 'Producto médico',
          inventoryTracking: ProductInventoryTracking.SERIALIZED,
        }),
      ]);

      await expect(service.createFromQuote(companyId, quoteId)).rejects.toThrow(
        new BadRequestException(incompatibleTrackingMessage),
      );

      expect(transactionMock.quote.updateMany).not.toHaveBeenCalled();
      expect(transactionMock.sale.create).not.toHaveBeenCalled();
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
        folio: 'V-000001',
      });

      transactionMock.product.findFirst.mockResolvedValueOnce({
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
      transactionMock.quote.findFirst.mockResolvedValue(quote);

      transactionMock.quote.updateMany.mockResolvedValue({
        count: 1,
      });

      transactionMock.sale.create.mockResolvedValue({
        id: saleId,
        folio: 'V-000001',
      });

      transactionMock.product.findMany.mockResolvedValue([
        createProductMock({
          cost: 55.75,
        }),
      ]);

      transactionMock.product.findFirst.mockResolvedValueOnce({
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
        folio: 'V-000001',
      });

      transactionMock.product.findFirst.mockResolvedValueOnce({
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
