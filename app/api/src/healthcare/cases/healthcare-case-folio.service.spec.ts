import { HealthcareCaseStatus } from '@prisma/client';

import { HealthcareCaseFolioService } from './healthcare-case-folio.service';

describe('HealthcareCaseFolioService', () => {
  let service: HealthcareCaseFolioService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';

  const txMock = {
    healthcareCase: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const companySequenceAllocatorMock = {
    allocateNext: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new HealthcareCaseFolioService(companySequenceAllocatorMock);

    companySequenceAllocatorMock.allocateNext.mockResolvedValue(1);
    txMock.healthcareCase.findFirst.mockResolvedValue(null);
  });

  it('should allocate using the Healthcare Case folio sequence key', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledWith(
      txMock,
      companyId,
      'HEALTHCARE_CASE_FOLIO',
    );
  });

  it('should format 1 as CASE-000001', async () => {
    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-000001');
  });

  it('should format 25 as CASE-000025', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(25);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-000025');
  });

  it('should format 999999 as CASE-999999', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(999999);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-999999');
  });

  it('should format 1000000 without imposing a six-digit maximum', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(1000000);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-1000000');
  });

  it('should lookup collisions by companyId and folio', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(txMock.healthcareCase.findFirst).toHaveBeenCalledWith({
      where: {
        companyId,
        folio: 'CASE-000001',
      },
      select: {
        id: true,
      },
    });
  });

  it('should skip an occupied folio', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    txMock.healthcareCase.findFirst
      .mockResolvedValueOnce({
        id: 'occupied-case-id',
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-000002');
  });

  it('should treat cancelled historical cases as occupied folios', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    txMock.healthcareCase.findFirst
      .mockResolvedValueOnce({
        id: 'cancelled-case-id',
        status: HealthcareCaseStatus.CANCELLED,
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-000002');
  });

  it('should continue through multiple occupied folios until a free folio is found', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);

    txMock.healthcareCase.findFirst
      .mockResolvedValueOnce({
        id: 'occupied-case-1',
      })
      .mockResolvedValueOnce({
        id: 'occupied-case-2',
      })
      .mockResolvedValueOnce({
        id: 'occupied-case-3',
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('CASE-000004');

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledTimes(4);
    expect(txMock.healthcareCase.findFirst).toHaveBeenCalledTimes(4);
  });

  it('should pass the caller-owned transaction to the shared allocator', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledWith(
      txMock,
      companyId,
      'HEALTHCARE_CASE_FOLIO',
    );
  });

  it('should not open its own Prisma transaction', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(txMock.$transaction).not.toHaveBeenCalled();
  });
});
