import { UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { PurchaseReceiptsController } from './purchases-receipts.controller';
import { PurchaseReceiptsService } from './purchases-receipts.service';

type PurchaseReceiptsServiceMock = {
  create: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  findByPurchase: jest.Mock;
};

describe('PurchaseReceiptsController', () => {
  const idempotencyKey = 'receipt-request-key';
  let controller: PurchaseReceiptsController;
  let purchaseReceiptsService: PurchaseReceiptsServiceMock;
  let request: AuthenticatedRequest;

  beforeEach(async () => {
    purchaseReceiptsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPurchase: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseReceiptsController],
      providers: [
        {
          provide: PurchaseReceiptsService,
          useValue: purchaseReceiptsService,
        },
      ],
    }).compile();

    controller = moduleRef.get<PurchaseReceiptsController>(
      PurchaseReceiptsController,
    );

    request = {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        companyId: '22222222-2222-4222-8222-222222222222',
        email: 'usuario.prueba@zaping.test',
        firstName: 'Usuario',
        lastName: 'Prueba',
        role: UserRole.ADMIN,
      },
    } as AuthenticatedRequest;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('debe crear una recepción usando la empresa y el usuario autenticados', async () => {
    const dto: CreatePurchaseReceiptDto = {
      purchaseId: '33333333-3333-4333-8333-333333333333',
      notes: 'Recepción de prueba',
      items: [
        {
          purchaseItemId: '44444444-4444-4444-8444-444444444444',
          quantityReceived: 4,
          lotNumber: 'LOTE-PRUEBA-001',
          expirationDate: '2028-12-31',
        },
      ],
    };

    const expectedResult = {
      id: '55555555-5555-4555-8555-555555555555',
    };

    purchaseReceiptsService.create.mockResolvedValue(expectedResult);

    const result = await controller.create(request, idempotencyKey, dto);

    expect(purchaseReceiptsService.create).toHaveBeenCalledWith(
      request.user.companyId,
      request.user.id,
      idempotencyKey,
      dto,
    );

    expect(result).toEqual(expectedResult);
  });

  it.each([undefined, '', '   ', 'x'.repeat(129)])(
    'rechaza una clave Idempotency-Key inválida: %p',
    (invalidKey) => {
      const dto = {
        purchaseId: '33333333-3333-4333-8333-333333333333',
        items: [
          {
            purchaseItemId: '44444444-4444-4444-8444-444444444444',
            quantityReceived: 1,
          },
        ],
      };

      let error: unknown;

      try {
        void controller.create(request, invalidKey, dto);
      } catch (caughtError: unknown) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toMatchObject({
        message: 'Se requiere una clave Idempotency-Key válida',
        status: 400,
      });
      expect(purchaseReceiptsService.create).not.toHaveBeenCalled();
    },
  );

  it('recorta la clave Idempotency-Key antes de enviarla al servicio', async () => {
    const dto = {
      purchaseId: '33333333-3333-4333-8333-333333333333',
      items: [
        {
          purchaseItemId: '44444444-4444-4444-8444-444444444444',
          quantityReceived: 1,
        },
      ],
    };

    await controller.create(request, `  ${idempotencyKey}  `, dto);

    expect(purchaseReceiptsService.create).toHaveBeenCalledWith(
      request.user.companyId,
      request.user.id,
      idempotencyKey,
      dto,
    );
  });

  it('debe listar las recepciones de la empresa autenticada', async () => {
    const expectedResult = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        folio: 'REC-PRUEBA-001',
      },
    ];

    purchaseReceiptsService.findAll.mockResolvedValue(expectedResult);

    const result = await controller.findAll(request);

    expect(purchaseReceiptsService.findAll).toHaveBeenCalledWith(
      request.user.companyId,
    );

    expect(result).toEqual(expectedResult);
  });

  it('debe consultar una recepción por id y empresa', async () => {
    const receiptId = '55555555-5555-4555-8555-555555555555';

    const expectedResult = {
      id: receiptId,
      folio: 'REC-PRUEBA-001',
    };

    purchaseReceiptsService.findOne.mockResolvedValue(expectedResult);

    const result = await controller.findOne(request, receiptId);

    expect(purchaseReceiptsService.findOne).toHaveBeenCalledWith(
      request.user.companyId,
      receiptId,
    );

    expect(result).toEqual(expectedResult);
  });

  it('debe listar las recepciones asociadas a una compra', async () => {
    const purchaseId = '33333333-3333-4333-8333-333333333333';

    const expectedResult = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        purchaseId,
      },
    ];

    purchaseReceiptsService.findByPurchase.mockResolvedValue(expectedResult);

    const result = await controller.findByPurchase(request, purchaseId);

    expect(purchaseReceiptsService.findByPurchase).toHaveBeenCalledWith(
      request.user.companyId,
      purchaseId,
    );

    expect(result).toEqual(expectedResult);
  });
});
