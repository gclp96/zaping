import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  Optional,
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
import { EquipmentAssetCodeService } from './equipment-asset-code.service';
import { RetireEquipmentDto } from './dto/retire-equipment.dto';
import {
  equipmentPhysicalPublicOmit,
  equipmentPhysicalFailure,
  EquipmentPhysicalError,
} from './equipment-physical.contract';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import { EquipmentPhysicalHistoryService } from './equipment-physical-history.service';
import { acquireHealthcareCompanyLock } from '../healthcare/common/healthcare-company-lock';
import { HealthcareCompanyLockTimeoutError } from '../healthcare/common/healthcare-company-lock-timeout.error';
import { applyHealthcareSubsequentTransactionTimeouts } from '../healthcare/common/healthcare-subsequent-transaction-timeouts';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../healthcare/common/healthcare-company-transaction-timeout.config';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../healthcare/common/healthcare-company-transaction-timeout-policy';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipmentAssetCodeService: EquipmentAssetCodeService,
    @Optional()
    private readonly physical: EquipmentPhysicalRepository = new EquipmentPhysicalRepository(),
    @Optional()
    private readonly history: EquipmentPhysicalHistoryService = new EquipmentPhysicalHistoryService(),
    @Optional()
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly physicalPolicy: HealthcareCompanyTransactionTimeoutPolicy = healthcareCompanyTransactionTimeoutConfiguration(),
  ) {}

  async findAll(companyId: string) {
    return this.prisma.equipmentAsset.findMany({
      omit: equipmentPhysicalPublicOmit,
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
      omit: equipmentPhysicalPublicOmit,
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
      const assetCode =
        await this.equipmentAssetCodeService.allocateNextAvailableAssetCode(
          tx,
          companyId,
        );

      try {
        return await tx.equipmentAsset.create({
          omit: equipmentPhysicalPublicOmit,
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

    return this.physicalTransaction(companyId, async (tx) => {
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

      const equipment = await this.physical.lockAssetForPhysicalMutation(
        tx,
        companyId,
        equipmentId,
      );
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
      if (conditionBefore !== dto.conditionAfter) {
        await this.physical.changeInspectionCondition(
          tx,
          equipment,
          dto.conditionAfter,
        );
        await this.history.appendInspection(
          tx,
          equipment,
          inspection.id,
          inspectedById,
          dto.conditionAfter,
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

    return this.physicalTransaction(companyId, async (tx) => {
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

      const equipment = await this.physical.lockAssetForPhysicalMutation(
        tx,
        companyId,
        equipmentId,
      );
      if (equipment.lifecycle === EquipmentLifecycle.RETIRED) {
        throw new ConflictException('El equipo ya se encuentra retirado');
      }
      const retiredAt = new Date();
      await this.physical.retireAsset(tx, equipment, {
        retiredAt,
        retiredById,
        retiredReason: dto.retiredReason,
        retirementNotes,
      });
      await this.history.appendRetirement(tx, equipment, retiredById);
      const retiredEquipment = await tx.equipmentAsset.findFirst({
        omit: equipmentPhysicalPublicOmit,
        where: { id: equipment.id, companyId },
        include: { product: true, batch: true },
      });
      if (!retiredEquipment)
        throw new NotFoundException('Equipo no encontrado después del retiro');
      return retiredEquipment;
    });
  }

  private async physicalTransaction<T>(
    companyId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await acquireHealthcareCompanyLock(tx, companyId, {
            acquisitionTimeoutMs:
              this.physicalPolicy.companyLockAcquisitionTimeoutMs,
          });
          await applyHealthcareSubsequentTransactionTimeouts(
            tx,
            this.physicalPolicy,
          );
          return operation(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: this.physicalPolicy.prismaMaxWaitMs,
          timeout: this.physicalPolicy.prismaTransactionTimeoutMs,
        },
      );
    } catch (error) {
      if (error instanceof HealthcareCompanyLockTimeoutError)
        throw new EquipmentPhysicalError('HEALTHCARE_CONCURRENCY_TIMEOUT');
      equipmentPhysicalFailure(error);
    }
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
