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
import { HealthcareCaseAvailabilityController } from './healthcare-case-availability.controller';
import { HealthcareCaseAvailabilityService } from './healthcare-case-availability.service';

describe('Case Availability HTTP/JWT boundary (mock persistence)', () => {
  const caseId = '11111111-1111-4111-8111-111111111111';
  const path = `/healthcare/cases/${caseId}/availability`;
  const secret = 'case-availability-test-only-secret';
  const service = { findAvailability: jest.fn() };
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
      controllers: [HealthcareCaseAvailabilityController],
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: HealthcareCaseAvailabilityService, useValue: service },
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
    service.findAvailability.mockResolvedValue({ caseId });
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
    expect(service.findAvailability).toHaveBeenCalledWith('jwt-tenant', caseId);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: role, companyId: 'jwt-tenant', isActive: true },
      }),
    );
  });
  it('returns 401 without JWT', async () => {
    await supertest(app.getHttpServer()).get(path).expect(401);
    expect(service.findAvailability).not.toHaveBeenCalled();
  });
  it('returns 401 for invalid signature', async () => {
    await supertest(app.getHttpServer())
      .get(path)
      .auth(token('ADMIN', 'jwt-tenant', 'wrong'), { type: 'bearer' })
      .expect(401);
    expect(service.findAvailability).not.toHaveBeenCalled();
  });
  it('returns 403 for a role outside the read contract', async () => {
    await supertest(app.getHttpServer())
      .get(path)
      .auth(token('UNKNOWN'), { type: 'bearer' })
      .expect(403);
    expect(service.findAvailability).not.toHaveBeenCalled();
  });
  it('uses only JWT Company despite client query/body/header spoofing', async () => {
    await supertest(app.getHttpServer())
      .get(`${path}?companyId=foreign`)
      .set('x-company-id', 'foreign')
      .send({ companyId: 'foreign' })
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(service.findAvailability).toHaveBeenCalledWith('jwt-tenant', caseId);
  });
  it('rejects malformed UUID without service access', async () => {
    await supertest(app.getHttpServer())
      .get(path.replace(caseId, 'invalid'))
      .auth(token(), { type: 'bearer' })
      .expect(400);
    expect(service.findAvailability).not.toHaveBeenCalled();
  });
  it('preserves identical public 404 for missing and foreign Case', async () => {
    service.findAvailability.mockRejectedValue(caseNotFoundException());
    const missing = await supertest(app.getHttpServer())
      .get(path)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    const foreign = await supertest(app.getHttpServer())
      .get(path)
      .auth(token('ADMIN', 'other-tenant'), { type: 'bearer' })
      .expect(404);
    expect(foreign.body).toEqual(missing.body);
    expect(service.findAvailability).toHaveBeenLastCalledWith(
      'other-tenant',
      caseId,
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
    expect(service.findAvailability).not.toHaveBeenCalled();
  });
});
