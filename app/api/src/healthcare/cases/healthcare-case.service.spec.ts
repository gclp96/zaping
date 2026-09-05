import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { HealthcareCase, HealthcareCaseStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { HealthcareCaseFolioService } from './healthcare-case-folio.service';
import { HealthcareCaseService } from './healthcare-case.service';

type UserLookupResult = {
  id: string;
} | null;

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
  let persistedCase: HealthcareCase;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const otherCompanyId = '64af248f-8081-4407-91f5-8d545749d7f4';
  const createdById = 'created-by-user-id';
  const responsibleUserId = 'responsible-user-id';
  const caseId = 'healthcare-case-id';

  const userFindFirstMock = jest.fn<Promise<UserLookupResult>, [unknown]>();
  const healthcareCaseCreateMock = jest.fn<
    Promise<HealthcareCase>,
    [HealthcareCaseCreateArgs]
  >();
  const healthcareCaseFindManyMock = jest.fn<
    Promise<HealthcareCase[]>,
    [unknown]
  >();
  const healthcareCaseFindFirstMock = jest.fn<
    Promise<HealthcareCase | null>,
    [unknown]
  >();
  const txHealthcareCaseFindFirstMock = jest.fn<
    Promise<HealthcareCase | null>,
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

  const baseCase: HealthcareCase = {
    id: caseId,
    companyId,
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

    healthcareCaseFolioServiceMock.allocateNextAvailableFolio.mockResolvedValue(
      'CASE-000001',
    );

    healthcareCaseCreateMock.mockImplementation(({ data }) =>
      Promise.resolve({
        ...baseCase,
        ...data,
      }),
    );

    txHealthcareCaseFindFirstMock.mockImplementation(() =>
      Promise.resolve(persistedCase),
    );

    healthcareCaseUpdateManyMock.mockImplementation(({ data }) => {
      persistedCase = {
        ...persistedCase,
        ...data,
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

  it('should list cases scoped by companyId with deterministic ordering', async () => {
    healthcareCaseFindManyMock.mockResolvedValueOnce([baseCase]);

    await expect(service.findAll(companyId)).resolves.toEqual([baseCase]);

    expect(healthcareCaseFindManyMock).toHaveBeenCalledWith({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('should find one case using id and companyId', async () => {
    healthcareCaseFindFirstMock.mockResolvedValueOnce(baseCase);

    await expect(service.findOne(companyId, caseId)).resolves.toEqual(baseCase);

    expect(healthcareCaseFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: caseId,
        companyId,
      },
    });
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

    expect(healthcareCaseFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: caseId,
        companyId: otherCompanyId,
      },
    });
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
      }),
    ).rejects.toBeInstanceOf(ConflictException);

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

  it('should report a concurrency conflict when cancellation update count is zero', async () => {
    healthcareCaseUpdateManyMock.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      service.cancel(companyId, caseId, createdById, 'Cancelación operacional'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
