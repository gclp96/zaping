import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  EquipmentCondition,
  EquipmentLifecycle,
  HealthcareCaseKitItemLifecycle,
  HealthcareCaseKitStatus,
  HealthcareCaseStatus,
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareRequirementLifecycle,
  IdempotencyScope,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';

import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { HealthcareCompanyLockTimeoutError } from '../common/healthcare-company-lock-timeout.error';
import {
  caseKitAlreadyExistsException,
  caseKitItemAlreadyExistsException,
  caseKitItemAlreadyExcludedException,
  caseKitItemNotFoundException,
  caseKitNotFoundException,
  caseKitNotMutableException,
  caseKitSourceNotEligibleException,
  caseKitSourceNotFoundException,
  caseNotEligibleException,
  caseNotFoundException,
  healthcareConcurrencyTimeoutException,
  healthcarePersistenceException,
  idempotencyKeyReusedException,
  invalidCaseKitSourceException,
  invalidCaseKitItemExclusionReasonException,
  invalidPreparedQuantityException,
  resourceStateChangedException,
} from '../common/healthcare-errors';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';
import {
  AddHealthcareCaseKitItemDto,
  HealthcareCaseKitItemSourceType,
} from './dto/add-healthcare-case-kit-item.dto';
import { ExcludeHealthcareCaseKitItemDto } from './dto/exclude-healthcare-case-kit-item.dto';
import {
  createHealthcareCaseKitItemExclusionRequestHash,
  createHealthcareCaseKitItemRequestHash,
  createHealthcareCaseKitRequestHash,
} from './healthcare-case-kit-request-hash';
import {
  HealthcareCaseKitItemRecord,
  HealthcareCaseKitRecord,
  HealthcareCaseKitsRepository,
} from './healthcare-case-kits.repository';

const CREATE_SCOPE = IdempotencyScope.HEALTHCARE_CASE_KIT_CREATE;
const ADD_ITEM_SCOPE = IdempotencyScope.HEALTHCARE_CASE_KIT_ITEM_ADD;
const EXCLUDE_ITEM_SCOPE = IdempotencyScope.HEALTHCARE_CASE_KIT_ITEM_EXCLUDE;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HealthcareCaseKitWarningCode =
  | 'CASE_KIT_CASE_CANCELLED'
  | 'CASE_KIT_REQUIREMENT_NOT_ACTIVE'
  | 'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE'
  | 'CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED'
  | 'CASE_KIT_ASSIGNMENT_NOT_RESERVED'
  | 'CASE_KIT_EQUIPMENT_NOT_ACTIVE'
  | 'CASE_KIT_EQUIPMENT_NOT_GOOD';

type UserSummary = { id: string; firstName: string; lastName: string };
type Warning = { code: HealthcareCaseKitWarningCode; message: string };

export type HealthcareCaseKitItemResponse = {
  id: string;
  sourceType: HealthcareCaseKitItemSourceType;
  preparedQuantity: number | null;
  lifecycle: HealthcareCaseKitItemLifecycle;
  requirement: HealthcareCaseKitItemRecord['requirement'];
  equipmentAssignment: HealthcareCaseKitItemRecord['equipmentAssignment'];
  sourceValid: boolean;
  stale: boolean;
  warnings: Warning[];
  addedBy: UserSummary;
  excludedBy: UserSummary | null;
  excludedAt: Date | null;
  exclusionReason: string | null;
  createdAt: Date;
};

export type HealthcareCaseKitResponse = {
  id: string;
  caseId: string;
  status: HealthcareCaseKitStatus;
  createdBy: UserSummary;
  createdAt: Date;
  updatedAt: Date;
  items: HealthcareCaseKitItemResponse[];
};

export type HealthcareCaseKitCommandResult<T> = {
  replay: boolean;
  data: T;
};

@Injectable()
export class HealthcareCaseKitsService {
  constructor(
    private readonly repository: HealthcareCaseKitsRepository,
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly timeoutPolicy: ConfigType<
      typeof healthcareCompanyTransactionTimeoutConfiguration
    >,
  ) {}

