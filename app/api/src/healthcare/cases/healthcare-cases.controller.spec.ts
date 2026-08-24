import { NotFoundException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthcareCase, HealthcareCaseStatus, UserRole } from '@prisma/client';

import {
  CreateHealthcareCaseInput,
  HealthcareCaseService,
} from './healthcare-case.service';
import { HealthcareCasesController } from './healthcare-cases.controller';

describe('HealthcareCasesController', () => {
  let controller: HealthcareCasesController;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const userId = 'f6c503b4-82db-4e21-b2ce-f7cc9e13f021';
  const caseId = 'cca93237-878a-4467-ae17-b2514dff6819';

  const healthcareCaseServiceMock = {
    create: jest.fn<
      Promise<HealthcareCase>,
      [string, string, CreateHealthcareCaseInput]
    >(),
    findAll: jest.fn<Promise<HealthcareCase[]>, [string]>(),
    findOne: jest.fn<Promise<HealthcareCase>, [string, string]>(),
  };

  const request = {
    user: {
      id: userId,
      companyId,
      email: 'admin@insap.com',
      firstName: 'Admin',
      lastName: 'INSAP',
      role: UserRole.ADMIN,
    },
  };

  const healthcareCase: HealthcareCase = {
    id: caseId,
    companyId,
    folio: 'CASE-000001',
    title: 'Cirugía programada',
    procedureDescription: null,
    status: HealthcareCaseStatus.DRAFT,
    scheduledStart: null,
    scheduledEnd: null,
    responsibleUserId: null,
    createdById: userId,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    createdAt: new Date('2026-08-24T10:00:00.000Z'),
    updatedAt: new Date('2026-08-24T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthcareCasesController],
      providers: [
        {
          provide: HealthcareCaseService,
          useValue: healthcareCaseServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<HealthcareCasesController>(
      HealthcareCasesController,
    );
  });

  const getRolesMetadata = (
    methodName: 'create' | 'findAll' | 'findOne',
  ): UserRole[] | undefined => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HealthcareCasesController.prototype,
      methodName,
    );

    if (!descriptor?.value) {
      return undefined;
    }

    const method = descriptor.value as object;

    return Reflect.getMetadata('roles', method) as UserRole[] | undefined;
  };

  it('should use the healthcare/cases controller path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthcareCasesController)).toBe(
      'healthcare/cases',
    );
  });

  it('should create using the authenticated companyId', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    await controller.create(request, {
      title: 'Cirugía programada',
    });

    expect(healthcareCaseServiceMock.create).toHaveBeenCalledWith(
      companyId,
      userId,
      expect.any(Object),
    );
  });

  it('should create using the authenticated user id as createdById', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    await controller.create(request, {
      title: 'Cirugía programada',
    });

    expect(healthcareCaseServiceMock.create).toHaveBeenCalledWith(
      companyId,
      userId,
      expect.any(Object),
    );
  });

  it('should pass only approved mapped fields to create', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    await controller.create(request, {
      title: 'Cirugía programada',
      procedureDescription: 'Preparación operacional',
      scheduledStart: '2026-09-01T10:00:00.000Z',
      scheduledEnd: '2026-09-01T11:00:00.000Z',
      responsibleUserId: '953a950f-b33a-4ff5-85ac-4ff35b8f3017',
      companyId: 'client-company-id',
      createdById: 'client-user-id',
      status: HealthcareCaseStatus.CANCELLED,
    } as never);

    expect(healthcareCaseServiceMock.create).toHaveBeenCalledWith(
      companyId,
      userId,
      {
        title: 'Cirugía programada',
        procedureDescription: 'Preparación operacional',
        scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
        scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
        responsibleUserId: '953a950f-b33a-4ff5-85ac-4ff35b8f3017',
      },
    );
  });

  it('should map scheduledStart ISO input to Date', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    await controller.create(request, {
      title: 'Cirugía programada',
      scheduledStart: '2026-09-01T10:00:00.000Z',
    });

    expect(healthcareCaseServiceMock.create).toHaveBeenCalledWith(
      companyId,
      userId,
      expect.objectContaining({
        scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      }),
    );
  });

  it('should map scheduledEnd ISO input to Date when present', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    await controller.create(request, {
      title: 'Cirugía programada',
      scheduledStart: '2026-09-01T10:00:00.000Z',
      scheduledEnd: '2026-09-01T11:00:00.000Z',
    });

    expect(healthcareCaseServiceMock.create).toHaveBeenCalledWith(
      companyId,
      userId,
      expect.objectContaining({
        scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
      }),
    );
  });

  it('should return create service result unchanged', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    const result = await controller.create(request, {
      title: 'Cirugía programada',
    });

    expect(result).toBe(healthcareCase);
  });

  it('should propagate create service errors', async () => {
    const error = new Error('create failed');
    healthcareCaseServiceMock.create.mockRejectedValue(error);

    await expect(
      controller.create(request, {
        title: 'Cirugía programada',
      }),
    ).rejects.toBe(error);
  });

  it('should findAll using the authenticated companyId', async () => {
    healthcareCaseServiceMock.findAll.mockResolvedValue([healthcareCase]);

    await controller.findAll(request);

    expect(healthcareCaseServiceMock.findAll).toHaveBeenCalledWith(companyId);
  });

  it('should return findAll result unchanged', async () => {
    const cases = [healthcareCase];
    healthcareCaseServiceMock.findAll.mockResolvedValue(cases);

    const result = await controller.findAll(request);

    expect(result).toBe(cases);
  });

  it('should findOne using companyId and caseId', async () => {
    healthcareCaseServiceMock.findOne.mockResolvedValue(healthcareCase);

    await controller.findOne(request, caseId);

    expect(healthcareCaseServiceMock.findOne).toHaveBeenCalledWith(
      companyId,
      caseId,
    );
  });

  it('should return findOne result unchanged', async () => {
    healthcareCaseServiceMock.findOne.mockResolvedValue(healthcareCase);

    const result = await controller.findOne(request, caseId);

    expect(result).toBe(healthcareCase);
  });

  it('should propagate findOne NotFound errors', async () => {
    const error = new NotFoundException('Caso no encontrado');
    healthcareCaseServiceMock.findOne.mockRejectedValue(error);

    await expect(controller.findOne(request, caseId)).rejects.toBe(error);
  });

  it('should not pass client companyId, createdById, or status to service input', async () => {
    healthcareCaseServiceMock.create.mockResolvedValue(healthcareCase);

    await controller.create(request, {
      title: 'Cirugía programada',
      companyId: 'client-company-id',
      createdById: 'client-user-id',
      status: HealthcareCaseStatus.CANCELLED,
    } as never);

    const createInput = healthcareCaseServiceMock.create.mock.calls[0][2];

    expect(createInput).not.toHaveProperty('companyId');
    expect(createInput).not.toHaveProperty('createdById');
    expect(createInput).not.toHaveProperty('status');
  });

  it('should allow ADMIN, MANAGER, and SALES to create cases', () => {
    expect(getRolesMetadata('create')).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.SALES,
    ]);
  });

  it('should allow ADMIN, MANAGER, SALES, and WAREHOUSE to list cases', () => {
    expect(getRolesMetadata('findAll')).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.SALES,
      UserRole.WAREHOUSE,
    ]);
  });

  it('should allow ADMIN, MANAGER, SALES, and WAREHOUSE to read one case', () => {
    expect(getRolesMetadata('findOne')).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.SALES,
      UserRole.WAREHOUSE,
    ]);
  });
});
