import { GUARDS_METADATA } from '@nestjs/common/constants';

import { Test, TestingModule } from '@nestjs/testing';

import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import type { CreateQuoteDto } from './dto/create-quote.dto';

import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

const companyId = '11111111-1111-4111-8111-111111111111';

const userId = '22222222-2222-4222-8222-222222222222';

const customerId = '33333333-3333-4333-8333-333333333333';

const productId = '44444444-4444-4444-8444-444444444444';

const quoteId = '55555555-5555-4555-8555-555555555555';

const request = {
  user: {
    id: userId,
    companyId,
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

const createQuoteDto: CreateQuoteDto = {
  customerId,
  items: [
    {
      productId,
      quantity: 2,
      price: 150,
    },
  ],
};

const quotesServiceMock = {
  create: jest.fn(),
  findAll: jest.fn(),
  generatePDF: jest.fn(),
  approve: jest.fn(),
  cancel: jest.fn(),
};

describe('QuotesController', () => {
  let controller: QuotesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        {
          provide: QuotesService,
          useValue: quotesServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<QuotesController>(QuotesController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('protege el controlador con JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      QuotesController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('crea una cotización usando el companyId autenticado', async () => {
    const createdQuote = {
      id: quoteId,
      companyId,
      ...createQuoteDto,
    };

    quotesServiceMock.create.mockResolvedValue(createdQuote);

    const result = await controller.create(
      request as Parameters<QuotesController['create']>[0],
      createQuoteDto,
    );

    expect(quotesServiceMock.create).toHaveBeenCalledWith(
      companyId,
      createQuoteDto,
    );

    expect(result).toEqual(createdQuote);
  });

  it('consulta las cotizaciones de la empresa autenticada', async () => {
    const quotes = [
      {
        id: quoteId,
        companyId,
        folio: 'COT-001',
      },
    ];

    quotesServiceMock.findAll.mockResolvedValue(quotes);

    const result = await controller.findAll(
      request as Parameters<QuotesController['findAll']>[0],
    );

    expect(quotesServiceMock.findAll).toHaveBeenCalledWith(companyId);

    expect(result).toEqual(quotes);
  });

  it('genera el PDF usando el companyId autenticado', async () => {
    const response = {} as Response;

    quotesServiceMock.generatePDF.mockResolvedValue(undefined);

    await controller.generatePdf(
      request as Parameters<QuotesController['generatePdf']>[0],
      quoteId,
      response,
    );

    expect(quotesServiceMock.generatePDF).toHaveBeenCalledWith(
      companyId,
      quoteId,
      response,
    );
  });

  it('aprueba una cotización usando el companyId autenticado', async () => {
    const confirmedQuote = {
      id: quoteId,
      status: 'CONFIRMED',
    };

    quotesServiceMock.approve.mockResolvedValue(confirmedQuote);

    const result = await controller.approve(
      request as Parameters<QuotesController['approve']>[0],
      quoteId,
    );

    expect(quotesServiceMock.approve).toHaveBeenCalledWith(companyId, quoteId);

    expect(result).toEqual(confirmedQuote);
  });

  it('cancela una cotización usando el companyId autenticado', async () => {
    const cancelledQuote = {
      id: quoteId,
      status: 'CANCELLED',
    };

    quotesServiceMock.cancel.mockResolvedValue(cancelledQuote);

    const result = await controller.cancel(
      request as Parameters<QuotesController['cancel']>[0],
      quoteId,
    );

    expect(quotesServiceMock.cancel).toHaveBeenCalledWith(companyId, quoteId);

    expect(result).toEqual(cancelledQuote);
  });
});
