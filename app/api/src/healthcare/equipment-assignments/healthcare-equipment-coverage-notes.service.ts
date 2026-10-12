import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  HealthcareCaseStatus,
  HealthcareRequirementLifecycle,
  HealthcareEquipmentRequirementCoverageNoteKind,
  IdempotencyScope,
  Prisma,
  ProductInventoryTracking,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  caseRequirementsReadOnlyException,
  requirementRetiredException,
  requirementNotFoundException,
  resourceStateChangedException,
  idempotencyKeyReusedException,
  idempotencyKeyRequiredException,
  invalidIdempotencyKeyException,
  healthcarePersistenceException,
  healthcareConcurrencyTimeoutException,
} from '../common/healthcare-errors';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import { classifyHealthcareTransactionError } from '../common/healthcare-transaction-error-classification';
import { normalizeHealthcareOptionalText } from '../common/healthcare-normalization';
import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';
import {
  applicableCoverageAssignments,
  deriveCoverageQuantities,
} from './healthcare-equipment-coverage.service';
import { CreateHealthcareEquipmentCoverageNoteDto } from './dto/create-healthcare-equipment-coverage-note.dto';

export const COVERAGE_NOTE_CREATE_SCOPE =
  IdempotencyScope.HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE;
export const COVERAGE_NOTE_RESOLVE_SCOPE =
  IdempotencyScope.HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_RESOLVE;

// PostgreSQL's existing partial index is the only CoverageNote unique invariant
// over exactly these three columns. Support the repository's Prisma target
// representations, but never infer this invariant from P2002 alone.
export function isActiveCoverageNoteUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  )
    return false;
  const model = error.meta?.modelName;
  if (
    model !== undefined &&
    model !== 'HealthcareEquipmentRequirementCoverageNote'
  )
    return false;
  const target = error.meta?.target;
  if (typeof target === 'string')
    return (
      target === 'HealthcareEquipmentRequirementCoverageNote_open_kind_key'
    );
  const fields = ['companyId', 'requirementId', 'kind'];
  return (
    model === 'HealthcareEquipmentRequirementCoverageNote' &&
    Array.isArray(target) &&
    target.length === fields.length &&
    fields.every((field) => target.includes(field))
  );
}

export function coverageNoteRequestHash(
  command:
    | {
        caseId: string;
        requirementId: string;
        kind: HealthcareEquipmentRequirementCoverageNoteKind;
        comment: string;
      }
    | { caseId: string; requirementId: string; noteId: string },
) {
  return createHash('sha256').update(JSON.stringify(command)).digest('hex');
}

@Injectable()
export class HealthcareEquipmentCoverageNotesService {
  constructor(
    private readonly repository: HealthcareEquipmentAssignmentsRepository,
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly policy: ConfigType<
      typeof healthcareCompanyTransactionTimeoutConfiguration
    >,
  ) {}

  create(
    companyId: string,
    actorId: string,
    caseId: string,
    requirementId: string,
    key: string | undefined,
    dto: CreateHealthcareEquipmentCoverageNoteDto,
  ) {
    const comment =
      typeof dto.comment === 'string'
        ? normalizeHealthcareOptionalText(dto.comment)
        : null;
    if (
      !comment ||
      !Object.values(HealthcareEquipmentRequirementCoverageNoteKind).includes(
        dto.kind,
      )
    )
      throw new BadRequestException(
        'La nota requiere tipo válido y comentario no vacío',
      );
    const command = { caseId, requirementId, kind: dto.kind, comment };
    return this.execute(
      companyId,
      this.key(key),
      COVERAGE_NOTE_CREATE_SCOPE,
      coverageNoteRequestHash(command),
      async (tx, claim) => {
        const { healthcareCase, requirement } = await this.parents(
          tx,
          companyId,
          caseId,
          requirementId,
        );
        if (claim?.resourceId) {
          const original = await this.repository.findCoverageNote(
            tx,
            companyId,
            requirementId,
            claim.resourceId,
          );
          if (!original) throw requirementNotFoundException();
          // The immutable registration is the CREATE result, even after resolution.
          return { ...original, resolvedAt: null, resolvedBy: null };
        }
        if (healthcareCase.status === HealthcareCaseStatus.CANCELLED)
          throw caseRequirementsReadOnlyException();
        if (requirement.lifecycle !== HealthcareRequirementLifecycle.ACTIVE)
          throw requirementRetiredException();
        if (
          requirement.product.inventoryTracking !==
          ProductInventoryTracking.ASSET
        )
          throw resourceStateChangedException();
        const records = await this.repository.findCoverageAssignments(
          companyId,
          caseId,
          [requirementId],
          tx,
        );
        const effective = applicableCoverageAssignments(records, [
          { id: requirementId, product: { id: requirement.productId } },
        ]);
        const { assignedQty, requestedQty } = deriveCoverageQuantities(
          requirement.requestedQty,
          records.length,
          effective.length,
          false,
        );
        const valid =
          dto.kind === 'UNAVAILABLE'
            ? assignedQty === 0
            : assignedQty > 0 && assignedQty < requestedQty;
        if (
          !valid ||
          (await this.repository.findActiveCoverageNote(
            tx,
            companyId,
            requirementId,
            dto.kind,
          ))
        )
          throw resourceStateChangedException();
        const idempotency = await this.repository.createIdempotencyClaim(
          tx,
          companyId,
          this.key(key),
          COVERAGE_NOTE_CREATE_SCOPE,
          coverageNoteRequestHash(command),
        );
        const note = await this.repository.createCoverageNote(tx, {
          companyId,
          requirementId,
          kind: dto.kind,
          comment,
          recordedById: actorId,
        });
        await this.repository.completeIdempotencyClaim(
          tx,
          idempotency.id,
          note.id,
        );
        return note;
      },
    );
  }

