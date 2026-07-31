import { Test, TestingModule } from '@nestjs/testing';

import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: InventoryService,
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
