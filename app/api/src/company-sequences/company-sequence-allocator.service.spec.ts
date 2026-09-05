import { CompanySequenceAllocatorService } from './company-sequence-allocator.service';

describe('CompanySequenceAllocatorService', () => {
  let service: CompanySequenceAllocatorService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const key = 'TEST_SEQUENCE';

  const txMock = {
    companySequence: {
      createMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new CompanySequenceAllocatorService();

    txMock.companySequence.createMany.mockResolvedValue({
      count: 1,
    });

    txMock.companySequence.update.mockResolvedValue({
      nextValue: 2,
    });
  });

  it('should bootstrap a missing CompanySequence row with createMany skipDuplicates', async () => {
    await service.allocateNext(txMock as never, companyId, key);

    expect(txMock.companySequence.createMany).toHaveBeenCalledWith({
      data: [
        {
          companyId,
          key,
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('should scope allocation by companyId and key', async () => {
    await service.allocateNext(txMock as never, companyId, key);

    expect(txMock.companySequence.update).toHaveBeenCalledWith({
      where: {
        companyId_key: {
          companyId,
          key,
        },
      },
      data: {
        nextValue: {
          increment: 1,
        },
      },
      select: {
        nextValue: true,
      },
    });
  });

  it('should use an atomic increment for nextValue', async () => {
    await service.allocateNext(txMock as never, companyId, key);

    expect(txMock.companySequence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nextValue: {
            increment: 1,
          },
        },
      }),
    );
  });

  it('should return the updated nextValue minus one', async () => {
    txMock.companySequence.update.mockResolvedValueOnce({
      nextValue: 43,
    });

    await expect(
      service.allocateNext(txMock as never, companyId, key),
    ).resolves.toBe(42);
  });

  it('should use the caller-owned transaction client', async () => {
    await service.allocateNext(txMock as never, companyId, key);

    expect(txMock.companySequence.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.companySequence.update).toHaveBeenCalledTimes(1);
  });

  it('should not create its own transaction', async () => {
    await service.allocateNext(txMock as never, companyId, key);

    expect(txMock.$transaction).not.toHaveBeenCalled();
  });

  it('should return only the numeric allocation without formatting domain codes', async () => {
    const result = await service.allocateNext(txMock as never, companyId, key);

    expect(result).toBe(1);
    expect(typeof result).toBe('number');
  });

  it('should work with different sequence keys', async () => {
    const otherKey = 'OTHER_SEQUENCE';

    await service.allocateNext(txMock as never, companyId, key);
    await service.allocateNext(txMock as never, companyId, otherKey);

    expect(txMock.companySequence.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        {
          companyId,
          key: otherKey,
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });

    expect(txMock.companySequence.update).toHaveBeenNthCalledWith(2, {
      where: {
        companyId_key: {
          companyId,
          key: otherKey,
        },
      },
      data: {
        nextValue: {
          increment: 1,
        },
      },
      select: {
        nextValue: true,
      },
    });
  });

  it('should not target unrelated sequence rows in the mutation shape', async () => {
    await service.allocateNext(txMock as never, companyId, key);

    expect(txMock.companySequence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_key: {
            companyId,
            key,
          },
        },
      }),
    );
  });
});
