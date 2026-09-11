import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { HealthcareCase, HealthcareCaseStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { HealthcareCaseFolioService } from './healthcare-case-folio.service';
import { HealthcareCaseService } from './healthcare-case.service';

type UserLookupResult = {
  id: string;
} | null;

type MasterLookupResult = {
  isActive: boolean;
} | null;

type CompactDoctor = {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  isActive: boolean;
};

type CompactHospital = {
  id: string;
  name: string;
  city: string;
  state: string;
  isActive: boolean;
};

type HealthcareCasePersistenceRecord = HealthcareCase & {
  healthcareDoctor: CompactDoctor | null;
  healthcareHospital: CompactHospital | null;
};

type HealthcareCaseCreateData = Omit<
  HealthcareCase,
  'id' | 'createdAt' | 'updatedAt'
>;

type HealthcareCaseCreateArgs = {
  data: HealthcareCaseCreateData;
};

type HealthcareCaseUpdateData = Partial<HealthcareCaseCreateData>;

type HealthcareCaseUpdateManyArgs = {
  where: unknown;
  data: HealthcareCaseUpdateData;
};

type UpdateManyResult = {
  count: number;
};

describe('HealthcareCaseService', () => {
  let service: HealthcareCaseService;
  let persistedCase: HealthcareCasePersistenceRecord;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const otherCompanyId = '64af248f-8081-4407-91f5-8d545749d7f4';
  const createdById = 'created-by-user-id';
  const responsibleUserId = 'responsible-user-id';
  const caseId = 'healthcare-case-id';
  const doctorId = 'doctor-id';
  const replacementDoctorId = 'replacement-doctor-id';
  const hospitalId = 'hospital-id';
  const replacementHospitalId = 'replacement-hospital-id';

  const compactDoctor: CompactDoctor = {
    id: doctorId,
    firstName: 'Ana',
    lastName: 'Torres',
    specialty: 'Cardiología',
    isActive: true,
  };
  const compactHospital: CompactHospital = {
    id: hospitalId,
    name: 'Hospital Central',
    city: 'Hermosillo',
    state: 'Sonora',
    isActive: true,
  };

  const userFindFirstMock = jest.fn<Promise<UserLookupResult>, [unknown]>();
  const doctorFindFirstMock = jest.fn<Promise<MasterLookupResult>, [unknown]>();
  const hospitalFindFirstMock = jest.fn<
    Promise<MasterLookupResult>,
    [unknown]
  >();
  const healthcareCaseCreateMock = jest.fn<
    Promise<HealthcareCasePersistenceRecord>,
    [HealthcareCaseCreateArgs]
  >();
  const healthcareCaseFindManyMock = jest.fn<
    Promise<HealthcareCasePersistenceRecord[]>,
    [unknown]
  >();
  const healthcareCaseFindFirstMock = jest.fn<
    Promise<HealthcareCasePersistenceRecord | null>,
    [unknown]
  >();
  const txHealthcareCaseFindFirstMock = jest.fn<
    Promise<HealthcareCasePersistenceRecord | null>,
    [unknown]
  >();
  const healthcareCaseUpdateManyMock = jest.fn<
    Promise<UpdateManyResult>,
    [HealthcareCaseUpdateManyArgs]
  >();
  const prismaTransactionMock = jest.fn();

  const txMock = {
    user: {
      findFirst: userFindFirstMock,
    },
    healthcareCase: {
      create: healthcareCaseCreateMock,
      findFirst: txHealthcareCaseFindFirstMock,
      updateMany: healthcareCaseUpdateManyMock,
    },
    healthcareDoctor: {
      findFirst: doctorFindFirstMock,
    },
    healthcareHospital: {
      findFirst: hospitalFindFirstMock,
    },
  };

  const prismaMock = {
    $transaction: prismaTransactionMock,
    healthcareCase: {
      findMany: healthcareCaseFindManyMock,
      findFirst: healthcareCaseFindFirstMock,
    },
  };

  const healthcareCaseFolioServiceMock = {
    allocateNextAvailableFolio: jest.fn<Promise<string>, [unknown, string]>(),
  };

  const createdAt = new Date('2026-08-24T10:00:00.000Z');
  const updatedAt = new Date('2026-08-24T10:00:00.000Z');

  const baseCase: HealthcareCasePersistenceRecord = {
    id: caseId,
    companyId,
    doctorId: null,
    hospitalId: null,
    folio: 'CASE-000001',
    title: 'Cirugía programada',
    procedureDescription: null,
    status: HealthcareCaseStatus.DRAFT,
    scheduledStart: null,
    scheduledEnd: null,
    responsibleUserId: null,
    createdById,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    createdAt,
    updatedAt,
    healthcareDoctor: null,
    healthcareHospital: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    persistedCase = {
      ...baseCase,
    };

    prismaTransactionMock.mockImplementation(
      (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock),
    );

    userFindFirstMock.mockResolvedValue({
      id: createdById,
    });
    doctorFindFirstMock.mockResolvedValue({ isActive: true });
    hospitalFindFirstMock.mockResolvedValue({ isActive: true });

    healthcareCaseFolioServiceMock.allocateNextAvailableFolio.mockResolvedValue(
      'CASE-000001',
    );

    healthcareCaseCreateMock.mockImplementation(({ data }) =>
      Promise.resolve({
        ...baseCase,
        ...data,
        healthcareDoctor: data.doctorId
          ? {
              ...compactDoctor,
              id: data.doctorId,
            }
          : null,
        healthcareHospital: data.hospitalId
          ? {
              ...compactHospital,
              id: data.hospitalId,
            }
          : null,
      }),
    );

    txHealthcareCaseFindFirstMock.mockImplementation(() =>
      Promise.resolve(persistedCase),
    );

    healthcareCaseUpdateManyMock.mockImplementation(({ data }) => {
      const doctorChanged = Boolean(
        Object.prototype.hasOwnProperty.call(data, 'doctorId') &&
        data.doctorId !== persistedCase.doctorId,
      );
      const hospitalChanged = Boolean(
        Object.prototype.hasOwnProperty.call(data, 'hospitalId') &&
        data.hospitalId !== persistedCase.hospitalId,
      );

      persistedCase = {
        ...persistedCase,
        ...data,
        ...(doctorChanged
          ? {
              healthcareDoctor: data.doctorId
                ? { ...compactDoctor, id: data.doctorId }
                : null,
            }
          : {}),
        ...(hospitalChanged
          ? {
              healthcareHospital: data.hospitalId
                ? { ...compactHospital, id: data.hospitalId }
                : null,
            }
          : {}),
      };

      return Promise.resolve({
        count: 1,
      });
    });

    service = new HealthcareCaseService(
      prismaMock as unknown as PrismaService,
      healthcareCaseFolioServiceMock as unknown as HealthcareCaseFolioService,
    );
  });

  const getLastCreateData = (): HealthcareCaseCreateData => {
    const lastCall = healthcareCaseCreateMock.mock.lastCall;

    if (!lastCall) {
      throw new Error('Expected healthcareCase.create to have been called');
    }

    return lastCall[0].data;
  };

  const expectLastCreateData = (
    expected: Partial<HealthcareCaseCreateData>,
  ) => {
    expect(getLastCreateData()).toEqual(expect.objectContaining(expected));
  };

  const getLastUpdateData = (): HealthcareCaseUpdateData => {
    const lastCall = healthcareCaseUpdateManyMock.mock.lastCall;

    if (!lastCall) {
      throw new Error('Expected healthcareCase.updateMany to have been called');
    }

    return lastCall[0].data;
  };

  const expectLastUpdateData = (
    expected: Partial<HealthcareCaseUpdateData>,
  ) => {
    expect(getLastUpdateData()).toEqual(expect.objectContaining(expected));
  };

  const toResponse = (record: HealthcareCasePersistenceRecord) => {
    const { healthcareDoctor, healthcareHospital, ...data } = record;

    return {
      ...data,
      doctor: healthcareDoctor,
      hospital: healthcareHospital,
    };
  };

  const captureHttpException = async (
    operation: Promise<unknown>,
  ): Promise<HttpException> => {
    try {
      await operation;
    } catch (error) {
      if (error instanceof HttpException) {
        return error;
      }

      throw error;
    }

    throw new Error('Expected operation to reject with HttpException');
  };

  const knownPrismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('sensitive persistence detail', {
      code,
      clientVersion: '6.19.3',
    });

  it('should create an unscheduled case as DRAFT', async () => {
    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
    });

    expect(result.status).toBe(HealthcareCaseStatus.DRAFT);
    expectLastCreateData({
      scheduledStart: null,
      scheduledEnd: null,
      status: HealthcareCaseStatus.DRAFT,
    });
  });

  it('should create a case with scheduledStart only as SCHEDULED', async () => {
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');

    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      scheduledStart,
    });

    expect(result.status).toBe(HealthcareCaseStatus.SCHEDULED);
    expectLastCreateData({
      scheduledStart,
      scheduledEnd: null,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should create a case with scheduledStart and later scheduledEnd as SCHEDULED', async () => {
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');
    const scheduledEnd = new Date('2026-09-01T11:00:00.000Z');

    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      scheduledStart,
      scheduledEnd,
    });

    expect(result.status).toBe(HealthcareCaseStatus.SCHEDULED);
    expectLastCreateData({
      scheduledStart,
      scheduledEnd,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should reject scheduledEnd without scheduledStart', async () => {
    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();
  });

  it('should reject scheduledEnd equal to scheduledStart', async () => {
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');

    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        scheduledStart,
        scheduledEnd: scheduledStart,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();
  });

  it('should reject scheduledEnd before scheduledStart', async () => {
    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
        scheduledEnd: new Date('2026-09-01T09:59:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();
  });

  it('should normalize and trim title', async () => {
    await service.create(companyId, createdById, {
      title: '  Cirugía programada  ',
    });

    expectLastCreateData({
      title: 'Cirugía programada',
    });
  });

  it('should reject a blank title', async () => {
    await expect(
      service.create(companyId, createdById, {
        title: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();
  });

  it('should trim procedureDescription', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      procedureDescription: '  Preparación operacional  ',
    });

    expectLastCreateData({
      procedureDescription: 'Preparación operacional',
    });
  });

  it('should store a blank procedureDescription as null', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      procedureDescription: '   ',
    });

    expectLastCreateData({
      procedureDescription: null,
    });
  });

  it('should allow creation without responsibleUserId', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
    });

    expect(userFindFirstMock).toHaveBeenCalledTimes(1);
    expect(healthcareCaseCreateMock).toHaveBeenCalled();
  });

  it('should accept a valid same-company active responsible user', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      responsibleUserId,
    });

    expect(userFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: {
        id: responsibleUserId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    expectLastCreateData({
      responsibleUserId,
    });
  });

  it('should reject a cross-tenant responsible user safely', async () => {
    userFindFirstMock
      .mockResolvedValueOnce({
        id: createdById,
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        responsibleUserId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: {
        id: responsibleUserId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an inactive responsible user safely', async () => {
    userFindFirstMock
      .mockResolvedValueOnce({
        id: createdById,
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        responsibleUserId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: {
        id: responsibleUserId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  });

  it('should generate the folio inside the same transaction used for create', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
    });

    expect(
      healthcareCaseFolioServiceMock.allocateNextAvailableFolio,
    ).toHaveBeenCalledWith(txMock, companyId);
    expectLastCreateData({
      folio: 'CASE-000001',
    });
  });

  it('should use companyId from the service argument instead of input', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      companyId: otherCompanyId,
    } as never);

    expectLastCreateData({
      companyId,
    });
  });

  it('should use createdById from the service argument instead of input', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      createdById: 'input-created-by-id',
    } as never);

    expectLastCreateData({
      createdById,
    });
  });

  it('should derive status on the server instead of using input status', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      status: HealthcareCaseStatus.CANCELLED,
    } as never);

    expectLastCreateData({
      status: HealthcareCaseStatus.DRAFT,
    });
  });

  it('should not allow cancellation fields from input', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      cancelledAt: new Date('2026-09-01T09:00:00.000Z'),
      cancelledById: 'input-cancelled-by-id',
      cancellationReason: 'input reason',
    } as never);

    expectLastCreateData({
      cancelledAt: null,
      cancelledById: null,
      cancellationReason: null,
    });
  });

  it('should propagate create failures without opening a second transaction or retrying create', async () => {
    const error = new Error('unique constraint race');
    healthcareCaseCreateMock.mockRejectedValueOnce(error);

    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
      }),
    ).rejects.toThrow(error);

    expect(prismaTransactionMock).toHaveBeenCalledTimes(1);
    expect(healthcareCaseCreateMock).toHaveBeenCalledTimes(1);
  });

  it('should accept a same-company active creator', async () => {
    await service.create(companyId, createdById, {
      title: 'Cirugía programada',
    });

    expect(userFindFirstMock).toHaveBeenNthCalledWith(1, {
      where: {
        id: createdById,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  });

  it('should reject a cross-tenant creator safely', async () => {
    userFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an inactive creator safely', async () => {
    userFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
  });

  it('should create without Doctor or Hospital relations', async () => {
    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
    });

    expectLastCreateData({ doctorId: null, hospitalId: null });
    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      doctorId: null,
      hospitalId: null,
      doctor: null,
      hospital: null,
    });
  });

  it('should create with only a same-tenant active Doctor', async () => {
    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      doctorId,
    });

    expect(doctorFindFirstMock).toHaveBeenCalledWith({
      where: { id: doctorId, companyId },
      select: { isActive: true },
    });
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
    expectLastCreateData({ doctorId, hospitalId: null });
    expect(result.doctor).toEqual(compactDoctor);
    expect(result.hospital).toBeNull();
  });

  it('should create with only a same-tenant active Hospital', async () => {
    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      hospitalId,
    });

    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).toHaveBeenCalledWith({
      where: { id: hospitalId, companyId },
      select: { isActive: true },
    });
    expectLastCreateData({ doctorId: null, hospitalId });
    expect(result.doctor).toBeNull();
    expect(result.hospital).toEqual(compactHospital);
  });

  it('should validate Doctor before Hospital and persist both active relations', async () => {
    const result = await service.create(companyId, createdById, {
      title: 'Cirugía programada',
      doctorId,
      hospitalId,
    });

    expect(doctorFindFirstMock).toHaveBeenCalledWith({
      where: { id: doctorId, companyId },
      select: { isActive: true },
    });
    expect(hospitalFindFirstMock).toHaveBeenCalledWith({
      where: { id: hospitalId, companyId },
      select: { isActive: true },
    });
    expect(doctorFindFirstMock.mock.invocationCallOrder[0]).toBeLessThan(
      hospitalFindFirstMock.mock.invocationCallOrder[0] ?? 0,
    );
    expectLastCreateData({ doctorId, hospitalId });
    expect(result).toMatchObject({
      doctorId,
      hospitalId,
      doctor: compactDoctor,
      hospital: compactHospital,
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        'id',
        'companyId',
        'doctorId',
        'hospitalId',
        'folio',
        'title',
        'procedureDescription',
        'status',
        'scheduledStart',
        'scheduledEnd',
        'responsibleUserId',
        'createdById',
        'cancelledAt',
        'cancelledById',
        'cancellationReason',
        'createdAt',
        'updatedAt',
        'doctor',
        'hospital',
      ].sort(),
    );
    expect(Object.keys(result.doctor ?? {}).sort()).toEqual(
      ['id', 'firstName', 'lastName', 'specialty', 'isActive'].sort(),
    );
    expect(Object.keys(result.hospital ?? {}).sort()).toEqual(
      ['id', 'name', 'city', 'state', 'isActive'].sort(),
    );
  });

  it.each(['missing', 'foreign'])(
    'should return tenant-safe DOCTOR_NOT_FOUND for a %s Doctor on create',
    async () => {
      doctorFindFirstMock.mockResolvedValueOnce(null);

      const error = await captureHttpException(
        service.create(companyId, createdById, {
          title: 'Cirugía programada',
          doctorId,
        }),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ code: 'DOCTOR_NOT_FOUND' });
      expect(doctorFindFirstMock).toHaveBeenCalledWith({
        where: { id: doctorId, companyId },
        select: { isActive: true },
      });
      expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
    },
  );

  it('should return DOCTOR_INACTIVE for an inactive Doctor on create', async () => {
    doctorFindFirstMock.mockResolvedValueOnce({ isActive: false });

    const error = await captureHttpException(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        doctorId,
      }),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ code: 'DOCTOR_INACTIVE' });
    expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
  });

  it.each(['missing', 'foreign'])(
    'should return tenant-safe HOSPITAL_NOT_FOUND for a %s Hospital on create',
    async () => {
      hospitalFindFirstMock.mockResolvedValueOnce(null);

      const error = await captureHttpException(
        service.create(companyId, createdById, {
          title: 'Cirugía programada',
          hospitalId,
        }),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({
        code: 'HOSPITAL_NOT_FOUND',
      });
      expect(hospitalFindFirstMock).toHaveBeenCalledWith({
        where: { id: hospitalId, companyId },
        select: { isActive: true },
      });
      expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
    },
  );

  it('should return HOSPITAL_INACTIVE for an inactive Hospital on create', async () => {
    hospitalFindFirstMock.mockResolvedValueOnce({ isActive: false });

    const error = await captureHttpException(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        hospitalId,
      }),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ code: 'HOSPITAL_INACTIVE' });
    expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
  });

  it.each([
    ['missing Doctor', null],
    ['inactive Doctor', { isActive: false }],
  ] as const)(
    'should let %s win over an invalid Hospital on create',
    async (_scenario, doctorResult) => {
      doctorFindFirstMock.mockResolvedValueOnce(doctorResult);
      hospitalFindFirstMock.mockResolvedValueOnce(null);

      const error = await captureHttpException(
        service.create(companyId, createdById, {
          title: 'Cirugía programada',
          doctorId,
          hospitalId,
        }),
      );

      expect(error.getResponse()).toMatchObject({
        code: doctorResult ? 'DOCTOR_INACTIVE' : 'DOCTOR_NOT_FOUND',
      });
      expect(hospitalFindFirstMock).not.toHaveBeenCalled();
      expect(healthcareCaseCreateMock).not.toHaveBeenCalled();
    },
  );

  it('should translate a relationship P2003 race without leaking persistence details', async () => {
    healthcareCaseCreateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('sensitive constraint detail', {
        code: 'P2003',
        clientVersion: '6.19.3',
      }),
    );

    const error = await captureHttpException(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
        doctorId,
      }),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      code: 'RELATED_RESOURCE_CHANGED',
      message: 'Un recurso relacionado cambió. Recarga e intenta nuevamente',
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('constraint');
  });

  it('should map other known create failures to the stable persistence error', async () => {
    healthcareCaseCreateMock.mockRejectedValueOnce(knownPrismaError('P2002'));

    const error = await captureHttpException(
      service.create(companyId, createdById, {
        title: 'Cirugía programada',
      }),
    );

    expect(error.getResponse()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'HEALTHCARE_PERSISTENCE_ERROR',
      message: 'No fue posible completar la operación',
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('persistence');
  });

  it('should list cases scoped by companyId with deterministic ordering', async () => {
    healthcareCaseFindManyMock.mockResolvedValueOnce([baseCase]);

    await expect(service.findAll(companyId)).resolves.toEqual([
      toResponse(baseCase),
    ]);

    const listArgs = healthcareCaseFindManyMock.mock.lastCall?.[0] as {
      where: unknown;
      select: Record<string, unknown>;
      orderBy: unknown;
    };

    expect(listArgs.where).toEqual({
      companyId,
    });
    expect(listArgs.select).toEqual(
      expect.objectContaining({
        doctorId: true,
        hospitalId: true,
        healthcareDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true,
            isActive: true,
          },
        },
        healthcareHospital: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            isActive: true,
          },
        },
      }),
    );
    expect(listArgs.orderBy).toEqual({
      createdAt: 'desc',
    });
    expect(healthcareCaseFindManyMock).toHaveBeenCalledTimes(1);
    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
  });

  it('should find one case using id and companyId', async () => {
    healthcareCaseFindFirstMock.mockResolvedValueOnce(baseCase);

    await expect(service.findOne(companyId, caseId)).resolves.toEqual(
      toResponse(baseCase),
    );

    const detailArgs = healthcareCaseFindFirstMock.mock.lastCall?.[0] as {
      where: unknown;
      select: unknown;
    };

    expect(detailArgs.where).toEqual({ id: caseId, companyId });
    expect(detailArgs.select).toBeDefined();
  });

  it('should throw NotFound when a case does not exist', async () => {
    healthcareCaseFindFirstMock.mockResolvedValueOnce(null);

    await expect(service.findOne(companyId, caseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should throw the same NotFound for cross-tenant lookup simulation', async () => {
    healthcareCaseFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.findOne(otherCompanyId, caseId),
    ).rejects.toBeInstanceOf(NotFoundException);

    const detailArgs = healthcareCaseFindFirstMock.mock.lastCall?.[0] as {
      where: unknown;
      select: unknown;
    };

    expect(detailArgs.where).toEqual({
      id: caseId,
      companyId: otherCompanyId,
    });
    expect(detailArgs.select).toBeDefined();
  });

  it('should keep a DRAFT case as DRAFT on title-only update', async () => {
    const result = await service.update(companyId, caseId, {
      title: 'Caso actualizado',
    });

    expect(result.status).toBe(HealthcareCaseStatus.DRAFT);
    expectLastUpdateData({
      title: 'Caso actualizado',
      status: HealthcareCaseStatus.DRAFT,
    });
  });

  it('should transition DRAFT to SCHEDULED when scheduledStart is added', async () => {
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');

    const result = await service.update(companyId, caseId, {
      scheduledStart,
    });

    expect(result.status).toBe(HealthcareCaseStatus.SCHEDULED);
    expectLastUpdateData({
      scheduledStart,
      scheduledEnd: null,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should preserve the existing title when a schedule-only PATCH omits title as undefined', async () => {
    const scheduledStart = new Date('2026-08-28T15:00:00.000Z');
    const scheduledEnd = new Date('2026-08-28T17:00:00.000Z');

    persistedCase = {
      ...baseCase,
      title: 'Título persistido',
      scheduledStart: null,
      scheduledEnd: null,
      status: HealthcareCaseStatus.DRAFT,
    };

    const result = await service.update(companyId, caseId, {
      title: undefined,
      scheduledStart,
      scheduledEnd,
    });

    expect(result.title).toBe('Título persistido');
    expect(result.scheduledStart).toBe(scheduledStart);
    expect(result.scheduledEnd).toBe(scheduledEnd);
    expect(result.status).toBe(HealthcareCaseStatus.SCHEDULED);
    expectLastUpdateData({
      title: 'Título persistido',
      scheduledStart,
      scheduledEnd,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should keep a SCHEDULED case as SCHEDULED when schedule is edited', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
    };

    const scheduledEnd = new Date('2026-09-01T12:00:00.000Z');

    const result = await service.update(companyId, caseId, {
      scheduledEnd,
    });

    expect(result.status).toBe(HealthcareCaseStatus.SCHEDULED);
    expectLastUpdateData({
      scheduledStart: persistedCase.scheduledStart,
      scheduledEnd,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should retain title when it is omitted in an unrelated PATCH', async () => {
    persistedCase = {
      ...baseCase,
      title: 'Caso existente',
      procedureDescription: 'Descripción anterior',
    };

    const result = await service.update(companyId, caseId, {
      procedureDescription: 'Descripción nueva',
    });

    expect(result.title).toBe('Caso existente');
    expectLastUpdateData({
      title: 'Caso existente',
      procedureDescription: 'Descripción nueva',
    });
  });

  it('should transition SCHEDULED to DRAFT when start and end are cleared', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
    };

    const result = await service.update(companyId, caseId, {
      scheduledStart: null,
      scheduledEnd: null,
    });

    expect(result.status).toBe(HealthcareCaseStatus.DRAFT);
    expectLastUpdateData({
      scheduledStart: null,
      scheduledEnd: null,
      status: HealthcareCaseStatus.DRAFT,
    });
  });

  it('should reject clearing scheduledStart while retaining an existing scheduledEnd', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
    };

    await expect(
      service.update(companyId, caseId, {
        scheduledStart: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should reject an effective scheduledEnd that is not after scheduledStart', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      scheduledEnd: null,
    };

    await expect(
      service.update(companyId, caseId, {
        scheduledEnd: new Date('2026-09-01T10:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should trim title on update', async () => {
    await service.update(companyId, caseId, {
      title: '  Caso actualizado  ',
    });

    expectLastUpdateData({
      title: 'Caso actualizado',
    });
  });

  it('should retain procedureDescription when it is omitted', async () => {
    persistedCase = {
      ...baseCase,
      procedureDescription: 'Descripción existente',
    };

    await service.update(companyId, caseId, {
      title: 'Caso actualizado',
    });

    expectLastUpdateData({
      procedureDescription: 'Descripción existente',
    });
  });

  it('should reject blank title on update', async () => {
    await expect(
      service.update(companyId, caseId, {
        title: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should normalize blank procedureDescription to null on update', async () => {
    await service.update(companyId, caseId, {
      procedureDescription: '   ',
    });

    expectLastUpdateData({
      procedureDescription: null,
    });
  });

  it('should retain responsibleUserId when it is omitted', async () => {
    persistedCase = {
      ...baseCase,
      responsibleUserId,
    };

    await service.update(companyId, caseId, {
      title: 'Caso actualizado',
    });

    expectLastUpdateData({
      responsibleUserId,
    });
    expect(userFindFirstMock).not.toHaveBeenCalled();
  });

  it('should retain responsibleUserId when it is omitted as undefined', async () => {
    persistedCase = {
      ...baseCase,
      responsibleUserId,
    };

    await service.update(companyId, caseId, {
      responsibleUserId: undefined,
      procedureDescription: 'Descripción nueva',
    });

    expectLastUpdateData({
      responsibleUserId,
    });
    expect(userFindFirstMock).not.toHaveBeenCalled();
  });

  it('should clear responsibleUserId when null is supplied', async () => {
    persistedCase = {
      ...baseCase,
      responsibleUserId,
    };

    await service.update(companyId, caseId, {
      responsibleUserId: null,
    });

    expectLastUpdateData({
      responsibleUserId: null,
    });
  });

  it('should update a valid responsible user', async () => {
    await service.update(companyId, caseId, {
      responsibleUserId,
    });

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: responsibleUserId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    expectLastUpdateData({
      responsibleUserId,
    });
  });

  it('should reject a cross-tenant or inactive responsible user on update', async () => {
    userFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.update(companyId, caseId, {
        responsibleUserId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should preserve Doctor and Hospital when relationship fields are omitted', async () => {
    persistedCase = {
      ...baseCase,
      doctorId,
      hospitalId,
      healthcareDoctor: compactDoctor,
      healthcareHospital: compactHospital,
    };

    const result = await service.update(companyId, caseId, {
      title: 'Caso actualizado',
    });

    expectLastUpdateData({ doctorId, hospitalId });
    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      doctorId,
      hospitalId,
      doctor: compactDoctor,
      hospital: compactHospital,
    });
  });

  it('should return enriched historical relations even after both masters become inactive', async () => {
    const historicalCase: HealthcareCasePersistenceRecord = {
      ...baseCase,
      doctorId,
      hospitalId,
      healthcareDoctor: { ...compactDoctor, isActive: false },
      healthcareHospital: { ...compactHospital, isActive: false },
    };
    healthcareCaseFindManyMock.mockResolvedValueOnce([historicalCase]);
    healthcareCaseFindFirstMock.mockResolvedValueOnce(historicalCase);

    await expect(service.findAll(companyId)).resolves.toEqual([
      {
        ...toResponse(historicalCase),
        doctor: { ...compactDoctor, isActive: false },
        hospital: { ...compactHospital, isActive: false },
      },
    ]);
    await expect(service.findOne(companyId, caseId)).resolves.toEqual({
      ...toResponse(historicalCase),
      doctor: { ...compactDoctor, isActive: false },
      hospital: { ...compactHospital, isActive: false },
    });
  });

  it('should clear Doctor and Hospital only when explicit nulls are supplied', async () => {
    persistedCase = {
      ...baseCase,
      doctorId,
      hospitalId,
      healthcareDoctor: compactDoctor,
      healthcareHospital: compactHospital,
    };

    const result = await service.update(companyId, caseId, {
      doctorId: null,
      hospitalId: null,
    });

    expectLastUpdateData({ doctorId: null, hospitalId: null });
    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      doctorId: null,
      hospitalId: null,
      doctor: null,
      hospital: null,
    });
  });

  it('should validate and replace a different Doctor', async () => {
    persistedCase = {
      ...baseCase,
      doctorId,
      healthcareDoctor: compactDoctor,
    };

    const result = await service.update(companyId, caseId, {
      doctorId: replacementDoctorId,
    });

    expect(doctorFindFirstMock).toHaveBeenCalledWith({
      where: { id: replacementDoctorId, companyId },
      select: { isActive: true },
    });
    expectLastUpdateData({ doctorId: replacementDoctorId });
    expect(result.doctor).toEqual({
      ...compactDoctor,
      id: replacementDoctorId,
    });
  });

  it('should validate and replace a different Hospital', async () => {
    persistedCase = {
      ...baseCase,
      hospitalId,
      healthcareHospital: compactHospital,
    };

    const result = await service.update(companyId, caseId, {
      hospitalId: replacementHospitalId,
    });

    expect(hospitalFindFirstMock).toHaveBeenCalledWith({
      where: { id: replacementHospitalId, companyId },
      select: { isActive: true },
    });
    expectLastUpdateData({ hospitalId: replacementHospitalId });
    expect(result.hospital).toEqual({
      ...compactHospital,
      id: replacementHospitalId,
    });
  });

  it('should validate Doctor before Hospital when replacing both', async () => {
    await service.update(companyId, caseId, {
      doctorId: replacementDoctorId,
      hospitalId: replacementHospitalId,
    });

    expect(doctorFindFirstMock.mock.invocationCallOrder[0]).toBeLessThan(
      hospitalFindFirstMock.mock.invocationCallOrder[0] ?? 0,
    );
    expectLastUpdateData({
      doctorId: replacementDoctorId,
      hospitalId: replacementHospitalId,
    });
  });

  it.each([
    ['Doctor', 'doctorId', doctorId, 'healthcareDoctor'],
    ['Hospital', 'hospitalId', hospitalId, 'healthcareHospital'],
  ] as const)(
    'should keep the same inactive %s without active revalidation',
    async (_label, idField, currentId, relationField) => {
      persistedCase = {
        ...baseCase,
        [idField]: currentId,
        [relationField]: {
          ...(relationField === 'healthcareDoctor'
            ? compactDoctor
            : compactHospital),
          isActive: false,
        },
      };

      const result = await service.update(companyId, caseId, {
        [idField]: currentId,
      });

      expect(doctorFindFirstMock).not.toHaveBeenCalled();
      expect(hospitalFindFirstMock).not.toHaveBeenCalled();
      expect(getLastUpdateData()).toMatchObject({ [idField]: currentId });
      expect(
        idField === 'doctorId' ? result.doctor : result.hospital,
      ).toMatchObject({ id: currentId, isActive: false });
    },
  );

  it.each([
    [
      'Doctor',
      'doctorId',
      replacementDoctorId,
      doctorFindFirstMock,
      'DOCTOR_NOT_FOUND',
    ],
    [
      'Hospital',
      'hospitalId',
      replacementHospitalId,
      hospitalFindFirstMock,
      'HOSPITAL_NOT_FOUND',
    ],
  ] as const)(
    'should return tenant-safe not-found for a missing or foreign replacement %s',
    async (_label, field, replacementId, lookup, code) => {
      lookup.mockResolvedValueOnce(null);

      const error = await captureHttpException(
        service.update(companyId, caseId, { [field]: replacementId }),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ code });
      expect(lookup).toHaveBeenCalledWith({
        where: { id: replacementId, companyId },
        select: { isActive: true },
      });
      expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'Doctor',
      'doctorId',
      replacementDoctorId,
      doctorFindFirstMock,
      'DOCTOR_INACTIVE',
    ],
    [
      'Hospital',
      'hospitalId',
      replacementHospitalId,
      hospitalFindFirstMock,
      'HOSPITAL_INACTIVE',
    ],
  ] as const)(
    'should reject an inactive replacement %s',
    async (_label, field, replacementId, lookup, code) => {
      lookup.mockResolvedValueOnce({ isActive: false });

      const error = await captureHttpException(
        service.update(companyId, caseId, { [field]: replacementId }),
      );

      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ code });
      expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
    },
  );

  it('should return the Doctor error first when both replacements are invalid', async () => {
    doctorFindFirstMock.mockResolvedValueOnce(null);
    hospitalFindFirstMock.mockResolvedValueOnce(null);

    const error = await captureHttpException(
      service.update(companyId, caseId, {
        doctorId: replacementDoctorId,
        hospitalId: replacementHospitalId,
      }),
    );

    expect(error.getResponse()).toMatchObject({ code: 'DOCTOR_NOT_FOUND' });
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should preserve Doctor and Hospital while rescheduling', async () => {
    persistedCase = {
      ...baseCase,
      doctorId,
      hospitalId,
      healthcareDoctor: compactDoctor,
      healthcareHospital: compactHospital,
    };
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');

    await service.update(companyId, caseId, { scheduledStart });

    expectLastUpdateData({ doctorId, hospitalId, scheduledStart });
    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
  });

  it('should translate update P2003 without exposing persistence details', async () => {
    healthcareCaseUpdateManyMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('sensitive foreign key detail', {
        code: 'P2003',
        clientVersion: '6.19.3',
      }),
    );

    const error = await captureHttpException(
      service.update(companyId, caseId, {
        doctorId: replacementDoctorId,
      }),
    );

    expect(error.getResponse()).toMatchObject({
      code: 'RELATED_RESOURCE_CHANGED',
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('foreign key');
  });

  it('should map an update state race to RESOURCE_STATE_CHANGED after a scoped re-read', async () => {
    healthcareCaseUpdateManyMock.mockResolvedValueOnce({ count: 0 });

    const error = await captureHttpException(
      service.update(companyId, caseId, { title: 'Caso actualizado' }),
    );

    expect(error.getResponse()).toMatchObject({
      statusCode: 409,
      code: 'RESOURCE_STATE_CHANGED',
    });
    expect(txHealthcareCaseFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: { id: caseId, companyId },
      select: { id: true },
    });
  });

  it('should preserve missing/foreign 404 semantics when an update loses its row', async () => {
    healthcareCaseUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    txHealthcareCaseFindFirstMock
      .mockResolvedValueOnce(baseCase)
      .mockResolvedValueOnce(null);

    await expect(
      service.update(companyId, caseId, { title: 'Caso actualizado' }),
    ).rejects.toEqual(new NotFoundException('Caso no encontrado'));
  });

  it('should map other known update failures to the stable persistence error', async () => {
    healthcareCaseUpdateManyMock.mockRejectedValueOnce(
      knownPrismaError('P2002'),
    );

    const error = await captureHttpException(
      service.update(companyId, caseId, { title: 'Caso actualizado' }),
    );

    expect(error.getResponse()).toMatchObject({
      statusCode: 500,
      code: 'HEALTHCARE_PERSISTENCE_ERROR',
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('persistence');
  });

  it('should ignore status supplied through application input on update', async () => {
    await service.update(companyId, caseId, {
      status: HealthcareCaseStatus.CANCELLED,
    } as never);

    expectLastUpdateData({
      status: HealthcareCaseStatus.DRAFT,
    });
  });

  it('should keep folio, companyId, and createdById unchanged on update', async () => {
    await service.update(companyId, caseId, {
      folio: 'CLIENT-FOLIO',
      companyId: otherCompanyId,
      createdById: 'client-created-by',
      title: 'Caso actualizado',
    } as never);

    const updateData = getLastUpdateData();

    expect(updateData).not.toHaveProperty('folio');
    expect(updateData).not.toHaveProperty('companyId');
    expect(updateData).not.toHaveProperty('createdById');
  });

  it('should reject PATCH for a cancelled case', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.CANCELLED,
    };

    await expect(
      service.update(companyId, caseId, {
        title: 'Caso actualizado',
        doctorId: replacementDoctorId,
        hospitalId: replacementHospitalId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(doctorFindFirstMock).not.toHaveBeenCalled();
    expect(hospitalFindFirstMock).not.toHaveBeenCalled();
    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should return NotFound for missing or cross-tenant case on update', async () => {
    txHealthcareCaseFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.update(companyId, caseId, {
        title: 'Caso actualizado',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should derive update status from the effective schedule', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      scheduledEnd: null,
    };

    await service.update(companyId, caseId, {
      title: 'Caso actualizado',
    });

    expectLastUpdateData({
      scheduledStart: persistedCase.scheduledStart,
      scheduledEnd: persistedCase.scheduledEnd,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should retain scheduled fields when they are omitted', async () => {
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');
    const scheduledEnd = new Date('2026-09-01T11:00:00.000Z');

    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart,
      scheduledEnd,
    };

    const result = await service.update(companyId, caseId, {
      procedureDescription: 'Descripción nueva',
    });

    expect(result.scheduledStart).toBe(scheduledStart);
    expect(result.scheduledEnd).toBe(scheduledEnd);
    expectLastUpdateData({
      scheduledStart,
      scheduledEnd,
      status: HealthcareCaseStatus.SCHEDULED,
    });
  });

  it('should cancel a DRAFT case', async () => {
    const result = await service.cancel(
      companyId,
      caseId,
      createdById,
      '  Error de captura  ',
    );

    expect(result.status).toBe(HealthcareCaseStatus.CANCELLED);
    expectLastUpdateData({
      status: HealthcareCaseStatus.CANCELLED,
      cancelledById: createdById,
      cancellationReason: 'Error de captura',
    });
    expect(getLastUpdateData().cancelledAt).toBeInstanceOf(Date);
  });

  it('should cancel a SCHEDULED case', async () => {
    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
    };

    const result = await service.cancel(
      companyId,
      caseId,
      createdById,
      'Cancelación operacional',
    );

    expect(result.status).toBe(HealthcareCaseStatus.CANCELLED);
  });

  it('should reject blank cancellation reason', async () => {
    await expect(
      service.cancel(companyId, caseId, createdById, '   '),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();
  });

  it('should preserve schedule, title, and procedureDescription when cancelling', async () => {
    const scheduledStart = new Date('2026-09-01T10:00:00.000Z');
    const scheduledEnd = new Date('2026-09-01T11:00:00.000Z');

    persistedCase = {
      ...baseCase,
      title: 'Caso original',
      procedureDescription: 'Descripción original',
      status: HealthcareCaseStatus.SCHEDULED,
      scheduledStart,
      scheduledEnd,
    };

    const result = await service.cancel(
      companyId,
      caseId,
      createdById,
      'Cancelación operacional',
    );

    expect(result.title).toBe('Caso original');
    expect(result.procedureDescription).toBe('Descripción original');
    expect(result.scheduledStart).toBe(scheduledStart);
    expect(result.scheduledEnd).toBe(scheduledEnd);
    expect(getLastUpdateData()).not.toHaveProperty('scheduledStart');
    expect(getLastUpdateData()).not.toHaveProperty('scheduledEnd');
    expect(getLastUpdateData()).not.toHaveProperty('title');
    expect(getLastUpdateData()).not.toHaveProperty('procedureDescription');
  });

  it('should preserve and enrich Doctor and Hospital in the cancel response', async () => {
    persistedCase = {
      ...baseCase,
      doctorId,
      hospitalId,
      healthcareDoctor: { ...compactDoctor, isActive: false },
      healthcareHospital: { ...compactHospital, isActive: false },
    };

    const result = await service.cancel(
      companyId,
      caseId,
      createdById,
      'Cancelación operacional',
    );

    expect(result).toMatchObject({
      doctorId,
      hospitalId,
      doctor: { ...compactDoctor, isActive: false },
      hospital: { ...compactHospital, isActive: false },
    });
    expect(getLastUpdateData()).not.toHaveProperty('doctorId');
    expect(getLastUpdateData()).not.toHaveProperty('hospitalId');
  });

  it('should reject cancelling an already cancelled case', async () => {
    const originalCancelledAt = new Date('2026-09-01T09:00:00.000Z');

    persistedCase = {
      ...baseCase,
      status: HealthcareCaseStatus.CANCELLED,
      cancelledAt: originalCancelledAt,
      cancelledById: 'original-user-id',
      cancellationReason: 'Original reason',
    };

    await expect(
      service.cancel(companyId, caseId, createdById, 'New reason'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
    expect(persistedCase.cancelledAt).toBe(originalCancelledAt);
    expect(persistedCase.cancelledById).toBe('original-user-id');
    expect(persistedCase.cancellationReason).toBe('Original reason');
  });

  it('should return NotFound when cancelling a missing case', async () => {
    txHealthcareCaseFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.cancel(companyId, caseId, createdById, 'Cancelación operacional'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(healthcareCaseUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should return the same NotFound for cross-tenant cancel simulation', async () => {
    txHealthcareCaseFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.cancel(
        otherCompanyId,
        caseId,
        createdById,
        'Cancelación operacional',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should use a conditional update for cancellation eligibility', async () => {
    await service.cancel(
      companyId,
      caseId,
      createdById,
      'Cancelación operacional',
    );

    expect(healthcareCaseUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: caseId,
          companyId,
          status: {
            in: [HealthcareCaseStatus.DRAFT, HealthcareCaseStatus.SCHEDULED],
          },
        },
      }),
    );
  });

  it('should report RESOURCE_STATE_CHANGED when cancellation loses a state race', async () => {
    healthcareCaseUpdateManyMock.mockResolvedValueOnce({
      count: 0,
    });

    const error = await captureHttpException(
      service.cancel(companyId, caseId, createdById, 'Cancelación operacional'),
    );

    expect(error.getResponse()).toMatchObject({
      statusCode: 409,
      code: 'RESOURCE_STATE_CHANGED',
    });
    expect(txHealthcareCaseFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: { id: caseId, companyId },
      select: { id: true },
    });
  });

  it('should preserve missing/foreign 404 semantics when cancellation loses its row', async () => {
    healthcareCaseUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    txHealthcareCaseFindFirstMock
      .mockResolvedValueOnce(baseCase)
      .mockResolvedValueOnce(null);

    await expect(
      service.cancel(companyId, caseId, createdById, 'Cancelación operacional'),
    ).rejects.toEqual(new NotFoundException('Caso no encontrado'));
  });

  it.each([
    ['P2003', 'RELATED_RESOURCE_CHANGED', 409],
    ['P2002', 'HEALTHCARE_PERSISTENCE_ERROR', 500],
  ])(
    'should translate cancellation %s without exposing persistence details',
    async (prismaCode, expectedCode, statusCode) => {
      healthcareCaseUpdateManyMock.mockRejectedValueOnce(
        knownPrismaError(prismaCode),
      );

      const error = await captureHttpException(
        service.cancel(
          companyId,
          caseId,
          createdById,
          'Cancelación operacional',
        ),
      );

      expect(error.getResponse()).toMatchObject({
        statusCode,
        code: expectedCode,
      });
      expect(JSON.stringify(error.getResponse())).not.toContain('persistence');
    },
  );
});
