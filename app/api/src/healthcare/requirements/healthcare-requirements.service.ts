import { Inject, Injectable } from '@nestjs/common';
import {
  HealthcareCaseStatus,
  HealthcareRequirementLifecycle,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  caseNotFoundException,
  caseRequirementsReadOnlyException,
  healthcarePersistenceException,
  invalidRequirementReorderException,
  productInactiveException,
  productNotFoundException,
  relatedResourceChangedException,
  requirementAlreadyActiveException,
  requirementNotFoundException,
  requirementRetiredException,
  resourceStateChangedException,
} from '../common/healthcare-errors';
import {
  normalizeHealthcareDisplayText,
  normalizeHealthcareOptionalText,
} from '../common/healthcare-normalization';
import { CreateHealthcareRequirementDto } from './dto/create-healthcare-requirement.dto';
import {
  HealthcareRequirementListQueryDto,
  HealthcareRequirementListStatus,
} from './dto/healthcare-requirement-list-query.dto';
import { ReorderHealthcareRequirementsDto } from './dto/reorder-healthcare-requirements.dto';
import { RetireHealthcareRequirementDto } from './dto/retire-healthcare-requirement.dto';
import { UpdateHealthcareRequirementDto } from './dto/update-healthcare-requirement.dto';
import {
  REQUIREMENT_OPERATIONAL_EVIDENCE_POLICY,
  RequirementOperationalEvidencePolicy,
} from './requirement-operational-evidence-policy';

const compactProductSelect = {
  id: true,
  sku: true,
  name: true,
  isActive: true,
  inventoryTracking: true,
} satisfies Prisma.ProductSelect;

const healthcareRequirementSelect = {
  id: true,
  companyId: true,
  caseId: true,
  productId: true,
  requestedQty: true,
  type: true,
  notes: true,
  sortOrder: true,
  lifecycle: true,
  createdById: true,
  retiredAt: true,
  retiredById: true,
  retirementReason: true,
  reactivatedAt: true,
  reactivatedById: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: compactProductSelect,
  },
} satisfies Prisma.HealthcareCaseRequirementSelect;

const requirementPairStateSelect = {
  id: true,
  lifecycle: true,
} satisfies Prisma.HealthcareCaseRequirementSelect;

const requirementIdentitySelect = {
  id: true,
  companyId: true,
  caseId: true,
  productId: true,
  lifecycle: true,
} satisfies Prisma.HealthcareCaseRequirementSelect;

const requirementPairUniqueFields = [
  'companyId',
  'caseId',
  'productId',
] as const;

const requirementPairUniqueConstraint =
  'HealthcareCaseRequirement_companyId_caseId_productId_key';

type HealthcareRequirementRecord = Prisma.HealthcareCaseRequirementGetPayload<{
  select: typeof healthcareRequirementSelect;
}>;

type RequirementIdentity = Prisma.HealthcareCaseRequirementGetPayload<{
  select: typeof requirementIdentitySelect;
}>;

type LockedHealthcareCase = {
  id: string;
  status: HealthcareCaseStatus;
};

type LockedRequirementOwner = {
  caseId: string;
  productId: string;
  status: HealthcareCaseStatus;
};

type LockedProduct = {
  id: string;
  isActive: boolean;
};

type LockedRequirement = {
  id: string;
  caseId: string;
  productId: string;
  lifecycle: HealthcareRequirementLifecycle;
  sortOrder: number;
};

