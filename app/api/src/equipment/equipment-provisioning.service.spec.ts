import { NotFoundException } from '@nestjs/common';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentOrigin,
  ProductInventoryTracking,
} from '@prisma/client';

import { EquipmentAssetCodeService } from './equipment-asset-code.service';
import { EquipmentProvisioningService } from './equipment-provisioning.service';

type PurchaseReceiptItemFindFirstArgs = {
  where: {
    id: string;
    companyId: string;
  };
  select: unknown;
};

type EquipmentAssetCreateData = {
  companyId: string;
  productId: string;
  assetCode: string;
  serialNumber: string | null;
  serialNumberKey: string | null;
  lifecycle: EquipmentLifecycle;
  condition: EquipmentCondition;
  origin: EquipmentOrigin;
  purchaseReceiptItemId: string;
  batchId: string | null;
};

type EquipmentAssetCreateArgs = {
  data: EquipmentAssetCreateData;
};

describe('EquipmentProvisioningService', () => {
  let service: EquipmentProvisioningService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const otherCompanyId = '64af248f-8081-4407-91f5-8d545749d7f4';
  const productId = '953a950f-b33a-4ff5-85ac-4ff35b8f3017';
  const purchaseReceiptItemId = 'c2ed4313-b240-4f13-a83c-e5218710f56a';
  const batchId = 'f89b0de7-d345-4710-95af-464bd8dc6706';

  const txMock = {
    purchaseReceiptItem: {
      findFirst: jest.fn(),
    },
    equipmentAsset: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const equipmentAssetCodeServiceMock = {
    allocateNextAvailableAssetCode: jest.fn(),
  };

  const buildReceiptItem = ({
    inventoryTracking = ProductInventoryTracking.ASSET,
    quantityReceived = 1,
    receiptBatchId = batchId,
    isActive = false,
  }: {
    inventoryTracking?: ProductInventoryTracking;
    quantityReceived?: number;
    receiptBatchId?: string | null;
    isActive?: boolean;
  } = {}) => ({
    id: purchaseReceiptItemId,
    companyId,
    productId,
    quantityReceived,
    batchId: receiptBatchId,
    purchaseItem: {
      quantity: 10,
    },
    product: {
      inventoryTracking,
      isActive,
    },
  });

  const getFindFirstArgs = (): PurchaseReceiptItemFindFirstArgs =>
    (
      txMock.purchaseReceiptItem.findFirst.mock.calls[0] as [
        PurchaseReceiptItemFindFirstArgs,
      ]
    )[0];

  const getCreateData = (callIndex = 0): EquipmentAssetCreateData =>
    (
      txMock.equipmentAsset.create.mock.calls[callIndex] as [
        EquipmentAssetCreateArgs,
      ]
    )[0].data;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new EquipmentProvisioningService(
      equipmentAssetCodeServiceMock as unknown as EquipmentAssetCodeService,
    );

    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(buildReceiptItem());

    equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode.mockResolvedValue(
      'EQ-000001',
    );

    txMock.equipmentAsset.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: `equipment-${txMock.equipmentAsset.create.mock.calls.length}`,
        ...data,
      }),
    );
  });

  it('should throw NotFoundException when the PurchaseReceiptItem is missing for the company', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(null);

    await expect(
      service.provisionFromPurchaseReceiptItem(
        txMock as never,
        companyId,
        purchaseReceiptItemId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const findFirstArgs = getFindFirstArgs();

    expect(findFirstArgs.where).toEqual({
      id: purchaseReceiptItemId,
      companyId,
    });
    expect(findFirstArgs.select).toBeDefined();
  });

  it('should create one EquipmentAsset for ASSET quantityReceived 1', async () => {
    const result = await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(result).toHaveLength(1);
    expect(txMock.equipmentAsset.create).toHaveBeenCalledTimes(1);
  });

  it('should create exactly three EquipmentAssets for ASSET quantityReceived 3', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        quantityReceived: 3,
      }),
    );

    equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode
      .mockResolvedValueOnce('EQ-000001')
      .mockResolvedValueOnce('EQ-000002')
      .mockResolvedValueOnce('EQ-000003');

    const result = await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(result).toHaveLength(3);
    expect(txMock.equipmentAsset.create).toHaveBeenCalledTimes(3);
  });

  it('should derive the creation count only from quantityReceived', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        quantityReceived: 3,
      }),
    );

    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(txMock.equipmentAsset.create).toHaveBeenCalledTimes(3);
  });

  it('should use generated asset codes returned by EquipmentAssetCodeService', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        quantityReceived: 3,
      }),
    );

    equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode
      .mockResolvedValueOnce('EQ-000018')
      .mockResolvedValueOnce('EQ-000019')
      .mockResolvedValueOnce('EQ-000020');

    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(getCreateData(0).assetCode).toBe('EQ-000018');
    expect(getCreateData(1).assetCode).toBe('EQ-000019');
    expect(getCreateData(2).assetCode).toBe('EQ-000020');
  });

  it('should pass the exact supplied tx and companyId to the allocator', async () => {
    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(
      equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode,
    ).toHaveBeenCalledWith(txMock, companyId);
  });

  it('should create receipt assets with the approved lifecycle, condition and origin', async () => {
    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(getCreateData()).toEqual(
      expect.objectContaining({
        lifecycle: EquipmentLifecycle.ACTIVE,
        condition: EquipmentCondition.INSPECTION_PENDING,
        origin: EquipmentOrigin.PURCHASE_RECEIPT,
      }),
    );
  });

  it('should create receipt assets without serial numbers', async () => {
    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(getCreateData()).toEqual(
      expect.objectContaining({
        serialNumber: null,
        serialNumberKey: null,
      }),
    );
  });

  it('should preserve purchaseReceiptItemId on every created asset', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        quantityReceived: 3,
      }),
    );

    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    for (const call of txMock.equipmentAsset.create.mock.calls as [
      EquipmentAssetCreateArgs,
    ][]) {
      expect(call[0].data.purchaseReceiptItemId).toBe(purchaseReceiptItemId);
    }
  });

  it('should propagate batchId when present', async () => {
    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(getCreateData().batchId).toBe(batchId);
  });

  it('should keep batchId null when the receipt item has no batch', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        receiptBatchId: null,
      }),
    );

    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(getCreateData().batchId).toBeNull();
  });

  it('should return an empty array for QUANTITY products', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        inventoryTracking: ProductInventoryTracking.QUANTITY,
      }),
    );

    const result = await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(result).toEqual([]);
    expect(
      equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode,
    ).not.toHaveBeenCalled();
    expect(txMock.equipmentAsset.create).not.toHaveBeenCalled();
  });

  it('should return an empty array for SERIALIZED products', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        inventoryTracking: ProductInventoryTracking.SERIALIZED,
      }),
    );

    const result = await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(result).toEqual([]);
    expect(
      equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode,
    ).not.toHaveBeenCalled();
    expect(txMock.equipmentAsset.create).not.toHaveBeenCalled();
  });

  it('should preserve tenant isolation when loading the receipt item', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(null);

    await expect(
      service.provisionFromPurchaseReceiptItem(
        txMock as never,
        otherCompanyId,
        purchaseReceiptItemId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const findFirstArgs = getFindFirstArgs();

    expect(findFirstArgs.where).toEqual({
      id: purchaseReceiptItemId,
      companyId: otherCompanyId,
    });
    expect(findFirstArgs.select).toBeDefined();
    expect(txMock.equipmentAsset.create).not.toHaveBeenCalled();
  });

  it('should reject and not swallow errors if EquipmentAsset creation fails', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        quantityReceived: 3,
      }),
    );

    txMock.equipmentAsset.create
      .mockResolvedValueOnce({
        id: 'equipment-1',
      })
      .mockRejectedValueOnce(new Error('create failed'));

    await expect(
      service.provisionFromPurchaseReceiptItem(
        txMock as never,
        companyId,
        purchaseReceiptItemId,
      ),
    ).rejects.toThrow('create failed');

    expect(txMock.equipmentAsset.create).toHaveBeenCalledTimes(2);
    expect(
      equipmentAssetCodeServiceMock.allocateNextAvailableAssetCode,
    ).toHaveBeenCalledTimes(2);
  });

  it('should not open its own Prisma transaction', async () => {
    await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(txMock.$transaction).not.toHaveBeenCalled();
  });

  it('should not block provisioning when the Product is inactive', async () => {
    txMock.purchaseReceiptItem.findFirst.mockResolvedValue(
      buildReceiptItem({
        isActive: false,
      }),
    );

    const result = await service.provisionFromPurchaseReceiptItem(
      txMock as never,
      companyId,
      purchaseReceiptItemId,
    );

    expect(result).toHaveLength(1);
    expect(txMock.equipmentAsset.create).toHaveBeenCalledTimes(1);
  });
});
