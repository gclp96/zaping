import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from './roles.guards';

describe('RolesGuard', () => {
  let reflectorMock: {
    getAllAndOverride: jest.Mock;
  };
  let guard: RolesGuard;

  const buildContext = (role?: UserRole) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: role
            ? {
                id: 'user-1',
                companyId: 'company-1',
                email: 'user@zaping.test',
                firstName: 'User',
                lastName: 'Zaping',
                role,
              }
            : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflectorMock as unknown as Reflector);
  });

  it('allows requests when no role metadata is required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext(UserRole.SALES))).toBe(true);
  });

  it('allows ADMIN through ADMIN-only metadata', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(buildContext(UserRole.ADMIN))).toBe(true);
  });

  it('rejects non-ADMIN users from ADMIN-only metadata', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(buildContext(UserRole.SALES))).toBe(false);
  });

  it('rejects requests without an authenticated user when roles are required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(buildContext())).toBe(false);
  });
});
