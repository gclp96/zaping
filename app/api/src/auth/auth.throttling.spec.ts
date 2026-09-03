import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Controller('throttling-probe')
class ThrottlingProbeController {
  @Get()
  get(): string {
    return 'ok';
  }
}

describe('AuthController throttling', () => {
  let app: INestApplication<App>;
  let authServiceMock: {
    forgotPassword: jest.Mock;
    login: jest.Mock;
    register: jest.Mock;
    resetPassword: jest.Mock;
    changePassword: jest.Mock;
  };
  const previousJwtSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';

    authServiceMock = {
      changePassword: jest.fn().mockResolvedValue({ success: true }),
      forgotPassword: jest.fn().mockResolvedValue({
        message:
          'Si la cuenta existe, enviaremos instrucciones para restablecer la contraseña.',
      }),
      login: jest.fn().mockResolvedValue({ success: true }),
      register: jest.fn().mockResolvedValue({ success: true }),
      resetPassword: jest.fn().mockResolvedValue({
        success: true,
        message: 'Contraseña restablecida',
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'default',
              limit: 10,
              ttl: 60_000,
            },
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: 'test-secret' }),
      ],
      controllers: [AuthController, ThrottlingProbeController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        JwtAuthGuard,
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'user-1',
                companyId: 'company-1',
                email: 'user@example.com',
                firstName: 'Test',
                lastName: 'User',
                role: 'ADMIN',
                authVersion: 0,
              }),
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  async function expectLimit(
    path: string,
    limit: number,
    body: object,
  ): Promise<void> {
    for (let attempt = 0; attempt < limit; attempt += 1) {
      await request(app.getHttpServer()).post(path).send(body).expect(201);
    }

    await request(app.getHttpServer()).post(path).send(body).expect(429);
  }

  it('returns 429 after the login limit while allowing prior requests', async () => {
    await expectLimit('/auth/login', 10, {
      email: 'invalid@example.com',
      password: 'invalid-password',
    });

    expect(authServiceMock.login).toHaveBeenCalledTimes(10);
  });

  it('keeps forgot-password generic before applying its limit', async () => {
    const knownAccount = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'known@example.com' })
      .expect(201);
    const unknownAccount = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(201);

    expect(knownAccount.body).toEqual(unknownAccount.body);

    for (let attempt = 2; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `account-${attempt}@example.com` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'after-limit@example.com' })
      .expect(429);
  });

  it('applies the register and reset limits independently', async () => {
    await expectLimit('/auth/register', 5, {
      companyName: 'Test Company',
    });
    await expectLimit('/auth/reset-password', 10, {
      token: 'test-token',
      newPassword: 'new-password',
    });

    const rejectedReset = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'test-token', newPassword: 'new-password' })
      .expect(429);

    expect(JSON.stringify(rejectedReset.body)).not.toContain('test-token');
    expect(authServiceMock.register).toHaveBeenCalledTimes(5);
    expect(authServiceMock.resetPassword).toHaveBeenCalledTimes(10);
  });

  it('does not apply Auth throttling globally to other controllers', async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await request(app.getHttpServer())
        .get('/throttling-probe')
        .expect(200)
        .expect('ok');
    }
  });

  it('keeps change-password authentication semantics and throttles after five client requests', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .send({ currentPassword: 'current', newPassword: 'new-password' })
      .expect(401);

    const jwtService = app.get(JwtService);
    const token = jwtService.sign({
      sub: 'user-1',
      companyId: 'company-1',
      email: 'user@example.com',
      role: 'ADMIN',
      authVersion: 0,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'current', newPassword: 'new-password' })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'current', newPassword: 'new-password' })
      .expect(429);

    expect(authServiceMock.changePassword).toHaveBeenCalledTimes(4);
  });
});
