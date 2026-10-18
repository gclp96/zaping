import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { HealthcareCaseDispatchAudit, Prisma } from '@prisma/client';
import { EquipmentCustodyService } from '../../equipment/equipment-custody.service';
import { evaluateEquipmentPhysicalEligibility } from '../../equipment/equipment-physical-eligibility';
import { PhysicalInventoryService } from '../../inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../../inventory/physical/inventory-compatibility-projection.service';
import { InventoryAuthorityResolver } from '../../inventory/physical/inventory-authority-resolver';
import { inventoryAuthorityFence } from '../../inventory/physical/inventory-authority-fence';
import { InventoryRuntimeCompatibilityService } from '../../inventory/physical/inventory-runtime-compatibility.service';
import {
  InventoryAuthorityError,
  inventoryWriterError,
} from '../../inventory/physical/inventory-authority-error';
import { InventoryCutoverError } from '../../inventory/physical/inventory-cutover.contract';
import { PhysicalInventoryError } from '../../inventory/physical/physical-inventory.contract';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { HealthcareCompanyLockTimeoutError } from '../common/healthcare-company-lock-timeout.error';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import { classifyHealthcareTransactionError } from '../common/healthcare-transaction-error-classification';
import {
  caseNotEligibleException,
  caseKitPreparationBlockedException,
  equipmentAssetNotEligibleException,
  healthcareConcurrencyTimeoutException,
  healthcarePersistenceException,
  idempotencyKeyRequiredException,
  idempotencyKeyReusedException,
  invalidIdempotencyKeyException,
  resourceStateChangedException,
} from '../common/healthcare-errors';
import { evaluateHealthcareCaseKitReadiness } from '../case-kits/healthcare-case-kit-readiness';
import {
  deriveEquipmentAssignmentOperationalWindow,
  equipmentAssignmentWindowsOverlap,
  resolveEquipmentAssignmentBuffers,
} from '../equipment-assignments/healthcare-equipment-assignment-availability';
import { ConfirmHealthcareCaseDispatchDto } from './dto/confirm-healthcare-case-dispatch.dto';
import {
  ConfirmContext,
  DispatchItemEvidence,
  ConfirmItem,
  ConfirmKit,
  ConfirmRoot,
  HealthcareCaseDispatchConfirmRepository,
} from './healthcare-case-dispatch-confirm.repository';
import { DispatchCommandResult } from './healthcare-case-dispatch-command.types';
import {
  dispatchCapacityExceeded,
  dispatchConflict,
  dispatchMissing,
  invalidDispatchSource,
} from './healthcare-case-dispatch-command.errors';
import { createDispatchConfirmRequestHash } from './healthcare-case-dispatch-request-hash';
import { mapDispatchDetail } from './healthcare-case-dispatch.mapper';
import {
  DispatchItemHandoff,
  DispatchItemSnapshot,
  DispatchRootSnapshot,
} from './healthcare-case-dispatch.types';
import {
  parseDispatchAuditChange,
  parseDispatchItemSnapshot,
  parseDispatchRootSnapshot,
} from './healthcare-case-dispatch.snapshot';

