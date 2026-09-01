import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: {
    changePassword: jest.Mock;
    getAuthenticatedUserContext: jest.Mock;
  };

  const authenticatedUser = {
    id: 'user-1',
    companyId: 'company-1',
    email: 'admin@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    authServiceMock = {
      changePassword: jest.fn(),
      getAuthenticatedUserContext: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const getMethodMetadata = (
    methodName: keyof Pick<AuthController, 'me' | 'changePassword'>,
  ): object => {
    const descriptor = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      methodName,
    );

    if (!descriptor?.value) {
      throw new Error(`Missing ${methodName} handler`);
    }

    return descriptor.value as object;
  };

  it('uses the auth controller path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');
  });

  it('protects change-password with JwtAuthGuard only', () => {
    const handler = getMethodMetadata('changePassword');

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      JwtAuthGuard,
    ]);
    expect(Reflect.getMetadata('roles', handler)).toBeUndefined();
  });

  it('exposes POST /auth/change-password', () => {
    const handler = getMethodMetadata('changePassword');

    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('change-password');
  });

  it('returns the authenticated context from /auth/me with companyTimezone', async () => {
    const response = {
      ...authenticatedUser,
      companyTimezone: 'America/Mazatlan',
    };
    authServiceMock.getAuthenticatedUserContext.mockResolvedValue(response);

    await expect(
      controller.me({
        user: authenticatedUser,
      } as never),
    ).resolves.toEqual(response);

    expect(authServiceMock.getAuthenticatedUserContext).toHaveBeenCalledWith(
      authenticatedUser,
    );
  });

  it('does not accept a client-controlled companyId for /auth/me', async () => {
    authServiceMock.getAuthenticatedUserContext.mockResolvedValue({
      ...authenticatedUser,
      companyTimezone: 'America/Hermosillo',
    });

    await controller.me({
      user: authenticatedUser,
      query: {
        companyId: 'company-other',
      },
      body: {
        companyId: 'company-other',
      },
    } as never);

    expect(authServiceMock.getAuthenticatedUserContext).toHaveBeenCalledWith(
      authenticatedUser,
    );
    expect(
      authServiceMock.getAuthenticatedUserContext,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-other',
      }),
    );
  });

  it('changes password using authenticated user context and body passwords only', async () => {
    const response = {
      success: true,
      message: 'Contraseña actualizada',
    };
    const dto = {
      currentPassword: 'current-password',
      newPassword: 'new-secure-password',
      userId: 'attacker-user',
      companyId: 'attacker-company',
      email: 'attacker@example.com',
    };

    authServiceMock.changePassword.mockResolvedValue(response);

    await expect(
      controller.changePassword(
        {
          user: authenticatedUser,
        } as never,
        dto as never,
      ),
    ).resolves.toEqual(response);

    expect(authServiceMock.changePassword).toHaveBeenCalledWith(
      authenticatedUser,
      dto,
    );
    expect(authServiceMock.changePassword).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'attacker-user',
        companyId: 'attacker-company',
      }),
      expect.anything(),
    );
  });
});
