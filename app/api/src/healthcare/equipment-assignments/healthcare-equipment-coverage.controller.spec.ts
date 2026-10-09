import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import supertest from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HealthcareEquipmentCoverageController } from './healthcare-equipment-coverage.controller';
import { HealthcareEquipmentCoverageService } from './healthcare-equipment-coverage.service';

describe('Coverage HTTP read boundary (mock authentication, real roles/pipes)', () => {
  const caseId = '11111111-1111-4111-8111-111111111111';
  const requirementId = '22222222-2222-4222-8222-222222222222';
  const coverage = `/healthcare/cases/${caseId}/equipment-coverage`;
  const notes = `/healthcare/cases/${caseId}/requirements/${requirementId}/equipment-coverage-notes`;
  const service = { findCoverage: jest.fn(), findNotes: jest.fn() };
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthcareEquipmentCoverageController],
      providers: [
        { provide: HealthcareEquipmentCoverageService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const request = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user: AuthenticatedRequest['user'];
          }>();
          const role = request.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          request.user = {
            id: 'actor',
            companyId: 'jwt-tenant',
            role,
          } as AuthenticatedRequest['user'];
          return true;
        },
      })
      .compile();
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
  beforeEach(() => {
    jest.clearAllMocks();
    service.findCoverage.mockResolvedValue({ items: [] });
    service.findNotes.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });
  });
  afterAll(async () => {
    await app.close();
  });
  it.each(Object.values(UserRole))('allows %s on both GETs', async (role) => {
    await supertest(app.getHttpServer())
      .get(coverage)
      .set('x-test-role', role)
      .expect(200);
    await supertest(app.getHttpServer())
      .get(notes)
      .set('x-test-role', role)
      .expect(200);
    expect(service.findCoverage).toHaveBeenCalledWith('jwt-tenant', caseId);
    expect(service.findNotes).toHaveBeenCalledWith(
      'jwt-tenant',
      caseId,
      requirementId,
      { page: 1, pageSize: 25 },
    );
  });
  it.each([coverage, notes])('requires authentication for %s', async (path) => {
    await supertest(app.getHttpServer()).get(path).expect(401);
    expect(service.findCoverage).not.toHaveBeenCalled();
    expect(service.findNotes).not.toHaveBeenCalled();
  });
  it('rejects an unauthorized role', async () => {
    await supertest(app.getHttpServer())
      .get(coverage)
      .set('x-test-role', 'UNKNOWN')
      .expect(403);
  });
  it.each([
    coverage.replace(caseId, 'invalid'),
    notes.replace(caseId, 'invalid'),
    notes.replace(requirementId, 'invalid'),
    `${notes}?page=0`,
    `${notes}?page=1.5`,
    `${notes}?pageSize=101`,
    `${notes}?pageSize=bad`,
    `${notes}?companyId=foreign`,
  ])('rejects invalid inputs: %s', async (path) => {
    await supertest(app.getHttpServer())
      .get(path)
      .set('x-test-role', 'ADMIN')
      .expect(400);
    expect(service.findCoverage).not.toHaveBeenCalled();
    expect(service.findNotes).not.toHaveBeenCalled();
  });
  it('transforms valid pagination', async () => {
    await supertest(app.getHttpServer())
      .get(`${notes}?page=2&pageSize=10`)
      .set('x-test-role', 'SALES')
      .expect(200);
    expect(service.findNotes).toHaveBeenCalledWith(
      'jwt-tenant',
      caseId,
      requirementId,
      { page: 2, pageSize: 10 },
    );
  });
});
