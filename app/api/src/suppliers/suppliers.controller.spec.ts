import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

describe('SuppliersController RBAC', () => {
  const companyId = '33333333-3333-4333-8333-333333333333';
  const supplierId = '77777777-7777-4777-8777-777777777777';

  let app: INestApplication<App>;
  let currentRole: UserRole;

  const suppliersServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const authenticationGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const httpRequest = context.switchToHttp().getRequest<{
        user: { companyId: string; role: UserRole };
      }>();
      httpRequest.user = {
        companyId,
        role: currentRole,
      };
      return true;
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    currentRole = UserRole.ADMIN;
    suppliersServiceMock.findAll.mockResolvedValue([]);
    suppliersServiceMock.findOne.mockResolvedValue({ id: supplierId });
    suppliersServiceMock.create.mockResolvedValue({ id: supplierId });
    suppliersServiceMock.update.mockResolvedValue({ id: supplierId });
    suppliersServiceMock.remove.mockResolvedValue({ id: supplierId });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [
        RolesGuard,
        {
          provide: SuppliersService,
          useValue: suppliersServiceMock,
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

  it.each([UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE])(
    'allows %s to create a supplier',
    async (role) => {
      currentRole = role;
      const body = { name: 'Proveedor QA' };

      await request(app.getHttpServer())
        .post('/suppliers')
        .send(body)
        .expect(201);

      expect(suppliersServiceMock.create).toHaveBeenCalledWith(companyId, body);
    },
  );

  it('returns 403 when SALES attempts to create a supplier', async () => {
    currentRole = UserRole.SALES;

    await request(app.getHttpServer())
      .post('/suppliers')
      .send({ name: 'Proveedor QA' })
      .expect(403);

    expect(suppliersServiceMock.create).not.toHaveBeenCalled();
  });

  it('allows WAREHOUSE to update a supplier', async () => {
    currentRole = UserRole.WAREHOUSE;
    const body = { name: 'Proveedor actualizado' };

    await request(app.getHttpServer())
      .patch(`/suppliers/${supplierId}`)
      .send(body)
      .expect(200);

    expect(suppliersServiceMock.update).toHaveBeenCalledWith(
      companyId,
      supplierId,
      body,
    );
  });

  it('returns 403 when SALES attempts to update a supplier', async () => {
    currentRole = UserRole.SALES;

    await request(app.getHttpServer())
      .patch(`/suppliers/${supplierId}`)
      .send({ name: 'Proveedor actualizado' })
      .expect(403);

    expect(suppliersServiceMock.update).not.toHaveBeenCalled();
  });

  it('allows WAREHOUSE to deactivate a supplier', async () => {
    currentRole = UserRole.WAREHOUSE;

    await request(app.getHttpServer())
      .delete(`/suppliers/${supplierId}`)
      .expect(200);

    expect(suppliersServiceMock.remove).toHaveBeenCalledWith(
      companyId,
      supplierId,
    );
  });

  it('returns 403 when SALES attempts to deactivate a supplier', async () => {
    currentRole = UserRole.SALES;

    await request(app.getHttpServer())
      .delete(`/suppliers/${supplierId}`)
      .expect(403);

    expect(suppliersServiceMock.remove).not.toHaveBeenCalled();
  });
});
