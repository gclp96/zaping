import { EquipmentLifecycle } from '@prisma/client';

import { EquipmentAssetCodeService } from './equipment-asset-code.service';

describe('EquipmentAssetCodeService', () => {
  let service: EquipmentAssetCodeService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';

  const txMock = {
    equipmentAsset: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const companySequenceAllocatorMock = {
    allocateNext: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new EquipmentAssetCodeService(companySequenceAllocatorMock);

    companySequenceAllocatorMock.allocateNext.mockResolvedValue(1);

    txMock.equipmentAsset.findFirst.mockResolvedValue(null);
  });

  it('should allocate numeric values through the shared company sequence allocator', async () => {
    await service.allocateNextAvailableAssetCode(txMock as never, companyId);

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledWith(
      txMock,
      companyId,
      'EQUIPMENT_ASSET_CODE',
    );
  });

  it('should isolate equipment sequence allocation by company', async () => {
    const otherCompanyId = '64af248f-8081-4407-91f5-8d545749d7f4';

    await service.allocateNextAvailableAssetCode(txMock as never, companyId);
    await service.allocateNextAvailableAssetCode(
      txMock as never,
      otherCompanyId,
    );

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenNthCalledWith(
      1,
      txMock,
      companyId,
      'EQUIPMENT_ASSET_CODE',
    );

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenNthCalledWith(
      2,
      txMock,
      otherCompanyId,
      'EQUIPMENT_ASSET_CODE',
    );
  });

  it('should allocate the first automatic asset code', async () => {
    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000001');
  });

  it('should allocate a subsequent automatic asset code', async () => {
    companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(2);

    const result = await service.allocateNextAvailableAssetCode(
      txMock as never,
      companyId,
    );

    expect(result).toBe('EQ-000002');
  });

  it('should format asset codes beyond the six-digit minimum width', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(999999)
      .mockResolvedValueOnce(1000000);

    await expect(
      service.allocateNextAvailableAssetCode(txMock as never, companyId),
    ).resolves.toBe('EQ-999999');

    await expect(
      service.allocateNextAvailableAssetCode(txMock as never, companyId),
    ).resolves.toBe('EQ-1000000');
  });

  it('should skip an occupied historical active asset code', async () => {
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(123)
      .mockResolvedValueOnce(124);

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
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(123)
      .mockResolvedValueOnce(124);

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
    companySequenceAllocatorMock.allocateNext
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);

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
    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledTimes(4);
    expect(txMock.equipmentAsset.findFirst).toHaveBeenCalledTimes(4);
  });

  it('should continue past more than 100 occupied generated asset codes', async () => {
    for (let value = 1; value <= 102; value += 1) {
      companySequenceAllocatorMock.allocateNext.mockResolvedValueOnce(value);
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
    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledTimes(
      102,
    );
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

    expect(companySequenceAllocatorMock.allocateNext).toHaveBeenCalledWith(
      txMock,
      companyId,
      'EQUIPMENT_ASSET_CODE',
    );
    expect(txMock.equipmentAsset.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should not open its own Prisma transaction', async () => {
    await service.allocateNextAvailableAssetCode(txMock as never, companyId);

    expect(txMock.$transaction).not.toHaveBeenCalled();
  });
});
