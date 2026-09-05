import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import * as equipmentAvailabilityEvaluator from './equipment-availability.evaluator';
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
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    const evaluation =
      equipmentAvailabilityEvaluator.evaluateEquipmentCurrentAvailability({
        lifecycle: equipment.lifecycle,
        condition: equipment.condition,
      });

    return {
      ...evaluation,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
