import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  HealthcareCaseReconciliationAudit,
  IdempotencyScope,
  Prisma,
} from '@prisma/client';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import {
  caseNotFoundException,
  healthcarePersistenceException,
  healthcareConcurrencyTimeoutException,
  idempotencyKeyRequiredException,
  invalidIdempotencyKeyException,
  idempotencyKeyReusedException,
  resourceStateChangedException,
} from '../common/healthcare-errors';
import { classifyHealthcareTransactionError } from '../common/healthcare-transaction-error-classification';
import { HealthcareCaseReconciliationCommandRepository as Repository } from './healthcare-case-reconciliation-command.repository';
import {
  ReconciliationCommandContext as Context,
  ReconciliationCommandIntent as Intent,
  ReconciliationCommandResult,
  ReconciliationDraftOperation,
} from './healthcare-case-reconciliation-command.types';
import { ReconciliationAuditChange } from './healthcare-case-reconciliation.types';
import { createReconciliationRequestHash } from './healthcare-case-reconciliation-request-hash';
import { parseReconciliationAuditChange } from './healthcare-case-reconciliation.snapshot';
import { mapReconciliationDetail } from './healthcare-case-reconciliation.mapper';
import { deriveReconciliationSummary } from './healthcare-case-reconciliation-summary';
import {
  reconciliationMissing,
  reconciliationConflict,
  reconciliationSourceInvalid,
  reconciliationCapacityExceeded,
} from './healthcare-case-reconciliation-command.errors';
type Tx = Prisma.TransactionClient;
const scopes: Record<ReconciliationDraftOperation, IdempotencyScope> = {
  CREATE: 'HEALTHCARE_CASE_RECONCILIATION_CREATE',
  ITEM_ADD: 'HEALTHCARE_CASE_RECONCILIATION_ITEM_ADD',
  OUTCOME_SET: 'HEALTHCARE_CASE_RECONCILIATION_OUTCOME_SET',
  ITEM_EXCLUDE: 'HEALTHCARE_CASE_RECONCILIATION_ITEM_EXCLUDE',
  CANCEL: 'HEALTHCARE_CASE_RECONCILIATION_CANCEL',
};
@Injectable()
export class HealthcareCaseReconciliationCommandService {
  constructor(
    private readonly repo: Repository,
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly policy: ConfigType<
      typeof healthcareCompanyTransactionTimeoutConfiguration
    >,
  ) {}
  async execute(
    context: Context,
    intent: Intent,
  ): Promise<ReconciliationCommandResult> {
    if (context.key === undefined) throw idempotencyKeyRequiredException();
    if (
      typeof context.key !== 'string' ||
      !context.key.trim() ||
      context.key.trim().length > 128
    )
      throw invalidIdempotencyKeyException();
    const c = { ...context, key: context.key.trim() },
      hash = createReconciliationRequestHash(c, intent),
      scope = scopes[intent.operation];
    try {
      const replay = await this.replay(c, intent, hash, scope);
      if (replay) return replay;
      try {
        return await this.repo.runInTransaction(async (tx) => {
          const claim = await this.repo.createClaim(c, scope, hash, tx),
            audit = await this.mutate(c, intent, tx);
          await this.repo.completeClaim(
            claim.id,
            audit.reconciliationItemId ?? audit.reconciliationId,
            tx,
          );
          return this.result(c, audit, false, tx);
        }, this.policy);
      } catch (e) {
        if (
          this.unique(e, ['companyId', 'scope', 'key'], 'IdempotencyRecord')
        ) {
          const winner = await this.replay(c, intent, hash, scope);
          if (winner) return winner;
          throw healthcarePersistenceException();
        }
        throw e;
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (classifyHealthcareTransactionError(e, 'subsequent-operation'))
        throw healthcareConcurrencyTimeoutException();
      if (
        this.unique(
          e,
          ['companyId', 'reconciliationId', 'sourceDispatchItemId'],
          'Reconciliation_active_source',
        )
      )
        reconciliationConflict(
          'CASE_RECONCILIATION_SOURCE_ALREADY_REPRESENTED',
        );
      throw healthcarePersistenceException();
    }
  }
  private unique(e: unknown, keys: string[], name: string) {
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError) ||
      e.code !== 'P2002'
    )
      return false;
    const target = e.meta?.target;
    return Array.isArray(target)
      ? keys.every((k) => target.includes(k))
      : typeof target === 'string' && target.includes(name);
  }
  private replay(c: Context, i: Intent, hash: string, scope: IdempotencyScope) {
    return this.repo.runInReadSnapshot(async (tx) => {
      const record = await this.repo.findClaim(c, scope, tx);
      if (!record) return null;
      if (record.requestHash !== hash) throw idempotencyKeyReusedException();
      if (!record.resourceId) throw healthcarePersistenceException();
      let id = record.resourceId,
        itemId: string | null = null;
      if (
        i.operation === 'ITEM_ADD' ||
        i.operation === 'OUTCOME_SET' ||
        i.operation === 'ITEM_EXCLUDE'
      ) {
        const item = await this.repo.replayItem(c, record.resourceId, tx);
        if (
          !item ||
          item.reconciliationId !== c.reconciliationId ||
          (i.operation !== 'ITEM_ADD' && item.id !== c.itemId) ||
          (i.operation === 'ITEM_ADD' &&
            item.sourceDispatchItemId !== i.dto.sourceDispatchItemId) ||
          (i.operation === 'OUTCOME_SET' && item.type !== i.dto.type)
        )
          throw healthcarePersistenceException();
        id = item.reconciliationId;
        itemId = item.id;
      } else if (i.operation !== 'CREATE' && id !== c.reconciliationId)
        throw healthcarePersistenceException();
      const audit = await this.repo.findWitness(
        c,
        id,
        i.operation === 'CREATE' ? 0 : i.dto.expectedRevision + 1,
        tx,
      );
      if (
        !audit ||
        audit.operation !== i.operation ||
        audit.reconciliationItemId !== itemId ||
        audit.revisionBefore !==
          (i.operation === 'CREATE' ? null : i.dto.expectedRevision)
      )
        throw healthcarePersistenceException();
      const change = parseReconciliationAuditChange(
        audit.change,
        audit.operation,
      );
      if (
        (i.operation === 'ITEM_EXCLUDE' || i.operation === 'CANCEL') &&
        (!('reason' in change) || change.reason !== i.dto.reason.trim())
      )
        throw healthcarePersistenceException();
      if (i.operation === 'OUTCOME_SET') {
        if (change.operation !== 'OUTCOME_SET' || change.type !== i.dto.type)
          throw healthcarePersistenceException();
        if (
          change.type === 'MATERIAL'
            ? change.after.returnedQty !== i.dto.returnedQty ||
              change.after.usedQty !== i.dto.usedQty
            : change.after.outcome !== i.dto.outcome ||
              change.after.reportedCondition !== i.dto.reportedCondition
        )
          throw healthcarePersistenceException();
      }
      const result = await this.result(c, audit, true, tx);
      if (
        i.operation === 'CREATE' &&
        (result.data.dispatchId !== i.dto.dispatchId ||
          result.data.observation !== (i.dto.observation?.trim() ?? null))
      )
        throw healthcarePersistenceException();
      return result;
    });
  }
  private async result(
    c: Context,
    a: HealthcareCaseReconciliationAudit,
    replay: boolean,
    tx: Tx,
  ): Promise<ReconciliationCommandResult> {
    const row = await this.repo.detail(c, a.reconciliationId, tx);
    if (!row || a.operation === 'CONFIRM')
      throw healthcarePersistenceException();
    return {
      replay,
      command: {
        auditId: a.id,
        operation: a.operation,
        reconciliationId: a.reconciliationId,
        itemId: a.reconciliationItemId,
        revisionBefore: a.revisionBefore,
        revisionAfter: a.revisionAfter,
        actorId: a.actorId,
        occurredAt: a.createdAt.toISOString(),
      },
      data: mapReconciliationDetail(row),
    };
  }
  private async admission(
    c: Context,
    dispatchId: string,
    sourceId: string,
    tx: Tx,
  ) {
    const sources = await this.repo.admissionSources(c, dispatchId, tx),
      source = sources.find((s) => s.id === sourceId);
    if (!source) reconciliationSourceInvalid();
    const summary = deriveReconciliationSummary(dispatchId, sources),
      state = summary.items.find((s) => s.sourceDispatchItemId === sourceId);
    if (!state) throw healthcarePersistenceException();
    if (
      (state.type === 'MATERIAL' && state.unresolvedQty === 0) ||
      (state.type === 'EQUIPMENT' && state.custodyStatus === 'CLOSED')
    )
      reconciliationCapacityExceeded();
    return { source, state };
  }
  private async mutate(
    c: Context,
    i: Intent,
    tx: Tx,
  ): Promise<HealthcareCaseReconciliationAudit> {
    if (i.operation === 'CREATE') {
      await this.repo.lockSourcePrefix(c, i.dto.dispatchId, undefined, tx);
      if (!(await this.repo.findCase(c, tx))) throw caseNotFoundException();
      const d = await this.repo.sourceDispatch(c, i.dto.dispatchId, tx);
      if (!d || d.status !== 'CONFIRMED') reconciliationSourceInvalid();
      const root = await this.repo.createDraft(
        c,
        d.id,
        d.caseKitId,
        i.dto.observation?.trim() ?? null,
        tx,
      );
      return this.repo.appendAudit(
        { ...c, reconciliationId: root.id },
        null,
        null,
        { version: 1, operation: 'CREATE' },
        tx,
      );
    }
    let discoveredDispatchId: string | undefined,
      discoveredSourceId: string | undefined;
    if (i.operation === 'ITEM_ADD' || i.operation === 'OUTCOME_SET') {
      const discovery = await this.repo.identity(c, tx);
      discoveredDispatchId = discovery?.dispatchId;
      discoveredSourceId =
        i.operation === 'ITEM_ADD'
          ? i.dto.sourceDispatchItemId
          : (await this.repo.itemIdentity(c, tx))?.sourceDispatchItemId;
      if (discovery)
        await this.repo.lockSourcePrefix(
          c,
          discovery.dispatchId,
          discoveredSourceId,
          tx,
        );
    }
    const root = await this.repo.lockDraftById(c, tx);
    if (!root) reconciliationMissing();
    if (root.revision !== i.dto.expectedRevision)
      throw resourceStateChangedException();
    if (root.status !== 'DRAFT')
      reconciliationConflict('CASE_RECONCILIATION_NOT_MUTABLE');
    let itemId: string | null = null,
      change: ReconciliationAuditChange,
      count: number;
    if (i.operation === 'ITEM_ADD') {
      if (root.dispatchId !== discoveredDispatchId)
        throw resourceStateChangedException();
      const source = await this.repo.sourceItem(
        c,
        root.dispatchId,
        i.dto.sourceDispatchItemId,
        tx,
      );
      if (!source || source.lifecycle !== 'ACTIVE')
        reconciliationSourceInvalid();
      if (await this.repo.activeSource(c, source.id, tx))
        reconciliationConflict(
          'CASE_RECONCILIATION_SOURCE_ALREADY_REPRESENTED',
        );
      const facts = await this.admission(c, root.dispatchId, source.id, tx),
        base = {
          companyId: c.companyId,
          caseId: c.caseId,
          dispatchId: root.dispatchId,
          reconciliationId: root.id,
          sourceDispatchItemId: source.id,
          createdById: c.actorId,
        };
      itemId =
        source.type === 'MATERIAL'
          ? (
              await this.repo.insertMaterialItem(
                {
                  ...base,
                  type: 'MATERIAL',
                  sourceCustodyPositionId: facts.source.destinationPosition!.id,
                  expectedSourceRevision:
                    facts.source.destinationPosition!.revision,
                  returnedQty: 0,
                  usedQty: 0,
                },
                tx,
              )
            ).id
          : (
              await this.repo.insertEquipmentItem(
                {
                  ...base,
                  type: 'EQUIPMENT',
                  equipmentCustodyId: source.equipmentCustodyId,
                  assetId: source.assetId,
                  assignmentId: source.assignmentId,
                  expectedPhysicalRevision:
                    facts.source.asset!.physicalRevision,
                  outcome: 'UNRESOLVED',
                  reportedCondition: null,
                },
                tx,
              )
            ).id;
      change = { version: 1, operation: 'ITEM_ADD' };
      count = (await this.repo.advanceRevision(c, root.revision, tx)).count;
    } else if (i.operation === 'CANCEL') {
      change = { version: 1, operation: 'CANCEL', reason: i.dto.reason.trim() };
      count = (await this.repo.cancelDraft(c, root.revision, change.reason, tx))
        .count;
    } else {
      const item = await this.repo.lockItem(c, tx);
      if (!item) reconciliationMissing(true);
      if (item.lifecycle !== 'ACTIVE')
        reconciliationConflict('CASE_RECONCILIATION_NOT_MUTABLE');
      itemId = item.id;
      if (i.operation === 'ITEM_EXCLUDE') {
        change = {
          version: 1,
          operation: 'ITEM_EXCLUDE',
          reason: i.dto.reason.trim(),
        };
        if ((await this.repo.excludeItem(c, change.reason, tx)).count !== 1)
          throw resourceStateChangedException();
      } else {
        if (
          root.dispatchId !== discoveredDispatchId ||
          item.sourceDispatchItemId !== discoveredSourceId
        )
          throw resourceStateChangedException();
        if (i.dto.type !== item.type) reconciliationSourceInvalid();
        const { source, state } = await this.admission(
          c,
          root.dispatchId,
          item.sourceDispatchItemId,
          tx,
        );
        if (i.dto.type === 'MATERIAL') {
          const returnedQty = i.dto.returnedQty!,
            usedQty = i.dto.usedQty!;
          if (
            state.type !== 'MATERIAL' ||
            BigInt(returnedQty) + BigInt(usedQty) > BigInt(state.unresolvedQty)
          )
            reconciliationCapacityExceeded();
          change = {
            version: 1,
            operation: 'OUTCOME_SET',
            type: 'MATERIAL',
            before: { returnedQty: item.returnedQty!, usedQty: item.usedQty! },
            after: { returnedQty, usedQty },
          };
          if (
            (
              await this.repo.setMaterialOutcome(
                c,
                returnedQty,
                usedQty,
                source.destinationPosition!.revision,
                tx,
              )
            ).count !== 1
          )
            throw resourceStateChangedException();
        } else {
          const outcome = i.dto.outcome!,
            reportedCondition = i.dto.reportedCondition!;
          change = {
            version: 1,
            operation: 'OUTCOME_SET',
            type: 'EQUIPMENT',
            before: {
              outcome: item.outcome!,
              reportedCondition: item.reportedCondition,
            },
            after: { outcome, reportedCondition },
          };
          if (
            (
              await this.repo.setEquipmentOutcome(
                c,
                outcome,
                reportedCondition,
                source.asset!.physicalRevision,
                tx,
              )
            ).count !== 1
          )
            throw resourceStateChangedException();
        }
      }
      count = (await this.repo.advanceRevision(c, root.revision, tx)).count;
    }
    if (count !== 1) throw resourceStateChangedException();
    return this.repo.appendAudit(c, root.revision, itemId, change, tx);
  }
}
