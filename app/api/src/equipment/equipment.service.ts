import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EquipmentCondition,
  EquipmentLifecycle,
  EquipmentOrigin,
  EquipmentRetirementReason,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateEquipmentInspectionDto } from './dto/create-equipment-inspection.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { RetireEquipmentDto } from './dto/retire-equipment.dto';

const EQUIPMENT_ASSET_CODE_SEQUENCE_KEY = 'EQUIPMENT_ASSET_CODE';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.equipmentAsset.findMany({
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
  }

  async findOne(companyId: string, equipmentId: string) {
    const equipment = await this.prisma.equipmentAsset.findFirst({
      where: {
        id: equipmentId,
        companyId,
      },
      include: {
        product: true,
        batch: true,
        inspections: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    return equipment;
  }

  async create(companyId: string, dto: CreateEquipmentDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        companyId,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (product.inventoryTracking !== ProductInventoryTracking.ASSET) {
      throw new BadRequestException(
        'El producto debe utilizar seguimiento de inventario ASSET',
      );
    }

    if (!product.isActive) {
      throw new BadRequestException(
        'No se puede registrar equipo para un producto inactivo',
      );
    }

    if (dto.batchId) {
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id: dto.batchId,
          companyId,
          productId: dto.productId,
        },
      });

      if (!batch) {
        throw new NotFoundException('Lote no encontrado para este producto');
      }
    }

    const { serialNumber, serialNumberKey } = this.normalizeSerialNumber(
      dto.serialNumber,
    );

    if (serialNumberKey) {
      const existingSerial = await this.prisma.equipmentAsset.findFirst({
        where: {
          companyId,
          productId: dto.productId,
          serialNumberKey,
        },
        select: {
          id: true,
        },
      });

      if (existingSerial) {
        throw new ConflictException(
          'Ya existe un equipo de este producto con ese número de serie',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureEquipmentAssetCodeSequence(tx, companyId);

      const assetCode = await this.allocateEquipmentAssetCode(tx, companyId);

      try {
        return await tx.equipmentAsset.create({
          data: {
            companyId,
            productId: dto.productId,
            assetCode,
            serialNumber,
            serialNumberKey,
            condition: dto.condition,
            origin: EquipmentOrigin.MANUAL,
            batchId: dto.batchId,
          },
          include: {
            product: true,
            batch: true,
          },
        });
      } catch (error: unknown) {
        this.handleUniqueConstraintError(error);
      }
    });
  }

  async createInspection(
    companyId: string,
    inspectedById: string,
    equipmentId: string,
    dto: CreateEquipmentInspectionDto,
  ) {
    if (
      dto.conditionAfter !== EquipmentCondition.GOOD &&
      dto.conditionAfter !== EquipmentCondition.DAMAGED &&
      dto.conditionAfter !== EquipmentCondition.OUT_OF_SERVICE
    ) {
      throw new BadRequestException(
        'INSPECTION_PENDING no es un resultado válido de inspección',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const inspector = await tx.user.findFirst({
        where: {
          id: inspectedById,
          companyId,
        },
        select: {
          id: true,
        },
      });

      if (!inspector) {
        throw new ForbiddenException(
          'El usuario no está autorizado para inspeccionar este equipo',
        );
      }

      const equipment = await tx.equipmentAsset.findFirst({
        where: {
          id: equipmentId,
          companyId,
        },
        select: {
          id: true,
          lifecycle: true,
          condition: true,
        },
      });

      if (!equipment) {
        throw new NotFoundException('Equipo no encontrado');
      }

      if (equipment.lifecycle !== EquipmentLifecycle.ACTIVE) {
        throw new BadRequestException(
          'No se puede inspeccionar un equipo retirado',
        );
      }

      const conditionBefore = equipment.condition;

      const inspection = await tx.equipmentInspection.create({
        data: {
          companyId,
          equipmentAssetId: equipment.id,
          conditionBefore,
          conditionAfter: dto.conditionAfter,
          inspectedById,
          notes: dto.notes?.trim() || null,
        },
      });

      const updateResult = await tx.equipmentAsset.updateMany({
        where: {
          id: equipment.id,
          companyId,
          lifecycle: EquipmentLifecycle.ACTIVE,
          condition: conditionBefore,
        },
        data: {
          condition: dto.conditionAfter,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'El estado del equipo cambió durante la inspección. Intenta nuevamente',
        );
      }

      return inspection;
    });
  }

  async findInspections(companyId: string, equipmentId: string) {
    const equipment = await this.prisma.equipmentAsset.findFirst({
      where: {
        id: equipmentId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    return this.prisma.equipmentInspection.findMany({
      where: {
        companyId,
        equipmentAssetId: equipment.id,
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
  }

  async retire(
    companyId: string,
    retiredById: string,
    equipmentId: string,
    dto: RetireEquipmentDto,
  ) {
    const retirementNotes = dto.retirementNotes?.trim() || null;

    if (
      dto.retiredReason === EquipmentRetirementReason.OTHER &&
      !retirementNotes
    ) {
      throw new BadRequestException(
        'Las notas de retiro son obligatorias cuando la razón es OTHER',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const retiringUser = await tx.user.findFirst({
        where: {
          id: retiredById,
          companyId,
        },
        select: {
          id: true,
        },
      });

      if (!retiringUser) {
        throw new ForbiddenException(
          'El usuario no está autorizado para retirar este equipo',
        );
      }

      const equipment = await tx.equipmentAsset.findFirst({
        where: {
          id: equipmentId,
          companyId,
        },
        select: {
          id: true,
          lifecycle: true,
        },
      });

      if (!equipment) {
        throw new NotFoundException('Equipo no encontrado');
      }

      if (equipment.lifecycle === EquipmentLifecycle.RETIRED) {
        throw new ConflictException('El equipo ya se encuentra retirado');
      }

      const retiredAt = new Date();

      const updateResult = await tx.equipmentAsset.updateMany({
        where: {
          id: equipment.id,
          companyId,
          lifecycle: EquipmentLifecycle.ACTIVE,
        },
        data: {
          lifecycle: EquipmentLifecycle.RETIRED,
          retiredAt,
          retiredById,
          retiredReason: dto.retiredReason,
          retirementNotes,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'El estado del equipo cambió durante el retiro. Intenta nuevamente',
        );
      }

      const retiredEquipment = await tx.equipmentAsset.findFirst({
        where: {
          id: equipment.id,
          companyId,
        },
        include: {
          product: true,
          batch: true,
        },
      });

      if (!retiredEquipment) {
        throw new NotFoundException('Equipo no encontrado después del retiro');
      }

      return retiredEquipment;
    });
  }

  private async allocateEquipmentAssetCode(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    while (true) {
      const nextValue = await this.allocateNextEquipmentSequenceValue(
        tx,
        companyId,
      );

      const assetCode = this.formatEquipmentAssetCode(nextValue);

      const existingAssetCode = await tx.equipmentAsset.findFirst({
        where: {
          companyId,
          assetCode,
        },
        select: {
          id: true,
        },
      });

      if (!existingAssetCode) {
        return assetCode;
      }
    }
  }

  private async ensureEquipmentAssetCodeSequence(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    await tx.companySequence.createMany({
      data: [
        {
          companyId,
          key: EQUIPMENT_ASSET_CODE_SEQUENCE_KEY,
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async allocateNextEquipmentSequenceValue(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    const sequence = await tx.companySequence.update({
      where: {
        companyId_key: {
          companyId,
          key: EQUIPMENT_ASSET_CODE_SEQUENCE_KEY,
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

    return sequence.nextValue - 1;
  }

  private formatEquipmentAssetCode(value: number) {
    return `EQ-${value.toString().padStart(6, '0')}`;
  }

  private normalizeSerialNumber(serialNumber?: string | null): {
    serialNumber: string | null;
    serialNumberKey: string | null;
  } {
    if (serialNumber === undefined || serialNumber === null) {
      return {
        serialNumber: null,
        serialNumberKey: null,
      };
    }

    const normalizedSerial = serialNumber.trim();

    if (!normalizedSerial) {
      return {
        serialNumber: null,
        serialNumberKey: null,
      };
    }

    return {
      serialNumber: normalizedSerial,
      serialNumberKey: normalizedSerial.toUpperCase(),
    };
  }

  private handleUniqueConstraintError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un equipo con datos únicos duplicados',
      );
    }

    throw error;
  }
}
