import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentCondition, EquipmentLifecycle } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import * as equipmentAvailabilityEvaluator from './equipment-availability.evaluator';
import { EquipmentAvailabilityService } from './equipment-availability.service';
import { EQUIPMENT_AVAILABILITY_REASON } from './equipment-availability.types';

type EquipmentAssetFindFirstArgs = {
  where: {
    id: string;
    companyId: string;
  };
  select: {
    lifecycle: true;
    condition: true;
  };
};

describe('EquipmentAvailabilityService', () => {
  let service: EquipmentAvailabilityService;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const equipmentId = 'cca93237-878a-4467-ae17-b2514dff6819';
  const evaluatedAt = new Date('2026-08-24T12:34:56.789Z');

  const prismaMock = {
    equipmentAsset: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const getFindFirstArgs = (): EquipmentAssetFindFirstArgs =>
    (
      prismaMock.equipmentAsset.findFirst.mock.calls[0] as [
        EquipmentAssetFindFirstArgs,
      ]
    )[0];

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(evaluatedAt);

    prismaMock.equipmentAsset.findFirst.mockResolvedValue({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.GOOD,
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentAvailabilityService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<EquipmentAvailabilityService>(
      EquipmentAvailabilityService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should mark ACTIVE GOOD equipment as available with evaluatedAt', async () => {
    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result).toEqual({
      available: true,
      primaryReason: null,
      reasons: [],
      evaluatedAt: evaluatedAt.toISOString(),
    });
  });

  it('should block ACTIVE INSPECTION_PENDING equipment', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.INSPECTION_PENDING,
    });

    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.INSPECTION_PENDING,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.INSPECTION_PENDING],
      evaluatedAt: evaluatedAt.toISOString(),
    });
  });

  it('should block ACTIVE DAMAGED equipment', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.DAMAGED,
    });

    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.DAMAGED,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.DAMAGED],
      evaluatedAt: evaluatedAt.toISOString(),
    });
  });

  it('should block ACTIVE OUT_OF_SERVICE equipment', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      lifecycle: EquipmentLifecycle.ACTIVE,
      condition: EquipmentCondition.OUT_OF_SERVICE,
    });

    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.OUT_OF_SERVICE,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.OUT_OF_SERVICE],
      evaluatedAt: evaluatedAt.toISOString(),
    });
  });

  it('should block RETIRED GOOD equipment', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.GOOD,
    });

    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      reasons: [EQUIPMENT_AVAILABILITY_REASON.RETIRED],
      evaluatedAt: evaluatedAt.toISOString(),
    });
  });

  it('should return RETIRED before DAMAGED', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.DAMAGED,
    });

    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result).toEqual({
      available: false,
      primaryReason: EQUIPMENT_AVAILABILITY_REASON.RETIRED,
      reasons: [
        EQUIPMENT_AVAILABILITY_REASON.RETIRED,
        EQUIPMENT_AVAILABILITY_REASON.DAMAGED,
      ],
      evaluatedAt: evaluatedAt.toISOString(),
    });
  });

  it('should throw NotFoundException for nonexistent equipment', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.evaluateCurrent(companyId, equipmentId),
    ).rejects.toThrow(new NotFoundException('Equipo no encontrado'));
  });

  it('should use the same NotFoundException for cross-tenant equipment', async () => {
    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.evaluateCurrent(companyId, equipmentId),
    ).rejects.toThrow(new NotFoundException('Equipo no encontrado'));
  });

  it('should scope lookup by equipment id and company id', async () => {
    await service.evaluateCurrent(companyId, equipmentId);

    expect(getFindFirstArgs().where).toEqual({
      id: equipmentId,
      companyId,
    });
  });

  it('should select only lifecycle and condition', async () => {
    await service.evaluateCurrent(companyId, equipmentId);

    expect(getFindFirstArgs().select).toEqual({
      lifecycle: true,
      condition: true,
    });
  });

  it('should delegate lifecycle and condition facts to the pure evaluator', async () => {
    const evaluateSpy = jest.spyOn(
      equipmentAvailabilityEvaluator,
      'evaluateEquipmentCurrentAvailability',
    );

    prismaMock.equipmentAsset.findFirst.mockResolvedValueOnce({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.OUT_OF_SERVICE,
    });

    await service.evaluateCurrent(companyId, equipmentId);

    expect(evaluateSpy).toHaveBeenCalledWith({
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.OUT_OF_SERVICE,
    });
  });

  it('should produce deterministic evaluatedAt under fake system time', async () => {
    const result = await service.evaluateCurrent(companyId, equipmentId);

    expect(result.evaluatedAt).toBe('2026-08-24T12:34:56.789Z');
  });

  it('should not require inspection history', async () => {
    await service.evaluateCurrent(companyId, equipmentId);

    expect(prismaMock).not.toHaveProperty('equipmentInspection');
  });

  it('should not load Product.stock', async () => {
    await service.evaluateCurrent(companyId, equipmentId);

    expect(prismaMock).not.toHaveProperty('product');
  });

  it('should perform no writes and start no transaction', async () => {
    await service.evaluateCurrent(companyId, equipmentId);

    expect(prismaMock.equipmentAsset.create).not.toHaveBeenCalled();
    expect(prismaMock.equipmentAsset.update).not.toHaveBeenCalled();
    expect(prismaMock.equipmentAsset.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.equipmentAsset.delete).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
