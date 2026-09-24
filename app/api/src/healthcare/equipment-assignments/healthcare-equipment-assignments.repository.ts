import { Injectable } from '@nestjs/common';
import {
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
  IdempotencyScope,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';

export const EQUIPMENT_ASSIGNMENT_SETTINGS_LOCK_NAMESPACE =
  'healthcare-equipment-assignment-settings:v1';

export function equipmentAssignmentSettingsAdvisoryLockKey(
  companyId: string,
): bigint {
  const digest = createHash('sha256')
    .update(`${EQUIPMENT_ASSIGNMENT_SETTINGS_LOCK_NAMESPACE}:${companyId}`)
    .digest();

  return digest.readBigInt64BE(0);
}

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
      folio: true,
      scheduledStart: true,
      scheduledEnd: true,
      updatedAt: true,
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
      assignmentWindowStart: true,
      assignmentWindowEnd: true,
      conflictingWindowStart: true,
      conflictingWindowEnd: true,
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

export interface HealthcareEquipmentAssignmentTransactionOptions {
  readonly maxWait: number;
  readonly timeout: number;
}

export const healthcareEquipmentReservationAvailabilitySelect = {
  id: true,
  caseId: true,
  updatedAt: true,
  healthcareCase: {
    select: {
      id: true,
      folio: true,
      scheduledStart: true,
      scheduledEnd: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.HealthcareEquipmentAssignmentSelect;

export type HealthcareEquipmentReservationAvailabilityRecord =
  Prisma.HealthcareEquipmentAssignmentGetPayload<{
    select: typeof healthcareEquipmentReservationAvailabilitySelect;
  }>;

@Injectable()
export class HealthcareEquipmentAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  runInTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: HealthcareEquipmentAssignmentTransactionOptions,
  ): Promise<T> {
    if (options) {
      return this.prisma.$transaction(operation, options);
    }

    return this.prisma.$transaction(operation);
  }

  findIdempotencyRecord(
    companyId: string,
    key: string,
    scope: IdempotencyScope,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.idempotencyRecord.findUnique({
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
        folio: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        updatedAt: true,
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
        updatedAt: true,
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
        assetCode: true,
        serialNumber: true,
        lifecycle: true,
        condition: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            isActive: true,
          },
        },
      },
    });
  }

  findSettings(
    companyId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignmentSettings.findUnique({
      where: { companyId },
      select: {
        preCaseBufferMinutes: true,
        postCaseBufferMinutes: true,
      },
    });
  }

  async lockEquipmentAsset(
    transaction: Prisma.TransactionClient,
    companyId: string,
    equipmentAssetId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "EquipmentAsset"
      WHERE "id" = ${equipmentAssetId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);

    return rows.length === 1;
  }

  async lockRequirement(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirementId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "HealthcareCaseRequirement"
      WHERE "id" = ${requirementId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);

    return rows.length === 1;
  }

  findAssignmentReplacementSource(
    companyId: string,
    assignmentId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findFirst({
      where: {
        id: assignmentId,
        companyId,
      },
      select: {
        id: true,
        companyId: true,
        caseId: true,
        equipmentAssetId: true,
        requirementId: true,
        origin: true,
        lifecycle: true,
        directAssignmentReason: true,
        updatedAt: true,
      },
    });
  }

  findAssignmentReleaseSource(
    companyId: string,
    assignmentId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findFirst({
      where: {
        id: assignmentId,
        companyId,
      },
      select: {
        id: true,
        equipmentAssetId: true,
      },
    });
  }

  async lockAssignment(
    transaction: Prisma.TransactionClient,
    companyId: string,
    assignmentId: string,
  ) {
    const rows = await transaction.$queryRaw<
      Array<{
        id: string;
        companyId: string;
        caseId: string;
        equipmentAssetId: string;
        requirementId: string | null;
        origin: HealthcareEquipmentAssignmentOrigin;
        lifecycle: HealthcareEquipmentAssignmentLifecycle;
        directAssignmentReason: string | null;
        releasedAt: Date | null;
        releasedById: string | null;
        releaseCause: HealthcareEquipmentAssignmentReleaseCause | null;
        releaseReason: string | null;
        updatedAt: Date;
      }>
    >(Prisma.sql`
    SELECT
      "id",
      "companyId",
      "caseId",
      "equipmentAssetId",
      "requirementId",
      "origin",
      "lifecycle",
      "directAssignmentReason",
      "releasedAt",
      "releasedById",
      "releaseCause",
      "releaseReason",
      "updatedAt"
    FROM "HealthcareEquipmentAssignment"
    WHERE "id" = ${assignmentId}
      AND "companyId" = ${companyId}
    FOR UPDATE
  `);

    return rows[0] ?? null;
  }

  async lockReservedRequirementAssignments(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      caseId: string;
      requirementId: string;
    },
  ): Promise<string[]> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "HealthcareEquipmentAssignment"
      WHERE "companyId" = ${data.companyId}
        AND "caseId" = ${data.caseId}
        AND "requirementId" = ${data.requirementId}
        AND "origin" = CAST(${HealthcareEquipmentAssignmentOrigin.REQUIREMENT} AS "HealthcareEquipmentAssignmentOrigin")
        AND "lifecycle" = CAST(${HealthcareEquipmentAssignmentLifecycle.RESERVED} AS "HealthcareEquipmentAssignmentLifecycle")
      ORDER BY "id" ASC
      FOR UPDATE
    `);

    return rows.map((row) => row.id);
  }

  async lockReservedCaseAssignments(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      caseId: string;
    },
  ): Promise<string[]> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "HealthcareEquipmentAssignment"
      WHERE "companyId" = ${data.companyId}
        AND "caseId" = ${data.caseId}
        AND "lifecycle" = CAST(${HealthcareEquipmentAssignmentLifecycle.RESERVED} AS "HealthcareEquipmentAssignmentLifecycle")
      ORDER BY "id" ASC
      FOR UPDATE
    `);

    return rows.map((row) => row.id);
  }

  async acquireSettingsSharedAdvisoryLock(
    transaction: Prisma.TransactionClient,
    companyId: string,
  ): Promise<void> {
    const lockKey = equipmentAssignmentSettingsAdvisoryLockKey(companyId);

    await transaction.$queryRaw<Array<{ lock: string }>>(Prisma.sql`
      SELECT pg_advisory_xact_lock_shared(${lockKey})::text AS "lock"
    `);
  }

  async lockHealthcareCasesForShare(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseIds: string[],
  ): Promise<string[]> {
    if (caseIds.length === 0) {
      return [];
    }

    const sortedCaseIds = [...new Set(caseIds)].sort((left, right) =>
      left.localeCompare(right),
    );
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "HealthcareCase"
      WHERE "companyId" = ${companyId}
        AND "id" IN (${Prisma.join(sortedCaseIds)})
      ORDER BY "id" ASC
      FOR SHARE
    `);

    return rows.map((row) => row.id);
  }

  async findSettingsForShare(
    transaction: Prisma.TransactionClient,
    companyId: string,
  ): Promise<{
    preCaseBufferMinutes: number;
    postCaseBufferMinutes: number;
  } | null> {
    const rows = await transaction.$queryRaw<
      Array<{
        preCaseBufferMinutes: number;
        postCaseBufferMinutes: number;
      }>
    >(Prisma.sql`
      SELECT "preCaseBufferMinutes", "postCaseBufferMinutes"
      FROM "HealthcareEquipmentAssignmentSettings"
      WHERE "companyId" = ${companyId}
      FOR SHARE
    `);

    return rows[0] ?? null;
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

  findReservedAssignmentCaseIdsForAsset(
    companyId: string,
    equipmentAssetId: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findMany({
      where: {
        companyId,
        equipmentAssetId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
      select: { caseId: true },
      orderBy: [{ caseId: 'asc' }, { id: 'asc' }],
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
      replacesAssignmentId?: string | null;
    },
  ) {
    return transaction.healthcareEquipmentAssignment.create({
      data,
      select: healthcareEquipmentAssignmentResponseSelect,
    });
  }

  releaseAssignment(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      assignmentId: string;
      releasedAt: Date;
      releasedById: string;
      releaseCause: HealthcareEquipmentAssignmentReleaseCause;
      releaseReason: string;
      expectedContext?:
        | {
            caseId: string;
            requirementId: string;
            origin: HealthcareEquipmentAssignmentOrigin;
          }
        | {
            caseId: string;
            requirementId?: never;
            origin?: never;
          };
    },
  ) {
    return transaction.healthcareEquipmentAssignment.updateMany({
      where: {
        id: data.assignmentId,
        companyId: data.companyId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        ...(data.expectedContext ?? {}),
      },
      data: {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RELEASED,
        releasedAt: data.releasedAt,
        releasedById: data.releasedById,
        releaseCause: data.releaseCause,
        releaseReason: data.releaseReason,
      },
    });
  }

  replaceAssignment(
    transaction: Prisma.TransactionClient,
    data: {
      companyId: string;
      assignmentId: string;
      replacedAt: Date;
      replacedById: string;
      replacementReason: string;
    },
  ) {
    return transaction.healthcareEquipmentAssignment.updateMany({
      where: {
        id: data.assignmentId,
        companyId: data.companyId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
      data: {
        lifecycle: HealthcareEquipmentAssignmentLifecycle.REPLACED,
        replacedAt: data.replacedAt,
        replacedById: data.replacedById,
        replacementReason: data.replacementReason,
      },
    });
  }

  createConflictOverrides(
    transaction: Prisma.TransactionClient,
    rows: Array<{
      companyId: string;
      assignmentId: string;
      conflictingAssignmentId: string;
      assignmentWindowStart: Date;
      assignmentWindowEnd: Date;
      conflictingWindowStart: Date;
      conflictingWindowEnd: Date;
      approvedById: string;
      reason: string;
    }>,
  ) {
    return transaction.healthcareEquipmentAssignmentConflictOverride.createMany(
      { data: rows },
    );
  }

  findReservedAssignmentsForAsset(
    companyId: string,
    equipmentAssetId: string,
    excludeAssignmentId?: string,
    client: HealthcareEquipmentAssignmentDatabaseClient = this.prisma,
  ) {
    return client.healthcareEquipmentAssignment.findMany({
      where: {
        companyId,
        equipmentAssetId,
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
      },
      select: healthcareEquipmentReservationAvailabilitySelect,
      orderBy: { id: 'asc' },
    });
  }

  findReservedAssignmentsForAssets(
    companyId: string,
    equipmentAssetIds: string[],
  ) {
    return this.prisma.healthcareEquipmentAssignment.findMany({
      where: {
        companyId,
        equipmentAssetId: { in: equipmentAssetIds },
        lifecycle: HealthcareEquipmentAssignmentLifecycle.RESERVED,
      },
      select: {
        ...healthcareEquipmentReservationAvailabilitySelect,
        equipmentAssetId: true,
      },
      orderBy: { id: 'asc' },
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
