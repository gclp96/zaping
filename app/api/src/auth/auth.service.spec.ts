import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: {
    company: {
      findUnique: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let jwtServiceMock: {
    sign: jest.Mock;
    signAsync: jest.Mock;
  };

  const authenticatedUser = {
    id: 'user-1',
    companyId: 'company-1',
    email: 'admin@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
  };

  const userRecord = {
    ...authenticatedUser,
    role: UserRole.ADMIN,
    passwordHash: 'hashed-password',
    locale: 'es',
    isActive: true,
  };

  beforeEach(async () => {
    prismaMock = {
      company: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    jwtServiceMock = {
      sign: jest.fn(),
      signAsync: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('adds companyTimezone from the authenticated user company', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      timezone: 'America/Mazatlan',
    });

    await expect(
      service.getAuthenticatedUserContext(authenticatedUser as never),
    ).resolves.toEqual({
      ...authenticatedUser,
      companyTimezone: 'America/Mazatlan',
    });

    expect(prismaMock.company.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'company-1',
      },
      select: {
        timezone: true,
      },
    });
  });

  it('returns non-default company timezones without hardcoding', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      timezone: 'America/Tijuana',
    });

    const context = await service.getAuthenticatedUserContext(
      authenticatedUser as never,
    );

    expect(context.companyTimezone).toBe('America/Tijuana');
  });

  it('preserves existing authenticated user fields', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      timezone: 'America/Hermosillo',
    });

    const context = await service.getAuthenticatedUserContext(
      authenticatedUser as never,
    );

    expect(context).toMatchObject(authenticatedUser);
  });

  it('rejects missing companies using the current authenticated companyId', async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);

    await expect(
      service.getAuthenticatedUserContext(authenticatedUser as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not add timezone to JWT operations while building /auth/me context', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      timezone: 'America/Mazatlan',
    });

    await service.getAuthenticatedUserContext(authenticatedUser as never);

    expect(jwtServiceMock.sign).not.toHaveBeenCalled();
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('allows active users with a valid password to login without exposing passwordHash', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userRecord,
      passwordHash: await bcrypt.hash('correct-password', 10),
    });
    jwtServiceMock.signAsync.mockResolvedValue('signed-token');

    const response = await service.login({
      email: userRecord.email,
      password: 'correct-password',
    });

    expect(response).toEqual({
      token: 'signed-token',
      user: {
        id: userRecord.id,
        companyId: userRecord.companyId,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        email: userRecord.email,
        role: userRecord.role,
        locale: userRecord.locale,
      },
    });
    expect(response.user).not.toHaveProperty('passwordHash');
  });

  it('rejects inactive users with the generic credentials error before issuing a token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userRecord,
      isActive: false,
    });

    await expect(
      service.login({
        email: userRecord.email,
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      message: 'Credenciales inválidas',
    });

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('keeps invalid password behavior unchanged', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...userRecord,
      passwordHash: await bcrypt.hash('correct-password', 10),
    });

    await expect(
      service.login({
        email: userRecord.email,
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });
});
