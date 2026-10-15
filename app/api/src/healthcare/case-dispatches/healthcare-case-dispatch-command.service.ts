import { HealthcareCaseKitRecord } from '../case-kits/healthcare-case-kits.repository';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  IdempotencyScope,
  Prisma,
  HealthcareCaseDispatchAudit,
} from '@prisma/client';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import {
  caseNotFoundException,
  caseNotEligibleException,
  caseKitNotFoundException,
  caseKitPreparationBlockedException,
  healthcarePersistenceException,
  healthcareConcurrencyTimeoutException,
  idempotencyKeyReusedException,
  idempotencyKeyRequiredException,
  invalidIdempotencyKeyException,
  resourceStateChangedException,
  equipmentAssetNotEligibleException,
} from '../common/healthcare-errors';
import { classifyHealthcareTransactionError } from '../common/healthcare-transaction-error-classification';
import { evaluateHealthcareCaseKitReadiness } from '../case-kits/healthcare-case-kit-readiness';
import { evaluateEquipmentPhysicalEligibility } from '../../equipment/equipment-physical-eligibility';
import { HealthcareCaseDispatchCommandRepository } from './healthcare-case-dispatch-command.repository';
import {
  DispatchCommandContext,
  DispatchCommandIntent,
  DispatchCommandResult,
  DraftOperation,
} from './healthcare-case-dispatch-command.types';
import {
  createDispatchRequestHash,
  normalizeDispatchCustodian,
} from './healthcare-case-dispatch-request-hash';
import {
  dispatchConflict,
  dispatchMissing,
  invalidDispatchSource,
  dispatchCapacityExceeded,
} from './healthcare-case-dispatch-command.errors';
import { mapDispatchDetail } from './healthcare-case-dispatch.mapper';
import { parseDispatchAuditChange } from './healthcare-case-dispatch.snapshot';
import { DispatchCustodianDto } from './dto/create-healthcare-case-dispatch.dto';
import { AddHealthcareCaseDispatchItemDto } from './dto/add-healthcare-case-dispatch-item.dto';
type Tx = Prisma.TransactionClient;
const scopes: Record<DraftOperation, IdempotencyScope> = {
  CREATE: 'HEALTHCARE_CASE_DISPATCH_CREATE',
  CUSTODIAN_SET: 'HEALTHCARE_CASE_DISPATCH_CUSTODIAN_SET',
  ITEM_ADD: 'HEALTHCARE_CASE_DISPATCH_ITEM_ADD',
  ITEM_EXCLUDE: 'HEALTHCARE_CASE_DISPATCH_ITEM_EXCLUDE',
  CANCEL: 'HEALTHCARE_CASE_DISPATCH_CANCEL',
};
@Injectable()
export class HealthcareCaseDispatchCommandService {
  constructor(
    private readonly repo: HealthcareCaseDispatchCommandRepository,
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly policy: ConfigType<
      typeof healthcareCompanyTransactionTimeoutConfiguration
    >,
  ) {}
  async execute(
    context: DispatchCommandContext,
    intent: DispatchCommandIntent,
  ): Promise<DispatchCommandResult> {
    if (context.key === undefined) throw idempotencyKeyRequiredException();
    const key = context.key.trim();
    if (!key || key.length > 128) throw invalidIdempotencyKeyException();
    const c = { ...context, key },
      hash = createDispatchRequestHash(c, intent),
      scope = scopes[intent.operation];
    try {
      const replay = await this.replay(c, intent, hash, scope);
      if (replay) return replay;
      try {
        return await this.repo.runInTransaction(async (tx) => {
          const claim = await this.repo.createClaim(c, scope, hash, tx);
          const result = await this.mutate(c, intent, tx);
          await this.repo.completeClaim(
            claim.id,
            result.command.itemId ?? result.command.dispatchId,
            tx,
          );
          return result;
        }, this.policy);
      } catch (e) {
        if (this.isClaimConflict(e)) {
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
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        dispatchConflict(
          'CASE_DISPATCH_SOURCE_ALREADY_REPRESENTED',
          'Fuente ya representada en el despacho',
        );
      throw healthcarePersistenceException();
    }
  }
  private isClaimConflict(e: unknown) {
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError) ||
      e.code !== 'P2002'
    )
      return false;
    const target = e.meta?.target;
    return Array.isArray(target)
      ? ['companyId', 'scope', 'key'].every((k) => target.includes(k))
      : typeof target === 'string' &&
          target.includes('IdempotencyRecord') &&
          target.includes('scope');
  }
  private replay(
    c: DispatchCommandContext,
    i: DispatchCommandIntent,
    hash: string,
    scope: IdempotencyScope,
  ) {
    return this.repo.runInReadSnapshot(async (tx) => {
      const record = await this.repo.findClaim(c, scope, tx);
      if (!record) return null;
      if (record.requestHash !== hash) throw idempotencyKeyReusedException();
      if (!record.resourceId) throw healthcarePersistenceException();
      let id = record.resourceId,
        itemId: string | null = null;
      if (i.operation === 'ITEM_ADD' || i.operation === 'ITEM_EXCLUDE') {
        const item = await this.repo.findReplayItem(
          c.companyId,
          record.resourceId,
          tx,
        );
        if (
          !item ||
          item.caseId !== c.caseId ||
          item.dispatchId !== c.dispatchId ||
          (i.operation === 'ITEM_EXCLUDE' && item.id !== c.itemId)
        )
          throw healthcarePersistenceException();
        id = item.dispatchId;
        itemId = item.id;
      } else if (i.operation !== 'CREATE' && id !== c.dispatchId)
        throw healthcarePersistenceException();
      const revision =
        i.operation === 'CREATE' ? 0 : i.dto.expectedRevision + 1;
      const audit = await this.repo.findWitness(c.companyId, id, revision, tx);
      if (
        !audit ||
        audit.operation !== i.operation ||
        audit.dispatchItemId !== itemId ||
        audit.revisionBefore !==
          (i.operation === 'CREATE' ? null : i.dto.expectedRevision)
      )
        throw healthcarePersistenceException();
      const change = parseDispatchAuditChange(audit.change, audit.operation);
      if (
        (i.operation === 'CANCEL' || i.operation === 'ITEM_EXCLUDE') &&
        change.reason !== i.dto.reason.trim()
      )
        throw healthcarePersistenceException();
      return this.result(c, id, audit, true, tx);
    });
  }
  private async result(
    c: DispatchCommandContext,
    id: string,
    a: HealthcareCaseDispatchAudit,
    replay: boolean,
    tx: Tx,
  ): Promise<DispatchCommandResult> {
    const row = await this.repo.detail(c, id, tx);
    if (!row) throw healthcarePersistenceException();
    return {
      replay,
      command: {
        auditId: a.id,
        operation: a.operation as DraftOperation,
        dispatchId: id,
        itemId: a.dispatchItemId,
        revisionBefore: a.revisionBefore,
        revisionAfter: a.revisionAfter,
        actorId: a.actorId,
        occurredAt: a.createdAt.toISOString(),
      },
      data: mapDispatchDetail(row),
    };
  }
  private async custodian(
    c: DispatchCommandContext,
    value: DispatchCustodianDto,
    tx: Tx,
  ) {
    const u = normalizeDispatchCustodian(value);
    if (
      u.userId &&
      !(await this.repo.findCustodianUser(c.companyId, u.userId, tx))
    )
      invalidDispatchSource();
    return u;
  }
  private async planning(c: DispatchCommandContext, tx: Tx) {
    await this.repo.lockCaseForShare(c.companyId, c.caseId, tx);
    const parent = await this.repo.findCase(c, tx);
    if (!parent) throw caseNotFoundException();
    let kit = await this.repo.findKit(c, tx);
    if (!kit) throw caseKitNotFoundException();
    await this.repo.lockSources(
      'HealthcareCaseKit',
      [kit.id],
      c.companyId,
      tx,
      true,
    );
    kit = await this.repo.findKit(c, tx);
    if (!kit) invalidDispatchSource();
    return kit;
  }
  private assertPlanning(kit: HealthcareCaseKitRecord) {
    const parent = kit.healthcareCase;
    if (
      parent.status !== 'SCHEDULED' ||
      !parent.scheduledStart ||
      !parent.scheduledEnd ||
      parent.scheduledEnd <= parent.scheduledStart
    )
      throw caseNotEligibleException();
    if (kit.status !== 'PREPARED') invalidDispatchSource();
  }
  private async mutate(
    c: DispatchCommandContext,
    i: DispatchCommandIntent,
    tx: Tx,
  ): Promise<DispatchCommandResult> {
    if (i.operation === 'CREATE') {
      let kit = await this.planning(c, tx);
      this.assertPlanning(kit);
      const discovered = this.readinessBindings(kit);
      await this.repo.lockReadiness(kit, c, tx);
      kit = (await this.repo.findKit(c, tx))!;
      if (!kit || this.readinessBindings(kit) !== discovered)
        throw resourceStateChangedException();
      this.assertPlanning(kit);
      const readiness = evaluateHealthcareCaseKitReadiness(kit);
      if (readiness.status !== 'PASS')
        throw caseKitPreparationBlockedException(readiness.blockers);
      await this.custodian(c, i.dto.custodian, tx);
      const root = await this.repo.createDraft(c, kit.id, i.dto.custodian, tx),
        own = { ...c, dispatchId: root.id };
      const audit = await this.repo.appendAudit(
        own,
        'CREATE',
        null,
        null,
        null,
        tx,
      );
      return this.result(own, root.id, audit, false, tx);
    }
    if (i.operation === 'ITEM_ADD' && !(await this.repo.findIdentity(c, tx)))
      dispatchMissing();
    const kit = i.operation === 'ITEM_ADD' ? await this.planning(c, tx) : null;
    const root = await this.repo.lockDraftById(c, tx);
    if (!root) dispatchMissing();
    // Revision takes precedence for competing commands against the same observed state.
    if (root.revision !== i.dto.expectedRevision)
      throw resourceStateChangedException();
    if (root.status !== 'DRAFT')
      dispatchConflict(
        'CASE_DISPATCH_NOT_MUTABLE',
        'El despacho no admite cambios',
      );
    let itemId: string | null = null,
      reason: string | null = null,
      count: number;
    switch (i.operation) {
      case 'CUSTODIAN_SET':
        await this.custodian(c, i.dto.custodian, tx);
        count = (
          await this.repo.setCustodianWithExpectedRevision(
            c,
            root.revision,
            i.dto.custodian,
            tx,
          )
        ).count;
        break;
      case 'ITEM_ADD': {
        if (!kit || kit.id !== root.caseKitId) invalidDispatchSource();
        this.assertPlanning(kit);
        itemId = await this.add(c, kit.id, i.dto, tx);
        count = (await this.repo.advanceItemRevision(c, root.revision, tx))
          .count;
        break;
      }
      case 'ITEM_EXCLUDE': {
        const item = await this.repo.lockItem(c, tx);
        if (!item) dispatchMissing(true);
        if (item.lifecycle !== 'ACTIVE')
          dispatchConflict(
            'CASE_DISPATCH_ITEM_ALREADY_EXCLUDED',
            'El contenido ya está excluido',
          );
        reason = i.dto.reason.trim();
        if (
          (await this.repo.excludeItemWithExpectedRevision(c, reason, tx))
            .count !== 1
        )
          throw resourceStateChangedException();
        itemId = item.id;
        count = (await this.repo.advanceItemRevision(c, root.revision, tx))
          .count;
        break;
      }
      case 'CANCEL':
        reason = i.dto.reason.trim();
        count = (
          await this.repo.cancelDraftWithExpectedRevision(
            c,
            root.revision,
            reason,
            tx,
          )
        ).count;
        break;
    }
    if (count !== 1) throw resourceStateChangedException();
    const audit = await this.repo.appendAudit(
      c,
      i.operation,
      root.revision,
      reason,
      itemId,
      tx,
    );
    return this.result(c, root.id, audit, false, tx);
  }
  private async add(
    c: DispatchCommandContext,
    kitId: string,
    d: AddHealthcareCaseDispatchItemDto,
    tx: Tx,
  ) {
    await this.repo.lockSources(
      'HealthcareCaseKitItem',
      [d.sourceCaseKitItemId],
      c.companyId,
      tx,
    );
    let source = await this.repo.findSource(
      c,
      kitId,
      d.sourceCaseKitItemId,
      tx,
    );
    if (!source || source.lifecycle !== 'ACTIVE') invalidDispatchSource();
    const base = {
      companyId: c.companyId,
      dispatchId: c.dispatchId!,
      caseId: c.caseId,
      caseKitId: kitId,
      sourceCaseKitItemId: source.id,
      addedById: c.actorId,
    };
    if (d.type === 'MATERIAL') {
      if (!source.requirement || source.equipmentAssignmentId)
        invalidDispatchSource();
      await this.repo.lockSources(
        'HealthcareCaseRequirement',
        [source.requirement.id],
        c.companyId,
        tx,
      );
      source = (await this.repo.findSource(
        c,
        kitId,
        d.sourceCaseKitItemId,
        tx,
      ))!;
      if (
        !source.requirement ||
        source.requirement.lifecycle !== 'ACTIVE' ||
        !source.preparedQuantity
      )
        invalidDispatchSource();
      const productId = source.requirement.productId;
      await this.repo.lockSources('Product', [productId], c.companyId, tx);
      const product = await this.repo.findProduct(c.companyId, productId, tx);
      if (
        !product ||
        !product.isActive ||
        product.inventoryTracking !== 'QUANTITY'
      )
        invalidDispatchSource();
      const batchId = d.batchId!;
      if (
        (product.lotTracking === 'NONE' && batchId !== null) ||
        (product.lotTracking === 'REQUIRED' && batchId === null)
      )
        invalidDispatchSource();
      if (batchId) {
        await this.repo.lockSources(
          'InventoryBatch',
          [batchId],
          c.companyId,
          tx,
        );
        const batch = await this.repo.findBatch(c.companyId, batchId, tx);
        if (
          !batch ||
          batch.productId !== productId ||
          !batch.isActive ||
          (batch.expirationDate && batch.expirationDate <= new Date())
        )
          invalidDispatchSource();
      }
      await this.repo.lockSources(
        'InventoryPosition',
        [d.sourcePositionId!],
        c.companyId,
        tx,
      );
      const p = await this.repo.findPosition(
        c.companyId,
        d.sourcePositionId!,
        tx,
      );
      if (
        !p ||
        p.productId !== productId ||
        p.inventoryBatchId !== batchId ||
        p.state !== 'AVAILABLE' ||
        p.contextType !== null ||
        p.contextId !== null
      )
        invalidDispatchSource();
      const capacity = await this.repo.materialCapacity(c, source.id, p.id, tx);
      if (
        capacity.confirmed + capacity.local + d.quantity! >
          source.preparedQuantity ||
        capacity.position + d.quantity! > p.quantity
      )
        dispatchCapacityExceeded();
      if (await this.repo.localSource(c, source.id, p.id, null, tx))
        dispatchConflict(
          'CASE_DISPATCH_SOURCE_ALREADY_REPRESENTED',
          'Fuente ya representada en el despacho',
        );
      return (
        await this.repo.insertMaterialItem(
          {
            ...base,
            type: 'MATERIAL',
            productId,
            quantity: d.quantity,
            sourcePositionId: p.id,
            batchId,
            expectedPositionRevision: p.revision,
          },
          tx,
        )
      ).id;
    }
    if (!source.equipmentAssignment || source.requirementId)
      invalidDispatchSource();
    // Discovery is only a lock-set hint. Never authorize from this snapshot or
    // acquire a different physical root after the canonical locks below.
    const discoveredAssignment = source.equipmentAssignment;
    const before = await this.repo.findAsset(
      c.companyId,
      discoveredAssignment.equipmentAssetId,
      tx,
    );
    if (!before) invalidDispatchSource();
    await this.repo.lockProductForKeyShare(c.companyId, before.productId, tx);
    await this.repo.lockAssetsForShare(c.companyId, [before.id], tx);
    await this.repo.lockAssignmentsForShare(
      c.companyId,
      [discoveredAssignment.id],
      tx,
    );
    source = (await this.repo.findSource(c, kitId, d.sourceCaseKitItemId, tx))!;
    const assignment = source?.equipmentAssignment;
    if (
      !source ||
      source.lifecycle !== 'ACTIVE' ||
      source.requirementId ||
      !assignment ||
      assignment.id !== discoveredAssignment.id ||
      assignment.equipmentAssetId !== before.id ||
      assignment.lifecycle !== 'RESERVED' ||
      assignment.companyId !== c.companyId ||
      assignment.caseId !== c.caseId
    )
      invalidDispatchSource();
    const asset = await this.repo.findAsset(c.companyId, before.id, tx),
      product = await this.repo.findProduct(c.companyId, before.productId, tx);
    if (
      !asset ||
      asset.productId !== before.productId ||
      !product ||
      !product.isActive ||
      product.inventoryTracking !== 'ASSET'
    )
      invalidDispatchSource();
    const currentKit = await this.repo.findKit(c, tx);
    if (!currentKit || currentKit.id !== kitId) invalidDispatchSource();
    this.assertPlanning(currentKit);
    // This root is already held FOR UPDATE by mutate(); rereading cannot add a
    // new lock dependency and keeps every admission fact after physical locks.
    const currentRoot = await this.repo.lockDraftById(c, tx);
    if (!currentRoot) dispatchMissing();
    if (currentRoot.revision !== d.expectedRevision)
      throw resourceStateChangedException();
    if (currentRoot.status !== 'DRAFT')
      dispatchConflict(
        'CASE_DISPATCH_NOT_MUTABLE',
        'El despacho no admite cambios',
      );
    if (currentRoot.caseKitId !== kitId) invalidDispatchSource();
    const eligibility = evaluateEquipmentPhysicalEligibility(asset);
    if (!eligibility.available)
      throw equipmentAssetNotEligibleException(eligibility.reasons);
    if (await this.repo.equipmentConsumed(c.companyId, source.id, tx))
      dispatchCapacityExceeded();
    if (await this.repo.localSource(c, source.id, null, asset.id, tx))
      dispatchConflict(
        'CASE_DISPATCH_SOURCE_ALREADY_REPRESENTED',
        'Fuente ya representada en el despacho',
      );
    return (
      await this.repo.insertEquipmentItem(
        {
          ...base,
          type: 'EQUIPMENT',
          productId: product.id,
          assignmentId: assignment.id,
          assetId: asset.id,
          expectedPhysicalRevision: asset.physicalRevision,
        },
        tx,
      )
    ).id;
  }
  private readinessBindings(kit: HealthcareCaseKitRecord) {
    return JSON.stringify({
      kit: kit.id,
      requirements: kit.healthcareCase.requirements.map((r) => r.id).sort(),
      sources: kit.items
        .filter((i) => i.lifecycle === 'ACTIVE')
        .map((i) => [
          i.id,
          i.requirementId,
          i.requirement?.productId,
          i.equipmentAssignmentId,
          i.equipmentAssignment?.equipmentAsset.id,
          i.equipmentAssignment?.equipmentAsset.product.id,
        ])
        .sort(),
    });
  }
}
