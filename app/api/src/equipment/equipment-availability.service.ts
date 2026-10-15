import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { evaluateEquipmentPhysicalEligibility } from './equipment-physical-eligibility';
import { EquipmentCurrentAvailabilityResult } from './equipment-availability.types';

@Injectable()
export class EquipmentAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateCurrent(
    companyId: string,
    equipmentId: string,
  ): Promise<EquipmentCurrentAvailabilityResult> {
    const equipment = await this.prisma.equipmentAsset.findFirst({
      where: {
        id: equipmentId,
        companyId,
      },
      select: {
        lifecycle: true,
        condition: true,
        physicalLocation: true,
        physicalRevision: true,
        activeCustodyId: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    const evaluation = evaluateEquipmentPhysicalEligibility(equipment);

    return {
      ...evaluation,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
