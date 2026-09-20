import { HttpException, Injectable } from '@nestjs/common';

import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
  HealthcareEquipmentAssignmentReleaseCause,
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
  conflictOverrideReasonRequiredException,
  equipmentAssignmentNotFoundException,
  equipmentAssignmentNotReservedException,
  equipmentAssignmentReleaseReasonRequiredException,
  equipmentAssetNotEligibleException,
  equipmentAssetNotFoundException,
  healthcarePersistenceException,
  idempotencyKeyReusedException,
  invalidAssignmentOriginException,
  invalidConflictReviewConfirmationException,
  equipmentAssignmentReplacementReasonRequiredException,
  equipmentAssignmentReplacementSameAssetException,
  relatedResourceChangedException,
  resourceStateChangedException,
  requirementNotFoundException,
  requirementOverCoverageException,
  requirementRetiredException,
} from '../common/healthcare-errors';

import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';
import { CreateHealthcareEquipmentAssignmentDto } from './dto/create-healthcare-equipment-assignment.dto';
import { ReleaseHealthcareEquipmentAssignmentDto } from './dto/release-healthcare-equipment-assignment.dto';

import {
  HealthcareEquipmentAssignmentListQueryDto,
  HealthcareEquipmentAssignmentListStatus,
  toAssignmentLifecycleFilter,
} from './dto/healthcare-equipment-assignment-list-query.dto';

import {
  createEquipmentAssignmentConflictReviewFingerprint,
  deriveEquipmentAssignmentOperationalWindow,
  EquipmentAssignmentBuffers,
  createEquipmentAssignmentReplaceConflictReviewFingerprint,
  equipmentAssignmentWindowsOverlap,
  OperationalWindow,
  resolveEquipmentAssignmentBuffers,
} from './healthcare-equipment-assignment-availability';

import { createHealthcareEquipmentAssignmentReplaceRequestHash } from './healthcare-equipment-assignment-replace-request-hash';

import { createHealthcareEquipmentAssignmentRequestHash } from './healthcare-equipment-assignment-request-hash';
import { ReplaceHealthcareEquipmentAssignmentDto } from './dto/replace-healthcare-equipment-assignment.dto';

import {
  HealthcareEquipmentAssignmentRecord,
  HealthcareEquipmentAssignmentsRepository,
  HealthcareEquipmentReservationAvailabilityRecord,
} from './healthcare-equipment-assignments.repository';

const CREATE_SCOPE = IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE;
const REPLACE_SCOPE = IdempotencyScope.HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE;
const RESERVED_ASSIGNMENT_UNIQUE_CONSTRAINT =
  'HealthcareEquipmentAssignment_reserved_case_asset_key';
const IDEMPOTENCY_UNIQUE_CONSTRAINT =
  'IdempotencyRecord_companyId_scope_key_key';
const CONFLICT_REVIEW_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

type CompactUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type AvailabilityWarningCode =
  | 'INCOMPLETE_CASE_SCHEDULE'
  | 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE'
  | 'CURRENT_ASSIGNMENT_CONFLICT'
  | 'CONFLICT_OVERRIDE_CONFIRMED';

type AvailabilityWarning = {
  code: AvailabilityWarningCode;
  message: string;
};

type EquipmentAssignmentAvailability = {
  fullyVerifiable: boolean;
  conflictFree: boolean | null;
  warnings: AvailabilityWarning[];
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
  availability: EquipmentAssignmentAvailability | null;
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
  confirmConflictOverride: boolean;
  conflictReviewFingerprint: string | null;
  conflictOverrideReason: string | null;
};

type NormalizedReplaceInput = {
  equipmentAssetId: string;
  replacementReason: string;
  confirmConflictOverride: boolean;
  conflictReviewFingerprint: string | null;
  conflictOverrideReason: string | null;
};

type HealthcareEquipmentRequirementRecord = NonNullable<
  Awaited<
    ReturnType<HealthcareEquipmentAssignmentsRepository['findRequirement']>
  >
>;

type HealthcareEquipmentAssetRecord = NonNullable<
  Awaited<
    ReturnType<HealthcareEquipmentAssignmentsRepository['findEquipmentAsset']>
  >
>;

type EvaluatedConflict = {
  reservation: HealthcareEquipmentReservationAvailabilityRecord;
  window: OperationalWindow;
};

type AvailabilityEvaluation = {
  candidateWindow: OperationalWindow | null;
  conflicts: EvaluatedConflict[];
  unresolvedReservations: HealthcareEquipmentReservationAvailabilityRecord[];
  availability: EquipmentAssignmentAvailability;
};

export type HealthcareEquipmentAssignmentConflictReviewResponse = {
  outcome: 'CONFLICT_REVIEW_REQUIRED';
  conflictReviewFingerprint: string;
  overrideRequired: boolean;
  conflicts: Array<{
    assignmentId: string;
    caseId: string;
    caseFolio: string;
    windowStart: Date;
    windowEnd: Date;
  }>;
  candidate: {
    caseId: string;
    requirementId: string | null;
    origin: HealthcareEquipmentAssignmentOrigin;
    equipmentAsset: Omit<HealthcareEquipmentAssetRecord, 'updatedAt'>;
    operationalWindow: OperationalWindow;
  };
  unresolvedReservations: Array<{
    assignmentId: string;
    caseId: string;
    caseFolio: string;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
  }>;
  availability: EquipmentAssignmentAvailability;
};