@Injectable()
export class HealthcareRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUIREMENT_OPERATIONAL_EVIDENCE_POLICY)
    private readonly evidencePolicy: RequirementOperationalEvidencePolicy,
  ) {}

  async findAllForCase(
    companyId: string,
    caseId: string,
    query: HealthcareRequirementListQueryDto,
  ): Promise<{ items: HealthcareRequirementRecord[] }> {
    try {
      await this.assertCaseExists(this.prisma, companyId, caseId);

      const status = query.status ?? HealthcareRequirementListStatus.ACTIVE;
      const where: Prisma.HealthcareCaseRequirementWhereInput = {
        companyId,
        caseId,
      };

      if (status !== HealthcareRequirementListStatus.ALL) {
        where.lifecycle = status;
      }

      const items = await this.prisma.healthcareCaseRequirement.findMany({
        where,
        select: healthcareRequirementSelect,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });

      return { items };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async findOne(
    companyId: string,
    requirementId: string,
  ): Promise<HealthcareRequirementRecord> {
    try {
      return await this.findRequirementRecord(
        this.prisma,
        companyId,
        requirementId,
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async create(
    companyId: string,
    createdById: string,
    caseId: string,
    dto: CreateHealthcareRequirementDto,
  ): Promise<HealthcareRequirementRecord> {
    const notes = normalizeHealthcareOptionalText(dto.notes) ?? null;

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.lockMutableCase(transaction, companyId, caseId);
        await this.lockActiveProduct(transaction, companyId, dto.productId);

        const existing = await this.findRequirementPair(
          transaction,
          companyId,
          caseId,
          dto.productId,
        );

        if (existing) {
          this.throwRequirementPairConflict(existing.lifecycle);
        }

        return transaction.healthcareCaseRequirement.create({
          data: {
            companyId,
            caseId,
            productId: dto.productId,
            requestedQty: dto.requestedQty,
            type: dto.type,
            notes,
            sortOrder: dto.sortOrder,
            lifecycle: HealthcareRequirementLifecycle.ACTIVE,
            createdById,
          },
          select: healthcareRequirementSelect,
        });
      });
    } catch (error) {
      if (this.isRequirementPairUniqueViolation(error)) {
        const winner = await this.findRequirementPairSafely(
          companyId,
          caseId,
          dto.productId,
        );

        if (winner) {
          this.throwRequirementPairConflict(winner.lifecycle);
        }
      }

      this.rethrowPersistenceError(error);
    }
  }

  async update(
    companyId: string,
    requirementId: string,
    dto: UpdateHealthcareRequirementDto,
  ): Promise<HealthcareRequirementRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const owner = await this.lockMutableCaseForRequirement(
          transaction,
          companyId,
          requirementId,
        );
        const locked = await this.lockRequirement(
          transaction,
          companyId,
          owner.caseId,
          requirementId,
        );

        if (locked.lifecycle === HealthcareRequirementLifecycle.RETIRED) {
          throw requirementRetiredException();
        }

        const data = this.buildUpdateData(dto);

        if (Object.keys(data).length === 0) {
          return this.findRequirementRecord(
            transaction,
            companyId,
            requirementId,
          );
        }

        await this.assertRequirementMutable(transaction, companyId, locked);

        const result = await transaction.healthcareCaseRequirement.updateMany({
          where: {
            id: requirementId,
            companyId,
            caseId: owner.caseId,
            lifecycle: HealthcareRequirementLifecycle.ACTIVE,
          },
          data,
        });

        if (result.count !== 1) {
          await this.resolveExpectedActiveMutation(
            transaction,
            companyId,
            requirementId,
          );
        }

        return this.findRequirementRecord(
          transaction,
          companyId,
          requirementId,
        );
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async retire(
    companyId: string,
    retiredById: string,
    requirementId: string,
    dto: RetireHealthcareRequirementDto,
  ): Promise<HealthcareRequirementRecord> {
    const retirementReason = normalizeHealthcareDisplayText(
      dto.retirementReason,
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const owner = await this.lockMutableCaseForRequirement(
          transaction,
          companyId,
          requirementId,
        );
        const locked = await this.lockRequirement(
          transaction,
          companyId,
          owner.caseId,
          requirementId,
        );

        if (locked.lifecycle === HealthcareRequirementLifecycle.RETIRED) {
          return this.findRequirementRecord(
            transaction,
            companyId,
            requirementId,
          );
        }

        await this.assertRequirementMutable(transaction, companyId, locked);

        const result = await transaction.healthcareCaseRequirement.updateMany({
          where: {
            id: requirementId,
            companyId,
            caseId: owner.caseId,
            lifecycle: HealthcareRequirementLifecycle.ACTIVE,
          },
          data: {
            lifecycle: HealthcareRequirementLifecycle.RETIRED,
            retiredAt: new Date(),
            retiredById,
            retirementReason,
          },
        });

        if (result.count !== 1) {
          return this.resolveRetireRace(transaction, companyId, requirementId);
        }

        return this.findRequirementRecord(
          transaction,
          companyId,
          requirementId,
        );
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async reactivate(
    companyId: string,
    reactivatedById: string,
    requirementId: string,
  ): Promise<HealthcareRequirementRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const owner = await this.lockMutableCaseForRequirement(
          transaction,
          companyId,
          requirementId,
        );
        const product = await this.lockProduct(
          transaction,
          companyId,
          owner.productId,
        );
        const locked = await this.lockRequirement(
          transaction,
          companyId,
          owner.caseId,
          requirementId,
        );

        if (locked.lifecycle === HealthcareRequirementLifecycle.ACTIVE) {
          return this.findRequirementRecord(
            transaction,
            companyId,
            requirementId,
          );
        }

        if (!product.isActive) {
          throw productInactiveException();
        }

        await this.assertRequirementMutable(transaction, companyId, locked);

        const result = await transaction.healthcareCaseRequirement.updateMany({
          where: {
            id: requirementId,
            companyId,
            caseId: owner.caseId,
            lifecycle: HealthcareRequirementLifecycle.RETIRED,
          },
          data: {
            lifecycle: HealthcareRequirementLifecycle.ACTIVE,
            reactivatedAt: new Date(),
            reactivatedById,
          },
        });

        if (result.count !== 1) {
          return this.resolveReactivateRace(
            transaction,
            companyId,
            requirementId,
          );
        }

        return this.findRequirementRecord(
          transaction,
          companyId,
          requirementId,
        );
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async reorder(
    companyId: string,
    caseId: string,
    dto: ReorderHealthcareRequirementsDto,
  ): Promise<{ items: HealthcareRequirementRecord[] }> {
    this.assertValidReorder(dto);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.lockMutableCase(transaction, companyId, caseId);

        const requestedById = new Map(
          dto.items.map((item) => [item.requirementId, item.sortOrder]),
        );
        const requirementIds = [...requestedById.keys()].sort();
        const lockedRequirements = await this.lockRequirements(
          transaction,
          companyId,
          caseId,
          requirementIds,
        );

        if (lockedRequirements.length !== requirementIds.length) {
          throw requirementNotFoundException();
        }

        if (
          lockedRequirements.some(
            (requirement) =>
              requirement.lifecycle === HealthcareRequirementLifecycle.RETIRED,
          )
        ) {
          throw requirementRetiredException();
        }

        const affected = lockedRequirements.filter(
          (requirement) =>
            requirement.sortOrder !== requestedById.get(requirement.id),
        );

        for (const requirement of affected) {
          await this.assertRequirementMutable(
            transaction,
            companyId,
            requirement,
          );
        }

        for (const requirement of affected) {
          const result = await transaction.healthcareCaseRequirement.updateMany(
            {
              where: {
                id: requirement.id,
                companyId,
                caseId,
                lifecycle: HealthcareRequirementLifecycle.ACTIVE,
              },
              data: {
                sortOrder: requestedById.get(requirement.id),
              },
            },
          );

          if (result.count !== 1) {
            await this.resolveExpectedActiveMutation(
              transaction,
              companyId,
              requirement.id,
            );
          }
        }

        return this.findActiveRequirementsForCase(
          transaction,
          companyId,
          caseId,
        );
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private async assertCaseExists(
    client: Prisma.TransactionClient | PrismaService,
    companyId: string,
    caseId: string,
  ): Promise<void> {
    const healthcareCase = await client.healthcareCase.findFirst({
      where: { id: caseId, companyId },
      select: { id: true },
    });

    if (!healthcareCase) {
      throw caseNotFoundException();
    }
  }

  private async lockMutableCase(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
  ): Promise<LockedHealthcareCase> {
    const [healthcareCase] = await transaction.$queryRaw<
      LockedHealthcareCase[]
    >(Prisma.sql`
      SELECT "id", "status"
      FROM "HealthcareCase"
      WHERE "id" = ${caseId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);

    if (!healthcareCase) {
      throw caseNotFoundException();
    }

    if (healthcareCase.status === HealthcareCaseStatus.CANCELLED) {
      throw caseRequirementsReadOnlyException();
    }

    return healthcareCase;
  }

  private async lockActiveProduct(
    transaction: Prisma.TransactionClient,
    companyId: string,
    productId: string,
  ): Promise<LockedProduct> {
    const product = await this.lockProduct(transaction, companyId, productId);

    if (!product.isActive) {
      throw productInactiveException();
    }

    return product;
  }

  private async lockMutableCaseForRequirement(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirementId: string,
  ): Promise<LockedRequirementOwner> {
    const [owner] = await transaction.$queryRaw<LockedRequirementOwner[]>(
      Prisma.sql`
        SELECT
          healthcare_case."id" AS "caseId",
          requirement."productId",
          healthcare_case."status"
        FROM "HealthcareCaseRequirement" AS requirement
        INNER JOIN "HealthcareCase" AS healthcare_case
          ON healthcare_case."id" = requirement."caseId"
          AND healthcare_case."companyId" = requirement."companyId"
        WHERE requirement."id" = ${requirementId}
          AND requirement."companyId" = ${companyId}
        FOR UPDATE OF healthcare_case
      `,
    );

    if (!owner) {
      throw requirementNotFoundException();
    }

    if (owner.status === HealthcareCaseStatus.CANCELLED) {
      throw caseRequirementsReadOnlyException();
    }

    return owner;
  }

  private async lockProduct(
    transaction: Prisma.TransactionClient,
    companyId: string,
    productId: string,
  ): Promise<LockedProduct> {
    const [product] = await transaction.$queryRaw<LockedProduct[]>(Prisma.sql`
      SELECT "id", "isActive"
      FROM "Product"
      WHERE "id" = ${productId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);

    if (!product) {
      throw productNotFoundException();
    }

    return product;
  }

  private async lockRequirement(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
    requirementId: string,
  ): Promise<LockedRequirement> {
    const [requirement] = await transaction.$queryRaw<LockedRequirement[]>(
      Prisma.sql`
        SELECT "id", "caseId", "productId", "lifecycle", "sortOrder"
        FROM "HealthcareCaseRequirement"
        WHERE "id" = ${requirementId}
          AND "companyId" = ${companyId}
          AND "caseId" = ${caseId}
        FOR UPDATE
      `,
    );

    if (!requirement) {
      throw requirementNotFoundException();
    }

    return requirement;
  }

  private lockRequirements(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
    requirementIds: string[],
  ): Promise<LockedRequirement[]> {
    return transaction.$queryRaw<LockedRequirement[]>(Prisma.sql`
      SELECT "id", "caseId", "productId", "lifecycle", "sortOrder"
      FROM "HealthcareCaseRequirement"
      WHERE "companyId" = ${companyId}
        AND "caseId" = ${caseId}
        AND "id" IN (${Prisma.join(requirementIds)})
      ORDER BY "id" ASC
      FOR UPDATE
    `);
  }

  private findRequirementPair(
    client: Prisma.TransactionClient | PrismaService,
    companyId: string,
    caseId: string,
    productId: string,
  ) {
    return client.healthcareCaseRequirement.findUnique({
      where: {
        companyId_caseId_productId: { companyId, caseId, productId },
      },
      select: requirementPairStateSelect,
    });
  }

  private async findRequirementPairSafely(
    companyId: string,
    caseId: string,
    productId: string,
  ) {
    try {
      return await this.findRequirementPair(
        this.prisma,
        companyId,
        caseId,
        productId,
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private async findRequirementIdentity(
    client: Prisma.TransactionClient | PrismaService,
    companyId: string,
    requirementId: string,
  ): Promise<RequirementIdentity> {
    const requirement = await client.healthcareCaseRequirement.findFirst({
      where: { id: requirementId, companyId },
      select: requirementIdentitySelect,
    });

    if (!requirement) {
      throw requirementNotFoundException();
    }

    return requirement;
  }

  private async findRequirementRecord(
    client: Prisma.TransactionClient | PrismaService,
    companyId: string,
    requirementId: string,
  ): Promise<HealthcareRequirementRecord> {
    const requirement = await client.healthcareCaseRequirement.findFirst({
      where: { id: requirementId, companyId },
      select: healthcareRequirementSelect,
    });

    if (!requirement) {
      throw requirementNotFoundException();
    }

    return requirement;
  }

  private async findActiveRequirementsForCase(
    transaction: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
  ): Promise<{ items: HealthcareRequirementRecord[] }> {
    const items = await transaction.healthcareCaseRequirement.findMany({
      where: {
        companyId,
        caseId,
        lifecycle: HealthcareRequirementLifecycle.ACTIVE,
      },
      select: healthcareRequirementSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return { items };
  }

  private assertRequirementMutable(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirement: Pick<LockedRequirement, 'id' | 'caseId' | 'productId'>,
  ): Promise<void> {
    return this.evidencePolicy.assertMutable(transaction, {
      companyId,
      caseId: requirement.caseId,
      requirementId: requirement.id,
      productId: requirement.productId,
    });
  }

  private buildUpdateData(
    dto: UpdateHealthcareRequirementDto,
  ): Prisma.HealthcareCaseRequirementUpdateManyMutationInput {
    const data: Prisma.HealthcareCaseRequirementUpdateManyMutationInput = {};

    if (this.hasDefinedOwn(dto, 'requestedQty')) {
      data.requestedQty = dto.requestedQty;
    }

    if (this.hasDefinedOwn(dto, 'type')) {
      data.type = dto.type;
    }

    if (this.hasOwn(dto, 'notes') && dto.notes !== undefined) {
      data.notes = normalizeHealthcareOptionalText(dto.notes) ?? null;
    }

    if (this.hasDefinedOwn(dto, 'sortOrder')) {
      data.sortOrder = dto.sortOrder;
    }

    return data;
  }

  private assertValidReorder(dto: ReorderHealthcareRequirementsDto): void {
    if (dto.items.length === 0) {
      throw invalidRequirementReorderException();
    }

    const uniqueIds = new Set(dto.items.map((item) => item.requirementId));

    if (uniqueIds.size !== dto.items.length) {
      throw invalidRequirementReorderException();
    }
  }

  private async resolveExpectedActiveMutation(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirementId: string,
  ): Promise<never> {
    const latest = await this.findRequirementIdentity(
      transaction,
      companyId,
      requirementId,
    );

    if (latest.lifecycle === HealthcareRequirementLifecycle.RETIRED) {
      throw requirementRetiredException();
    }

    throw resourceStateChangedException();
  }

  private async resolveRetireRace(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirementId: string,
  ): Promise<HealthcareRequirementRecord> {
    const latest = await this.findRequirementIdentity(
      transaction,
      companyId,
      requirementId,
    );

    if (latest.lifecycle === HealthcareRequirementLifecycle.RETIRED) {
      return this.findRequirementRecord(transaction, companyId, requirementId);
    }

    throw resourceStateChangedException();
  }

  private async resolveReactivateRace(
    transaction: Prisma.TransactionClient,
    companyId: string,
    requirementId: string,
  ): Promise<HealthcareRequirementRecord> {
    const latest = await this.findRequirementIdentity(
      transaction,
      companyId,
      requirementId,
    );

    if (latest.lifecycle === HealthcareRequirementLifecycle.ACTIVE) {
      return this.findRequirementRecord(transaction, companyId, requirementId);
    }

    throw resourceStateChangedException();
  }

  private throwRequirementPairConflict(
    lifecycle: HealthcareRequirementLifecycle,
  ): never {
    if (lifecycle === HealthcareRequirementLifecycle.RETIRED) {
      throw requirementRetiredException();
    }

    throw requirementAlreadyActiveException();
  }

  private isRequirementPairUniqueViolation(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;

    if (target === requirementPairUniqueConstraint) {
      return true;
    }

    return (
      Array.isArray(target) &&
      target.length === requirementPairUniqueFields.length &&
      requirementPairUniqueFields.every((field) => target.includes(field))
    );
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        throw relatedResourceChangedException();
      }

      throw healthcarePersistenceException();
    }

    throw error;
  }

  private hasDefinedOwn<T extends object, K extends keyof T>(
    object: T,
    key: K,
  ): object is T & Record<K, Exclude<T[K], undefined>> {
    return this.hasOwn(object, key) && object[key] !== undefined;
  }

  private hasOwn<T extends object>(
    object: T,
    key: PropertyKey,
  ): key is keyof T {
    return Boolean(Object.prototype.hasOwnProperty.call(object, key));
  }
}
