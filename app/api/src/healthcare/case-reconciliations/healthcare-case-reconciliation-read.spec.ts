import { Prisma } from '@prisma/client';
import { HealthcareCaseReconciliationsRepository as Repository } from './healthcare-case-reconciliations.repository';
import { HealthcareCaseReconciliationReadService as Service } from './healthcare-case-reconciliation-read.service';
import { HealthcareCaseReconciliationModule } from './healthcare-case-reconciliations.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { PrismaService } from '../../prisma/prisma.service';
describe('Reconciliation read service and persistence boundary', () => {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    runInReadSnapshot: jest.fn(),
    findCase: jest.fn(),
    list: jest.fn(),
    detail: jest.fn(),
    summary: jest.fn(),
  };
  const service = new Service(repo as unknown as Repository);
  beforeEach(() => {
    jest.resetAllMocks();
    repo.runInReadSnapshot.mockImplementation(
      (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
    );
    repo.findCase.mockResolvedValue({ id: 'case' });
  });
  it.each(['detail', 'summary'] as const)(
    '%s same-tenant missing/wrong Case is 404',
    async (method) => {
      repo[method].mockResolvedValue(null);
      await expect(
        service[method]('tenant', 'case', 'id'),
      ).rejects.toMatchObject({ status: 404 });
      expect(repo[method]).toHaveBeenCalledWith('tenant', 'case', 'id', tx);
    },
  );
  it('foreign Company never reaches detail persistence', async () => {
    repo.findCase.mockResolvedValue(null);
    await expect(service.detail('foreign', 'case', 'id')).rejects.toMatchObject(
      { status: 404 },
    );
    expect(repo.detail).not.toHaveBeenCalled();
  });
  it('sanitizes persistence exceptions', async () => {
    repo.detail.mockRejectedValue(Error('SQL password internal'));
    await expect(service.detail('tenant', 'case', 'id')).rejects.toHaveProperty(
      'response.code',
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
  });
  it('invalid confirmed root cannot fall back to current descriptions', async () => {
    repo.detail.mockResolvedValue({
      status: 'CONFIRMED',
      snapshot: null,
      dispatch: { snapshot: {} },
    });
    await expect(service.detail('tenant', 'case', 'id')).rejects.toHaveProperty(
      'response.code',
      'HEALTHCARE_PERSISTENCE_ERROR',
    );
  });
  it('keeps list pagination consistent', async () => {
    repo.list.mockResolvedValue({ items: [], totalItems: 27 });
    expect(
      await service.list('tenant', 'case', { page: 2, pageSize: 25 }),
    ).toEqual({
      items: [],
      pagination: { page: 2, pageSize: 25, totalItems: 27, totalPages: 2 },
    });
  });
  it('imports only PrismaModule', () => {
    expect(
      Reflect.getMetadata(
        MODULE_METADATA.IMPORTS,
        HealthcareCaseReconciliationModule,
      ),
    ).toEqual([PrismaModule]);
  });
  it('repository queries are scoped, ordered and bound to read transaction', async () => {
    const count = jest.fn().mockResolvedValue(4),
      findMany = jest.fn().mockResolvedValue([]),
      findFirst = jest.fn().mockResolvedValue(null);
    const client = {
      healthcareCaseReconciliation: { count, findMany, findFirst },
      healthcareCaseDispatch: { findFirst },
      healthcareCase: { findFirst },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: jest.fn(
        (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(client),
      ),
    };
    const r = new Repository(prisma as unknown as PrismaService);
    await r.runInReadSnapshot(async (t) => {
      await r.list(
        'tenant',
        'case',
        { page: 2, pageSize: 10, status: 'CONFIRMED', dispatchId: 'dispatch' },
        t,
      );
      await r.summary('tenant', 'case', 'dispatch', t);
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'tenant',
          caseId: 'case',
          status: 'CONFIRMED',
          dispatchId: 'dispatch',
        },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'tenant',
          caseId: 'case',
          id: 'dispatch',
          status: 'CONFIRMED',
        },
      }),
    );
  });
});
