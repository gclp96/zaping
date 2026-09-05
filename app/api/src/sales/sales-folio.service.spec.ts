import { DocumentStatus } from '@prisma/client';

import { SalesFolioService } from './sales-folio.service';

describe('SalesFolioService', () => {
  let service: SalesFolioService;

  const companyId = '11111111-1111-4111-8111-111111111111';
  const otherCompanyId = '22222222-2222-4222-8222-222222222222';

  const txMock = {
    sale: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const companySequenceAllocatorMock = {
    allocateNext: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new SalesFolioService(companySequenceAllocatorMock);

    companySequenceAllocatorMock.allocateNext.mockResolvedValue(1);
    txMock.sale.findFirst.mockResolvedValue(null);
  });

  it('formats numeric 1 as V-000001', async () => {
    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-000001');
  });

  it('formats numeric 25 as V-000025', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(25);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-000025');
  });

  it('formats numeric 999999 as V-999999', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(999999);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-999999');
  });

  it('formats numeric 1000000 without a six-digit maximum', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(1000000);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-1000000');
  });

  it('uses the Sales folio sequence key', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledWith(
      txMock,
      companyId,
      'SALE_FOLIO',
    );
  });

  it('passes the caller-owned transaction to the shared allocator', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledWith(
      txMock,
      companyId,
      'SALE_FOLIO',
    );
    expect(txMock.$transaction).not.toHaveBeenCalled();
  });

  it('allocates another candidate when V-000001 is occupied', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    txMock.sale.findFirst
      .mockResolvedValueOnce({
        id: 'occupied-sale-id',
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-000002');

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledTimes(2);
    expect(txMock.sale.findFirst).toHaveBeenCalledTimes(2);
  });

  it('treats cancelled historical Sales as occupied folios', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    txMock.sale.findFirst
      .mockResolvedValueOnce({
        id: 'cancelled-sale-id',
        status: DocumentStatus.CANCELLED,
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-000002');
  });

  it('looks up collisions by companyId and folio', async () => {
    await service.allocateNextAvailableFolio(txMock as never, companyId);

    expect(txMock.sale.findFirst).toHaveBeenCalledWith({
      where: {
        companyId,
        folio: 'V-000001',
      },
      select: {
        id: true,
      },
    });
  });

  it('allows independent companies to receive the same formatted folio', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValue(1);
    txMock.sale.findFirst.mockResolvedValue(null);

    await expect(
      service.allocateNextAvailableFolio(txMock as never, companyId),
    ).resolves.toBe('V-000001');

    await expect(
      service.allocateNextAvailableFolio(txMock as never, otherCompanyId),
    ).resolves.toBe('V-000001');

    expect(txMock.sale.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        companyId,
        folio: 'V-000001',
      },
      select: {
        id: true,
      },
    });
    expect(txMock.sale.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        companyId: otherCompanyId,
        folio: 'V-000001',
      },
      select: {
        id: true,
      },
    });
  });
});
