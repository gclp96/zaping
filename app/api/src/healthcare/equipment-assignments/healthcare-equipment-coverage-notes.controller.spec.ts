import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HealthcareEquipmentCoverageNotesController } from './healthcare-equipment-coverage-notes.controller';
import { HealthcareEquipmentCoverageNotesService } from './healthcare-equipment-coverage-notes.service';
import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';

describe('CoverageNote HTTP commands (mock authentication, real roles/pipes/service)', () => {
  const caseId = '11111111-1111-4111-8111-111111111111';
  const requirementId = '22222222-2222-4222-8222-222222222222';
  const noteId = '33333333-3333-4333-8333-333333333333';
  const path = `/healthcare/cases/${caseId}/requirements/${requirementId}/equipment-coverage-notes`;
  const resolvePath = `${path}/${noteId}/resolve`;
  const repository = {
    runCoverageNoteCommand: jest.fn(),
    findIdempotencyRecord: jest.fn(),
    lockCoverageCase: jest.fn(),
    findCase: jest.fn(),
    lockRequirement: jest.fn(),
    findRequirement: jest.fn(),
    findCoverageAssignments: jest.fn(),
    findActiveCoverageNote: jest.fn(),
    createIdempotencyClaim: jest.fn(),
    createCoverageNote: jest.fn(),
    completeIdempotencyClaim: jest.fn(),
    lockCoverageNote: jest.fn(),
    findCoverageNote: jest.fn(),
    resolveCoverageNote: jest.fn(),
  };
  const note = {
    id: noteId,
    requirementId,
    kind: 'UNAVAILABLE',
    comment: 'Context',
    createdAt: new Date(0),
    recordedBy: { id: 'actor', firstName: 'A', lastName: 'B' },
    resolvedAt: null,
    resolvedBy: null,
  };
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthcareEquipmentCoverageNotesController],
      providers: [
        HealthcareEquipmentCoverageNotesService,
        {
          provide: HealthcareEquipmentAssignmentsRepository,
          useValue: repository,
        },
        {
          provide: healthcareCompanyTransactionTimeoutConfiguration.KEY,
          useValue: {},
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user: AuthenticatedRequest['user'];
          }>();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = {
            id: 'actor',
            companyId: 'tenant',
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
    jest.resetAllMocks();
    repository.runCoverageNoteCommand.mockImplementation(
      (
        _company: unknown,
        _policy: unknown,
        action: (tx: object) => Promise<unknown>,
      ) => action({}),
    );
    repository.findIdempotencyRecord.mockResolvedValue(null);
    repository.lockCoverageCase.mockResolvedValue(true);
    repository.findCase.mockResolvedValue({ id: caseId, status: 'SCHEDULED' });
    repository.lockRequirement.mockResolvedValue(true);
    repository.findRequirement.mockResolvedValue({
      id: requirementId,
      caseId,
      productId: 'product',
      requestedQty: 2,
      lifecycle: 'ACTIVE',
      product: { inventoryTracking: 'ASSET' },
    });
    repository.findCoverageAssignments.mockResolvedValue([]);
    repository.findActiveCoverageNote.mockResolvedValue(null);
    repository.createIdempotencyClaim.mockResolvedValue({ id: 'claim' });
    repository.completeIdempotencyClaim.mockResolvedValue({ id: 'claim' });
    repository.createCoverageNote.mockResolvedValue(note);
    repository.lockCoverageNote.mockResolvedValue(true);
    repository.findCoverageNote.mockResolvedValue({
      ...note,
      resolvedAt: new Date(1000),
      resolvedBy: { id: 'first', firstName: 'F', lastName: 'A' },
    });
  });
  afterAll(async () => {
    await app.close();
  });
  it.each(['ADMIN', 'MANAGER', 'WAREHOUSE'])(
    'allows %s on both commands with public R audit shape',
    async (role) => {
      const created = await supertest(app.getHttpServer())
        .post(path)
        .set('x-test-role', role)
        .set('Idempotency-Key', 'create')
        .send({ kind: 'UNAVAILABLE', comment: ' Context ' })
        .expect(201);
      expect(created.body).toEqual({
        ...note,
        createdAt: new Date(0).toISOString(),
      });
      expect(repository.createCoverageNote).toHaveBeenCalledWith(
        expect.anything(),
        {
          companyId: 'tenant',
          requirementId,
          kind: 'UNAVAILABLE',
          comment: 'Context',
          recordedById: 'actor',
        },
      );
      const resolved = await supertest(app.getHttpServer())
        .post(resolvePath)
        .set('x-test-role', role)
        .set('Idempotency-Key', 'resolve')
        .send({})
        .expect(200);
      expect(resolved.body).not.toHaveProperty('companyId');
      expect(resolved.body).not.toHaveProperty('claims');
    },
  );
  it.each([path, resolvePath])(
    'SALES 403 and missing JWT 401 on %s',
    async (route) => {
      await supertest(app.getHttpServer())
        .post(route)
        .set('x-test-role', 'SALES')
        .send({})
        .expect(403);
      await supertest(app.getHttpServer()).post(route).send({}).expect(401);
      expect(repository.runCoverageNoteCommand).not.toHaveBeenCalled();
    },
  );
  it.each([path, resolvePath])('requires key on %s', async (route) => {
    await supertest(app.getHttpServer())
      .post(route)
      .set('x-test-role', 'ADMIN')
      .send(route === path ? { kind: 'UNAVAILABLE', comment: 'OK' } : {})
      .expect(400);
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { kind: 'OTHER', comment: 'OK' },
    { kind: 'UNAVAILABLE', comment: ' \n ' },
    { kind: 'UNAVAILABLE', comment: 1 },
    ...[
      'companyId',
      'recordedById',
      'resolvedById',
      'createdAt',
      'resolvedAt',
    ].map((field) => ({
      kind: 'UNAVAILABLE',
      comment: 'OK',
      [field]: 'injected',
    })),
  ])('rejects malformed or client-owned fields %j', async (body) => {
    await supertest(app.getHttpServer())
      .post(path)
      .set('x-test-role', 'ADMIN')
      .set('Idempotency-Key', 'key')
      .send(body)
      .expect(400);
    expect(repository.runCoverageNoteCommand).not.toHaveBeenCalled();
  });
  it.each([
    { noteId },
    [],
    { resolvedById: 'actor' },
    { resolvedAt: '2026-10-09' },
  ])('rejects nonempty resolve body %j', async (body) => {
    await supertest(app.getHttpServer())
      .post(resolvePath)
      .set('x-test-role', 'ADMIN')
      .set('Idempotency-Key', 'key')
      .send(body)
      .expect(400);
    expect(repository.runCoverageNoteCommand).not.toHaveBeenCalled();
  });
  it('accepts absent resolve body', async () => {
    await supertest(app.getHttpServer())
      .post(resolvePath)
      .set('x-test-role', 'ADMIN')
      .set('Idempotency-Key', 'key')
      .expect(200);
  });
  it.each([
    path.replace(caseId, 'bad'),
    path.replace(requirementId, 'bad'),
    resolvePath.replace(noteId, 'bad'),
  ])('rejects malformed UUID %s', async (route) => {
    await supertest(app.getHttpServer())
      .post(route)
      .set('x-test-role', 'ADMIN')
      .set('Idempotency-Key', 'key')
      .send({ kind: 'UNAVAILABLE', comment: 'OK' })
      .expect(400);
    expect(repository.runCoverageNoteCommand).not.toHaveBeenCalled();
  });
  it('returns the identical public 404 for every missing/foreign relationship', async () => {
    const responses: unknown[] = [];
    for (const missing of ['case', 'requirement', 'relationship', 'note']) {
      repository.lockCoverageCase.mockResolvedValue(missing !== 'case');
      repository.findRequirement.mockResolvedValue(
        missing === 'requirement'
          ? null
          : { caseId: missing === 'relationship' ? 'foreign' : caseId },
      );
      repository.lockCoverageNote.mockResolvedValue(missing !== 'note');
      const response = await supertest(app.getHttpServer())
        .post(resolvePath)
        .set('x-test-role', 'ADMIN')
        .set('Idempotency-Key', 'key')
        .send({})
        .expect(404);
      responses.push(response.body);
    }
    expect(
      responses.every(
        (response) => JSON.stringify(response) === JSON.stringify(responses[0]),
      ),
    ).toBe(true);
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
  });
});