  resolve(
    companyId: string,
    actorId: string,
    caseId: string,
    requirementId: string,
    noteId: string,
    key: string | undefined,
  ) {
    const hash = coverageNoteRequestHash({ caseId, requirementId, noteId });
    return this.execute(
      companyId,
      this.key(key),
      COVERAGE_NOTE_RESOLVE_SCOPE,
      hash,
      async (tx, claim) => {
        await this.parents(tx, companyId, caseId, requirementId);
        if (
          !(await this.repository.lockCoverageNote(
            tx,
            companyId,
            requirementId,
            noteId,
          ))
        )
          throw requirementNotFoundException();
        const note = await this.repository.findCoverageNote(
          tx,
          companyId,
          requirementId,
          noteId,
        );
        if (!note) throw requirementNotFoundException();
        if (claim?.resourceId) {
          if (claim.resourceId !== noteId || !note.resolvedAt)
            throw resourceStateChangedException();
          return note;
        }
        const idempotency = await this.repository.createIdempotencyClaim(
          tx,
          companyId,
          this.key(key),
          COVERAGE_NOTE_RESOLVE_SCOPE,
          hash,
        );
        if (!note.resolvedAt) {
          const updated = await this.repository.resolveCoverageNote(
            tx,
            companyId,
            requirementId,
            noteId,
            actorId,
          );
          if (updated.count !== 1) throw resourceStateChangedException();
        }
        const result = await this.repository.findCoverageNote(
          tx,
          companyId,
          requirementId,
          noteId,
        );
        if (!result) throw requirementNotFoundException();
        await this.repository.completeIdempotencyClaim(
          tx,
          idempotency.id,
          noteId,
        );
        return result;
      },
    );
  }

  private async parents(
    tx: Prisma.TransactionClient,
    companyId: string,
    caseId: string,
    requirementId: string,
  ) {
    // One public 404 for every missing/foreign/invalid relationship.
    if (!(await this.repository.lockCoverageCase(tx, companyId, caseId)))
      throw requirementNotFoundException();
    const healthcareCase = await this.repository.findCase(
      companyId,
      caseId,
      tx,
    );
    if (
      !healthcareCase ||
      !(await this.repository.lockRequirement(tx, companyId, requirementId))
    )
      throw requirementNotFoundException();
    const requirement = await this.repository.findRequirement(
      companyId,
      requirementId,
      tx,
    );
    if (!requirement || requirement.caseId !== caseId)
      throw requirementNotFoundException();
    return { healthcareCase, requirement };
  }

  private key(value: string | undefined) {
    if (value === undefined) throw idempotencyKeyRequiredException();
    const key = value.trim();
    if (!key || key.length > 128) throw invalidIdempotencyKeyException();
    return key;
  }

  private async execute<T>(
    companyId: string,
    key: string,
    scope: IdempotencyScope,
    hash: string,
    operation: (
      tx: Prisma.TransactionClient,
      claim: { requestHash: string; resourceId: string | null } | null,
    ) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.repository.runCoverageNoteCommand(
        companyId,
        this.policy,
        async (tx) => {
          const claim = await this.repository.findIdempotencyRecord(
            companyId,
            key,
            scope,
            tx,
          );
          if (claim && claim.requestHash !== hash)
            throw idempotencyKeyReusedException();
          if (claim && !claim.resourceId) throw resourceStateChangedException();
          return operation(tx, claim);
        },
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (classifyHealthcareTransactionError(error, 'subsequent-operation'))
        throw healthcareConcurrencyTimeoutException();
      // The partial active-kind unique index is the final concurrency defense.
      if (isActiveCoverageNoteUniqueViolation(error))
        throw resourceStateChangedException();
      throw healthcarePersistenceException();
    }
  }
}
