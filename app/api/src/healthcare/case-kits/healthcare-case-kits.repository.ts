import { Injectable } from '@nestjs/common';
import {
  HealthcareCaseKitItemLifecycle,
  IdempotencyScope,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export const healthcareCaseKitItemSelect = {
  id: true,
  companyId: true,
  caseId: true,
  caseKitId: true,
  requirementId: true,
  equipmentAssignmentId: true,
  preparedQuantity: true,
  lifecycle: true,
  createdAt: true,
  addedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  excludedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  excludedAt: true,
  exclusionReason: true,
  requirement: {
    select: {
      id: true,
      productId: true,
      requestedQty: true,
      lifecycle: true,
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          isActive: true,
          inventoryTracking: true,
        },
      },
    },
  },
  equipmentAssignment: {
    select: {
      id: true,
      lifecycle: true,
      equipmentAsset: {
        select: {
          id: true,
          assetCode: true,
          serialNumber: true,
          lifecycle: true,
          condition: true,
          product: {
            select: { id: true, sku: true, name: true, isActive: true },
          },
        },
      },
    },
  },
} satisfies Prisma.HealthcareCaseKitItemSelect;

export const healthcareCaseKitSelect = {
  id: true,
  companyId: true,
  caseId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  healthcareCase: { select: { status: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  items: {
    select: healthcareCaseKitItemSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.HealthcareCaseKitSelect;

export type HealthcareCaseKitRecord = Prisma.HealthcareCaseKitGetPayload<{
  select: typeof healthcareCaseKitSelect;
}>;
export type HealthcareCaseKitItemRecord =
  Prisma.HealthcareCaseKitItemGetPayload<{
    select: typeof healthcareCaseKitItemSelect;
  }>;

type DatabaseClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class HealthcareCaseKitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  runInTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options: { maxWait: number; timeout: number },
  ): Promise<T> {
    return this.prisma.$transaction(operation, options);
  }

  findIdempotencyRecord(
    companyId: string,
    key: string,
    scope: IdempotencyScope,
    client: DatabaseClient = this.prisma,
  ) {
    return client.idempotencyRecord.findUnique({
      where: { companyId_scope_key: { companyId, scope, key } },
      select: { requestHash: true, resourceId: true },
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
      data: { companyId, key, scope, requestHash },
      select: { id: true },
    });
  }

  completeIdempotencyClaim(
    transaction: Prisma.TransactionClient,
    claimId: string,
    resourceId: string,
  ) {
    return transaction.idempotencyRecord.update({
      where: { id: claimId },
      data: { resourceId },
      select: { id: true },
    });
  }

  findCase(
    companyId: string,
    caseId: string,
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareCase.findFirst({
      where: { id: caseId, companyId },
      select: { id: true, status: true },
    });
  }

  async lockCase(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "HealthcareCase"
      WHERE "id" = ${caseId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);
    return rows.length === 1;
  }

  findKitByCase(
    companyId: string,
    caseId: string,
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareCaseKit.findUnique({
      where: { companyId_caseId: { companyId, caseId } },
      select: healthcareCaseKitSelect,
    });
  }

  findKit(
    companyId: string,
    caseKitId: string,
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareCaseKit.findFirst({
      where: { id: caseKitId, companyId },
      select: healthcareCaseKitSelect,
    });
  }

  async lockKit(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseKitId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "HealthcareCaseKit"
      WHERE "id" = ${caseKitId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);
    return rows.length === 1;
  }

  createKit(
    transaction: Prisma.TransactionClient,
    data: { companyId: string; caseId: string; createdById: string },
  ) {
    return transaction.healthcareCaseKit.create({
      data,
      select: healthcareCaseKitSelect,
    });
  }

  findItem(
    companyId: string,
    itemId: string,
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareCaseKitItem.findFirst({
      where: { id: itemId, companyId },
      select: {
        ...healthcareCaseKitItemSelect,
        caseKit: {
          select: {
            id: true,
            status: true,
            healthcareCase: { select: { status: true } },
          },
        },
      },
    });
  }

  async lockRequirement(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirementId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "HealthcareCaseRequirement"
      WHERE "id" = ${requirementId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);
    return rows.length === 1;
  }

  async lockItem(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseKitId: string,
    itemId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "HealthcareCaseKitItem"
      WHERE "id" = ${itemId}
        AND "companyId" = ${companyId}
        AND "caseKitId" = ${caseKitId}
      FOR UPDATE
    `);
    return rows.length === 1;
  }

  findRequirement(
    companyId: string,
    requirementId: string,
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareCaseRequirement.findFirst({
      where: { id: requirementId, companyId },
      select: {
        id: true,
        caseId: true,
        requestedQty: true,
        lifecycle: true,
        product: {
          select: { id: true, isActive: true, inventoryTracking: true },
        },
      },
    });
  }

  async lockAssignment(
    transaction: Prisma.TransactionClient,
    companyId: string,
    assignmentId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "HealthcareEquipmentAssignment"
      WHERE "id" = ${assignmentId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);
    return rows.length === 1;
  }

  findAssignment(
    companyId: string,
    assignmentId: string,
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findFirst({
      where: { id: assignmentId, companyId },
      select: {
        id: true,
        caseId: true,
        lifecycle: true,
        equipmentAsset: {
          select: { lifecycle: true, condition: true },
        },
      },
    });
  }

  findDuplicateItem(
    companyId: string,
    caseKitId: string,
    source: { requirementId?: string; equipmentAssignmentId?: string },
    client: DatabaseClient = this.prisma,
  ) {
    return client.healthcareCaseKitItem.findFirst({
      where: {
        companyId,
        caseKitId,
        lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
        ...source,
      },
      select: { id: true },
    });
  }

  excludeItem(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      caseKitId: string;
      itemId: string;
      excludedById: string;
      excludedAt: Date;
      exclusionReason: string;
    },
  ) {
    return transaction.healthcareCaseKitItem.updateMany({
      where: {
        id: data.itemId,
        companyId: data.companyId,
        caseKitId: data.caseKitId,
        lifecycle: HealthcareCaseKitItemLifecycle.ACTIVE,
      },
      data: {
        lifecycle: HealthcareCaseKitItemLifecycle.EXCLUDED,
        excludedById: data.excludedById,
        excludedAt: data.excludedAt,
        exclusionReason: data.exclusionReason,
      },
    });
  }

  createItem(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      caseId: string;
      caseKitId: string;
      requirementId: string | null;
      equipmentAssignmentId: string | null;
      preparedQuantity: number | null;
      addedById: string;
    },
  ) {
    return transaction.healthcareCaseKitItem.create({
      data,
      select: healthcareCaseKitItemSelect,
    });
  }
}
