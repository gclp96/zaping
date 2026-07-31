import { Test, TestingModule } from '@nestjs/testing';

import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

describe('PurchasesController', () => {
  let controller: PurchasesController;

  let purchasesServiceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    approve: jest.Mock;
    cancel: jest.Mock;
    findInventoryMovements: jest.Mock;
    generatePDF: jest.Mock;
  };

  beforeEach(async () => {
    purchasesServiceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      cancel: jest.fn(),
      findInventoryMovements: jest.fn(),
      generatePDF: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [
        {
          provide: PurchasesService,
          useValue: purchasesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<PurchasesController>(PurchasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
