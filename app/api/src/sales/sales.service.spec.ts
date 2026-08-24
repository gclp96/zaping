import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

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
    update: jest.fn(),
    updateMany: jest.fn(),
  },

  product: {
    findFirst: jest.fn(),
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
  },

  sale: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    jest.clearAllMocks();

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

      expect(prismaMock.sale.create).not.toHaveBeenCalled();
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

      expect(prismaMock.sale.create).not.toHaveBeenCalled();
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

      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();

      expect(prismaMock.sale.create).not.toHaveBeenCalled();
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

      expect(prismaMock.sale.create).not.toHaveBeenCalled();
    });

    it('rechaza un producto inexistente, inactivo o de otra empresa', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findFirst.mockResolvedValue(null);

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

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: {
          id: productId,
          companyId,
          isActive: true,
        },
      });

      expect(prismaMock.sale.create).not.toHaveBeenCalled();
    });

    it('crea una venta manual en borrador usando el precio vigente del producto', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findFirst.mockResolvedValue({
        id: productId,
        companyId,
        name: 'Producto médico',
        price: 100,
        isActive: true,
      });

      const createdSale = {
        id: saleId,
        companyId,
        customerId,
        folio: 'V-1700000000000',
        subtotal: 200,
        iva: 32,
        total: 232,
        status: 'DRAFT',
      };

      prismaMock.sale.create.mockResolvedValue(createdSale);

      const result = await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      });

      expect(prismaMock.sale.create).toHaveBeenCalledWith({
        data: {
          companyId,
          customerId,
          folio: 'V-1700000000000',
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

      expect(result).toEqual(createdSale);
    });

    it('redondea los importes monetarios a dos decimales', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
        companyId,
        isActive: true,
      });

      prismaMock.product.findFirst.mockResolvedValue({
        id: productId,
        companyId,
        name: 'Producto médico',
        price: 33.335,
        isActive: true,
      });

      prismaMock.sale.create.mockResolvedValue({
        id: saleId,
      });

      await service.create(companyId, {
        customerId,
        items: [
          {
            productId,
            quantity: 3,
          },
        ],
      });

      expect(prismaMock.sale.create).toHaveBeenCalledWith(
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

    it('rechaza la aprobación cuando no existe stock suficiente', async () => {
      prismaMock.sale.findFirst.mockResolvedValue(draftSale);

      transactionMock.sale.updateMany.mockResolvedValue({
        count: 1,
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
