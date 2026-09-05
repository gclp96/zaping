import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import type { CreateSaleDto } from './dto/create-sale.dto';

import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

const companyId = '11111111-1111-4111-8111-111111111111';

const userId = '22222222-2222-4222-8222-222222222222';

const customerId = '33333333-3333-4333-8333-333333333333';

const productId = '44444444-4444-4444-8444-444444444444';

const saleId = '55555555-5555-4555-8555-555555555555';

const quoteId = '66666666-6666-4666-8666-666666666666';

const request = {
  user: {
    id: userId,
    companyId,
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

const createSaleDto: CreateSaleDto = {
  customerId,
  items: [
    {
      productId,
      quantity: 2,
      price: 150,
    },
  ],
};

const salesServiceMock = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  generatePDF: jest.fn(),
  createFromQuote: jest.fn(),
  cancel: jest.fn(),
};

describe('SalesController', () => {
  let controller: SalesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        {
          provide: SalesService,
          useValue: salesServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<SalesController>(SalesController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('protege el controlador con JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      SalesController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('crea una venta usando el companyId autenticado', async () => {
    const createdSale = {
      id: saleId,
      companyId,
      status: 'DRAFT',
    };

    salesServiceMock.create.mockResolvedValue(createdSale);

    const result = await controller.create(
      request as Parameters<SalesController['create']>[0],
      createSaleDto,
    );

    expect(salesServiceMock.create).toHaveBeenCalledWith(
      companyId,
      createSaleDto,
    );

    expect(result).toEqual(createdSale);
  });

  it('consulta las ventas de la empresa autenticada', async () => {
    const sales = [
      {
        id: saleId,
        companyId,
      },
    ];

    salesServiceMock.findAll.mockResolvedValue(sales);

    const result = await controller.findAll(
      request as Parameters<SalesController['findAll']>[0],
    );

    expect(salesServiceMock.findAll).toHaveBeenCalledWith(companyId);

    expect(result).toEqual(sales);
  });

  it('consulta el detalle de una venta usando el companyId autenticado', async () => {
    const sale = {
      id: saleId,
      companyId,
      customer: {
        id: customerId,
      },
      items: [
        {
          id: 'sale-item-1',
          product: {
            id: productId,
          },
        },
      ],
    };

    salesServiceMock.findOne.mockResolvedValue(sale);

    const result = await controller.findOne(
      request as Parameters<SalesController['findOne']>[0],
      saleId,
    );

    expect(salesServiceMock.findOne).toHaveBeenCalledWith(companyId, saleId);

    expect(result).toEqual(sale);
  });

  it('propaga errores del servicio al consultar el detalle', async () => {
    const error = new NotFoundException('Venta no encontrada');

    salesServiceMock.findOne.mockRejectedValue(error);

    await expect(
      controller.findOne(
        request as Parameters<SalesController['findOne']>[0],
        saleId,
      ),
    ).rejects.toBe(error);
  });

  it('valida el id del detalle con ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      SalesController,
      'findOne',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;

    const idParam = Object.values(metadata).find(
      (value) => value.data === 'id',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });

  it('aprueba una venta usando el companyId autenticado', async () => {
    const confirmedSale = {
      id: saleId,
      status: 'CONFIRMED',
    };

    salesServiceMock.approve.mockResolvedValue(confirmedSale);

    const result = await controller.approve(
      request as Parameters<SalesController['approve']>[0],
      saleId,
    );

    expect(salesServiceMock.approve).toHaveBeenCalledWith(companyId, saleId);

    expect(result).toEqual(confirmedSale);
  });

  it('genera el PDF usando el companyId autenticado', async () => {
    const response = {} as Response;

    salesServiceMock.generatePDF.mockResolvedValue(undefined);

    await controller.getPdf(
      request as Parameters<SalesController['getPdf']>[0],
      saleId,
      response,
    );

    expect(salesServiceMock.generatePDF).toHaveBeenCalledWith(
      companyId,
      saleId,
      response,
    );
  });

  it('convierte una cotización usando el companyId autenticado', async () => {
    const convertedSale = {
      id: saleId,
      quoteId,
      status: 'CONFIRMED',
    };

    salesServiceMock.createFromQuote.mockResolvedValue(convertedSale);

    const result = await controller.createFromQuote(
      request as Parameters<SalesController['createFromQuote']>[0],
      quoteId,
    );

    expect(salesServiceMock.createFromQuote).toHaveBeenCalledWith(
      companyId,
      quoteId,
    );

    expect(result).toEqual(convertedSale);
  });

  it('cancela una venta usando el companyId autenticado', async () => {
    const cancelledSale = {
      id: saleId,
      status: 'CANCELLED',
    };

    salesServiceMock.cancel.mockResolvedValue(cancelledSale);

    const result = await controller.cancel(
      request as Parameters<SalesController['cancel']>[0],
      saleId,
    );

    expect(salesServiceMock.cancel).toHaveBeenCalledWith(companyId, saleId);

    expect(result).toEqual(cancelledSale);
  });
});
