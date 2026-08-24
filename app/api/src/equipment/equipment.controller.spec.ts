import { Test, TestingModule } from '@nestjs/testing';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentRetirementReason,
  UserRole,
} from '@prisma/client';

import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

describe('EquipmentController', () => {
  let controller: EquipmentController;

  const companyId = '699baaae-2718-4d96-8683-8a2cf12bfe55';
  const userId = 'f6c503b4-82db-4e21-b2ce-f7cc9e13f021';
  const productId = '953a950f-b33a-4ff5-85ac-4ff35b8f3017';
  const equipmentId = 'cca93237-878a-4467-ae17-b2514dff6819';

  const equipmentServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findInspections: jest.fn(),
    createInspection: jest.fn(),
    retire: jest.fn(),
  };

  const req = {
    user: {
      id: userId,
      companyId,
      email: 'admin@insap.com',
      firstName: 'Admin',
      lastName: 'INSAP',
      role: UserRole.ADMIN,
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EquipmentController],
      providers: [
        {
          provide: EquipmentService,
          useValue: equipmentServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<EquipmentController>(EquipmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list equipment using the authenticated companyId', async () => {
    const equipment = [
      {
        id: equipmentId,
        companyId,
        productId,
        assetCode: 'EQ-AST-010',
      },
    ];

    equipmentServiceMock.findAll.mockResolvedValue(equipment);

    const result = await controller.findAll(req);

    expect(result).toEqual(equipment);

    expect(equipmentServiceMock.findAll).toHaveBeenCalledWith(companyId);
  });

  it('should find one equipment using companyId and equipmentId', async () => {
    const equipment = {
      id: equipmentId,
      companyId,
      productId,
      assetCode: 'EQ-AST-010',
    };

    equipmentServiceMock.findOne.mockResolvedValue(equipment);

    const result = await controller.findOne(req, equipmentId);

    expect(result).toEqual(equipment);

    expect(equipmentServiceMock.findOne).toHaveBeenCalledWith(
      companyId,
      equipmentId,
    );
  });

  it('should create equipment using the authenticated companyId', async () => {
    const dto = {
      productId,
      serialNumber: 'SN-TEST-030',
      condition: EquipmentCondition.GOOD,
    };

    const createdEquipment = {
      id: equipmentId,
      companyId,
      ...dto,
      assetCode: 'EQ-000001',
    };

    equipmentServiceMock.create.mockResolvedValue(createdEquipment);

    const result = await controller.create(req, dto);

    expect(result).toEqual(createdEquipment);

    expect(equipmentServiceMock.create).toHaveBeenCalledWith(companyId, dto);
  });

  it('should list inspection history using companyId and equipmentId', async () => {
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

    equipmentServiceMock.findInspections.mockResolvedValue(inspections);

    const result = await controller.findInspections(req, equipmentId);

    expect(result).toEqual(inspections);

    expect(equipmentServiceMock.findInspections).toHaveBeenCalledWith(
      companyId,
      equipmentId,
    );
  });

  it('should create inspection using authenticated companyId and userId', async () => {
    const dto = {
      conditionAfter: EquipmentCondition.GOOD,
      notes: 'Inspección física y funcional correcta',
    };

    const createdInspection = {
      id: 'inspection-001',
      companyId,
      equipmentAssetId: equipmentId,
      conditionBefore: EquipmentCondition.INSPECTION_PENDING,
      conditionAfter: EquipmentCondition.GOOD,
      inspectedById: userId,
      notes: dto.notes,
    };

    equipmentServiceMock.createInspection.mockResolvedValue(createdInspection);

    const result = await controller.createInspection(req, equipmentId, dto);

    expect(result).toEqual(createdInspection);

    expect(equipmentServiceMock.createInspection).toHaveBeenCalledWith(
      companyId,
      userId,
      equipmentId,
      dto,
    );
  });

  it('should retire equipment using authenticated companyId and userId', async () => {
    const dto = {
      retiredReason: EquipmentRetirementReason.END_OF_LIFE,
      retirementNotes: 'Fin de vida útil',
    };

    const retiredEquipment = {
      id: equipmentId,
      companyId,
      productId,
      assetCode: 'EQ-AST-010',
      lifecycle: EquipmentLifecycle.RETIRED,
      condition: EquipmentCondition.OUT_OF_SERVICE,
      retiredById: userId,
      retiredReason: EquipmentRetirementReason.END_OF_LIFE,
      retirementNotes: 'Fin de vida útil',
    };

    equipmentServiceMock.retire.mockResolvedValue(retiredEquipment);

    const result = await controller.retire(req, equipmentId, dto);

    expect(result).toEqual(retiredEquipment);

    expect(equipmentServiceMock.retire).toHaveBeenCalledWith(
      companyId,
      userId,
      equipmentId,
      dto,
    );
  });
});
