import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import supertest from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { caseNotFoundException } from '../common/healthcare-errors';
import { HealthcareCaseDispatchesController } from './healthcare-case-dispatches.controller';
import { HealthcareCaseDispatchReadService } from './healthcare-case-dispatch-read.service';

describe('Case Dispatch HTTP/JWT boundary (mock persistence)', () => {
  const caseId = '11111111-1111-4111-8111-111111111111';
  const path = `/healthcare/cases/${caseId}/dispatches`;
  const secret = 'case-availability-test-only-secret';
  const service = { list: jest.fn(), detail: jest.fn() };
  const prisma = { user: { findFirst: jest.fn() } };
  let app: INestApplication<App>;
  let jwt: JwtService;
  let previousSecret: string | undefined;
  const token = (role = 'ADMIN', companyId = 'jwt-tenant', key = secret) =>
    new JwtService({ secret: key }).sign({
      sub: role,
      email: 'test@example.invalid',
      role,
      companyId,
    });

  beforeAll(async () => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret })],
      controllers: [HealthcareCaseDispatchesController],
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: HealthcareCaseDispatchReadService, useValue: service },
      ],
    }).compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findFirst.mockImplementation(
      ({ where }: { where: { id: string; companyId: string } }) => ({
        ...where,
        role: where.id,
        email: 'test@example.invalid',
        authVersion: 0,
      }),
    );
    service.list.mockResolvedValue({ caseId });
  });

  it.each([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SALES,
    UserRole.WAREHOUSE,
  ])('allows %s with a real signed JWT', async (role) => {
    await supertest(app.getHttpServer())
      .get(path)
      .auth(token(role), { type: 'bearer' })
      .expect(200, { caseId });
    expect(service.list).toHaveBeenCalledWith(
      'jwt-tenant',
      caseId,
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: role, companyId: 'jwt-tenant', isActive: true },
      }),
    );
  });
  it('returns 401 without JWT', async () => {
    await supertest(app.getHttpServer()).get(path).expect(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('returns 401 for invalid signature', async () => {
    await supertest(app.getHttpServer())
      .get(path)
      .auth(token('ADMIN', 'jwt-tenant', 'wrong'), { type: 'bearer' })
      .expect(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('returns 403 for a role outside the read contract', async () => {
    await supertest(app.getHttpServer())
      .get(path)
      .auth(token('UNKNOWN'), { type: 'bearer' })
      .expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('uses only JWT Company despite client body/header spoofing', async () => {
    await supertest(app.getHttpServer())
      .get(path)
      .set('x-company-id', 'foreign')
      .send({ companyId: 'foreign' })
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(
      'jwt-tenant',
      caseId,
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
  });
  it('rejects malformed UUID without service access', async () => {
    await supertest(app.getHttpServer())
      .get(path.replace(caseId, 'invalid'))
      .auth(token(), { type: 'bearer' })
      .expect(400);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('preserves identical public 404 for missing and foreign Case', async () => {
    service.list.mockRejectedValue(caseNotFoundException());
    const missing = await supertest(app.getHttpServer())
      .get(path)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    const foreign = await supertest(app.getHttpServer())
      .get(path)
      .auth(token('ADMIN', 'other-tenant'), { type: 'bearer' })
      .expect(404);
    expect(foreign.body).toEqual(missing.body);
    expect(service.list).toHaveBeenLastCalledWith(
      'other-tenant',
      caseId,
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
  });
  it('rejects an expired JWT', async () => {
    const expired = jwt.sign(
      {
        sub: 'ADMIN',
        email: 'test@example.invalid',
        role: 'ADMIN',
        companyId: 'jwt-tenant',
      },
      { expiresIn: -1 },
    );
    await supertest(app.getHttpServer())
      .get(path)
      .auth(expired, { type: 'bearer' })
      .expect(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  it.each(['0', '-1', '1.5', 'abc'])(
    'rejects invalid page %s',
    async (page) => {
      await supertest(app.getHttpServer())
        .get(path + '?page=' + page)
        .auth(token(), { type: 'bearer' })
        .expect(400);
      expect(service.list).not.toHaveBeenCalled();
    },
  );
  it.each(['101', '0', 'abc'])(
    'rejects invalid pageSize %s',
    async (pageSize) => {
      await supertest(app.getHttpServer())
        .get(path + '?pageSize=' + pageSize)
        .auth(token(), { type: 'bearer' })
        .expect(400);
    },
  );
  it('accepts status and pagination', async () => {
    await supertest(app.getHttpServer())
      .get(path + '?status=CONFIRMED&page=2&pageSize=10')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(service.list).toHaveBeenCalledWith('jwt-tenant', caseId, {
      status: 'CONFIRMED',
      page: 2,
      pageSize: 10,
    });
  });
  it('rejects invalid status', async () => {
    await supertest(app.getHttpServer())
      .get(path + '?status=UNKNOWN')
      .auth(token(), { type: 'bearer' })
      .expect(400);
  });
  it.each(Object.values(UserRole))('allows detail for %s', async (role) => {
    service.detail.mockResolvedValue({ id: caseId });
    await supertest(app.getHttpServer())
      .get(path + '/' + caseId)
      .auth(token(role), { type: 'bearer' })
      .expect(200);
    expect(service.detail).toHaveBeenCalledWith('jwt-tenant', caseId, caseId);
  });
  it('detail rejects anonymous and invalid UUID', async () => {
    await supertest(app.getHttpServer())
      .get(path + '/' + caseId)
      .expect(401);
    await supertest(app.getHttpServer())
      .get(path + '/bad')
      .auth(token(), { type: 'bearer' })
      .expect(400);
    expect(service.detail).not.toHaveBeenCalled();
  });
  it.each(['post', 'patch', 'delete'] as const)(
    'has no %s route',
    async (method) => {
      await supertest(app.getHttpServer())
        [method](path)
        .auth(token(), { type: 'bearer' })
        .expect(404);
    },
  );
});
