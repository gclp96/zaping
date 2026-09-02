import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordRecoveryService } from './password-recovery.service';

import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '7d',
      },
    }),
  ],

  providers: [AuthService, JwtStrategy, PasswordRecoveryService],

  controllers: [AuthController],

  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
