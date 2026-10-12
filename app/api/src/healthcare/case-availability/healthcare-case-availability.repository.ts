import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { healthcareEquipmentAssignmentResponseSelect } from '../equipment-assignments/healthcare-equipment-assignments.repository';

@Injectable()
export class HealthcareCaseAvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  runInReadSnapshot<T>(read: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(read, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  findCase(companyId: string, caseId: string, tx: Prisma.TransactionClient) {
    return tx.healthcareCase.findFirst({
      where: { companyId, id: caseId },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });
  }

  findActiveRequirements(
    companyId: string,
    caseId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.healthcareCaseRequirement.findMany({
      where: { companyId, caseId, lifecycle: 'ACTIVE' },
      select: { type: true },
    });
  }

  findReservedAssignments(
    companyId: string,
    caseId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.healthcareEquipmentAssignment.findMany({
      where: {
        companyId,
        caseId,
        lifecycle: 'RESERVED',
        origin: { in: ['REQUIREMENT', 'DIRECT'] },
      },
      select: healthcareEquipmentAssignmentResponseSelect,
      orderBy: { id: 'asc' },
    });
  }
}
