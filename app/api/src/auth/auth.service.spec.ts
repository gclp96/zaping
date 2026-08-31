import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: {
    company: {
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

  beforeEach(async () => {
    prismaMock = {
      company: {
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
});
