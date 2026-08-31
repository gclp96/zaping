import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: {
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
});
