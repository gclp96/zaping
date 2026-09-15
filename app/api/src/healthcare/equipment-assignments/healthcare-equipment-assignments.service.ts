import { HttpException, Injectable } from '@nestjs/common';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareRequirementLifecycle,
  IdempotencyScope,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import {
  assignmentAlreadyReservedException,
  assignmentProductMismatchException,
  assignmentRequirementCaseMismatchException,
  caseEquipmentAssignmentsReadOnlyException,
  caseNotFoundException,
  equipmentAssignmentNotFoundException,
  equipmentAssetNotEligibleException,
  equipmentAssetNotFoundException,
  healthcarePersistenceException,
  idempotencyKeyReusedException,
  invalidAssignmentOriginException,
  relatedResourceChangedException,
  requirementNotFoundException,
  requirementOverCoverageException,
  requirementRetiredException,
} from '../common/healthcare-errors';
import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';
import { CreateHealthcareEquipmentAssignmentDto } from './dto/create-healthcare-equipment-assignment.dto';
import {
  HealthcareEquipmentAssignmentListQueryDto,
  HealthcareEquipmentAssignmentListStatus,
  toAssignmentLifecycleFilter,
} from './dto/healthcare-equipment-assignment-list-query.dto';
import { createHealthcareEquipmentAssignmentRequestHash } from './healthcare-equipment-assignment-request-hash';
import {
  HealthcareEquipmentAssignmentRecord,
  HealthcareEquipmentAssignmentsRepository,
} from './healthcare-equipment-assignments.repository';

const CREATE_SCOPE = IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE;
const RESERVED_ASSIGNMENT_UNIQUE_CONSTRAINT =
  'HealthcareEquipmentAssignment_reserved_case_asset_key';
const IDEMPOTENCY_UNIQUE_CONSTRAINT =
  'IdempotencyRecord_companyId_scope_key_key';

type CompactUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type AvailabilityWarning = {
  code: 'INCOMPLETE_CASE_SCHEDULE';
  message: string;
};