  async get(
    companyId: string,
    caseId: string,
  ): Promise<HealthcareCaseKitResponse> {
    try {
      const healthcareCase = await this.repository.findCase(companyId, caseId);
      if (!healthcareCase) throw caseNotFoundException();

      const kit = await this.repository.findKitByCase(companyId, caseId);
      if (!kit) throw caseKitNotFoundException();

      return this.mapKit(kit);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async create(
    companyId: string,
    createdById: string,
    caseId: string,
    idempotencyKey: string,
  ): Promise<HealthcareCaseKitCommandResult<HealthcareCaseKitResponse>> {
    const requestHash = createHealthcareCaseKitRequestHash(caseId);

    try {
      const replay = await this.findCompletedKitReplay(
        companyId,
        idempotencyKey,
        requestHash,
      );
      if (replay) return { replay: true, data: replay };

      return await this.repository.runInTransaction(async (transaction) => {
        await this.acquireCompanyProtocol(transaction, companyId);
        if (!(await this.repository.lockCase(transaction, companyId, caseId))) {
          throw caseNotFoundException();
        }

        const transactionalReplay = await this.findCompletedKitReplay(
          companyId,
          idempotencyKey,
          requestHash,
          transaction,
        );
        if (transactionalReplay) {
          return { replay: true, data: transactionalReplay };
        }

        const healthcareCase = await this.repository.findCase(
          companyId,
          caseId,
          transaction,
        );
        if (!healthcareCase) throw caseNotFoundException();
        if (healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
          throw caseNotEligibleException();
        }

        if (
          await this.repository.findKitByCase(companyId, caseId, transaction)
        ) {
          throw caseKitAlreadyExistsException();
        }

        const claim = await this.repository.createIdempotencyClaim(
          transaction,
          companyId,
          idempotencyKey,
          CREATE_SCOPE,
          requestHash,
        );
        const kit = await this.repository.createKit(transaction, {
          companyId,
          caseId,
          createdById,
        });
        await this.repository.completeIdempotencyClaim(
          transaction,
          claim.id,
          kit.id,
        );

        return { replay: false, data: this.mapKit(kit) };
      }, this.transactionOptions());
    } catch (error) {
      if (error instanceof HealthcareCompanyLockTimeoutError) {
        throw healthcareConcurrencyTimeoutException();
      }
      if (this.isIdempotencyUniqueViolation(error)) {
        const replay = await this.findCompletedKitReplay(
          companyId,
          idempotencyKey,
          requestHash,
        );
        if (replay) return { replay: true, data: replay };
      }
      if (
        this.isUniqueViolation(error, 'HealthcareCaseKit_companyId_caseId_key')
      ) {
        throw caseKitAlreadyExistsException();
      }
      if (this.isForeignKeyViolation(error))
        throw resourceStateChangedException();
      this.rethrowPersistenceError(error);
    }
  }

  async addItem(
    companyId: string,
    addedById: string,
    caseKitId: string,
    idempotencyKey: string,
    dto: AddHealthcareCaseKitItemDto,
  ): Promise<HealthcareCaseKitCommandResult<HealthcareCaseKitItemResponse>> {
    this.assertSourceShape(dto);
    const requestHash = createHealthcareCaseKitItemRequestHash(caseKitId, dto);

    try {
      const replay = await this.findCompletedItemReplay(
        companyId,
        idempotencyKey,
        requestHash,
      );
      if (replay) return { replay: true, data: replay };

      const discoveredKit = await this.repository.findKit(companyId, caseKitId);
      if (!discoveredKit) throw caseKitNotFoundException();

      return await this.repository.runInTransaction(async (transaction) => {
        await this.acquireCompanyProtocol(transaction, companyId);
        if (
          !(await this.repository.lockCase(
            transaction,
            companyId,
            discoveredKit.caseId,
          ))
        ) {
          throw caseKitNotFoundException();
        }
        if (
          !(await this.repository.lockKit(transaction, companyId, caseKitId))
        ) {
          throw caseKitNotFoundException();
        }

        if (dto.sourceType === HealthcareCaseKitItemSourceType.REQUIREMENT) {
          if (
            !(await this.repository.lockRequirement(
              transaction,
              companyId,
              dto.requirementId as string,
            ))
          ) {
            throw caseKitSourceNotFoundException();
          }
        } else if (
          !(await this.repository.lockAssignment(
            transaction,
            companyId,
            dto.equipmentAssignmentId as string,
          ))
        ) {
          throw caseKitSourceNotFoundException();
        }

        const transactionalReplay = await this.findCompletedItemReplay(
          companyId,
          idempotencyKey,
          requestHash,
          transaction,
        );
        if (transactionalReplay) {
          return { replay: true, data: transactionalReplay };
        }

        const kit = await this.repository.findKit(
          companyId,
          caseKitId,
          transaction,
        );
        if (!kit) throw caseKitNotFoundException();
        if (kit.status !== HealthcareCaseKitStatus.DRAFT) {
          throw caseKitNotMutableException();
        }
        if (kit.healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
          throw caseNotEligibleException();
        }

        const source = await this.validateSource(
          transaction,
          companyId,
          kit.caseId,
          dto,
        );
        const duplicate = await this.repository.findDuplicateItem(
          companyId,
          caseKitId,
          source.duplicateWhere,
          transaction,
        );
        if (duplicate) throw caseKitItemAlreadyExistsException();

        const claim = await this.repository.createIdempotencyClaim(
          transaction,
          companyId,
          idempotencyKey,
          ADD_ITEM_SCOPE,
          requestHash,
        );
        const item = await this.repository.createItem(transaction, {
          companyId,
          caseId: kit.caseId,
          caseKitId,
          requirementId: source.requirementId,
          equipmentAssignmentId: source.equipmentAssignmentId,
          preparedQuantity: source.preparedQuantity,
          addedById,
        });
        await this.repository.completeIdempotencyClaim(
          transaction,
          claim.id,
          item.id,
        );

        return {
          replay: false,
          data: this.mapItem(item, kit.healthcareCase.status),
        };
      }, this.transactionOptions());
    } catch (error) {
      if (error instanceof HealthcareCompanyLockTimeoutError) {
        throw healthcareConcurrencyTimeoutException();
      }
      if (this.isIdempotencyUniqueViolation(error)) {
        const replay = await this.findCompletedItemReplay(
          companyId,
          idempotencyKey,
          requestHash,
        );
        if (replay) return { replay: true, data: replay };
      }
      if (
        this.isUniqueViolation(
          error,
          'HealthcareCaseKitItem_requirement_source_key',
        ) ||
        this.isUniqueViolation(
          error,
          'HealthcareCaseKitItem_assignment_source_key',
        )
      ) {
        throw caseKitItemAlreadyExistsException();
      }
      if (this.isForeignKeyViolation(error))
        throw resourceStateChangedException();
      this.rethrowPersistenceError(error);
    }
  }

  async excludeItem(
    companyId: string,
    excludedById: string,
    caseKitId: string,
    itemId: string,
    idempotencyKey: string,
    dto: ExcludeHealthcareCaseKitItemDto,
  ): Promise<HealthcareCaseKitCommandResult<HealthcareCaseKitItemResponse>> {
    const exclusionReason = normalizeHealthcareOptionalText(dto.reason);
    if (!exclusionReason) {
      throw invalidCaseKitItemExclusionReasonException();
    }
    const requestHash = createHealthcareCaseKitItemExclusionRequestHash(
      caseKitId,
      itemId,
      exclusionReason,
    );

    try {
      const replay = await this.findCompletedItemExclusionReplay(
        companyId,
        idempotencyKey,
        requestHash,
        caseKitId,
      );
      if (replay) return { replay: true, data: replay };

      const discoveredKit = await this.repository.findKit(companyId, caseKitId);
      if (!discoveredKit) throw caseKitNotFoundException();

      const discoveredItem = await this.repository.findItem(companyId, itemId);
      if (!discoveredItem || discoveredItem.caseKitId !== caseKitId) {
        throw caseKitItemNotFoundException();
      }

      return await this.repository.runInTransaction(async (transaction) => {
        await this.acquireCompanyProtocol(transaction, companyId);
        if (
          !(await this.repository.lockCase(
            transaction,
            companyId,
            discoveredKit.caseId,
          ))
        ) {
          throw caseKitItemNotFoundException();
        }
        if (
          !(await this.repository.lockKit(transaction, companyId, caseKitId))
        ) {
          throw caseKitNotFoundException();
        }
        if (
          !(await this.repository.lockItem(
            transaction,
            companyId,
            caseKitId,
            itemId,
          ))
        ) {
          throw caseKitItemNotFoundException();
        }

        const transactionalReplay = await this.findCompletedItemExclusionReplay(
          companyId,
          idempotencyKey,
          requestHash,
          caseKitId,
          transaction,
        );
        if (transactionalReplay) {
          return { replay: true, data: transactionalReplay };
        }

        const item = await this.repository.findItem(
          companyId,
          itemId,
          transaction,
        );
        if (!item || item.caseKitId !== caseKitId) {
          throw caseKitItemNotFoundException();
        }
        if (item.lifecycle === HealthcareCaseKitItemLifecycle.EXCLUDED) {
          return this.resolveExcludedItemReplay(item, exclusionReason);
        }
        if (item.caseKit.status !== HealthcareCaseKitStatus.DRAFT) {
          throw caseKitNotMutableException();
        }
        if (
          item.caseKit.healthcareCase.status === HealthcareCaseStatus.CANCELLED
        ) {
          throw caseNotEligibleException();
        }

        const excludedAt = new Date();
        const update = await this.repository.excludeItem(transaction, {
          companyId,
          caseKitId,
          itemId,
          excludedById,
          excludedAt,
          exclusionReason,
        });
        if (update.count !== 1) {
          const winner = await this.repository.findItem(
            companyId,
            itemId,
            transaction,
          );
          if (
            winner &&
            winner.caseKitId === caseKitId &&
            winner.lifecycle === HealthcareCaseKitItemLifecycle.EXCLUDED
          ) {
            return this.resolveExcludedItemReplay(winner, exclusionReason);
          }
          throw resourceStateChangedException();
        }

        const claim = await this.repository.createIdempotencyClaim(
          transaction,
          companyId,
          idempotencyKey,
          EXCLUDE_ITEM_SCOPE,
          requestHash,
        );
        const excludedItem = await this.repository.findItem(
          companyId,
          itemId,
          transaction,
        );
        if (!excludedItem || excludedItem.caseKitId !== caseKitId) {
          throw healthcarePersistenceException();
        }
        await this.repository.completeIdempotencyClaim(
          transaction,
          claim.id,
          itemId,
        );

        return {
          replay: false,
          data: this.mapItem(
            excludedItem,
            excludedItem.caseKit.healthcareCase.status,
          ),
        };
      }, this.transactionOptions());
    } catch (error) {
      if (error instanceof HealthcareCompanyLockTimeoutError) {
        throw healthcareConcurrencyTimeoutException();
      }
      if (this.isIdempotencyUniqueViolation(error)) {
        const replay = await this.findCompletedItemExclusionReplay(
          companyId,
          idempotencyKey,
          requestHash,
          caseKitId,
        );
        if (replay) return { replay: true, data: replay };
      }
      if (this.isForeignKeyViolation(error)) {
        throw resourceStateChangedException();
      }
      this.rethrowPersistenceError(error);
    }
  }

  private async validateSource(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
    dto: AddHealthcareCaseKitItemDto,
  ) {
    if (dto.sourceType === HealthcareCaseKitItemSourceType.REQUIREMENT) {
      const requirement = await this.repository.findRequirement(
        companyId,
        dto.requirementId as string,
        transaction,
      );
      if (!requirement || requirement.caseId !== caseId) {
        throw caseKitSourceNotFoundException();
      }
      if (
        !Number.isInteger(dto.preparedQuantity) ||
        dto.preparedQuantity! < 1 ||
        dto.preparedQuantity! > requirement.requestedQty
      ) {
        throw invalidPreparedQuantityException();
      }
      if (
        requirement.lifecycle !== HealthcareRequirementLifecycle.ACTIVE ||
        !requirement.product.isActive
      ) {
        throw caseKitSourceNotEligibleException();
      }
      if (
        requirement.product.inventoryTracking !==
        ProductInventoryTracking.QUANTITY
      ) {
        throw invalidCaseKitSourceException();
      }
      return {
        requirementId: requirement.id,
        equipmentAssignmentId: null,
        preparedQuantity: dto.preparedQuantity as number,
        duplicateWhere: { requirementId: requirement.id },
      };
    }

    const assignment = await this.repository.findAssignment(
      companyId,
      dto.equipmentAssignmentId as string,
      transaction,
    );
    if (!assignment || assignment.caseId !== caseId) {
      throw caseKitSourceNotFoundException();
    }
    if (
      assignment.lifecycle !==
        HealthcareEquipmentAssignmentLifecycle.RESERVED ||
      assignment.equipmentAsset.lifecycle !== EquipmentLifecycle.ACTIVE ||
      assignment.equipmentAsset.condition !== EquipmentCondition.GOOD
    ) {
      throw caseKitSourceNotEligibleException();
    }
    return {
      requirementId: null,
      equipmentAssignmentId: assignment.id,
      preparedQuantity: null,
      duplicateWhere: { equipmentAssignmentId: assignment.id },
    };
  }

  private assertSourceShape(dto: AddHealthcareCaseKitItemDto): void {
    const validRequirementId =
      typeof dto.requirementId === 'string' &&
      UUID_PATTERN.test(dto.requirementId);
    const validAssignmentId =
      typeof dto.equipmentAssignmentId === 'string' &&
      UUID_PATTERN.test(dto.equipmentAssignmentId);
    const validRequirement =
      dto.sourceType === HealthcareCaseKitItemSourceType.REQUIREMENT &&
      validRequirementId &&
      dto.equipmentAssignmentId === undefined &&
      dto.preparedQuantity !== undefined;
    const validAssignment =
      dto.sourceType === HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT &&
      validAssignmentId &&
      dto.requirementId === undefined &&
      dto.preparedQuantity === undefined;
    if (!validRequirement && !validAssignment) {
      throw invalidCaseKitSourceException();
    }
    if (
      validRequirement &&
      (!Number.isInteger(dto.preparedQuantity) || dto.preparedQuantity! < 1)
    ) {
      throw invalidPreparedQuantityException();
    }
  }

  private async acquireCompanyProtocol(
    transaction: Prisma.TransactionClient,
    companyId: string,
  ): Promise<void> {
    await acquireHealthcareCompanyLock(transaction, companyId, {
      acquisitionTimeoutMs: this.timeoutPolicy.companyLockAcquisitionTimeoutMs,
    });
    await applyHealthcareSubsequentTransactionTimeouts(
      transaction,
      this.timeoutPolicy,
    );
  }

  private transactionOptions() {
    return {
      maxWait: this.timeoutPolicy.prismaMaxWaitMs,
      timeout: this.timeoutPolicy.prismaTransactionTimeoutMs,
    };
  }

  private async findCompletedKitReplay(
    companyId: string,
    key: string,
    requestHash: string,
    client?: Prisma.TransactionClient,
  ): Promise<HealthcareCaseKitResponse | null> {
    const record = await this.repository.findIdempotencyRecord(
      companyId,
      key,
      CREATE_SCOPE,
      client,
    );
    if (!record) return null;
    if (record.requestHash !== requestHash)
      throw idempotencyKeyReusedException();
    if (!record.resourceId) return null;
    const kit = await this.repository.findKit(
      companyId,
      record.resourceId,
      client,
    );
    if (!kit) throw healthcarePersistenceException();
    return this.mapKit(kit);
  }

  private async findCompletedItemReplay(
    companyId: string,
    key: string,
    requestHash: string,
    client?: Prisma.TransactionClient,
  ): Promise<HealthcareCaseKitItemResponse | null> {
    const record = await this.repository.findIdempotencyRecord(
      companyId,
      key,
      ADD_ITEM_SCOPE,
      client,
    );
    if (!record) return null;
    if (record.requestHash !== requestHash)
      throw idempotencyKeyReusedException();
    if (!record.resourceId) return null;
    const item = await this.repository.findItem(
      companyId,
      record.resourceId,
      client,
    );
    if (!item) throw healthcarePersistenceException();
    return this.mapItem(item, item.caseKit.healthcareCase.status);
  }

  private async findCompletedItemExclusionReplay(
    companyId: string,
    key: string,
    requestHash: string,
    caseKitId: string,
    client?: Prisma.TransactionClient,
  ): Promise<HealthcareCaseKitItemResponse | null> {
    const record = await this.repository.findIdempotencyRecord(
      companyId,
      key,
      EXCLUDE_ITEM_SCOPE,
      client,
    );
    if (!record) return null;
    if (record.requestHash !== requestHash) {
      throw idempotencyKeyReusedException();
    }
    if (!record.resourceId) return null;
    const item = await this.repository.findItem(
      companyId,
      record.resourceId,
      client,
    );
    if (!item || item.caseKitId !== caseKitId) {
      throw healthcarePersistenceException();
    }
    return this.mapItem(item, item.caseKit.healthcareCase.status);
  }

  private resolveExcludedItemReplay(
    item: NonNullable<
      Awaited<ReturnType<HealthcareCaseKitsRepository['findItem']>>
    >,
    exclusionReason: string,
  ): HealthcareCaseKitCommandResult<HealthcareCaseKitItemResponse> {
    if (item.exclusionReason !== exclusionReason) {
      throw caseKitItemAlreadyExcludedException();
    }
    return {
      replay: true,
      data: this.mapItem(item, item.caseKit.healthcareCase.status),
    };
  }

  private mapKit(record: HealthcareCaseKitRecord): HealthcareCaseKitResponse {
    return {
      id: record.id,
      caseId: record.caseId,
      status: record.status,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items: record.items.map((item) =>
        this.mapItem(item, record.healthcareCase.status),
      ),
    };
  }

  private mapItem(
    item: HealthcareCaseKitItemRecord,
    caseStatus: HealthcareCaseStatus,
  ): HealthcareCaseKitItemResponse {
    const warnings: Warning[] = [];
    if (caseStatus === HealthcareCaseStatus.CANCELLED) {
      warnings.push({
        code: 'CASE_KIT_CASE_CANCELLED',
        message: 'El caso está cancelado.',
      });
    }
    if (item.requirement) {
      if (
        item.requirement.lifecycle !== HealthcareRequirementLifecycle.ACTIVE
      ) {
        warnings.push({
          code: 'CASE_KIT_REQUIREMENT_NOT_ACTIVE',
          message: 'El requerimiento ya no está activo.',
        });
      }
      if (!item.requirement.product.isActive) {
        warnings.push({
          code: 'CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE',
          message: 'El producto del requerimiento está inactivo.',
        });
      }
      if ((item.preparedQuantity ?? 0) > item.requirement.requestedQty) {
        warnings.push({
          code: 'CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED',
          message: 'La cantidad preparada excede la cantidad solicitada.',
        });
      }
    }
    if (item.equipmentAssignment) {
      if (
        item.equipmentAssignment.lifecycle !==
        HealthcareEquipmentAssignmentLifecycle.RESERVED
      ) {
        warnings.push({
          code: 'CASE_KIT_ASSIGNMENT_NOT_RESERVED',
          message: 'La asignación ya no está reservada.',
        });
      }
      if (
        item.equipmentAssignment.equipmentAsset.lifecycle !==
        EquipmentLifecycle.ACTIVE
      ) {
        warnings.push({
          code: 'CASE_KIT_EQUIPMENT_NOT_ACTIVE',
          message: 'El equipo ya no está activo.',
        });
      }
      if (
        item.equipmentAssignment.equipmentAsset.condition !==
        EquipmentCondition.GOOD
      ) {
        warnings.push({
          code: 'CASE_KIT_EQUIPMENT_NOT_GOOD',
          message: 'El equipo ya no está en condición disponible.',
        });
      }
    }
    return {
      id: item.id,
      sourceType: item.requirement
        ? HealthcareCaseKitItemSourceType.REQUIREMENT
        : HealthcareCaseKitItemSourceType.EQUIPMENT_ASSIGNMENT,
      preparedQuantity: item.preparedQuantity,
      lifecycle: item.lifecycle,
      requirement: item.requirement,
      equipmentAssignment: item.equipmentAssignment,
      sourceValid: warnings.length === 0,
      stale: warnings.length > 0,
      warnings,
      addedBy: item.addedBy,
      excludedBy: item.excludedBy,
      excludedAt: item.excludedAt,
      exclusionReason: item.exclusionReason,
      createdAt: item.createdAt,
    };
  }

  private isIdempotencyUniqueViolation(error: unknown): boolean {
    return this.isUniqueViolation(
      error,
      'IdempotencyRecord_companyId_scope_key_key',
    );
  }

  private isUniqueViolation(error: unknown, constraint: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      (typeof error.meta?.target === 'string'
        ? error.meta.target.includes(constraint)
        : constraint.startsWith('IdempotencyRecord') &&
          Array.isArray(error.meta?.target) &&
          ['companyId', 'scope', 'key'].every((field) =>
            (error.meta?.target as string[]).includes(field),
          ))
    );
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof HttpException) throw error;
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