type HealthcareEquipmentAssignmentCreateResponse =
  | {
      outcome: 'CREATED';
      data: HealthcareEquipmentAssignmentResponse;
    }
  | HealthcareEquipmentAssignmentConflictReviewResponse;

export type HealthcareEquipmentAssignmentReplaceConflictReviewResponse =
  HealthcareEquipmentAssignmentConflictReviewResponse & {
    sourceAssignmentId: string;
  };

type HealthcareEquipmentAssignmentReplaceResponse =
  | {
      outcome: 'REPLACED';
      data: {
        replacedAssignment: HealthcareEquipmentAssignmentResponse;
        replacementAssignment: HealthcareEquipmentAssignmentResponse;
      };
    }
  | HealthcareEquipmentAssignmentReplaceConflictReviewResponse;

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
        items: await this.mapRecordsWithCurrentAvailability(companyId, records),
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

      return await this.mapRecordWithCurrentAvailability(companyId, record);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async create(
    companyId: string,
    createdById: string,
    idempotencyKey: string,
    dto: CreateHealthcareEquipmentAssignmentDto,
  ): Promise<HealthcareEquipmentAssignmentCreateResponse> {
    const input = this.normalizeCreateInput(dto);
    const requestHash = createHealthcareEquipmentAssignmentRequestHash({
      caseId: input.caseId,
      equipmentAssetId: input.equipmentAssetId,
      requirementId: input.requirementId,
      directAssignmentReason: input.directAssignmentReason,
      confirmConflictOverride: input.confirmConflictOverride,
      conflictReviewFingerprint: input.conflictReviewFingerprint ?? undefined,
      conflictOverrideReason: input.conflictOverrideReason,
    });

    try {
      const existingIdempotencyRecord =
        await this.repository.findIdempotencyRecord(
          companyId,
          idempotencyKey,
          CREATE_SCOPE,
        );

      if (
        existingIdempotencyRecord &&
        existingIdempotencyRecord.requestHash !== requestHash
      ) {
        throw idempotencyKeyReusedException();
      }

      return await this.repository.runInTransaction(async (transaction) => {
        const assetLocked = await this.repository.lockEquipmentAsset(
          transaction,
          companyId,
          input.equipmentAssetId,
        );

        if (!assetLocked) {
          throw equipmentAssetNotFoundException();
        }

        if (input.requirementId) {
          const requirementLocked = await this.repository.lockRequirement(
            transaction,
            companyId,
            input.requirementId,
          );

          if (!requirementLocked) {
            throw requirementNotFoundException();
          }
        }

        const reservedCaseReferences =
          await this.repository.findReservedAssignmentCaseIdsForAsset(
            companyId,
            input.equipmentAssetId,
            transaction,
          );
        await this.repository.acquireSettingsSharedAdvisoryLock(
          transaction,
          companyId,
        );
        const relevantCaseIds = [
          ...new Set([
            input.caseId,
            ...reservedCaseReferences.map((reference) => reference.caseId),
          ]),
        ].sort((left, right) => left.localeCompare(right));
        await this.repository.lockHealthcareCasesForShare(
          transaction,
          companyId,
          relevantCaseIds,
        );
        const settings = await this.repository.findSettingsForShare(
          transaction,
          companyId,
        );

        const transactionalReplay =
          await this.findCompletedIdempotentAssignment(
            companyId,
            idempotencyKey,
            requestHash,
            transaction,
          );

        if (transactionalReplay) {
          return transactionalReplay;
        }

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

        const currentCoverage = requirement
          ? await this.repository.countRequirementCoverage(
              companyId,
              requirement.id,
              transaction,
            )
          : null;

        if (
          requirement &&
          currentCoverage !== null &&
          currentCoverage >= requirement.requestedQty
        ) {
          throw requirementOverCoverageException();
        }

        const reservations =
          await this.repository.findReservedAssignmentsForAsset(
            companyId,
            input.equipmentAssetId,
            undefined,
            transaction,
          );
        const buffers = resolveEquipmentAssignmentBuffers(settings);
        const evaluation = this.evaluateAvailability(
          healthcareCase,
          buffers,
          reservations,
        );

        if (input.confirmConflictOverride && !evaluation.candidateWindow) {
          throw invalidConflictReviewConfirmationException();
        }

        const fingerprint = evaluation.candidateWindow
          ? createEquipmentAssignmentConflictReviewFingerprint({
              companyId,
              candidate: {
                caseId: input.caseId,
                equipmentAssetId: input.equipmentAssetId,
                requirementId: input.requirementId,
                origin: input.origin,
                window: evaluation.candidateWindow,
                caseUpdatedAt: healthcareCase.updatedAt,
                equipmentAssetUpdatedAt: equipmentAsset.updatedAt,
              },
              buffers,
              requirementCapacity:
                requirement && currentCoverage !== null
                  ? {
                      lifecycle: requirement.lifecycle,
                      requestedQty: requirement.requestedQty,
                      currentCoverage,
                      updatedAt: requirement.updatedAt,
                    }
                  : null,
              conflicts: evaluation.conflicts.map((conflict) => ({
                assignmentId: conflict.reservation.id,
                caseId: conflict.reservation.caseId,
                window: conflict.window,
                assignmentUpdatedAt: conflict.reservation.updatedAt,
                caseUpdatedAt: conflict.reservation.healthcareCase.updatedAt,
              })),
              unresolvedReservations: evaluation.unresolvedReservations.map(
                (reservation) => ({
                  assignmentId: reservation.id,
                  caseId: reservation.caseId,
                  assignmentUpdatedAt: reservation.updatedAt,
                  caseUpdatedAt: reservation.healthcareCase.updatedAt,
                  scheduledStart: reservation.healthcareCase.scheduledStart,
                  scheduledEnd: reservation.healthcareCase.scheduledEnd,
                }),
              ),
            })
          : null;

        if (
          evaluation.candidateWindow &&
          fingerprint &&
          (evaluation.conflicts.length > 0 || input.confirmConflictOverride)
        ) {
          if (
            !input.confirmConflictOverride ||
            input.conflictReviewFingerprint !== fingerprint ||
            evaluation.conflicts.length === 0
          ) {
            return this.buildConflictReviewResponse(
              input,
              equipmentAsset,
              evaluation as AvailabilityEvaluation & {
                candidateWindow: OperationalWindow;
              },
              fingerprint,
            );
          }
        }

        const claim = await this.repository.createIdempotencyClaim(
          transaction,
          companyId,
          idempotencyKey,
          CREATE_SCOPE,
          requestHash,
        );
        let record = await this.repository.createAssignment(transaction, {
          companyId,
          caseId: input.caseId,
          equipmentAssetId: input.equipmentAssetId,
          requirementId: input.requirementId,
          origin: input.origin,
          directAssignmentReason: input.directAssignmentReason,
          createdById,
        });

        if (evaluation.conflicts.length > 0) {
          await this.repository.createConflictOverrides(
            transaction,
            evaluation.conflicts.map((conflict) => ({
              companyId,
              assignmentId: record.id,
              conflictingAssignmentId: conflict.reservation.id,
              assignmentWindowStart: evaluation.candidateWindow!.start,
              assignmentWindowEnd: evaluation.candidateWindow!.end,
              conflictingWindowStart: conflict.window.start,
              conflictingWindowEnd: conflict.window.end,
              approvedById: createdById,
              reason: input.conflictOverrideReason as string,
            })),
          );
          const assignmentWithOverrides = await this.repository.findAssignment(
            companyId,
            record.id,
            transaction,
          );

          if (!assignmentWithOverrides) {
            throw equipmentAssignmentNotFoundException();
          }

          record = assignmentWithOverrides;
        }

        await this.repository.completeIdempotencyClaim(
          transaction,
          claim.id,
          record.id,
        );

        return {
          outcome: 'CREATED' as const,
          data: this.mapResponse(
            record,
            this.buildAvailability(
              evaluation.candidateWindow,
              evaluation.conflicts,
              evaluation.unresolvedReservations,
              evaluation.conflicts.length > 0,
            ),
          ),
        };
      });
    } catch (error) {
      if (this.isIdempotencyUniqueViolation(error)) {
        const idempotencyRecord = await this.repository.findIdempotencyRecord(
          companyId,
          idempotencyKey,
          CREATE_SCOPE,
        );

        if (
          idempotencyRecord &&
          idempotencyRecord.requestHash !== requestHash
        ) {
          throw idempotencyKeyReusedException();
        }

        if (idempotencyRecord?.resourceId) {
          return this.create(companyId, createdById, idempotencyKey, dto);
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

  async release(
    companyId: string,
    releasedById: string,
    assignmentId: string,
    dto: ReleaseHealthcareEquipmentAssignmentDto,
  ): Promise<HealthcareEquipmentAssignmentResponse> {
    const releaseReason = normalizeHealthcareOptionalText(dto.reason);

    if (!releaseReason) {
      throw equipmentAssignmentReleaseReasonRequiredException();
    }

    const releasedAt = new Date();

    try {
      return await this.repository.runInTransaction(async (transaction) => {
        const locked = await this.repository.lockAssignment(
          transaction,
          companyId,
          assignmentId,
        );

        if (!locked) {
          throw equipmentAssignmentNotFoundException();
        }

        if (
          locked.lifecycle !== HealthcareEquipmentAssignmentLifecycle.RESERVED
        ) {
          throw equipmentAssignmentNotReservedException();
        }

        const result = await this.repository.releaseAssignment(transaction, {
          companyId,
          assignmentId,
          releasedAt,
          releasedById,
          releaseCause: HealthcareEquipmentAssignmentReleaseCause.MANUAL,
          releaseReason,
        });

        if (result.count !== 1) {
          throw resourceStateChangedException();
        }

        const record = await this.repository.findAssignment(
          companyId,
          assignmentId,
          transaction,
        );

        if (!record) {
          throw equipmentAssignmentNotFoundException();
        }

        return this.mapResponse(record, null);
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async replace(
    companyId: string,
    replacedById: string,
    assignmentId: string,
    idempotencyKey: string,
    dto: ReplaceHealthcareEquipmentAssignmentDto,
  ): Promise<HealthcareEquipmentAssignmentReplaceResponse> {
    const input = this.normalizeReplaceInput(dto);
    const requestHash = createHealthcareEquipmentAssignmentReplaceRequestHash(
      assignmentId,
      dto,
    );

    try {
      const existingReplay = await this.findCompletedIdempotentReplacement(
        companyId,
        idempotencyKey,
        requestHash,
      );

      if (existingReplay) {
        return existingReplay;
      }

      const source = await this.repository.findAssignmentReplacementSource(
        companyId,
        assignmentId,
      );

      if (!source) {
        throw equipmentAssignmentNotFoundException();
      }

      if (
        source.lifecycle !== HealthcareEquipmentAssignmentLifecycle.RESERVED
      ) {
        throw equipmentAssignmentNotReservedException();
      }

      if (source.equipmentAssetId === input.equipmentAssetId) {
        throw equipmentAssignmentReplacementSameAssetException();
      }

      return await this.repository.runInTransaction(async (transaction) => {
        const assetLocked = await this.repository.lockEquipmentAsset(
          transaction,
          companyId,
          input.equipmentAssetId,
        );

        if (!assetLocked) {
          throw equipmentAssetNotFoundException();
        }

        if (source.requirementId) {
          const requirementLocked = await this.repository.lockRequirement(
            transaction,
            companyId,
            source.requirementId,
          );

          if (!requirementLocked) {
            throw requirementNotFoundException();
          }
        }

        const lockedSource = await this.repository.lockAssignment(
          transaction,
          companyId,
          assignmentId,
        );

        if (!lockedSource) {
          throw equipmentAssignmentNotFoundException();
        }

        const transactionalReplay =
          await this.findCompletedIdempotentReplacement(
            companyId,
            idempotencyKey,
            requestHash,
            transaction,
          );

        if (transactionalReplay) {
          return transactionalReplay;
        }

        if (
          lockedSource.lifecycle !==
          HealthcareEquipmentAssignmentLifecycle.RESERVED
        ) {
          throw equipmentAssignmentNotReservedException();
        }

        if (
          lockedSource.companyId !== source.companyId ||
          lockedSource.caseId !== source.caseId ||
          lockedSource.equipmentAssetId !== source.equipmentAssetId ||
          lockedSource.requirementId !== source.requirementId ||
          lockedSource.origin !== source.origin ||
          lockedSource.directAssignmentReason !==
            source.directAssignmentReason ||
          lockedSource.updatedAt.getTime() !== source.updatedAt.getTime()
        ) {
          throw resourceStateChangedException();
        }

        const reservedCaseReferences =
          await this.repository.findReservedAssignmentCaseIdsForAsset(
            companyId,
            input.equipmentAssetId,
            transaction,
          );

        await this.repository.acquireSettingsSharedAdvisoryLock(
          transaction,
          companyId,
        );

        const relevantCaseIds = [
          ...new Set([
            lockedSource.caseId,
            ...reservedCaseReferences.map((reference) => reference.caseId),
          ]),
        ].sort((left, right) => left.localeCompare(right));

        await this.repository.lockHealthcareCasesForShare(
          transaction,
          companyId,
          relevantCaseIds,
        );

        const settings = await this.repository.findSettingsForShare(
          transaction,
          companyId,
        );

        const healthcareCase = await this.repository.findCase(
          companyId,
          lockedSource.caseId,
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

        if (
          lockedSource.origin ===
          HealthcareEquipmentAssignmentOrigin.REQUIREMENT
        ) {
          if (!lockedSource.requirementId) {
            throw resourceStateChangedException();
          }

          requirement = await this.repository.findRequirement(
            companyId,
            lockedSource.requirementId,
            transaction,
          );

          if (!requirement) {
            throw requirementNotFoundException();
          }

          if (requirement.caseId !== lockedSource.caseId) {
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
        } else if (lockedSource.requirementId !== null) {
          throw resourceStateChangedException();
        }

        const duplicate =
          await this.repository.findReservedAssignmentForCaseAsset(
            companyId,
            lockedSource.caseId,
            input.equipmentAssetId,
            transaction,
          );

        if (duplicate) {
          throw assignmentAlreadyReservedException();
        }

        const currentCoverage = requirement
          ? await this.repository.countRequirementCoverage(
              companyId,
              requirement.id,
              transaction,
            )
          : null;

        const reservations =
          await this.repository.findReservedAssignmentsForAsset(
            companyId,
            input.equipmentAssetId,
            assignmentId,
            transaction,
          );

        const buffers = resolveEquipmentAssignmentBuffers(settings);

        const evaluation = this.evaluateAvailability(
          healthcareCase,
          buffers,
          reservations,
        );

        if (input.confirmConflictOverride && !evaluation.candidateWindow) {
          throw invalidConflictReviewConfirmationException();
        }

        const fingerprint = evaluation.candidateWindow
          ? createEquipmentAssignmentReplaceConflictReviewFingerprint({
              companyId,
              sourceAssignment: {
                id: lockedSource.id,
                lifecycle: lockedSource.lifecycle,
                updatedAt: lockedSource.updatedAt,
              },
              candidate: {
                caseId: lockedSource.caseId,
                equipmentAssetId: input.equipmentAssetId,
                requirementId: lockedSource.requirementId,
                origin: lockedSource.origin,
                window: evaluation.candidateWindow,
                caseUpdatedAt: healthcareCase.updatedAt,
                equipmentAssetUpdatedAt: equipmentAsset.updatedAt,
              },
              buffers,
              requirementCapacity:
                requirement && currentCoverage !== null
                  ? {
                      lifecycle: requirement.lifecycle,
                      requestedQty: requirement.requestedQty,
                      currentCoverage,
                      updatedAt: requirement.updatedAt,
                    }
                  : null,
              conflicts: evaluation.conflicts.map((conflict) => ({
                assignmentId: conflict.reservation.id,
                caseId: conflict.reservation.caseId,
                window: conflict.window,
                assignmentUpdatedAt: conflict.reservation.updatedAt,
                caseUpdatedAt: conflict.reservation.healthcareCase.updatedAt,
              })),
              unresolvedReservations: evaluation.unresolvedReservations.map(
                (reservation) => ({
                  assignmentId: reservation.id,
                  caseId: reservation.caseId,
                  assignmentUpdatedAt: reservation.updatedAt,
                  caseUpdatedAt: reservation.healthcareCase.updatedAt,
                  scheduledStart: reservation.healthcareCase.scheduledStart,
                  scheduledEnd: reservation.healthcareCase.scheduledEnd,
                }),
              ),
            })
          : null;

        if (
          evaluation.candidateWindow &&
          fingerprint &&
          (evaluation.conflicts.length > 0 || input.confirmConflictOverride)
        ) {
          if (
            !input.confirmConflictOverride ||
            input.conflictReviewFingerprint !== fingerprint ||
            evaluation.conflicts.length === 0
          ) {
            return this.buildReplaceConflictReviewResponse(
              lockedSource,
              input,
              equipmentAsset,
              evaluation as AvailabilityEvaluation & {
                candidateWindow: OperationalWindow;
              },
              fingerprint,
            );
          }
        }

        const claim = await this.repository.createIdempotencyClaim(
          transaction,
          companyId,
          idempotencyKey,
          REPLACE_SCOPE,
          requestHash,
        );

        const createdReplacement = await this.repository.createAssignment(
          transaction,
          {
            companyId,
            caseId: lockedSource.caseId,
            equipmentAssetId: input.equipmentAssetId,
            requirementId: lockedSource.requirementId,
            origin: lockedSource.origin,
            directAssignmentReason: lockedSource.directAssignmentReason,
            createdById: replacedById,
            replacesAssignmentId: lockedSource.id,
          },
        );

        if (evaluation.conflicts.length > 0) {
          await this.repository.createConflictOverrides(
            transaction,
            evaluation.conflicts.map((conflict) => ({
              companyId,
              assignmentId: createdReplacement.id,
              conflictingAssignmentId: conflict.reservation.id,
              assignmentWindowStart: evaluation.candidateWindow!.start,
              assignmentWindowEnd: evaluation.candidateWindow!.end,
              conflictingWindowStart: conflict.window.start,
              conflictingWindowEnd: conflict.window.end,
              approvedById: replacedById,
              reason: input.conflictOverrideReason as string,
            })),
          );
        }

        const replacedAt = new Date();

        const transition = await this.repository.replaceAssignment(
          transaction,
          {
            companyId,
            assignmentId: lockedSource.id,
            replacedAt,
            replacedById,
            replacementReason: input.replacementReason,
          },
        );

        if (transition.count !== 1) {
          throw resourceStateChangedException();
        }

        const replacedRecord = await this.repository.findAssignment(
          companyId,
          lockedSource.id,
          transaction,
        );

        if (!replacedRecord) {
          throw equipmentAssignmentNotFoundException();
        }

        const replacementRecord = await this.repository.findAssignment(
          companyId,
          createdReplacement.id,
          transaction,
        );

        if (!replacementRecord) {
          throw equipmentAssignmentNotFoundException();
        }

        await this.repository.completeIdempotencyClaim(
          transaction,
          claim.id,
          replacementRecord.id,
        );

        return {
          outcome: 'REPLACED' as const,
          data: {
            replacedAssignment: this.mapResponse(replacedRecord, null),
            replacementAssignment: this.mapResponse(
              replacementRecord,
              this.buildAvailability(
                evaluation.candidateWindow,
                evaluation.conflicts,
                evaluation.unresolvedReservations,
                evaluation.conflicts.length > 0,
              ),
            ),
          },
        };
      });
    } catch (error) {
      if (this.isIdempotencyUniqueViolation(error)) {
        const replay = await this.findCompletedIdempotentReplacement(
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
    const conflictOverrideReason =
      normalizeHealthcareOptionalText(dto.conflictOverrideReason) ?? null;
    const confirmConflictOverride = dto.confirmConflictOverride ?? false;
    const conflictReviewFingerprint = dto.conflictReviewFingerprint ?? null;

    if (!confirmConflictOverride) {
      if (
        dto.conflictReviewFingerprint !== undefined ||
        dto.conflictOverrideReason !== undefined
      ) {
        throw invalidConflictReviewConfirmationException();
      }
    } else {
      if (
        !conflictReviewFingerprint ||
        !CONFLICT_REVIEW_FINGERPRINT_PATTERN.test(conflictReviewFingerprint)
      ) {
        throw invalidConflictReviewConfirmationException();
      }

      if (!conflictOverrideReason) {
        throw conflictOverrideReasonRequiredException();
      }
    }

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
        confirmConflictOverride,
        conflictReviewFingerprint,
        conflictOverrideReason,
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
      confirmConflictOverride,
      conflictReviewFingerprint,
      conflictOverrideReason,
    };
  }

  private normalizeReplaceInput(
    dto: ReplaceHealthcareEquipmentAssignmentDto,
  ): NormalizedReplaceInput {
    const replacementReason =
      normalizeHealthcareOptionalText(dto.replacementReason) ?? null;

    const conflictOverrideReason =
      normalizeHealthcareOptionalText(dto.conflictOverrideReason) ?? null;

    const confirmConflictOverride = dto.confirmConflictOverride ?? false;
    const conflictReviewFingerprint = dto.conflictReviewFingerprint ?? null;

    if (!replacementReason) {
      throw equipmentAssignmentReplacementReasonRequiredException();
    }

    if (!confirmConflictOverride) {
      if (
        dto.conflictReviewFingerprint !== undefined ||
        dto.conflictOverrideReason !== undefined
      ) {
        throw invalidConflictReviewConfirmationException();
      }
    } else {
      if (
        !conflictReviewFingerprint ||
        !CONFLICT_REVIEW_FINGERPRINT_PATTERN.test(conflictReviewFingerprint)
      ) {
        throw invalidConflictReviewConfirmationException();
      }

      if (!conflictOverrideReason) {
        throw conflictOverrideReasonRequiredException();
      }
    }

    return {
      equipmentAssetId: dto.equipmentAssetId,
      replacementReason,
      confirmConflictOverride,
      conflictReviewFingerprint,
      conflictOverrideReason,
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
    client?: Prisma.TransactionClient,
  ): Promise<{
    outcome: 'CREATED';
    data: HealthcareEquipmentAssignmentResponse;
  } | null> {
    try {
      const record = client
        ? await this.repository.findIdempotencyRecord(
            companyId,
            idempotencyKey,
            CREATE_SCOPE,
            client,
          )
        : await this.repository.findIdempotencyRecord(
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

      const assignment = client
        ? await this.repository.findAssignment(
            companyId,
            record.resourceId,
            client,
          )
        : await this.repository.findAssignment(companyId, record.resourceId);

      if (!assignment) {
        throw equipmentAssignmentNotFoundException();
      }

      return {
        outcome: 'CREATED',
        data: await this.mapRecordWithCurrentAvailability(
          companyId,
          assignment,
          client,
        ),
      };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private async findCompletedIdempotentReplacement(
    companyId: string,
    idempotencyKey: string,
    requestHash: string,
    client?: Prisma.TransactionClient,
  ): Promise<{
    outcome: 'REPLACED';
    data: {
      replacedAssignment: HealthcareEquipmentAssignmentResponse;
      replacementAssignment: HealthcareEquipmentAssignmentResponse;
    };
  } | null> {
    try {
      const record = client
        ? await this.repository.findIdempotencyRecord(
            companyId,
            idempotencyKey,
            REPLACE_SCOPE,
            client,
          )
        : await this.repository.findIdempotencyRecord(
            companyId,
            idempotencyKey,
            REPLACE_SCOPE,
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

      const replacementAssignment = client
        ? await this.repository.findAssignment(
            companyId,
            record.resourceId,
            client,
          )
        : await this.repository.findAssignment(companyId, record.resourceId);

      if (!replacementAssignment) {
        throw equipmentAssignmentNotFoundException();
      }

      if (!replacementAssignment.replacesAssignmentId) {
        throw resourceStateChangedException();
      }

      const replacedAssignment = client
        ? await this.repository.findAssignment(
            companyId,
            replacementAssignment.replacesAssignmentId,
            client,
          )
        : await this.repository.findAssignment(
            companyId,
            replacementAssignment.replacesAssignmentId,
          );

      if (!replacedAssignment) {
        throw equipmentAssignmentNotFoundException();
      }

      return {
        outcome: 'REPLACED',
        data: {
          replacedAssignment: this.mapResponse(replacedAssignment, null),
          replacementAssignment: await this.mapRecordWithCurrentAvailability(
            companyId,
            replacementAssignment,
            client,
          ),
        },
      };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private evaluateAvailability(
    healthcareCase: {
      scheduledStart: Date | null;
      scheduledEnd: Date | null;
    },
    buffers: EquipmentAssignmentBuffers,
    reservations: HealthcareEquipmentReservationAvailabilityRecord[],
    hasConfirmedOverride = false,
  ): AvailabilityEvaluation {
    const candidateWindow = deriveEquipmentAssignmentOperationalWindow(
      healthcareCase,
      buffers,
    );

    if (!candidateWindow) {
      return {
        candidateWindow: null,
        conflicts: [],
        unresolvedReservations: [],
        availability: this.buildAvailability(null, [], [], false),
      };
    }

    const conflicts: EvaluatedConflict[] = [];
    const unresolvedReservations: HealthcareEquipmentReservationAvailabilityRecord[] =
      [];
    for (const reservation of reservations) {
      const existingWindow = deriveEquipmentAssignmentOperationalWindow(
        reservation.healthcareCase,
        buffers,
      );

      if (!existingWindow) {
        unresolvedReservations.push(reservation);
      } else if (
        equipmentAssignmentWindowsOverlap(candidateWindow, existingWindow)
      ) {
        conflicts.push({ reservation, window: existingWindow });
      }
    }

    return {
      candidateWindow,
      conflicts,
      unresolvedReservations,
      availability: this.buildAvailability(
        candidateWindow,
        conflicts,
        unresolvedReservations,
        hasConfirmedOverride,
      ),
    };
  }

  private buildAvailability(
    candidateWindow: OperationalWindow | null,
    conflicts: EvaluatedConflict[],
    unresolvedReservations: HealthcareEquipmentReservationAvailabilityRecord[],
    hasConfirmedOverride: boolean,
  ): EquipmentAssignmentAvailability {
    if (!candidateWindow) {
      return {
        fullyVerifiable: false,
        conflictFree: null,
        warnings: [
          {
            code: 'INCOMPLETE_CASE_SCHEDULE',
            message: 'La disponibilidad requiere revisar el horario del caso',
          },
        ],
      };
    }

    const warnings: AvailabilityWarning[] = [];
    if (conflicts.length > 0) {
      warnings.push({
        code: 'CURRENT_ASSIGNMENT_CONFLICT',
        message: 'El equipo tiene otra reserva activa con horario superpuesto',
      });
    }

    if (unresolvedReservations.length > 0) {
      warnings.push({
        code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
        message:
          'Existe una reserva activa del mismo equipo con horario incompleto; la disponibilidad no puede verificarse completamente.',
      });
    }

    if (hasConfirmedOverride && conflicts.length > 0) {
      warnings.push({
        code: 'CONFLICT_OVERRIDE_CONFIRMED',
        message: 'El conflicto actual fue confirmado explícitamente',
      });
    }

    return {
      fullyVerifiable: unresolvedReservations.length === 0,
      conflictFree:
        conflicts.length > 0
          ? false
          : unresolvedReservations.length > 0
            ? null
            : true,
      warnings,
    };
  }

  private buildConflictReviewResponse(
    input: NormalizedCreateInput,
    equipmentAsset: HealthcareEquipmentAssetRecord,
    evaluation: AvailabilityEvaluation & {
      candidateWindow: OperationalWindow;
    },
    fingerprint: string,
  ): HealthcareEquipmentAssignmentConflictReviewResponse {
    const compactEquipmentAsset = {
      id: equipmentAsset.id,
      productId: equipmentAsset.productId,
      assetCode: equipmentAsset.assetCode,
      serialNumber: equipmentAsset.serialNumber,
      lifecycle: equipmentAsset.lifecycle,
      condition: equipmentAsset.condition,
      product: equipmentAsset.product,
    };

    return {
      outcome: 'CONFLICT_REVIEW_REQUIRED',
      conflictReviewFingerprint: fingerprint,
      overrideRequired: evaluation.conflicts.length > 0,
      conflicts: evaluation.conflicts.map((conflict) => ({
        assignmentId: conflict.reservation.id,
        caseId: conflict.reservation.caseId,
        caseFolio: conflict.reservation.healthcareCase.folio,
        windowStart: conflict.window.start,
        windowEnd: conflict.window.end,
      })),
      candidate: {
        caseId: input.caseId,
        requirementId: input.requirementId,
        origin: input.origin,
        equipmentAsset: compactEquipmentAsset,
        operationalWindow: evaluation.candidateWindow,
      },
      unresolvedReservations: evaluation.unresolvedReservations.map(
        (reservation) => ({
          assignmentId: reservation.id,
          caseId: reservation.caseId,
          caseFolio: reservation.healthcareCase.folio,
          scheduledStart: reservation.healthcareCase.scheduledStart,
          scheduledEnd: reservation.healthcareCase.scheduledEnd,
        }),
      ),
      availability: evaluation.availability,
    };
  }

  private buildReplaceConflictReviewResponse(
    sourceAssignment: {
      id: string;
      caseId: string;
      requirementId: string | null;
      origin: HealthcareEquipmentAssignmentOrigin;
      directAssignmentReason: string | null;
    },
    input: NormalizedReplaceInput,
    equipmentAsset: HealthcareEquipmentAssetRecord,
    evaluation: AvailabilityEvaluation & {
      candidateWindow: OperationalWindow;
    },
    fingerprint: string,
  ): HealthcareEquipmentAssignmentReplaceConflictReviewResponse {
    const response = this.buildConflictReviewResponse(
      {
        caseId: sourceAssignment.caseId,
        equipmentAssetId: input.equipmentAssetId,
        requirementId: sourceAssignment.requirementId,
        origin: sourceAssignment.origin,
        directAssignmentReason: sourceAssignment.directAssignmentReason,
        confirmConflictOverride: input.confirmConflictOverride,
        conflictReviewFingerprint: input.conflictReviewFingerprint,
        conflictOverrideReason: input.conflictOverrideReason,
      },
      equipmentAsset,
      evaluation,
      fingerprint,
    );

    return {
      ...response,
      sourceAssignmentId: sourceAssignment.id,
    };
  }

  private async mapRecordsWithCurrentAvailability(
    companyId: string,
    records: HealthcareEquipmentAssignmentRecord[],
  ): Promise<HealthcareEquipmentAssignmentResponse[]> {
    const reservedRecords = records.filter(
      (record) =>
        record.lifecycle === HealthcareEquipmentAssignmentLifecycle.RESERVED,
    );

    if (reservedRecords.length === 0) {
      return records.map((record) => this.mapResponse(record, null));
    }

    const equipmentAssetIds = [
      ...new Set(reservedRecords.map((record) => record.equipmentAsset.id)),
    ];
    const [settings, reservations] = await Promise.all([
      this.repository.findSettings(companyId),
      this.repository.findReservedAssignmentsForAssets(
        companyId,
        equipmentAssetIds,
      ),
    ]);
    const buffers = resolveEquipmentAssignmentBuffers(settings);

    return records.map((record) => {
      if (
        record.lifecycle !== HealthcareEquipmentAssignmentLifecycle.RESERVED
      ) {
        return this.mapResponse(record, null);
      }

      const relatedReservations = reservations.filter(
        (reservation) =>
          reservation.equipmentAssetId === record.equipmentAsset.id &&
          reservation.id !== record.id,
      );
      const initialEvaluation = this.evaluateAvailability(
        record.healthcareCase,
        buffers,
        relatedReservations,
      );
      const hasConfirmedOverride = this.hasCurrentConfirmedOverride(
        record,
        initialEvaluation,
      );
      const evaluation = this.evaluateAvailability(
        record.healthcareCase,
        buffers,
        relatedReservations,
        hasConfirmedOverride,
      );

      return this.mapResponse(record, evaluation.availability);
    });
  }

  private async mapRecordWithCurrentAvailability(
    companyId: string,
    record: HealthcareEquipmentAssignmentRecord,
    client?: Prisma.TransactionClient,
  ): Promise<HealthcareEquipmentAssignmentResponse> {
    if (record.lifecycle !== HealthcareEquipmentAssignmentLifecycle.RESERVED) {
      return this.mapResponse(record, null);
    }

    const [settings, reservations] = client
      ? await Promise.all([
          this.repository.findSettings(companyId, client),
          this.repository.findReservedAssignmentsForAsset(
            companyId,
            record.equipmentAsset.id,
            record.id,
            client,
          ),
        ])
      : await Promise.all([
          this.repository.findSettings(companyId),
          this.repository.findReservedAssignmentsForAsset(
            companyId,
            record.equipmentAsset.id,
            record.id,
          ),
        ]);
    const buffers = resolveEquipmentAssignmentBuffers(settings);
    const initialEvaluation = this.evaluateAvailability(
      record.healthcareCase,
      buffers,
      reservations,
    );
    const hasConfirmedOverride = this.hasCurrentConfirmedOverride(
      record,
      initialEvaluation,
    );
    const evaluation = this.evaluateAvailability(
      record.healthcareCase,
      buffers,
      reservations,
      hasConfirmedOverride,
    );

    return this.mapResponse(record, evaluation.availability);
  }

  private hasCurrentConfirmedOverride(
    record: HealthcareEquipmentAssignmentRecord,
    evaluation: AvailabilityEvaluation,
  ): boolean {
    if (!evaluation.candidateWindow) {
      return false;
    }

    return record.conflictOverrides.some((override) => {
      const conflict = evaluation.conflicts.find(
        (candidate) =>
          candidate.reservation.id === override.conflictingAssignmentId,
      );

      return (
        conflict !== undefined &&
        override.assignmentWindowStart.getTime() ===
          evaluation.candidateWindow?.start.getTime() &&
        override.assignmentWindowEnd.getTime() ===
          evaluation.candidateWindow.end.getTime() &&
        override.conflictingWindowStart.getTime() ===
          conflict.window.start.getTime() &&
        override.conflictingWindowEnd.getTime() ===
          conflict.window.end.getTime()
      );
    });
  }

  private mapResponse(
    record: HealthcareEquipmentAssignmentRecord,
    availability: EquipmentAssignmentAvailability | null,
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
