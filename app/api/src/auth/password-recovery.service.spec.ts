import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { PasswordRecoveryService } from './password-recovery.service';

describe('PasswordRecoveryService', () => {
  type PasswordResetTokenCreateCall = {
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    };
  };

  type UserUpdateManyCall = {
    where: {
      id: string;
      isActive: boolean;
    };
    data: {
      passwordHash: string;
      authVersion: {
        increment: number;
      };
    };
  };

  type PasswordResetTokenUpdateManyCall = {
    where: {
      id?: string | { not: string };
      userId?: string;
      usedAt: null;
      expiresAt?: {
        gt: Date;
      };
    };
    data: {
      usedAt: Date;
    };
  };

  let service: PasswordRecoveryService;
  let prismaMock: {
    $transaction: jest.Mock;
    passwordResetToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let transactionMock: {
    passwordResetToken: {
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    user: {
      updateMany: jest.Mock;
    };
  };

  const activeUser = {
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    isActive: true,
  };

  beforeEach(async () => {
    jest.useRealTimers();
    transactionMock = {
      passwordResetToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        updateMany: jest.fn(),
      },
    };
    prismaMock = {
      $transaction: jest.fn(
        (callback: (tx: typeof transactionMock) => unknown) =>
          callback(transactionMock),
      ),
      passwordResetToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<PasswordRecoveryService>(PasswordRecoveryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues a URL-safe high-entropy token and persists only its hash', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T16:30:00.000Z'));
    prismaMock.user.findUnique.mockResolvedValue(activeUser);
    transactionMock.passwordResetToken.create.mockResolvedValue({
      id: 'reset-token-1',
    });

    const result = await service.preparePasswordReset(activeUser.email);

    expect(result).not.toBeNull();
    expect(result?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result?.expiresAt).toEqual(new Date('2026-09-01T17:00:00.000Z'));
    expect(result?.tokenId).toBe('reset-token-1');
    expect(result?.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      firstName: activeUser.firstName,
      lastName: activeUser.lastName,
    });

    expect(transactionMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: activeUser.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date('2026-09-01T16:30:00.000Z'),
      },
    });

    const createCalls = transactionMock.passwordResetToken.create.mock
      .calls as [PasswordResetTokenCreateCall][];
    const createCall = createCalls[0][0];
    expect(createCall.data.userId).toBe(activeUser.id);
    expect(createCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall.data.tokenHash).not.toBe(result?.token);
    expect(createCall.data.expiresAt).toEqual(
      new Date('2026-09-01T17:00:00.000Z'),
    );
    expect(createCall).toMatchObject({
      select: {
        id: true,
      },
    });
    expect(JSON.stringify(createCall)).not.toContain(result?.token ?? '');
  });

  it('does not issue a token for unknown or inactive users', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.preparePasswordReset('missing@example.com'),
    ).resolves.toBe(null);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...activeUser,
      isActive: false,
    });
    await expect(service.preparePasswordReset(activeUser.email)).resolves.toBe(
      null,
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(transactionMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('hashes tokens consistently for lookup', () => {
    const token = 'plain-reset-token';

    expect(service.hashToken(token)).toBe(service.hashToken(token));
    expect(service.hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hashToken(token)).not.toBe(token);
  });

  it('resets password with a valid token, increments authVersion, and invalidates other tokens', async () => {
    const currentHash = await bcrypt.hash('current-password', 10);
    const token = 'valid-reset-token';
    const beforeReset = Date.now();
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-1',
      userId: activeUser.id,
      tokenHash: service.hashToken(token),
      expiresAt: new Date(beforeReset + 15 * 60 * 1000),
      usedAt: null,
      user: {
        id: activeUser.id,
        isActive: true,
        passwordHash: currentHash,
      },
    });
    transactionMock.passwordResetToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    transactionMock.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resetPasswordWithToken(
      token,
      'new-secure-password',
    );

    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: {
        tokenHash: service.hashToken(token),
      },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            passwordHash: true,
          },
        },
      },
    });
    const tokenUpdateCalls = transactionMock.passwordResetToken.updateMany.mock
      .calls as [PasswordResetTokenUpdateManyCall][];
    expect(tokenUpdateCalls[0][0].where).toEqual({
      id: 'reset-token-1',
      usedAt: null,
      expiresAt: {
        gt: expect.any(Date) as Date,
      },
    });
    expect(tokenUpdateCalls[0][0].data.usedAt).toBeInstanceOf(Date);
    expect(tokenUpdateCalls[0][0].data.usedAt.getTime()).toBeGreaterThanOrEqual(
      beforeReset,
    );
    const userUpdateCalls = transactionMock.user.updateMany.mock.calls as [
      UserUpdateManyCall,
    ][];
    const userUpdateCall = userUpdateCalls[0][0];
    expect(userUpdateCall.where).toEqual({
      id: activeUser.id,
      isActive: true,
    });
    expect(userUpdateCall.data.authVersion).toEqual({ increment: 1 });
    expect(userUpdateCall.data.passwordHash).not.toBe('new-secure-password');
    expect(userUpdateCall.data.passwordHash).not.toBe(currentHash);
    await expect(
      bcrypt.compare('new-secure-password', userUpdateCall.data.passwordHash),
    ).resolves.toBe(true);
    await expect(
      bcrypt.compare('current-password', userUpdateCall.data.passwordHash),
    ).resolves.toBe(false);
    expect(tokenUpdateCalls[1][0]).toEqual({
      where: {
        userId: activeUser.id,
        id: {
          not: 'reset-token-1',
        },
        usedAt: null,
      },
      data: {
        usedAt: expect.any(Date) as Date,
      },
    });
    expect(result).toEqual({
      success: true,
      message: 'Contraseña actualizada',
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('token');
  });

  it.each([
    ['missing token', null],
    [
      'expired token',
      {
        id: 'reset-token-1',
        expiresAt: new Date('2026-09-01T16:29:59.000Z'),
        usedAt: null,
        user: { id: activeUser.id, isActive: true, passwordHash: 'hash' },
      },
    ],
    [
      'used token',
      {
        id: 'reset-token-1',
        expiresAt: new Date('2026-09-01T16:45:00.000Z'),
        usedAt: new Date('2026-09-01T16:00:00.000Z'),
        user: { id: activeUser.id, isActive: true, passwordHash: 'hash' },
      },
    ],
    [
      'inactive user',
      {
        id: 'reset-token-1',
        expiresAt: new Date('2026-09-01T16:45:00.000Z'),
        usedAt: null,
        user: { id: activeUser.id, isActive: false, passwordHash: 'hash' },
      },
    ],
  ])(
    'rejects %s without consuming token state',
    async (_caseName, resetToken) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-01T16:30:00.000Z'));
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(resetToken);

      await expect(
        service.resetPasswordWithToken('invalid-token', 'new-secure-password'),
      ).rejects.toMatchObject({
        constructor: BadRequestException,
        message: 'El enlace no es válido o ha expirado.',
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(
        transactionMock.passwordResetToken.updateMany,
      ).not.toHaveBeenCalled();
      expect(transactionMock.user.updateMany).not.toHaveBeenCalled();
    },
  );

  it('rejects same-password reset without consuming the token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-1',
      expiresAt: new Date(Date.now() + 30_000),
      usedAt: null,
      user: {
        id: activeUser.id,
        isActive: true,
        passwordHash: await bcrypt.hash('current-password', 10),
      },
    });

    await expect(
      service.resetPasswordWithToken('valid-token', 'current-password'),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'La nueva contraseña debe ser diferente de la actual.',
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(
      transactionMock.passwordResetToken.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('rejects short new passwords without touching token state', async () => {
    await expect(
      service.resetPasswordWithToken('valid-token', 'short'),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'La nueva contraseña debe tener al menos 8 caracteres.',
    });

    expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('does not complete reset if another request already consumed the token', async () => {
    const currentHash = await bcrypt.hash('current-password', 10);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-1',
      expiresAt: new Date(Date.now() + 30_000),
      usedAt: null,
      user: {
        id: activeUser.id,
        isActive: true,
        passwordHash: currentHash,
      },
    });
    transactionMock.passwordResetToken.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.resetPasswordWithToken('valid-token', 'new-secure-password'),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'El enlace no es válido o ha expirado.',
    });

    expect(transactionMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back as failed if the user becomes inactive inside the transaction', async () => {
    const currentHash = await bcrypt.hash('current-password', 10);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-1',
      expiresAt: new Date(Date.now() + 30_000),
      usedAt: null,
      user: {
        id: activeUser.id,
        isActive: true,
        passwordHash: currentHash,
      },
    });
    transactionMock.passwordResetToken.updateMany.mockResolvedValue({
      count: 1,
    });
    transactionMock.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.resetPasswordWithToken('valid-token', 'new-secure-password'),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'El enlace no es válido o ha expirado.',
    });
  });

  it('invalidates pending tokens for a user without deleting records', async () => {
    await service.invalidatePendingTokensForUser(activeUser.id);

    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: activeUser.id,
        usedAt: null,
      },
      data: {
        usedAt: expect.any(Date) as Date,
      },
    });
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });
});
