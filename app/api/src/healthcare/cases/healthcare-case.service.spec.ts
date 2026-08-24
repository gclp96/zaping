import { BadRequestException, NotFoundException } from '@nestjs/common';
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

describe('HealthcareCaseService', () => {
  let service: HealthcareCaseService;

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
  const prismaTransactionMock = jest.fn();

  const txMock = {
    user: {
      findFirst: userFindFirstMock,
    },
    healthcareCase: {
      create: healthcareCaseCreateMock,
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
});
