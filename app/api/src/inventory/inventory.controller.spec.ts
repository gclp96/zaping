import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryMovementType, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController RBAC', () => {
  const companyId = '33333333-3333-4333-8333-333333333333';
  const productId = '55555555-5555-4555-8555-555555555555';

  let app: INestApplication<App>;
  let currentRole: UserRole;

  const inventoryServiceMock = {
    findInventory: jest.fn(),
    findMovements: jest.fn(),
    createMovement: jest.fn(),
  };

  const authenticationGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = {
        companyId,
        role: currentRole,
      };
      return true;
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    currentRole = UserRole.ADMIN;
    inventoryServiceMock.findInventory.mockResolvedValue([]);
    inventoryServiceMock.findMovements.mockResolvedValue([]);
    inventoryServiceMock.createMovement.mockResolvedValue({ id: 'movement-1' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        RolesGuard,
        {
          provide: InventoryService,
          useValue: inventoryServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticationGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps Inventory stock available to SALES', async () => {
    currentRole = UserRole.SALES;

    await request(app.getHttpServer()).get('/inventory').expect(200);

    expect(inventoryServiceMock.findInventory).toHaveBeenCalledWith(companyId);
  });

  it('returns 403 when SALES requests Inventory movements', async () => {
    currentRole = UserRole.SALES;

    await request(app.getHttpServer()).get('/inventory/movements').expect(403);

    expect(inventoryServiceMock.findMovements).not.toHaveBeenCalled();
  });

  it.each([UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE])(
    'allows %s to request Inventory movements',
    async (role) => {
      currentRole = role;

      await request(app.getHttpServer()).get('/inventory/movements').expect(200);

      expect(inventoryServiceMock.findMovements).toHaveBeenCalledWith(companyId);
    },
  );

  it('returns 403 when SALES attempts an Inventory movement mutation', async () => {
    currentRole = UserRole.SALES;

    await request(app.getHttpServer())
      .post('/inventory/movements')
      .send({
        productId,
        movementType: InventoryMovementType.ADJUSTMENT,
        quantity: 3,
      })
      .expect(403);

    expect(inventoryServiceMock.createMovement).not.toHaveBeenCalled();
  });
});
