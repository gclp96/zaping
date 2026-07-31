import { BadRequestException, NotFoundException } from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import { DocumentStatus } from '@prisma/client';

import type { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateQuoteDto } from './dto/create-quote.dto';

import { QuotesService } from './quotes.service';

const companyId = '11111111-1111-4111-8111-111111111111';

const customerId = '22222222-2222-4222-8222-222222222222';

const firstProductId = '33333333-3333-4333-8333-333333333333';

const secondProductId = '44444444-4444-4444-8444-444444444444';

const quoteId = '55555555-5555-4555-8555-555555555555';

const createQuoteDto: CreateQuoteDto = {
  customerId,
  items: [
    {
      productId: firstProductId,
      quantity: 2,
      price: 10.5,
    },
    {
      productId: secondProductId,
      quantity: 1,
      price: 20,
    },
  ],
};

const prismaMock = {
  quote: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
};

describe('QuotesService', () => {
  let service: QuotesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<QuotesService>(QuotesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea una cotización con sus importes calculados', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);
      const createdQuote = {
        id: quoteId,
        companyId,
        customerId,
        folio: 'COT-123456',
        subtotal: 41,
        iva: 6.56,
        total: 47.56,
        status: DocumentStatus.DRAFT,
        items: [],
      };

      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
      });

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: firstProductId,
        },
        {
          id: secondProductId,
        },
      ]);

      prismaMock.quote.create.mockResolvedValue(createdQuote);

      const result = await service.create(companyId, createQuoteDto);

      expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
        where: {
          id: customerId,
          companyId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: {
          companyId,
          isActive: true,
          id: {
            in: [firstProductId, secondProductId],
          },
        },
        select: {
          id: true,
        },
      });

      expect(prismaMock.quote.create).toHaveBeenCalledWith({
        data: {
          companyId,
          customerId,
          folio: 'COT-1234567890',
          subtotal: 41,
          iva: 6.56,
          total: 47.56,
          items: {
            create: [
              {
                productId: firstProductId,
                quantity: 2,
                price: 10.5,
                subtotal: 21,
              },
              {
                productId: secondProductId,
                quantity: 1,
                price: 20,
                subtotal: 20,
              },
            ],
          },
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

      expect(result).toEqual(createdQuote);
    });

    it('rechaza un cliente inexistente, inactivo o de otra empresa', async () => {
      prismaMock.customer.findFirst.mockResolvedValue(null);

      await expect(service.create(companyId, createQuoteDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.product.findMany).not.toHaveBeenCalled();

      expect(prismaMock.quote.create).not.toHaveBeenCalled();
    });

    it('rechaza productos repetidos', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
      });

      const duplicatedProductDto: CreateQuoteDto = {
        customerId,
        items: [
          {
            productId: firstProductId,
            quantity: 1,
            price: 100,
          },
          {
            productId: firstProductId,
            quantity: 2,
            price: 100,
          },
        ],
      };

      await expect(
        service.create(companyId, duplicatedProductDto),
      ).rejects.toThrow(
        new BadRequestException(
          'No se puede repetir un producto dentro de la cotización',
        ),
      );

      expect(prismaMock.product.findMany).not.toHaveBeenCalled();

      expect(prismaMock.quote.create).not.toHaveBeenCalled();
    });

    it('rechaza productos inexistentes, inactivos o de otra empresa', async () => {
      prismaMock.customer.findFirst.mockResolvedValue({
        id: customerId,
      });

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: firstProductId,
        },
      ]);

      await expect(service.create(companyId, createQuoteDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.quote.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('consulta únicamente las cotizaciones de la empresa', async () => {
      const quotes = [
        {
          id: quoteId,
          companyId,
          folio: 'COT-123456',
        },
      ];

      prismaMock.quote.findMany.mockResolvedValue(quotes);

      const result = await service.findAll(companyId);

      expect(prismaMock.quote.findMany).toHaveBeenCalledWith({
        where: {
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
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toEqual(quotes);
    });
  });

  describe('approve', () => {
    it('cambia una cotización en borrador a confirmada', async () => {
      prismaMock.quote.findFirst.mockResolvedValue({
        id: quoteId,
        status: DocumentStatus.DRAFT,
      });

      const confirmedQuote = {
        id: quoteId,
        status: DocumentStatus.CONFIRMED,
      };

      prismaMock.quote.update.mockResolvedValue(confirmedQuote);

      const result = await service.approve(companyId, quoteId);

      expect(prismaMock.quote.findFirst).toHaveBeenCalledWith({
        where: {
          id: quoteId,
          companyId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      expect(prismaMock.quote.update).toHaveBeenCalledWith({
        where: {
          id: quoteId,
        },
        data: {
          status: DocumentStatus.CONFIRMED,
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

      expect(result).toEqual(confirmedQuote);
    });

    it('rechaza una cotización inexistente', async () => {
      prismaMock.quote.findFirst.mockResolvedValue(null);

      await expect(service.approve(companyId, quoteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.quote.update).not.toHaveBeenCalled();
    });

    it.each([DocumentStatus.CONFIRMED, DocumentStatus.CANCELLED])(
      'rechaza aprobar una cotización con estado %s',
      async (status) => {
        prismaMock.quote.findFirst.mockResolvedValue({
          id: quoteId,
          status,
        });

        await expect(service.approve(companyId, quoteId)).rejects.toThrow(
          BadRequestException,
        );

        expect(prismaMock.quote.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('cancel', () => {
    it('cambia una cotización en borrador a cancelada', async () => {
      prismaMock.quote.findFirst.mockResolvedValue({
        id: quoteId,
        status: DocumentStatus.DRAFT,
      });

      const cancelledQuote = {
        id: quoteId,
        status: DocumentStatus.CANCELLED,
      };

      prismaMock.quote.update.mockResolvedValue(cancelledQuote);

      const result = await service.cancel(companyId, quoteId);

      expect(prismaMock.quote.findFirst).toHaveBeenCalledWith({
        where: {
          id: quoteId,
          companyId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      expect(prismaMock.quote.update).toHaveBeenCalledWith({
        where: {
          id: quoteId,
        },
        data: {
          status: DocumentStatus.CANCELLED,
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

      expect(result).toEqual(cancelledQuote);
    });

    it('rechaza una cotización inexistente', async () => {
      prismaMock.quote.findFirst.mockResolvedValue(null);

      await expect(service.cancel(companyId, quoteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.quote.update).not.toHaveBeenCalled();
    });

    it.each([DocumentStatus.CONFIRMED, DocumentStatus.CANCELLED])(
      'rechaza cancelar una cotización con estado %s',
      async (status) => {
        prismaMock.quote.findFirst.mockResolvedValue({
          id: quoteId,
          status,
        });

        await expect(service.cancel(companyId, quoteId)).rejects.toThrow(
          BadRequestException,
        );

        expect(prismaMock.quote.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('generatePDF', () => {
    it('rechaza la descarga cuando la cotización no pertenece a la empresa', async () => {
      prismaMock.quote.findFirst.mockResolvedValue(null);

      const response = {} as Response;

      await expect(
        service.generatePDF(companyId, quoteId, response),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.quote.findFirst).toHaveBeenCalledWith({
        where: {
          id: quoteId,
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
    });
  });
});