type Tx = Prisma.TransactionClient;
const scope = 'HEALTHCARE_CASE_DISPATCH_CONFIRM' as const;
const json = (value: object) => value as unknown as Prisma.InputJsonValue;
export function assertDispatchTransferCount(count: number) {
  if (count > 1000) invalidDispatchSource();
}
@Injectable()
export class HealthcareCaseDispatchConfirmService {
  constructor(
    private readonly repo: HealthcareCaseDispatchConfirmRepository,
    private readonly physical: PhysicalInventoryService,
    private readonly projections: InventoryCompatibilityProjectionService,
    private readonly custody: EquipmentCustodyService,
    private readonly authority: InventoryAuthorityResolver,
    private readonly runtime: InventoryRuntimeCompatibilityService,
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly policy: ConfigType<
      typeof healthcareCompanyTransactionTimeoutConfiguration
    >,
  ) {}
  async execute(
    context: ConfirmContext,
    dto: ConfirmHealthcareCaseDispatchDto,
  ): Promise<DispatchCommandResult> {
    if (context.key === undefined) throw idempotencyKeyRequiredException();
    const key = context.key.trim();
    if (!key || key.length > 128) throw invalidIdempotencyKeyException();
    const c = { ...context, key },
      hash = createDispatchConfirmRequestHash(c, dto.expectedRevision);
    try {
      const replay = await this.replay(c, dto.expectedRevision, hash);
      if (replay) return replay;
      try {
        return await this.repo.commands.runInTransaction(async (tx) => {
          const hint = await this.repo.root(tx, c);
          if (!hint) dispatchMissing();
          const material = hint.items.some(
            (i) => i.lifecycle === 'ACTIVE' && i.type === 'MATERIAL',
          );
          if (material)
            await inventoryAuthorityFence(tx, c.companyId, 'shared');
          const claim = await this.repo.commands.createClaim(
            c,
            scope,
            hash,
            tx,
          );
          if (material) {
            // A persisted activation control is mandatory. Planning Positions
            // alone never confer PHYSICAL authority on a legacy Company.
            if (
              !(await tx.inventoryCutover.findUnique({
                where: { companyId: c.companyId },
              }))
            )
              throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
            const authority = await this.authority.resolve(tx, c.companyId);
            if (authority === 'LEGACY')
              throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
            if (authority === 'CUTOVER') {
              const control = await tx.inventoryCutover.findUnique({
                where: { companyId: c.companyId },
              });
              throw new InventoryAuthorityError(
                control?.status === 'RECOVERY_REQUIRED'
                  ? 'RECOVERY_REQUIRED'
                  : 'CUTOVER_FROZEN',
              );
            }
            this.runtime.identity();
          }
          await acquireHealthcareCompanyLock(tx, c.companyId, {
            acquisitionTimeoutMs: this.policy.companyLockAcquisitionTimeoutMs,
          });
          await applyHealthcareSubsequentTransactionTimeouts(tx, this.policy);
          const discovered = await this.repo.root(tx, c),
            discoveredKit = await this.repo.kit(tx, c);
          if (!discovered) dispatchMissing();
          if (!discoveredKit || discovered.caseKitId !== discoveredKit.id)
            invalidDispatchSource();
          const binding = this.repo.bindings(discovered, discoveredKit);
          const settings = await this.repo.lockCases(
            tx,
            c,
            this.repo.assetIds(discovered, discoveredKit),
          );
          await this.repo.lockStructure(tx, c, discovered, discoveredKit);
          // Abort a changing hint set BEFORE using it to authorize or discovering
          // extra roots later in the transaction.
          const locked = await this.repo.root(tx, c),
            lockedKit = await this.repo.kit(tx, c);
          if (
            !locked ||
            !lockedKit ||
            this.repo.bindings(locked, lockedKit) !== binding
          )
            throw resourceStateChangedException();
          this.assertRoot(locked, dto.expectedRevision);
          if (
            locked.items.some(
              (i) => i.lifecycle === 'ACTIVE' && i.type === 'MATERIAL',
            ) !== material
          )
            throw resourceStateChangedException();
          await this.repo.lockPhysical(tx, c, locked, lockedKit);
          const root = await this.repo.root(tx, c),
            kit = await this.repo.kit(tx, c);
          if (!root || !kit || this.repo.bindings(root, kit) !== binding)
            throw resourceStateChangedException();
          this.assertRoot(root, dto.expectedRevision);
          await this.validate(tx, c, root, kit, settings);
          const at = await this.repo.timestamp(tx);
          const actor = await tx.user.findFirst({
            where: {
              id: c.actorId,
              companyId: c.companyId,
              isActive: true,
              role: { in: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
            },
            select: { id: true, firstName: true, lastName: true },
          });
          if (!actor)
            throw new ForbiddenException(
              'No autorizado para confirmar despachos',
            );
          const snapshots = new Map(
            root.items.map((i) => [i.id, this.describe(i, at)]),
          );
          const rootSnapshot: DispatchRootSnapshot = {
            version: 1,
            case: {
              id: c.caseId,
              folio: root.healthcareCase.folio,
              scheduledStart: root.healthcareCase.scheduledStart!.toISOString(),
              scheduledEnd: root.healthcareCase.scheduledEnd!.toISOString(),
            },
            custodian: {
              type: root.custodianType,
              userId: root.custodianUserId,
              displayName: root.custodianDisplayName,
            },
            dispatchedBy: actor,
            dispatchedAt: at.toISOString(),
          };
          parseDispatchRootSnapshot(rootSnapshot);
          const audit = await this.repo.audit(tx, c, root.revision, at);
          const evidence = await this.transferQuantity(tx, c, root, snapshots);
          for (const item of root.items
            .filter((i) => i.lifecycle === 'ACTIVE' && i.type === 'EQUIPMENT')
            .sort((a, b) => a.assetId!.localeCompare(b.assetId!))) {
            const result = await this.custody.transferToCustody(tx, {
              companyId: c.companyId,
              caseId: c.caseId,
              assignmentId: item.assignmentId!,
              assetId: item.assetId!,
              actorId: c.actorId,
              expectedPhysicalRevision: item.expectedPhysicalRevision!,
              validatedContext: {
                adapterKey: 'CASE_DISPATCH_ITEM',
                contextId: item.id,
              },
              durableOrigin: {
                type: 'CASE_DISPATCH_ITEM',
                id: item.id,
                operation: 'CONFIRM_EQUIPMENT',
              },
            });
            if (result.outcome !== 'OPENED')
              throw healthcarePersistenceException();
            evidence.push({
              id: item.id,
              type: 'EQUIPMENT',
              equipmentCustodyId: result.custody.id,
              equipmentPhysicalEventId: result.event.id,
            });
            snapshots.get(item.id)!.handoff = {
              ...this.emptyHandoff(),
              assignmentId: item.assignmentId,
              assetId: item.assetId,
              physicalRevisionBefore: item.expectedPhysicalRevision,
              physicalRevisionAfter: result.event.revisionAfter,
              equipmentCustodyId: result.custody.id,
              equipmentPhysicalEventId: result.event.id,
              conditionBefore: item.asset!.condition,
              lifecycleBefore: item.asset!.lifecycle,
              locationBefore: item.asset!.physicalLocation,
            };
          }
          await this.repo.itemEvidenceBulk(tx, c, evidence);
          for (const item of root.items) {
            const snapshot = snapshots.get(item.id)!;
            parseDispatchItemSnapshot(snapshot);
          }
          await this.repo.itemSnapshotsBulk(
            tx,
            c,
            root.items.map((item) => ({
              id: item.id,
              lifecycle: item.lifecycle,
              snapshot: snapshots.get(item.id)!,
            })),
          );
          this.requireOne(
            await this.repo.finalize(
              tx,
              c,
              root.revision,
              at,
              json(rootSnapshot),
            ),
          );
          await this.repo.commands.completeClaim(claim.id, root.id, tx);
          // Flush only constraints touched by Confirm after every staging write.
          // Keep deferred CPU work under the existing statement_timeout.
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "InventoryPhysicalEffectLine_complete" IMMEDIATE',
          );
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "InventoryPhysicalEffect_complete" IMMEDIATE',
          );
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "Dispatch_local_state", "Dispatch_item_final_state", "Dispatch_final_state", "Dispatch_insert_final_state", "Dispatch_idempotency_resource", "EquipmentAsset_custody_coherence", "EquipmentAssetCustody_coherence" IMMEDIATE',
          );
          return this.result(tx, c, audit, false);
        }, this.policy);
      } catch (error) {
        if (this.claimConflict(error)) {
          const winner = await this.replay(c, dto.expectedRevision, hash);
          if (winner) return winner;
          throw healthcarePersistenceException();
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof InventoryCutoverError)
        throw new InventoryAuthorityError('RECOVERY_REQUIRED');
      if (error instanceof PhysicalInventoryError) inventoryWriterError(error);
      if (
        error instanceof HealthcareCompanyLockTimeoutError ||
        classifyHealthcareTransactionError(error, 'subsequent-operation')
      )
        throw healthcareConcurrencyTimeoutException();
      throw healthcarePersistenceException();
    }
  }
  private assertRoot(root: ConfirmRoot, revision: number) {
    if (root.revision !== revision) throw resourceStateChangedException();
    if (root.status !== 'DRAFT')
      dispatchConflict(
        'CASE_DISPATCH_NOT_MUTABLE',
        'El despacho no admite confirmación',
      );
  }
  private async validate(
    tx: Tx,
    c: ConfirmContext,
    root: ConfirmRoot,
    kit: ConfirmKit,
    settings: {
      preCaseBufferMinutes: number;
      postCaseBufferMinutes: number;
    } | null,
  ) {
    const parent = root.healthcareCase;
    if (
      parent.status !== 'SCHEDULED' ||
      !parent.scheduledStart ||
      !parent.scheduledEnd ||
      parent.scheduledEnd <= parent.scheduledStart
    )
      throw caseNotEligibleException();
    if (
      kit.id !== root.caseKitId ||
      kit.caseId !== c.caseId ||
      kit.status !== 'PREPARED'
    )
      invalidDispatchSource();
    const readiness = evaluateHealthcareCaseKitReadiness(kit);
    if (readiness.status !== 'PASS')
      throw caseKitPreparationBlockedException(readiness.blockers);
    const active = root.items.filter((i) => i.lifecycle === 'ACTIVE'),
      material = active.filter((i) => i.type === 'MATERIAL');
    if (!active.length) invalidDispatchSource();
    assertDispatchTransferCount(material.length);
    if (
      !root.custodianDisplayName.trim() ||
      root.custodianDisplayName !== root.custodianDisplayName.trim() ||
      (root.custodianType === 'EXTERNAL_PERSON' &&
        root.custodianUserId !== null)
    )
      invalidDispatchSource();
    const positions = await tx.inventoryPosition.findMany({
      where: {
        companyId: c.companyId,
        id: { in: material.map((i) => i.sourcePositionId!) },
      },
    });
    const totals = new Map<string, number>(),
      prepared = new Map<string, number>();
    const reservations =
      await this.repo.assignments.findReservedAssignmentsForAssets(
        c.companyId,
        active.flatMap((i) => (i.assetId ? [i.assetId] : [])),
        tx,
      );
    const buffers = resolveEquipmentAssignmentBuffers(settings),
      candidate = deriveEquipmentAssignmentOperationalWindow(parent, buffers)!;
    for (const item of active) {
      const source = item.sourceCaseKitItem;
      if (
        source.companyId !== c.companyId ||
        source.caseId !== c.caseId ||
        source.caseKitId !== kit.id ||
        source.lifecycle !== 'ACTIVE' ||
        !item.product.isActive
      )
        invalidDispatchSource();
      if (item.type === 'MATERIAL') {
        const position = positions.find((p) => p.id === item.sourcePositionId),
          batch = item.batch;
        if (
          !source.requirement ||
          source.equipmentAssignmentId ||
          source.requirement.lifecycle !== 'ACTIVE' ||
          source.requirement.productId !== item.productId ||
          !source.preparedQuantity ||
          !item.quantity ||
          item.product.inventoryTracking !== 'QUANTITY' ||
          !position ||
          position.productId !== item.productId ||
          position.inventoryBatchId !== item.batchId ||
          position.state !== 'AVAILABLE' ||
          position.contextType !== null ||
          position.contextId !== null
        )
          invalidDispatchSource();
        if (position.revision !== item.expectedPositionRevision)
          throw resourceStateChangedException();
        if (
          (item.product.lotTracking === 'NONE' && item.batchId !== null) ||
          (item.product.lotTracking === 'REQUIRED' && item.batchId === null) ||
          (item.batchId &&
            (!batch ||
              batch.companyId !== c.companyId ||
              batch.productId !== item.productId ||
              !batch.isActive ||
              (batch.expirationDate && batch.expirationDate <= new Date())))
        )
          invalidDispatchSource();
        totals.set(position.id, (totals.get(position.id) ?? 0) + item.quantity);
        prepared.set(source.id, (prepared.get(source.id) ?? 0) + item.quantity);
      } else {
        const assignment = item.assignment,
          asset = item.asset;
        if (
          item.product.inventoryTracking !== 'ASSET' ||
          source.requirementId ||
          source.equipmentAssignmentId !== item.assignmentId ||
          !assignment ||
          assignment.companyId !== c.companyId ||
          assignment.caseId !== c.caseId ||
          assignment.equipmentAssetId !== item.assetId ||
          assignment.lifecycle !== 'RESERVED' ||
          !asset ||
          asset.companyId !== c.companyId ||
          asset.productId !== item.productId
        )
          invalidDispatchSource();
        if (
          asset.physicalRevision !== item.expectedPhysicalRevision ||
          asset.physicalRevision >= 2147483647
        )
          throw resourceStateChangedException();
        const eligibility = evaluateEquipmentPhysicalEligibility(asset);
        if (!eligibility.available)
          throw equipmentAssetNotEligibleException(eligibility.reasons);
        const others = reservations.filter(
          (r) => r.equipmentAssetId === asset.id && r.id !== assignment.id,
        );
        for (const other of others) {
          const window = deriveEquipmentAssignmentOperationalWindow(
            other.healthcareCase,
            buffers,
          );
          if (!window || equipmentAssignmentWindowsOverlap(candidate, window))
            invalidDispatchSource();
        }
        if (await this.repo.equipmentConsumed(tx, c, source.id))
          dispatchCapacityExceeded();
      }
    }
    for (const [id, quantity] of totals)
      if (quantity > positions.find((p) => p.id === id)!.quantity)
        dispatchCapacityExceeded();
    for (const [sourceId, quantity] of prepared) {
      const source = material.find(
        (i) => i.sourceCaseKitItemId === sourceId,
      )!.sourceCaseKitItem;
      if (
        quantity + (await this.repo.materialConsumed(tx, c, sourceId)) >
        source.preparedQuantity!
      )
        dispatchCapacityExceeded();
    }
  }
  private async transferQuantity(
    tx: Tx,
    c: ConfirmContext,
    root: ConfirmRoot,
    snapshots: Map<string, DispatchItemSnapshot>,
  ) {
    const material = root.items.filter(
      (i) => i.lifecycle === 'ACTIVE' && i.type === 'MATERIAL',
    );
    const evidence: DispatchItemEvidence[] = [];
    if (!material.length) return evidence;
    const result = await this.physical.transfer(
      tx,
      {
        companyId: c.companyId,
        actorId: c.actorId,
        origin: {
          type: 'CASE_DISPATCH',
          id: root.id,
          operation: 'CONFIRM_QUANTITY',
        },
      },
      material.map((i) => ({
        sourceId: i.sourcePositionId!,
        quantity: i.quantity!,
        expectedSourceRevision: i.expectedPositionRevision!,
        target: {
          productId: i.productId,
          inventoryBatchId: i.batchId,
          state: 'CUSTODY',
          contextType: 'CASE_DISPATCH_ITEM',
          contextId: i.id,
        },
      })),
    );
    if (result.replay) throw healthcarePersistenceException();
    await this.projections.apply(tx, c.companyId, result);
    const destinations = await tx.inventoryPosition.findMany({
      where: {
        companyId: c.companyId,
        id: { in: result.effect.lines.map((l) => l.positionId) },
        state: 'CUSTODY',
        contextType: 'CASE_DISPATCH_ITEM',
        contextId: { in: material.map((i) => i.id) },
      },
    });
    if (destinations.length !== material.length)
      throw healthcarePersistenceException();
    for (const item of material) {
      const target = destinations.find((p) => p.contextId === item.id);
      if (
        !target ||
        target.productId !== item.productId ||
        target.inventoryBatchId !== item.batchId ||
        !result.effect.lines.some(
          (l) => l.positionId === target.id && l.delta === item.quantity,
        )
      )
        throw healthcarePersistenceException();
      evidence.push({
        id: item.id,
        type: 'MATERIAL',
        destinationPositionId: target.id,
        physicalEffectId: result.effect.id,
      });
      snapshots.get(item.id)!.handoff = {
        ...this.emptyHandoff(),
        quantity: item.quantity,
        sourcePositionId: item.sourcePositionId,
        sourceRevision: item.expectedPositionRevision,
        destinationPositionId: target.id,
        physicalEffectId: result.effect.id,
      };
    }
    return evidence;
  }
  private emptyHandoff(): DispatchItemHandoff {
    return {
      quantity: null,
      sourcePositionId: null,
      sourceRevision: null,
      destinationPositionId: null,
      physicalEffectId: null,
      assignmentId: null,
      assetId: null,
      physicalRevisionBefore: null,
      physicalRevisionAfter: null,
      equipmentCustodyId: null,
      equipmentPhysicalEventId: null,
      conditionBefore: null,
      lifecycleBefore: null,
      locationBefore: null,
    };
  }
  private describe(item: ConfirmItem, at: Date): DispatchItemSnapshot {
    return {
      version: 1,
      capturedAt: at.toISOString(),
      handoff: null,
      product: {
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        inventoryTracking: item.product.inventoryTracking,
        lotTracking: item.product.lotTracking,
      },
      preparation: {
        sourceCaseKitItemId: item.sourceCaseKitItemId,
        requirementId: item.sourceCaseKitItem.requirementId,
        assignmentId: item.assignmentId,
        preparedQuantity: item.sourceCaseKitItem.preparedQuantity,
      },
      batch: item.batch
        ? {
            id: item.batch.id,
            lotNumber: item.batch.lotNumber,
            expirationDate: item.batch.expirationDate?.toISOString() ?? null,
          }
        : null,
      equipment: item.asset
        ? {
            id: item.asset.id,
            assetCode: item.asset.assetCode,
            serialNumber: item.asset.serialNumber,
          }
        : null,
    };
  }
  private requireOne(result: Prisma.BatchPayload) {
    if (result.count !== 1) throw resourceStateChangedException();
  }
  private claimConflict(error: unknown) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    )
      return false;
    const target = error.meta?.target;
    return Array.isArray(target)
      ? ['companyId', 'scope', 'key'].every((k) => target.includes(k))
      : typeof target === 'string' &&
          target.includes('IdempotencyRecord') &&
          target.includes('scope');
  }
  private replay(c: ConfirmContext, revision: number, hash: string) {
    return this.repo.commands.runInReadSnapshot(async (tx) => {
      const record = await this.repo.commands.findClaim(c, scope, tx);
      if (!record) return null;
      if (record.requestHash !== hash) throw idempotencyKeyReusedException();
      if (record.resourceId !== c.dispatchId)
        throw healthcarePersistenceException();
      const root = await this.repo.root(tx, c),
        audit = await this.repo.commands.findWitness(
          c.companyId,
          c.dispatchId,
          revision + 1,
          tx,
        );
      if (
        !root ||
        root.status !== 'CONFIRMED' ||
        root.confirmedFromRevision !== revision ||
        root.revision !== revision + 1 ||
        !audit ||
        audit.operation !== 'CONFIRM' ||
        audit.dispatchItemId !== null ||
        audit.revisionBefore !== revision ||
        audit.actorId !== root.confirmedById ||
        audit.createdAt.getTime() !== root.confirmedAt?.getTime()
      )
        throw healthcarePersistenceException();
      const change = parseDispatchAuditChange(audit.change, 'CONFIRM');
      if (change.reason !== null) throw healthcarePersistenceException();
      return this.result(tx, c, audit, true);
    });
  }
  private async result(
    tx: Tx,
    c: ConfirmContext,
    audit: HealthcareCaseDispatchAudit,
    replay: boolean,
  ): Promise<DispatchCommandResult> {
    const detail = await this.repo.commands.detail(c, c.dispatchId, tx);
    if (!detail) throw healthcarePersistenceException();
    return {
      replay,
      command: {
        auditId: audit.id,
        operation: 'CONFIRM',
        dispatchId: c.dispatchId,
        itemId: null,
        revisionBefore: audit.revisionBefore,
        revisionAfter: audit.revisionAfter,
        actorId: audit.actorId,
        occurredAt: audit.createdAt.toISOString(),
      },
      data: mapDispatchDetail(detail),
    };
  }
}
