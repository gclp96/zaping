import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  INestApplication,
  ParseUUIDPipe,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import supertest from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { HealthcareEquipmentAssignmentListStatus } from './dto/healthcare-equipment-assignment-list-query.dto';
import { HealthcareEquipmentAssignmentsController } from './healthcare-equipment-assignments.controller';
import { HealthcareEquipmentAssignmentsService } from './healthcare-equipment-assignments.service';

const companyId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const assignmentId = '33333333-3333-4333-8333-333333333333';
const caseId = '44444444-4444-4444-8444-444444444444';
const equipmentAssetId = '55555555-5555-4555-8555-555555555555';
const request = { user: { id: userId, companyId } };
const response = { status: jest.fn() };

describe('HealthcareEquipmentAssignmentsController', () => {
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    release: jest.fn(),
    replace: jest.fn(),
  };
  const controller = new HealthcareEquipmentAssignmentsController(
    service as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    response.status.mockReturnValue(response);
  });

  it('registers the equipment assignment resource routes', () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        HealthcareEquipmentAssignmentsController,
      ),
    ).toBe('healthcare/equipment-assignments');
    expect(getPath('findAll')).toBe('/');
    expect(getPath('findOne')).toBe(':assignmentId');
    expect(getPath('create')).toBe('/');
    expect(getPath('release')).toBe(':assignmentId/release');
    expect(getPath('replace')).toBe(':assignmentId/replace');
  });

  it('lists and reads with authenticated companyId', async () => {
    const query = {
      status: HealthcareEquipmentAssignmentListStatus.ALL,
      page: 1,
      pageSize: 25,
    };
    service.findAll.mockResolvedValue({ items: [] });
    service.findOne.mockResolvedValue({ id: assignmentId });

    await controller.findAll(request as never, query);
    await controller.findOne(request as never, assignmentId);

    expect(service.findAll).toHaveBeenCalledWith(companyId, query);
    expect(service.findOne).toHaveBeenCalledWith(companyId, assignmentId);
  });

  it('creates with authenticated tenant/actor and trimmed idempotency key', async () => {
    const dto = {
      caseId,
      equipmentAssetId,
      directAssignmentReason: 'Urgente',
    };
    service.create.mockResolvedValue({ outcome: 'CREATED' });

    await controller.create(
      request as never,
      '  request-key  ',
      dto,
      response as never,
    );

    expect(service.create).toHaveBeenCalledWith(
      companyId,
      userId,
      'request-key',
      dto,
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.CREATED);
  });

  it('releases with authenticated tenant and actor', async () => {
    const dto = {
      reason: 'Equipo ya no requerido',
    };

    service.release.mockResolvedValue({
      id: assignmentId,
      status: 'RELEASED',
    });

    await controller.release(request as never, assignmentId, dto);

    expect(service.release).toHaveBeenCalledWith(
      companyId,
      userId,
      assignmentId,
      dto,
    );
  });

  it('replaces with authenticated tenant/actor and trimmed idempotency key', async () => {
    const dto = {
      equipmentAssetId,
      replacementReason: 'Equipo original no disponible',
    };
    service.replace.mockResolvedValue({ outcome: 'REPLACED' });

    await controller.replace(
      request as never,
      assignmentId,
      '  replace-request-key  ',
      dto,
    );

    expect(service.replace).toHaveBeenCalledWith(
      companyId,
      userId,
      assignmentId,
      'replace-request-key',
      dto,
    );
  });

  it('returns 200 for conflict review without changing the route contract', async () => {
    service.create.mockResolvedValue({
      outcome: 'CONFLICT_REVIEW_REQUIRED',
    });

    await controller.create(
      request as never,
      'request-key',
      { caseId, equipmentAssetId, directAssignmentReason: 'Urgente' },
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it.each([undefined, '', '   ', 'x'.repeat(129)])(
    'rejects invalid Idempotency-Key %p before service lookup',
    async (key) => {
      await expect(
        controller.create(
          request as never,
          key,
          {
            caseId,
            equipmentAssetId,
            directAssignmentReason: 'Urgente',
          },
          response as never,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.create).not.toHaveBeenCalled();
    },
  );

  it('validates assignmentId with ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      HealthcareEquipmentAssignmentsController,
      'findOne',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;
    const idParam = Object.values(metadata).find(
      (value) => value.data === 'assignmentId',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });

  it('validates release assignmentId with ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      HealthcareEquipmentAssignmentsController,
      'release',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;

    const idParam = Object.values(metadata).find(
      (value) => value.data === 'assignmentId',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });

  it('validates replace assignmentId with ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      HealthcareEquipmentAssignmentsController,
      'replace',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;

    const idParam = Object.values(metadata).find(
      (value) => value.data === 'assignmentId',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });
});

type ControllerMethod =
  'findAll' | 'findOne' | 'create' | 'release' | 'replace';

function getHandler(methodName: ControllerMethod): object {
  return Object.getOwnPropertyDescriptor(
    HealthcareEquipmentAssignmentsController.prototype,
    methodName,
  )?.value as object;
}

function getPath(methodName: ControllerMethod): string {
  return Reflect.getMetadata(PATH_METADATA, getHandler(methodName)) as string;
}

describe('HealthcareEquipmentAssignmentsController Replace HTTP', () => {
  const replacementAssignmentId = '66666666-6666-4666-8666-666666666666';
  const validBody = {
    equipmentAssetId,
    replacementReason: 'Equipo original no disponible',
  };
  const replacedResponse = {
    outcome: 'REPLACED',
    data: {
      replacedAssignment: {
        id: assignmentId,
        status: 'REPLACED',
      },
      replacementAssignment: {
        id: replacementAssignmentId,
        status: 'RESERVED',
        replacesAssignmentId: assignmentId,
      },
    },
  };
  const conflictReviewResponse = {
    outcome: 'CONFLICT_REVIEW_REQUIRED',
    sourceAssignmentId: assignmentId,
    conflictReviewFingerprint: 'a'.repeat(64),
    overrideRequired: true,
    conflicts: [
      {
        assignmentId: '77777777-7777-4777-8777-777777777777',
        caseId: '88888888-8888-4888-8888-888888888888',
        caseFolio: 'HC-000002',
      },
    ],
    candidate: {
      caseId,
      equipmentAsset: { id: equipmentAssetId },
    },
    unresolvedReservations: [
      {
        assignmentId: '99999999-9999-4999-8999-999999999999',
        caseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ],
    availability: {
      fullyVerifiable: false,
      conflictFree: false,
      warnings: [
        { code: 'CURRENT_ASSIGNMENT_CONFLICT' },
        { code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE' },
      ],
    },
  };
  const httpService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    release: jest.fn(),
    replace: jest.fn(),
  };

  let app: INestApplication<App>;
  let authenticated = true;
  let currentRole = UserRole.ADMIN;

  const authenticationGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      if (!authenticated) {
        throw new UnauthorizedException();
      }

      const httpRequest = context.switchToHttp().getRequest<{
        user?: {
          id: string;
          companyId: string;
          role: UserRole;
        };
      }>();
      httpRequest.user = {
        id: userId,
        companyId,
        role: currentRole,
      };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthcareEquipmentAssignmentsController],
      providers: [
        RolesGuard,
        {
          provide: HealthcareEquipmentAssignmentsService,
          useValue: httpService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticationGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authenticated = true;
    currentRole = UserRole.ADMIN;
    httpService.create.mockResolvedValue({ outcome: 'CREATED', data: {} });
    httpService.release.mockResolvedValue({
      id: assignmentId,
      status: 'RELEASED',
    });
    httpService.replace.mockResolvedValue(replacedResponse);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE])(
    'allows %s and delegates Replace with authenticated identity',
    async (role) => {
      currentRole = role;

      await supertest(app.getHttpServer())
        .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
        .set('Idempotency-Key', '  replace-http-key  ')
        .send(validBody)
        .expect(HttpStatus.OK);

      expect(httpService.replace).toHaveBeenCalledWith(
        companyId,
        userId,
        assignmentId,
        'replace-http-key',
        validBody,
      );
    },
  );

  it('returns 403 when SALES attempts Replace through RolesGuard', async () => {
    currentRole = UserRole.SALES;

    await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
      .set('Idempotency-Key', 'replace-http-key')
      .send(validBody)
      .expect(HttpStatus.FORBIDDEN);

    expect(httpService.replace).not.toHaveBeenCalled();
  });

  it('returns 401 when the authentication guard rejects the request', async () => {
    authenticated = false;

    await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
      .set('Idempotency-Key', 'replace-http-key')
      .send(validBody)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(httpService.replace).not.toHaveBeenCalled();
  });

  it.each([undefined, '   ', 'x'.repeat(129)])(
    'returns 400 for invalid Idempotency-Key %p',
    async (idempotencyKey) => {
      let httpRequest = supertest(app.getHttpServer())
        .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
        .send(validBody);

      if (idempotencyKey !== undefined) {
        httpRequest = httpRequest.set('Idempotency-Key', idempotencyKey);
      }

      await httpRequest.expect(HttpStatus.BAD_REQUEST);
      expect(httpService.replace).not.toHaveBeenCalled();
    },
  );

  it('returns 400 for an invalid source assignmentId', async () => {
    await supertest(app.getHttpServer())
      .post('/healthcare/equipment-assignments/not-a-uuid/replace')
      .set('Idempotency-Key', 'replace-http-key')
      .send(validBody)
      .expect(HttpStatus.BAD_REQUEST);

    expect(httpService.replace).not.toHaveBeenCalled();
  });

  it.each([
    { replacementReason: 'Equipo original no disponible' },
    { ...validBody, equipmentAssetId: 'not-a-uuid' },
  ])('returns 400 for invalid replacement EquipmentAsset %#', async (body) => {
    await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
      .set('Idempotency-Key', 'replace-http-key')
      .send(body)
      .expect(HttpStatus.BAD_REQUEST);

    expect(httpService.replace).not.toHaveBeenCalled();
  });

  it.each([{ equipmentAssetId }, { ...validBody, replacementReason: '   ' }])(
    'returns 400 for invalid replacementReason %#',
    async (body) => {
      await supertest(app.getHttpServer())
        .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
        .set('Idempotency-Key', 'replace-http-key')
        .send(body)
        .expect(HttpStatus.BAD_REQUEST);

      expect(httpService.replace).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...validBody, confirmConflictOverride: 'true' },
    { ...validBody, conflictReviewFingerprint: 123 },
    { ...validBody, conflictOverrideReason: 'x'.repeat(1001) },
  ])(
    'returns 400 for malformed conflict confirmation fields %#',
    async (body) => {
      await supertest(app.getHttpServer())
        .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
        .set('Idempotency-Key', 'replace-http-key')
        .send(body)
        .expect(HttpStatus.BAD_REQUEST);

      expect(httpService.replace).not.toHaveBeenCalled();
    },
  );

  it('normalizes and delegates valid optional conflict confirmation fields', async () => {
    const body = {
      ...validBody,
      confirmConflictOverride: true,
      conflictReviewFingerprint: 'a'.repeat(64),
      conflictOverrideReason: '  Riesgo controlado  ',
    };

    await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
      .set('Idempotency-Key', 'replace-http-key')
      .send(body)
      .expect(HttpStatus.OK);

    expect(httpService.replace).toHaveBeenCalledWith(
      companyId,
      userId,
      assignmentId,
      'replace-http-key',
      {
        ...body,
        conflictOverrideReason: 'Riesgo controlado',
      },
    );
  });

  it('returns the complete REPLACED service response with HTTP 200', async () => {
    const response = await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
      .set('Idempotency-Key', 'replace-http-key')
      .send(validBody)
      .expect(HttpStatus.OK);

    expect(response.body).toEqual(replacedResponse);
  });

  it('returns CONFLICT_REVIEW_REQUIRED as HTTP 200 without converting it to an exception', async () => {
    httpService.replace.mockResolvedValue(conflictReviewResponse);

    const response = await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/replace`)
      .set('Idempotency-Key', 'replace-http-key')
      .send(validBody)
      .expect(HttpStatus.OK);

    expect(response.body).toEqual(conflictReviewResponse);
  });

  it('keeps the existing Create and Manual Release HTTP routes working', async () => {
    await supertest(app.getHttpServer())
      .post('/healthcare/equipment-assignments')
      .set('Idempotency-Key', 'create-http-key')
      .send({ caseId, equipmentAssetId, directAssignmentReason: 'Urgente' })
      .expect(HttpStatus.CREATED);

    await supertest(app.getHttpServer())
      .post(`/healthcare/equipment-assignments/${assignmentId}/release`)
      .send({ reason: 'Equipo ya no requerido' })
      .expect(HttpStatus.OK);

    expect(httpService.create).toHaveBeenCalled();
    expect(httpService.release).toHaveBeenCalledWith(
      companyId,
      userId,
      assignmentId,
      { reason: 'Equipo ya no requerido' },
    );
  });
});
