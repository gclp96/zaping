import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaMock: {
    user: {
      findFirst: jest.Mock;
    };
  };

  const previousJwtSecret = process.env.JWT_SECRET;

  const payload = {
    sub: 'user-1',
    companyId: 'company-1',
    email: 'stale@example.com',
    role: UserRole.ADMIN,
    firstName: 'Stale',
    lastName: 'Token',
  };

  const dbUser = {
    id: 'user-1',
    companyId: 'company-1',
    email: 'current@example.com',
    firstName: 'Current',
    lastName: 'User',
    role: UserRole.MANAGER,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    prismaMock = {
      user: {
        findFirst: jest.fn(),
      },
    };
    strategy = new JwtStrategy(prismaMock as unknown as PrismaService);
  });

  afterAll(() => {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }

    process.env.JWT_SECRET = previousJwtSecret;
  });

  it('returns the current safe DB user for an active user in the token company', async () => {
    prismaMock.user.findFirst.mockResolvedValue(dbUser);

    await expect(strategy.validate(payload)).resolves.toEqual(dbUser);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  });

  it('rejects a missing user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user by requiring isActive in the lookup', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  });

  it('rejects a company mismatch by querying with the token companyId', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      strategy.validate({
        ...payload,
        companyId: 'company-other',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: payload.sub,
        companyId: 'company-other',
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  });

  it('uses the current DB role when the token role is stale', async () => {
    prismaMock.user.findFirst.mockResolvedValue(dbUser);

    const user = await strategy.validate({
      ...payload,
      role: UserRole.ADMIN,
    });

    expect(user.role).toBe(UserRole.MANAGER);
  });

  it('does not return passwordHash as part of request.user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(dbUser);

    const user = await strategy.validate(payload);

    expect(user).not.toHaveProperty('passwordHash');
  });
});
