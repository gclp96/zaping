import { Injectable } from '@nestjs/common';
import {
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  IdempotencyScope,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export const healthcareEquipmentAssignmentResponseSelect = {
  id: true,
  companyId: true,
  caseId: true,
  requirementId: true,
  origin: true,
  lifecycle: true,
  directAssignmentReason: true,
  replacesAssignmentId: true,
  releasedAt: true,
  releaseCause: true,
  releaseReason: true,
  replacedAt: true,
  replacementReason: true,
  createdAt: true,
  updatedAt: true,
  healthcareCase: {
    select: {
      scheduledStart: true,
      scheduledEnd: true,
    },
  },
  equipmentAsset: {
    select: {
      id: true,
      productId: true,
      assetCode: true,
      serialNumber: true,
      lifecycle: true,
      condition: true,
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          isActive: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  releasedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  replacedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  replacementAssignments: {
    select: {
      id: true,
    },
    take: 1,
  },
  conflictOverrides: {
    select: {
      conflictingAssignmentId: true,
      createdAt: true,
      reason: true,
      approvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.HealthcareEquipmentAssignmentSelect;

export type HealthcareEquipmentAssignmentRecord =
  Prisma.HealthcareEquipmentAssignmentGetPayload<{
    select: typeof healthcareEquipmentAssignmentResponseSelect;
  }>;

type HealthcareEquipmentAssignmentDatabaseClient =
  Prisma.TransactionClient | PrismaService;

@Injectable()
export class HealthcareEquipmentAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  runInTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operation);
  }

  findIdempotencyRecord(
    companyId: string,
    key: string,
    scope: IdempotencyScope,
  ) {
    return this.prisma.idempotencyRecord.findUnique({
      where: {
        companyId_scope_key: {
          companyId,
          scope,
          key,
        },
      },
      select: {
        requestHash: true,
        resourceId: true,
      },
    });
  }

  createIdempotencyClaim(
    transaction: Prisma.TransactionClient,
    companyId: string,
    key: string,
    scope: IdempotencyScope,
    requestHash: string,
  ) {
    return transaction.idempotencyRecord.create({
      data: {
        companyId,
        scope,
        key,
        requestHash,
      },
      select: {
        id: true,
      },
    });
  }

  completeIdempotencyClaim(
    transaction: Prisma.TransactionClient,
    id: string,
    resourceId: string,
  ) {
    return transaction.idempotencyRecord.update({
      where: { id },
      data: { resourceId },
      select: { id: true },
    });
  }

  findCase(
    companyId: string,
    caseId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareCase.findFirst({
      where: {
        id: caseId,
        companyId,
      },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });
  }

  findRequirement(
    companyId: string,
    requirementId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareCaseRequirement.findFirst({
      where: {
        id: requirementId,
        companyId,
      },
      select: {
        id: true,
        caseId: true,
        productId: true,
        requestedQty: true,
        lifecycle: true,
        product: {
          select: {
            inventoryTracking: true,
          },
        },
      },
    });
  }

  findEquipmentAsset(
    companyId: string,
    equipmentAssetId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.equipmentAsset.findFirst({
      where: {
        id: equipmentAssetId,
        companyId,
      },
      select: {
        id: true,
        productId: true,
        lifecycle: true,
        condition: true,
      },
    });
  }

  countRequirementCoverage(
    companyId: string,
    requirementId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.count({
      where: {
        companyId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
    });
  }

  findReservedAssignmentForCaseAsset(
    companyId: string,
    caseId: string,
    equipmentAssetId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findFirst({
      where: {
        companyId,
        caseId,
        equipmentAssetId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
      select: { id: true },
    });
  }

  createAssignment(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      caseId: string;
      equipmentAssetId: string;
      requirementId: string | null;
      origin: HealthcareEquipmentAssignmentOrigin;
      directAssignmentReason: string | null;
      createdById: string;
    },
  ) {
    return transaction.healthcareEquipmentAssignment.create({
      data,
      select: healthcareEquipmentAssignmentResponseSelect,
    });
  }

  findAssignment(
    companyId: string,
    assignmentId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findFirst({
      where: {
        id: assignmentId,
        companyId,
      },
      select: healthcareEquipmentAssignmentResponseSelect,
    });
  }

  countAssignments(
    companyId: string,
    filters: {
      caseId?: string;
      requirementId?: string;
      equipmentAssetId?: string;
      lifecycle?: HealthcareEquipmentAssignmentLifecycle;
      origin?: HealthcareEquipmentAssignmentOrigin;
    },
  ) {
    return this.prisma.healthcareEquipmentAssignment.count({
      where: {
        companyId,
        ...filters,
      },
    });
  }

  findAssignments(
    companyId: string,
    filters: {
      caseId?: string;
      requirementId?: string;
      equipmentAssetId?: string;
      lifecycle?: HealthcareEquipmentAssignmentLifecycle;
      origin?: HealthcareEquipmentAssignmentOrigin;
    },
    page: number,
    pageSize: number,
  ) {
    return this.prisma.healthcareEquipmentAssignment.findMany({
      where: {
        companyId,
        ...filters,
      },
      select: healthcareEquipmentAssignmentResponseSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}
