import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guards';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const companyId = 'company-1';
  const currentUserId = 'admin-1';
  const userId = 'user-1';

  const usersServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const request = {
    user: {
      id: currentUserId,
      companyId,
      email: 'admin@zaping.test',
      firstName: 'Admin',
      lastName: 'Zaping',
      role: UserRole.ADMIN,
    },
  } as AuthenticatedRequest;

  const safeUser = {
    id: userId,
    companyId,
    email: 'user@zaping.test',
    firstName: 'User',
    lastName: 'Zaping',
    role: UserRole.SALES,
    isActive: true,
    createdAt: new Date('2026-08-30T10:00:00.000Z'),
    updatedAt: new Date('2026-08-30T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<UsersController>(UsersController);
  });

  const getMethodMetadata = (
    methodName: keyof Pick<
      UsersController,
      'create' | 'findAll' | 'findOne' | 'update'
    >,
  ): object => {
    const descriptor = Object.getOwnPropertyDescriptor(
      UsersController.prototype,
      methodName,
    );

    if (!descriptor?.value) {
      throw new Error(`Missing ${methodName} handler`);
    }

    return descriptor.value as object;
  };

  it('uses the users controller path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, UsersController)).toBe('users');
  });

  it('protects the controller with JwtAuthGuard, RolesGuard, and ADMIN role', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      UsersController,
    ) as unknown[];

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata('roles', UsersController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('exposes only list, read, create, and update routes', () => {
    const routes = ['create', 'findAll', 'findOne', 'update'].map((method) => {
      const handler = getMethodMetadata(method as never);
      const httpMethod = Reflect.getMetadata(
        METHOD_METADATA,
        handler,
      ) as RequestMethod;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;

      return {
        method: httpMethod,
        path,
      };
    });

    expect(routes).toEqual([
      { method: RequestMethod.POST, path: '/' },
      { method: RequestMethod.GET, path: '/' },
      { method: RequestMethod.GET, path: ':id' },
      { method: RequestMethod.PATCH, path: ':id' },
    ]);
    expect(
      (controller as unknown as { remove?: unknown }).remove,
    ).toBeUndefined();
  });

  it('creates users using the authenticated companyId', async () => {
    usersServiceMock.create.mockResolvedValue(safeUser);

    const dto = {
      firstName: 'User',
      lastName: 'Zaping',
      email: 'user@zaping.test',
      password: 'secure-password',
      role: UserRole.SALES,
    };

    await controller.create(request, dto);

    expect(usersServiceMock.create).toHaveBeenCalledWith(companyId, dto);
  });

  it('lists users using the authenticated companyId', async () => {
    usersServiceMock.findAll.mockResolvedValue([safeUser]);

    await controller.findAll(request);

    expect(usersServiceMock.findAll).toHaveBeenCalledWith(companyId);
  });

  it('reads one user using authenticated companyId and route id', async () => {
    usersServiceMock.findOne.mockResolvedValue(safeUser);

    await controller.findOne(request, userId);

    expect(usersServiceMock.findOne).toHaveBeenCalledWith(companyId, userId);
  });

  it('updates using authenticated companyId, current user id, and route id', async () => {
    usersServiceMock.update.mockResolvedValue(safeUser);

    await controller.update(request, userId, {
      firstName: 'Updated',
      isActive: false,
    });

    expect(usersServiceMock.update).toHaveBeenCalledWith(
      companyId,
      currentUserId,
      userId,
      {
        firstName: 'Updated',
        isActive: false,
      },
    );
  });
});
