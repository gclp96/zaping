import { EquipmentLifecycle } from '@prisma/client';

import { EquipmentAssetCodeService } from './equipment-asset-code.service';

describe('EquipmentAssetCodeService', () => {
  let service: EquipmentAssetCodeService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';

  const txMock = {
    companySequence: {
      createMany: jest.fn(),
      update: jest.fn(),
    },
    equipmentAsset: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new EquipmentAssetCodeService();

    txMock.companySequence.createMany.mockResolvedValue({
      count: 1,
    });

    txMock.companySequence.update.mockResolvedValue({
      nextValue: 2,
    });

    txMock.equipmentAsset.findFirst.mockResolvedValue(null);
  });

  it('should bootstrap a missing CompanySequence with createMany skipDuplicates', async () => {
    await service.allocateNextAvailableAssetCode(txMock as never, companyId);

    expect(txMock.companySequence.createMany).toHaveBeenCalledWith({
      data: [
        {
          companyId,
          key: 'EQUIPMENT_ASSET_CODE',
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('should allocate the first automatic asset code', async () => {
    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000001');
  });

  it('should allocate a subsequent automatic asset code', async () => {
    txMock.companySequence.update.mockResolvedValueOnce({
      nextValue: 3,
    });

    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000002');
  });

  it('should isolate sequence allocation by company', async () => {
    const otherCompanyId = '64af248f-8081-4407-91f5-8d545749d7f4';

    await service.allocateNextAvailableAssetCode(txMock as never, companyId);
    await service.allocateNextAvailableAssetCode(
      txMock as never,
      otherCompanyId,
    );

    expect(txMock.companySequence.createMany).toHaveBeenNthCalledWith(1, {
      data: [
        {
          companyId,
          key: 'EQUIPMENT_ASSET_CODE',
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });

    expect(txMock.companySequence.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        {
          companyId: otherCompanyId,
          key: 'EQUIPMENT_ASSET_CODE',
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });

    expect(txMock.companySequence.update).toHaveBeenNthCalledWith(1, {
      where: {
        companyId_key: {
          companyId,
          key: 'EQUIPMENT_ASSET_CODE',
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

    expect(txMock.companySequence.update).toHaveBeenNthCalledWith(2, {
      where: {
        companyId_key: {
          companyId: otherCompanyId,
          key: 'EQUIPMENT_ASSET_CODE',
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

  it('should format asset codes beyond the six-digit minimum width', async () => {
    txMock.companySequence.update
      .mockResolvedValueOnce({
        nextValue: 1000000,
      })
      .mockResolvedValueOnce({
        nextValue: 1000001,
      });

    await expect(
      service.allocateNextAvailableAssetCode(txMock as never, companyId),
    ).resolves.toBe('EQ-999999');

    await expect(
      service.allocateNextAvailableAssetCode(txMock as never, companyId),
    ).resolves.toBe('EQ-1000000');
  });

  it('should skip an occupied historical active asset code', async () => {
    txMock.companySequence.update
      .mockResolvedValueOnce({
        nextValue: 124,
      })
      .mockResolvedValueOnce({
        nextValue: 125,
      });

    txMock.equipmentAsset.findFirst
      .mockResolvedValueOnce({
        id: 'active-equipment-id',
        lifecycle: EquipmentLifecycle.ACTIVE,
      })
      .mockResolvedValueOnce(null);

    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000124');

    expect(txMock.equipmentAsset.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        companyId,
        assetCode: 'EQ-000123',
      },
      select: {
        id: true,
      },
    });
  });

  it('should skip an occupied historical retired asset code', async () => {
    txMock.companySequence.update
      .mockResolvedValueOnce({
        nextValue: 124,
      })
      .mockResolvedValueOnce({
        nextValue: 125,
      });

    txMock.equipmentAsset.findFirst
      .mockResolvedValueOnce({
        id: 'retired-equipment-id',
        lifecycle: EquipmentLifecycle.RETIRED,
      })
      .mockResolvedValueOnce(null);

    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000124');

    expect(txMock.equipmentAsset.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        companyId,
        assetCode: 'EQ-000123',
      },
      select: {
        id: true,
      },
    });
  });

  it('should continue past multiple consecutive occupied generated asset codes', async () => {
    txMock.companySequence.update
      .mockResolvedValueOnce({
        nextValue: 2,
      })
      .mockResolvedValueOnce({
        nextValue: 3,
      })
      .mockResolvedValueOnce({
        nextValue: 4,
      })
      .mockResolvedValueOnce({
        nextValue: 5,
      });

    txMock.equipmentAsset.findFirst
      .mockResolvedValueOnce({
        id: 'occupied-equipment-1',
      })
      .mockResolvedValueOnce({
        id: 'occupied-equipment-2',
      })
      .mockResolvedValueOnce({
        id: 'occupied-equipment-3',
      })
      .mockResolvedValueOnce(null);

    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000004');
    expect(txMock.companySequence.update).toHaveBeenCalledTimes(4);
    expect(txMock.equipmentAsset.findFirst).toHaveBeenCalledTimes(4);
  });

  it('should continue past more than 100 occupied generated asset codes', async () => {
    for (let value = 1; value <= 102; value += 1) {
      txMock.companySequence.update.mockResolvedValueOnce({
        nextValue: value + 1,
      });
    }

    for (let value = 1; value <= 101; value += 1) {
      txMock.equipmentAsset.findFirst.mockResolvedValueOnce({
        id: `occupied-equipment-${value}`,
      });
    }

    txMock.equipmentAsset.findFirst.mockResolvedValueOnce(null);

    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000102');
    expect(txMock.companySequence.update).toHaveBeenCalledTimes(102);
    expect(txMock.equipmentAsset.findFirst).toHaveBeenCalledTimes(102);

    expect(txMock.equipmentAsset.findFirst).toHaveBeenLastCalledWith({
      where: {
        companyId,
        assetCode: 'EQ-000102',
      },
      select: {
        id: true,
      },
    });
  });

  it('should scope every collision lookup by company and assetCode', async () => {
    await service.allocateNextAvailableAssetCode(txMock as never, companyId);

    expect(txMock.equipmentAsset.findFirst).toHaveBeenCalledWith({
      where: {
        companyId,
        assetCode: 'EQ-000001',
      },
      select: {
        id: true,
      },
    });
  });

  it('should use the supplied Prisma transaction client', async () => {
    await service.allocateNextAvailableAssetCode(txMock as never, companyId);

    expect(txMock.companySequence.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.companySequence.update).toHaveBeenCalledTimes(1);
    expect(txMock.equipmentAsset.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should not open its own Prisma transaction', async () => {
    await service.allocateNextAvailableAssetCode(txMock as never, companyId);

    expect(txMock.$transaction).not.toHaveBeenCalled();
  });
});