export type HealthcareEquipmentAssignmentResponse = {
  id: string;
  caseId: string;
  requirementId: string | null;
  origin: HealthcareEquipmentAssignmentOrigin;
  status: HealthcareEquipmentAssignmentLifecycle;
  equipmentAsset: HealthcareEquipmentAssignmentRecord['equipmentAsset'];
  assignedAt: Date;
  assignedBy: CompactUser;
  directAssignmentReason?: string | null;
  replacesAssignmentId: string | null;
  replacement: {
    successorAssignmentId: string;
    reason: string;
    replacedAt: Date;
    replacedBy: CompactUser;
  } | null;
  release: {
    cause: NonNullable<HealthcareEquipmentAssignmentRecord['releaseCause']>;
    reason: string | null;
    releasedAt: Date;
    releasedBy: CompactUser;
  } | null;
  availability: {
    fullyVerifiable: false;
    conflictFree: null;
    warnings: AvailabilityWarning[];
  } | null;
  conflictOverrides: Array<{
    conflictingAssignmentId: string;
    approvedAt: Date;
    approvedBy: CompactUser;
    reason: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

type NormalizedCreateInput = {
  caseId: string;
  equipmentAssetId: string;
  requirementId: string | null;
  origin: HealthcareEquipmentAssignmentOrigin;
  directAssignmentReason: string | null;
};

type HealthcareEquipmentRequirementRecord = NonNullable<
  Awaited<
    ReturnType<HealthcareEquipmentAssignmentsRepository['findRequirement']>
  >
>;

@Injectable()
export class HealthcareEquipmentAssignmentsService {
  constructor(
    private readonly repository: HealthcareEquipmentAssignmentsRepository,
  ) {}

  async findAll(
    companyId: string,
    query: HealthcareEquipmentAssignmentListQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const status =
      query.status ?? HealthcareEquipmentAssignmentListStatus.RESERVED;

    try {
      await this.validateListFilters(companyId, query);

      const filters = {
        ...(query.caseId ? { caseId: query.caseId } : {}),
        ...(query.requirementId ? { requirementId: query.requirementId } : {}),
        ...(query.equipmentAssetId
          ? { equipmentAssetId: query.equipmentAssetId }
          : {}),
        ...(toAssignmentLifecycleFilter(status)
          ? { lifecycle: toAssignmentLifecycleFilter(status) }
          : {}),
        ...(query.origin ? { origin: query.origin } : {}),
      };

      const [totalItems, records] = await Promise.all([
        this.repository.countAssignments(companyId, filters),
        this.repository.findAssignments(companyId, filters, page, pageSize),
      ]);

      return {
        items: records.map((record) => this.mapResponse(record)),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async findOne(
    companyId: string,
    assignmentId: string,
  ): Promise<HealthcareEquipmentAssignmentResponse> {
    try {
      const record = await this.repository.findAssignment(
        companyId,
        assignmentId,
      );

      if (!record) {
        throw equipmentAssignmentNotFoundException();
      }

      return this.mapResponse(record);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async create(
    companyId: string,
    createdById: string,
    idempotencyKey: string,
    dto: CreateHealthcareEquipmentAssignmentDto,
  ): Promise<{
    outcome: 'CREATED';
    data: HealthcareEquipmentAssignmentResponse;
  }> {
    const input = this.normalizeCreateInput(dto);
    const requestHash = createHealthcareEquipmentAssignmentRequestHash({
      ...dto,
      requirementId: input.requirementId,
      directAssignmentReason: input.directAssignmentReason,
    });

    try {
      const replay = await this.findCompletedIdempotentAssignment(
        companyId,
        idempotencyKey,
        requestHash,
      );

      if (replay) {
        return replay;
      }

      return await this.repository.runInTransaction(async (transaction) => {
        const claim = await this.repository.createIdempotencyClaim(
          transaction,
          companyId,
          idempotencyKey,
          CREATE_SCOPE,
          requestHash,
        );

        const healthcareCase = await this.repository.findCase(
          companyId,
          input.caseId,
          transaction,
        );

        if (!healthcareCase) {
          throw caseNotFoundException();
        }

        if (healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
          throw caseEquipmentAssignmentsReadOnlyException();
        }

        const equipmentAsset = await this.repository.findEquipmentAsset(
          companyId,
          input.equipmentAssetId,
          transaction,
        );

        if (!equipmentAsset) {
          throw equipmentAssetNotFoundException();
        }

        this.assertEquipmentAssetEligible(equipmentAsset);

        let requirement: HealthcareEquipmentRequirementRecord | null = null;

        if (input.origin === HealthcareEquipmentAssignmentOrigin.REQUIREMENT) {
          requirement = await this.repository.findRequirement(
            companyId,
            input.requirementId as string,
            transaction,
          );

          if (!requirement) {
            throw requirementNotFoundException();
          }

          if (requirement.caseId !== input.caseId) {
            throw assignmentRequirementCaseMismatchException();
          }

          if (requirement.lifecycle !== HealthcareRequirementLifecycle.ACTIVE) {
            throw requirementRetiredException();
          }

          if (
            requirement.productId !== equipmentAsset.productId ||
            requirement.product.inventoryTracking !==
              ProductInventoryTracking.ASSET
          ) {
            throw assignmentProductMismatchException();
          }
        }

        const duplicate =
          await this.repository.findReservedAssignmentForCaseAsset(
            companyId,
            input.caseId,
            input.equipmentAssetId,
            transaction,
          );

        if (duplicate) {
          throw assignmentAlreadyReservedException();
        }

        if (requirement) {
          const currentCoverage =
            await this.repository.countRequirementCoverage(
              companyId,
              requirement.id,
              transaction,
            );

          if (currentCoverage >= requirement.requestedQty) {
            throw requirementOverCoverageException();
          }
        }

        const record = await this.repository.createAssignment(transaction, {
          companyId,
          caseId: input.caseId,
          equipmentAssetId: input.equipmentAssetId,
          requirementId: input.requirementId,
          origin: input.origin,
          directAssignmentReason: input.directAssignmentReason,
          createdById,
        });

        await this.repository.completeIdempotencyClaim(
          transaction,
          claim.id,
          record.id,
        );

        return {
          outcome: 'CREATED' as const,
          data: this.mapResponse(record),
        };
      });
    } catch (error) {
      if (this.isIdempotencyUniqueViolation(error)) {
        const replay = await this.findCompletedIdempotentAssignment(
          companyId,
          idempotencyKey,
          requestHash,
        );

        if (replay) {
          return replay;
        }
      }

      if (this.isReservedAssignmentUniqueViolation(error)) {
        throw assignmentAlreadyReservedException();
      }

      if (this.isForeignKeyViolation(error)) {
        throw relatedResourceChangedException();
      }

      this.rethrowPersistenceError(error);
    }
  }

  private async validateListFilters(
    companyId: string,
    query: HealthcareEquipmentAssignmentListQueryDto,
  ): Promise<void> {
    const healthcareCase = query.caseId
      ? await this.repository.findCase(companyId, query.caseId)
      : null;

    if (query.caseId && !healthcareCase) {
      throw caseNotFoundException();
    }

    const requirement = query.requirementId
      ? await this.repository.findRequirement(companyId, query.requirementId)
      : null;

    if (query.requirementId && !requirement) {
      throw requirementNotFoundException();
    }

    const equipmentAsset = query.equipmentAssetId
      ? await this.repository.findEquipmentAsset(
          companyId,
          query.equipmentAssetId,
        )
      : null;

    if (query.equipmentAssetId && !equipmentAsset) {
      throw equipmentAssetNotFoundException();
    }

    if (query.caseId && requirement?.caseId !== undefined) {
      if (requirement.caseId !== query.caseId) {
        throw assignmentRequirementCaseMismatchException();
      }
    }

    if (
      requirement &&
      equipmentAsset &&
      requirement.productId !== equipmentAsset.productId
    ) {
      throw assignmentProductMismatchException();
    }
  }

  private normalizeCreateInput(
    dto: CreateHealthcareEquipmentAssignmentDto,
  ): NormalizedCreateInput {
    const requirementId = dto.requirementId ?? null;
    const directAssignmentReason =
      normalizeHealthcareOptionalText(dto.directAssignmentReason) ?? null;

    if (requirementId) {
      if (directAssignmentReason !== null) {
        throw invalidAssignmentOriginException();
      }

      return {
        caseId: dto.caseId,
        equipmentAssetId: dto.equipmentAssetId,
        requirementId,
        origin: HealthcareEquipmentAssignmentOrigin.REQUIREMENT,
        directAssignmentReason: null,
      };
    }

    if (!directAssignmentReason) {
      throw invalidAssignmentOriginException();
    }

    return {
      caseId: dto.caseId,
      equipmentAssetId: dto.equipmentAssetId,
      requirementId: null,
      origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
      directAssignmentReason,
    };
  }

  private assertEquipmentAssetEligible(equipmentAsset: {
    lifecycle: EquipmentLifecycle;
    condition: EquipmentCondition;
  }): void {
    if (
      equipmentAsset.lifecycle !== EquipmentLifecycle.ACTIVE ||
      equipmentAsset.condition !== EquipmentCondition.GOOD
    ) {
      throw equipmentAssetNotEligibleException();
    }
  }

  private async findCompletedIdempotentAssignment(
    companyId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{
    outcome: 'CREATED';
    data: HealthcareEquipmentAssignmentResponse;
  } | null> {
    try {
      const record = await this.repository.findIdempotencyRecord(
        companyId,
        idempotencyKey,
        CREATE_SCOPE,
      );

      if (!record) {
        return null;
      }

      if (record.requestHash !== requestHash) {
        throw idempotencyKeyReusedException();
      }

      if (!record.resourceId) {
        return null;
      }

      const assignment = await this.repository.findAssignment(
        companyId,
        record.resourceId,
      );

      if (!assignment) {
        throw equipmentAssignmentNotFoundException();
      }

      return {
        outcome: 'CREATED',
        data: this.mapResponse(assignment),
      };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private mapResponse(
    record: HealthcareEquipmentAssignmentRecord,
  ): HealthcareEquipmentAssignmentResponse {
    const replacementAssignment = record.replacementAssignments[0];
    const replacement =
      record.lifecycle === HealthcareEquipmentAssignmentLifecycle.REPLACED &&
      replacementAssignment &&
      record.replacedAt &&
      record.replacedBy &&
      record.replacementReason
        ? {
            successorAssignmentId: replacementAssignment.id,
            reason: record.replacementReason,
            replacedAt: record.replacedAt,
            replacedBy: record.replacedBy,
          }
        : null;
    const release =
      record.lifecycle === HealthcareEquipmentAssignmentLifecycle.RELEASED &&
      record.releasedAt &&
      record.releasedBy &&
      record.releaseCause
        ? {
            cause: record.releaseCause,
            reason: record.releaseReason,
            releasedAt: record.releasedAt,
            releasedBy: record.releasedBy,
          }
        : null;
    const hasCompleteSchedule = Boolean(
      record.healthcareCase.scheduledStart &&
      record.healthcareCase.scheduledEnd,
    );
    const availability =
      record.lifecycle === HealthcareEquipmentAssignmentLifecycle.RESERVED
        ? {
            fullyVerifiable: false as const,
            conflictFree: null,
            warnings: hasCompleteSchedule
              ? []
              : [
                  {
                    code: 'INCOMPLETE_CASE_SCHEDULE' as const,
                    message:
                      'La disponibilidad requiere revisar el horario del caso',
                  },
                ],
          }
        : null;

    return {
      id: record.id,
      caseId: record.caseId,
      requirementId: record.requirementId,
      origin: record.origin,
      status: record.lifecycle,
      equipmentAsset: record.equipmentAsset,
      assignedAt: record.createdAt,
      assignedBy: record.createdBy,
      ...(record.origin === HealthcareEquipmentAssignmentOrigin.DIRECT
        ? { directAssignmentReason: record.directAssignmentReason }
        : {}),
      replacesAssignmentId: record.replacesAssignmentId,
      replacement,
      release,
      availability,
      conflictOverrides: record.conflictOverrides.map((override) => ({
        conflictingAssignmentId: override.conflictingAssignmentId,
        approvedAt: override.createdAt,
        approvedBy: override.approvedBy,
        reason: override.reason,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private isIdempotencyUniqueViolation(error: unknown): boolean {
    return this.isUniqueViolationForConstraint(
      error,
      IDEMPOTENCY_UNIQUE_CONSTRAINT,
      ['companyId', 'scope', 'key'],
    );
  }

  private isReservedAssignmentUniqueViolation(error: unknown): boolean {
    return this.isUniqueViolationForConstraint(
      error,
      RESERVED_ASSIGNMENT_UNIQUE_CONSTRAINT,
      ['companyId', 'caseId', 'equipmentAssetId'],
    );
  }

  private isUniqueViolationForConstraint(
    error: unknown,
    constraint: string,
    fields: string[],
  ): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      const targetFields = target.map(String);

      return fields.every((field) => targetFields.includes(field));
    }

    return typeof target === 'string' && target.includes(constraint);
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      throw healthcarePersistenceException();
    }

    throw error;
  }
}
