import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const INVALID_RESET_TOKEN_MESSAGE = 'El enlace no es válido o ha expirado.';

type IssuedPasswordReset = {
  token: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

@Injectable()
export class PasswordRecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async preparePasswordReset(
    email: string,
  ): Promise<IssuedPasswordReset | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async resetPasswordWithToken(plaintextToken: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 8 caracteres.',
      );
    }

    const tokenHash = this.hashToken(plaintextToken);
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
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

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !resetToken.user.isActive
    ) {
      throw this.invalidResetToken();
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      resetToken.user.passwordHash,
    );

    if (samePassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente de la actual.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const consumedToken = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumedToken.count !== 1) {
        throw this.invalidResetToken();
      }

      const updatedUser = await tx.user.updateMany({
        where: {
          id: resetToken.user.id,
          isActive: true,
        },
        data: {
          passwordHash,
          authVersion: {
            increment: 1,
          },
        },
      });

      if (updatedUser.count !== 1) {
        throw this.invalidResetToken();
      }

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.user.id,
          id: {
            not: resetToken.id,
          },
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
    });

    return {
      success: true,
      message: 'Contraseña actualizada',
    };
  }

  async invalidatePendingTokensForUser(userId: string, usedAt = new Date()) {
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt,
      },
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private invalidResetToken() {
    return new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
  }
}
