import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentOrigin,
  EquipmentRetirementReason,
  ProductInventoryTracking,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { EquipmentService } from './equipment.service';

describe('EquipmentService', () => {
  let service: EquipmentService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const productId = '953a950f-b33a-4ff5-85ac-4ff35b8f3017';
  const equipmentId = 'cca93237-878a-4467-ae17-b2514dff6819';
  const inspectorId = 'f6c503b4-82db-4e21-b2ce-f7cc9e13f021';

  const prismaMock = {
    product: {
      findFirst: jest.fn(),
    },
    inventoryBatch: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    equipmentAsset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    equipmentInspection: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<EquipmentService>(EquipmentService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list equipment for the company', async () => {
    const equipment = [
      {
        id: equipmentId,
        companyId,
        productId,
        assetCode: 'EQ-AST-001',
      },
    ];

    prismaMock.equipmentAsset.findMany.mockResolvedValue(equipment);

    const result = await service.findAll(companyId);

    expect(result).toEqual(equipment);

    expect(prismaMock.equipmentAsset.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
      },
      include: {
        product: true,
        batch: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('should throw NotFoundException when equipment does not exist', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(companyId, equipmentId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should create an ASSET equipment and normalize its identifiers', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: productId,
      companyId,
      inventoryTracking: ProductInventoryTracking.ASSET,
      isActive: true,
    });

    prismaMock.equipmentAsset.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const createdEquipment = {
      id: equipmentId,
      companyId,
      productId,
      assetCode: 'EQ-AST-001',
      serialNumber: 'sn-test-001',
      serialNumberKey: 'SN-TEST-001',
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.GOOD,
      origin: EquipmentOrigin.MANUAL,
    };

    prismaMock.equipmentAsset.create.mockResolvedValue(createdEquipment);

    const result = await service.create(companyId, {
      productId,
      assetCode: 'eq-ast-001',
      serialNumber: '  sn-test-001  ',
      condition: EquipmentCondition.GOOD,
    });

    expect(result).toEqual(createdEquipment);

    expect(prismaMock.equipmentAsset.create).toHaveBeenCalledWith({
      data: {
        companyId,
        productId,
        assetCode: 'EQ-AST-001',
        serialNumber: 'sn-test-001',
        serialNumberKey: 'SN-TEST-001',
        condition: EquipmentCondition.GOOD,
        origin: EquipmentOrigin.MANUAL,
        batchId: undefined,
      },
      include: {
        product: true,
        batch: true,
      },
    });
  });

  it('should reject products that do not use ASSET tracking', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: productId,
      companyId,
      inventoryTracking: ProductInventoryTracking.QUANTITY,
      isActive: true,
    });

    await expect(
      service.create(companyId, {
        productId,
        assetCode: 'EQ-AST-001',
        condition: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.equipmentAsset.create).not.toHaveBeenCalled();
  });

  it('should reject duplicated assetCode', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: productId,
      companyId,
      inventoryTracking: ProductInventoryTracking.ASSET,
      isActive: true,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      id: equipmentId,
    });

    await expect(
      service.create(companyId, {
        productId,
        assetCode: 'EQ-AST-001',
        condition: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.equipmentAsset.create).not.toHaveBeenCalled();
  });

  it('should reject duplicated normalized serial number', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: productId,
      companyId,
      inventoryTracking: ProductInventoryTracking.ASSET,
      isActive: true,
    });

    prismaMock.equipmentAsset.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: equipmentId,
      });

    await expect(
      service.create(companyId, {
        productId,
        assetCode: 'EQ-AST-002',
        serialNumber: 'sn-test-001',
        condition: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.equipmentAsset.findFirst).toHaveBeenLastCalledWith({
      where: {
        companyId,
        productId,
        serialNumberKey: 'SN-TEST-001',
      },
      select: {
        id: true,
      },
    });

    expect(prismaMock.equipmentAsset.create).not.toHaveBeenCalled();
  });

  it('should create equipment without a serial number', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: productId,
      companyId,
      inventoryTracking: ProductInventoryTracking.ASSET,
      isActive: true,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce(null);

    prismaMock.equipmentAsset.create.mockResolvedValue({
      id: equipmentId,
      companyId,
      productId,
      assetCode: 'EQ-AST-020',
      serialNumber: null,
      serialNumberKey: null,
    });

    await service.create(companyId, {
      productId,
      assetCode: 'eq-ast-020',
      condition: EquipmentCondition.INSPECTION_PENDING,
    });

    expect(prismaMock.equipmentAsset.create).toHaveBeenCalledWith({
      data: {
        companyId,
        productId,
        assetCode: 'EQ-AST-020',
        serialNumber: null,
        serialNumberKey: null,
        condition: EquipmentCondition.INSPECTION_PENDING,
        origin: EquipmentOrigin.MANUAL,
        batchId: undefined,
      },
      include: {
        product: true,
        batch: true,
      },
    });
  });

  it('should create an inspection and update equipment condition atomically', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.INSPECTION_PENDING,
    });

    const createdInspection = {
      id: 'inspection-001',
      companyId,
      equipmentAssetId: equipmentId,
      conditionBefore: EquipmentCondition.INSPECTION_PENDING,
      conditionAfter: EquipmentCondition.GOOD,
      inspectedById: inspectorId,
      notes: 'Inspección correcta',
    };

    prismaMock.equipmentInspection.create.mockResolvedValue(createdInspection);

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.createInspection(
      companyId,
      inspectorId,
      equipmentId,
      {
        conditionAfter: EquipmentCondition.GOOD,
        notes: '  Inspección correcta  ',
      },
    );

    expect(result).toEqual(createdInspection);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: inspectorId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    expect(prismaMock.equipmentInspection.create).toHaveBeenCalledWith({
      data: {
        companyId,
        equipmentAssetId: equipmentId,
        conditionBefore: EquipmentCondition.INSPECTION_PENDING,
        conditionAfter: EquipmentCondition.GOOD,
        inspectedById: inspectorId,
        notes: 'Inspección correcta',
      },
    });

    expect(prismaMock.equipmentAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: equipmentId,
        companyId,
        lifecycle: EquipmentLifecycle.ACTIVE,
        condition: EquipmentCondition.INSPECTION_PENDING,
      },
      data: {
        condition: EquipmentCondition.GOOD,
      },
    });
  });

  it('should reject INSPECTION_PENDING as an inspection result', async () => {
    await expect(
      service.createInspection(companyId, inspectorId, equipmentId, {
        conditionAfter: EquipmentCondition.INSPECTION_PENDING,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject an inspector that does not belong to the company', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.createInspection(companyId, inspectorId, equipmentId, {
        conditionAfter: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.equipmentAsset.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.equipmentInspection.create).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when inspected equipment does not exist', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.createInspection(companyId, inspectorId, equipmentId, {
        conditionAfter: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.equipmentInspection.create).not.toHaveBeenCalled();
  });

  it('should reject inspection of retired equipment', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.GOOD,
    });

    await expect(
      service.createInspection(companyId, inspectorId, equipmentId, {
        conditionAfter: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.equipmentInspection.create).not.toHaveBeenCalled();
  });

  it('should derive conditionBefore from the current equipment condition', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.DAMAGED,
    });

    prismaMock.equipmentInspection.create.mockResolvedValue({
      id: 'inspection-002',
    });

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    await service.createInspection(companyId, inspectorId, equipmentId, {
      conditionAfter: EquipmentCondition.GOOD,
    });

    expect(prismaMock.equipmentInspection.create).toHaveBeenCalledWith({
      data: {
        companyId,
        equipmentAssetId: equipmentId,
        conditionBefore: EquipmentCondition.DAMAGED,
        conditionAfter: EquipmentCondition.GOOD,
        inspectedById: inspectorId,
        notes: null,
      },
    });
  });

  it('should normalize empty inspection notes to null', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.GOOD,
    });

    prismaMock.equipmentInspection.create.mockResolvedValue({
      id: 'inspection-003',
    });

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    await service.createInspection(companyId, inspectorId, equipmentId, {
      conditionAfter: EquipmentCondition.GOOD,
      notes: '   ',
    });

    expect(prismaMock.equipmentInspection.create).toHaveBeenCalledWith({
      data: {
        companyId,
        equipmentAssetId: equipmentId,
        conditionBefore: EquipmentCondition.GOOD,
        conditionAfter: EquipmentCondition.GOOD,
        inspectedById: inspectorId,
        notes: null,
      },
    });
  });

  it('should throw ConflictException when equipment condition changes concurrently', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.INSPECTION_PENDING,
    });

    prismaMock.equipmentInspection.create.mockResolvedValue({
      id: 'inspection-004',
    });

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.createInspection(companyId, inspectorId, equipmentId, {
        conditionAfter: EquipmentCondition.GOOD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return inspection history ordered by inspectedAt descending', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
    });

    const inspections = [
      {
        id: 'inspection-002',
        companyId,
        equipmentAssetId: equipmentId,
        conditionBefore: EquipmentCondition.DAMAGED,
        conditionAfter: EquipmentCondition.GOOD,
      },
      {
        id: 'inspection-001',
        companyId,
        equipmentAssetId: equipmentId,
        conditionBefore: EquipmentCondition.INSPECTION_PENDING,
        conditionAfter: EquipmentCondition.DAMAGED,
      },
    ];

    prismaMock.equipmentInspection.findMany.mockResolvedValue(inspections);

    const result = await service.findInspections(companyId, equipmentId);

    expect(result).toEqual(inspections);

    expect(prismaMock.equipmentAsset.findFirst).toHaveBeenCalledWith({
      where: {
        id: equipmentId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    expect(prismaMock.equipmentInspection.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
        equipmentAssetId: equipmentId,
      },
      include: {
        inspectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        inspectedAt: 'desc',
      },
    });
  });

  it('should reject inspection history access when equipment does not belong to the company', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.findInspections(companyId, equipmentId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.equipmentInspection.findMany).not.toHaveBeenCalled();
  });

  it('should retire active equipment and preserve non-retirement fields', async () => {
    const retiredAt = new Date('2026-08-21T23:00:00.000Z');

    jest.useFakeTimers();
    jest.setSystemTime(retiredAt);

    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst
      .mockResolvedValueOnce({
        id: equipmentId,
        lifecycle: EquipmentLifecycle.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: equipmentId,
        companyId,
        productId,
        assetCode: 'EQ-AST-020',
        serialNumber: 'SN-TEST-020',
        lifecycle: EquipmentLifecycle.RETIRED,
        condition: EquipmentCondition.OUT_OF_SERVICE,
        retiredAt,
        retiredById: inspectorId,
        retiredReason: EquipmentRetirementReason.END_OF_LIFE,
        retirementNotes: 'Fin de vida útil',
      });

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.retire(companyId, inspectorId, equipmentId, {
        retiredReason: EquipmentRetirementReason.END_OF_LIFE,
        retirementNotes: '  Fin de vida útil  ',
      }),
    ).resolves.toMatchObject({
      id: equipmentId,
      assetCode: 'EQ-AST-020',
      serialNumber: 'SN-TEST-020',
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.OUT_OF_SERVICE,
      retiredReason: EquipmentRetirementReason.END_OF_LIFE,
      retirementNotes: 'Fin de vida útil',
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: inspectorId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    expect(prismaMock.equipmentAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: equipmentId,
        companyId,
        lifecycle: EquipmentLifecycle.ACTIVE,
      },
      data: {
        lifecycle: EquipmentLifecycle.RETIRED,
        retiredAt,
        retiredById: inspectorId,
        retiredReason: EquipmentRetirementReason.END_OF_LIFE,
        retirementNotes: 'Fin de vida útil',
      },
    });
  });

  it('should require retirement notes when reason is OTHER', async () => {
    await expect(
      service.retire(companyId, inspectorId, equipmentId, {
        retiredReason: EquipmentRetirementReason.OTHER,
        retirementNotes: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should normalize optional empty retirement notes to null', async () => {
    const retiredAt = new Date('2026-08-21T23:05:00.000Z');

    jest.useFakeTimers();
    jest.setSystemTime(retiredAt);

    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst
      .mockResolvedValueOnce({
        id: equipmentId,
        lifecycle: EquipmentLifecycle.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: equipmentId,
        lifecycle: EquipmentLifecycle.RETIRED,
      });

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    await service.retire(companyId, inspectorId, equipmentId, {
      retiredReason: EquipmentRetirementReason.SOLD,
      retirementNotes: '   ',
    });

    expect(prismaMock.equipmentAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: equipmentId,
        companyId,
        lifecycle: EquipmentLifecycle.ACTIVE,
      },
      data: {
        lifecycle: EquipmentLifecycle.RETIRED,
        retiredAt,
        retiredById: inspectorId,
        retiredReason: EquipmentRetirementReason.SOLD,
        retirementNotes: null,
      },
    });
  });

  it('should reject retirement when authenticated user does not belong to company', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.retire(companyId, inspectorId, equipmentId, {
        retiredReason: EquipmentRetirementReason.END_OF_LIFE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.equipmentAsset.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.equipmentAsset.updateMany).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when equipment to retire does not exist', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.retire(companyId, inspectorId, equipmentId, {
        retiredReason: EquipmentRetirementReason.END_OF_LIFE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.equipmentAsset.updateMany).not.toHaveBeenCalled();
  });

  it('should reject equipment that is already retired', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.RETIRED,
    });

    await expect(
      service.retire(companyId, inspectorId, equipmentId, {
        retiredReason: EquipmentRetirementReason.SOLD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.equipmentAsset.updateMany).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when lifecycle changes concurrently during retirement', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: inspectorId,
    });

    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      id: equipmentId,
      lifecycle: EquipmentLifecycle.ACTIVE,
    });

    prismaMock.equipmentAsset.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.retire(companyId, inspectorId, equipmentId, {
        retiredReason: EquipmentRetirementReason.END_OF_LIFE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
