import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { HealthcareCaseReconciliationAudit, Prisma } from '@prisma/client';
import { EquipmentCustodyCloseService } from '../../equipment/equipment-custody-close.service';
import { EquipmentPhysicalError } from '../../equipment/equipment-physical.contract';
import { InventoryAuthorityResolver } from '../../inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../../inventory/physical/inventory-runtime-compatibility.service';
import {
  InventoryAuthorityError,
  inventoryWriterError,
} from '../../inventory/physical/inventory-authority-error';
import { InventoryCutoverError } from '../../inventory/physical/inventory-cutover.contract';
import { inventoryAuthorityFence } from '../../inventory/physical/inventory-authority-fence';
import { PhysicalInventoryService } from '../../inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../../inventory/physical/inventory-compatibility-projection.service';
import {
  PhysicalInventoryError,
  PhysicalResult,
} from '../../inventory/physical/physical-inventory.contract';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../common/healthcare-company-transaction-timeout.config';
import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';
import { HealthcareCompanyLockTimeoutError } from '../common/healthcare-company-lock-timeout.error';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import { classifyHealthcareTransactionError } from '../common/healthcare-transaction-error-classification';
import {
  healthcareConcurrencyTimeoutException,
  healthcarePersistenceException,
  idempotencyKeyRequiredException,
  invalidIdempotencyKeyException,
  idempotencyKeyReusedException,
  resourceStateChangedException,
} from '../common/healthcare-errors';
import {
  reconciliationMissing,
  reconciliationConflict,
  reconciliationSourceInvalid,
  reconciliationCapacityExceeded,
} from './healthcare-case-reconciliation-command.errors';
import { ConfirmHealthcareCaseReconciliationDto } from './dto/confirm-healthcare-case-reconciliation.dto';
import {
  HealthcareCaseReconciliationConfirmRepository,
  ReconciliationConfirmContext as Context,
  ReconciliationConfirmRoot as Root,
  ReconciliationConfirmItem as Item,
} from './healthcare-case-reconciliation-confirm.repository';
import { ReconciliationCommandResult } from './healthcare-case-reconciliation-command.types';
import { createReconciliationConfirmRequestHash } from './healthcare-case-reconciliation-request-hash';
import { deriveReconciliationSummary } from './healthcare-case-reconciliation-summary';
import { mapReconciliationDetail } from './healthcare-case-reconciliation.mapper';
import {
  EquipmentObservation,
  MaterialResult,
  ReconciliationItemSnapshot,
  ReconciliationRootSnapshot,
} from './healthcare-case-reconciliation.types';
import {
  parseReconciliationAuditChange,
  parseReconciliationItemSnapshot,
  parseReconciliationRootSnapshot,
} from './healthcare-case-reconciliation.snapshot';
import {
  parseDispatchItemSnapshot,
  parseDispatchRootSnapshot,
} from '../case-dispatches/healthcare-case-dispatch.snapshot';
import { AdmissionSource } from './healthcare-case-reconciliation-command.repository';

type Tx = Prisma.TransactionClient;
const scope = 'HEALTHCARE_CASE_RECONCILIATION_CONFIRM' as const;
const json = (v: object) => v as unknown as Prisma.InputJsonValue;
export function assertReconciliationPhysicalCallLimits(
  items: readonly {
    lifecycle: string;
    type: string;
    returnedQty: number | null;
    usedQty: number | null;
  }[],
): void {
  for (const key of ['returnedQty', 'usedQty'] as const)
    if (
      items.filter(
        (i) =>
          i.lifecycle === 'ACTIVE' &&
          i.type === 'MATERIAL' &&
          (i[key] ?? 0) > 0,
      ).length > 1000
    )
      throw new PhysicalInventoryError('INVALID_PHYSICAL_REQUEST');
}
@Injectable()
export class HealthcareCaseReconciliationConfirmService {
  constructor(
    private readonly repo: HealthcareCaseReconciliationConfirmRepository,
    private readonly physical: PhysicalInventoryService,
    private readonly projections: InventoryCompatibilityProjectionService,
    private readonly close: EquipmentCustodyCloseService,
    private readonly authority: InventoryAuthorityResolver,
    private readonly runtime: InventoryRuntimeCompatibilityService,
    @Inject(healthcareCompanyTransactionTimeoutConfiguration.KEY)
    private readonly policy: ConfigType<
      typeof healthcareCompanyTransactionTimeoutConfiguration
    >,
  ) {}
  async execute(
    context: Context,
    dto: ConfirmHealthcareCaseReconciliationDto,
  ): Promise<ReconciliationCommandResult> {
    if (context.key === undefined) throw idempotencyKeyRequiredException();
    if (
      typeof context.key !== 'string' ||
      !context.key.trim() ||
      context.key.trim().length > 128
    )
      throw invalidIdempotencyKeyException();
    const c = { ...context, key: context.key.trim() },
      hash = createReconciliationConfirmRequestHash(c, dto.expectedRevision);
    try {
      const replay = await this.replay(c, dto.expectedRevision, hash);
      if (replay) return replay;
      try {
        return await this.repo.commands.runInTransaction(async (tx) => {
          const hint = await this.repo.root(tx, c);
          if (!hint) reconciliationMissing();
          const bindings = this.repo.bindings(hint),
            material = this.positiveMaterial(hint);
          if (material)
            await inventoryAuthorityFence(tx, c.companyId, 'shared');
          const claim = await this.repo.commands.createClaim(
            c,
            scope,
            hash,
            tx,
          );
          if (material) await this.requireAuthority(tx, c.companyId);
          await acquireHealthcareCompanyLock(tx, c.companyId, {
            acquisitionTimeoutMs: this.policy.companyLockAcquisitionTimeoutMs,
          });
          await applyHealthcareSubsequentTransactionTimeouts(tx, this.policy);
          await this.repo.lockStructure(tx, c, hint);
          let root = await this.repo.root(tx, c);
          if (!root || this.repo.bindings(root) !== bindings)
            throw resourceStateChangedException();
          this.assertRoot(root, dto.expectedRevision);
          await this.repo.lockPhysical(tx, c, root);
          root = await this.repo.root(tx, c);
          if (
            !root ||
            this.repo.bindings(root) !== bindings ||
            this.positiveMaterial(root) !== material
          )
            throw resourceStateChangedException();
          this.assertRoot(root, dto.expectedRevision);
          assertReconciliationPhysicalCallLimits(root.items);
          const sources = await this.repo.sources(tx, c, root.dispatchId);
          const snapshots = await this.validate(tx, c, root, sources);
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
              'No autorizado para confirmar reconciliaciones',
            );
          const at = await this.repo.timestamp(tx);
          const audit = await this.repo.audit(tx, c, root.revision, at);
          await this.material(tx, c, root, snapshots);
          for (const item of root.items
            .filter(
              (i) =>
                i.lifecycle === 'ACTIVE' &&
                i.type === 'EQUIPMENT' &&
                i.outcome === 'RETURNED',
            )
            .sort((a, b) => a.assetId!.localeCompare(b.assetId!))) {
            const result = await this.close.returnFromCustody(tx, {
              companyId: c.companyId,
              caseId: c.caseId,
              assetId: item.assetId!,
              custodyId: item.equipmentCustodyId!,
              assignmentId: item.assignmentId!,
              actorId: c.actorId,
              expectedPhysicalRevision: item.expectedPhysicalRevision!,
              reportedCondition: item.reportedCondition!,
              validatedContext: {
                adapterKey: 'CASE_RECONCILIATION_ITEM',
                contextId: item.id,
              },
              durableOrigin: {
                type: 'CASE_RECONCILIATION_ITEM',
                id: item.id,
                operation: 'CONFIRM_EQUIPMENT_RETURN',
              },
            });
            if (result.outcome !== 'CLOSED')
              throw healthcarePersistenceException();
            const snapshot = snapshots.get(item.id)!;
            if (snapshot.result?.type !== 'EQUIPMENT')
              throw healthcarePersistenceException();
            snapshot.result.after = {
              condition: result.conditionAfter,
              lifecycle: result.lifecycleAfter,
              location: result.locationAfter,
              revision: result.revisionAfter,
            };
            snapshot.result.closePhysicalEventId = result.physicalEventId;
            snapshot.result.custodyClosedAt = result.closedAt.toISOString();
          }
          for (const item of root.items) {
            const snapshot = snapshots.get(item.id)!;
            snapshot.capturedAt = at.toISOString();
            const r = snapshot.result;
            if (r)
              this.requireOne(
                await this.repo.itemEvidence(
                  tx,
                  c,
                  item.id,
                  r.type === 'MATERIAL'
                    ? {
                        returnedDestinationPositionId:
                          r.returnedDestinationPositionId,
                        returnedPhysicalEffectId: r.returnedPhysicalEffectId,
                        usedPhysicalEffectId: r.usedPhysicalEffectId,
                      }
                    : { closePhysicalEventId: r.closePhysicalEventId },
                ),
              );
            parseReconciliationItemSnapshot(snapshot);
            this.requireOne(
              await this.repo.itemSnapshot(tx, c, item.id, json(snapshot)),
            );
          }
          const active = root.items.filter((i) => i.lifecycle === 'ACTIVE');
          const snapshot: ReconciliationRootSnapshot = {
            version: 1,
            reconciliationId: root.id,
            sourceDispatch: {
              id: root.dispatchId,
              caseId: c.caseId,
              caseKitId: root.caseKitId,
              history: parseDispatchRootSnapshot(root.dispatch.snapshot),
            },
            confirmedBy: actor,
            confirmedAt: at.toISOString(),
            observation: root.observation,
            episodeFacts: {
              materialItemCount: active.filter((i) => i.type === 'MATERIAL')
                .length,
              equipmentItemCount: active.filter((i) => i.type === 'EQUIPMENT')
                .length,
              hasPhysicalMutation:
                material ||
                active.some(
                  (i) => i.type === 'EQUIPMENT' && i.outcome === 'RETURNED',
                ),
            },
          };
          parseReconciliationRootSnapshot(snapshot);
          this.requireOne(
            await this.repo.finalize(tx, c, root.revision, at, json(snapshot)),
          );
          await this.repo.commands.completeClaim(claim.id, root.id, tx);
          // Evaluate final staged state while the caller's statement_timeout is active.
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "InventoryPhysicalEffectLine_complete" IMMEDIATE',
          );
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "InventoryPhysicalEffect_complete" IMMEDIATE',
          );
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "Reconciliation_local_state", "Reconciliation_item_final_state", "Reconciliation_final_state", "Reconciliation_insert_final_state", "Reconciliation_idempotency_resource", "EquipmentAsset_custody_coherence", "EquipmentAssetCustody_coherence" IMMEDIATE',
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
  private positiveMaterial(root: Root) {
    return root.items.some(
      (i) =>
        i.lifecycle === 'ACTIVE' &&
        i.type === 'MATERIAL' &&
        ((i.returnedQty ?? 0) > 0 || (i.usedQty ?? 0) > 0),
    );
  }
  private async requireAuthority(tx: Tx, companyId: string) {
    if (!(await tx.inventoryCutover.findUnique({ where: { companyId } })))
      throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
    const authority = await this.authority.resolve(tx, companyId);
    if (authority === 'LEGACY')
      throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
    if (authority === 'CUTOVER') {
      const control = await tx.inventoryCutover.findUnique({
        where: { companyId },
      });
      throw new InventoryAuthorityError(
        control?.status === 'RECOVERY_REQUIRED'
          ? 'RECOVERY_REQUIRED'
          : 'CUTOVER_FROZEN',
      );
    }
    this.runtime.identity();
  }
  private assertRoot(root: Root, revision: number) {
    if (root.status !== 'DRAFT')
      reconciliationConflict('CASE_RECONCILIATION_NOT_MUTABLE');
    if (root.revision !== revision) throw resourceStateChangedException();
    if (
      root.dispatch.status !== 'CONFIRMED' ||
      root.dispatch.companyId !== root.companyId ||
      root.dispatch.caseId !== root.caseId ||
      root.dispatch.caseKitId !== root.caseKitId
    )
      reconciliationSourceInvalid();
    if (!root.items.some((i) => i.lifecycle === 'ACTIVE'))
      reconciliationSourceInvalid();
  }
  private async validate(
    tx: Tx,
    c: Context,
    root: Root,
    sources: AdmissionSource[],
  ) {
    const summary = deriveReconciliationSummary(root.dispatchId, sources),
      snapshots = new Map<string, ReconciliationItemSnapshot>();
    const pending = new Map(
      summary.items.map((s) => [s.sourceDispatchItemId, s]),
    );
    let unresolved = false;
    for (const item of root.items) {
      const d = item.sourceDispatchItem;
      if (
        d.companyId !== c.companyId ||
        d.caseId !== c.caseId ||
        d.dispatchId !== root.dispatchId ||
        d.lifecycle !== 'ACTIVE' ||
        d.type !== item.type
      )
        reconciliationSourceInvalid();
      const snapshot: ReconciliationItemSnapshot = {
        version: 1,
        sourceDispatchItemId: d.id,
        history: parseDispatchItemSnapshot(d.snapshot),
        dispatchedQty: d.quantity,
        capturedAt: '',
        result: null,
      };
      snapshots.set(item.id, snapshot);
      if (item.lifecycle !== 'ACTIVE') continue;
      const source = sources.find((s) => s.id === d.id),
        state = pending.get(d.id);
      if (!source || !state) reconciliationSourceInvalid();
      if (item.type === 'MATERIAL') {
        if (
          state.type !== 'MATERIAL' ||
          !source.destinationPosition ||
          item.sourceCustodyPositionId !== source.destinationPosition.id ||
          item.returnedQty === null ||
          item.usedQty === null
        )
          reconciliationSourceInvalid();
        const total = BigInt(item.returnedQty) + BigInt(item.usedQty);
        if (total > BigInt(state.unresolvedQty))
          reconciliationCapacityExceeded();
        if (item.expectedSourceRevision !== source.destinationPosition.revision)
          throw resourceStateChangedException();
        unresolved ||= state.unresolvedQty > 0;
        snapshot.result = {
          type: 'MATERIAL',
          returnedQty: item.returnedQty,
          usedQty: item.usedQty,
          unresolvedBefore: state.unresolvedQty,
          unresolvedAfter: state.unresolvedQty - Number(total),
          source: {
            positionId: source.destinationPosition.id,
            revision: source.destinationPosition.revision,
            quantity: source.destinationPosition.quantity,
          },
          returnedDestinationPositionId: null,
          returnedPhysicalEffectId: null,
          usedPhysicalEffectId: null,
        };
        if (item.returnedQty > 0) {
          const product = await tx.product.findFirst({
            where: { id: d.productId, companyId: c.companyId },
          });
          const batch = d.batchId
            ? await tx.inventoryBatch.findFirst({
                where: {
                  id: d.batchId,
                  companyId: c.companyId,
                  productId: d.productId,
                },
              })
            : null;
          if (
            !product?.isActive ||
            (d.batchId &&
              (!batch?.isActive ||
                (batch.expirationDate && batch.expirationDate <= new Date())))
          )
            throw new PhysicalInventoryError('PHYSICAL_SOURCE_NOT_ELIGIBLE');
        }
      } else {
        if (
          state.type !== 'EQUIPMENT' ||
          !source.equipmentCustody ||
          !source.asset ||
          item.equipmentCustodyId !== source.equipmentCustody.id ||
          item.assetId !== source.asset.id ||
          item.assignmentId !== source.equipmentCustody.assignmentId
        )
          reconciliationSourceInvalid();
        if (state.custodyStatus !== 'OPEN')
          throw new EquipmentPhysicalError('EQUIPMENT_CUSTODY_ALREADY_CLOSED');
        if (
          source.asset.physicalLocation !== 'CUSTODY' ||
          source.asset.activeCustodyId !== item.equipmentCustodyId ||
          source.equipmentCustody.closedById !== null
        )
          throw healthcarePersistenceException();
        if (source.asset.physicalRevision !== item.expectedPhysicalRevision)
          throw resourceStateChangedException();
        unresolved = true;
        const before: EquipmentObservation = {
          condition: source.asset.condition,
          lifecycle: source.asset.lifecycle,
          location: source.asset.physicalLocation,
          revision: source.asset.physicalRevision,
        };
        snapshot.result = {
          type: 'EQUIPMENT',
          custodyId: item.equipmentCustodyId,
          assignmentId: item.assignmentId,
          openPhysicalEventId: d.equipmentPhysicalEventId!,
          outcome: item.outcome!,
          reportedCondition: item.reportedCondition,
          before,
          after: { ...before },
          closePhysicalEventId: null,
          custodyClosedAt: null,
        };
      }
    }
    const physical =
      this.positiveMaterial(root) ||
      root.items.some(
        (i) =>
          i.lifecycle === 'ACTIVE' &&
          i.type === 'EQUIPMENT' &&
          i.outcome === 'RETURNED',
      );
    if (
      !physical &&
      (!unresolved ||
        !root.observation?.trim() ||
        root.observation !== root.observation.trim())
    )
      reconciliationSourceInvalid();
    return snapshots;
  }
  private async material(
    tx: Tx,
    c: Context,
    root: Root,
    snapshots: Map<string, ReconciliationItemSnapshot>,
  ) {
    const material = root.items.filter(
      (i) => i.lifecycle === 'ACTIVE' && i.type === 'MATERIAL',
    );
    const returned = material.filter((i) => i.returnedQty! > 0),
      used = material.filter((i) => i.usedQty! > 0);
    let transfer: PhysicalResult | undefined;
    if (returned.length) {
      transfer = await this.physical.transfer(
        tx,
        {
          companyId: c.companyId,
          actorId: c.actorId,
          origin: {
            type: 'CASE_RECONCILIATION',
            id: root.id,
            operation: 'CONFIRM_RETURNED',
          },
        },
        returned.map((i) => ({
          sourceId: i.sourceCustodyPositionId!,
          quantity: i.returnedQty!,
          expectedSourceRevision: i.expectedSourceRevision!,
          target: {
            productId: i.sourceDispatchItem.productId,
            inventoryBatchId: i.sourceDispatchItem.batchId,
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
          },
        })),
      );
      if (transfer.replay) throw healthcarePersistenceException();
      await this.projections.apply(tx, c.companyId, transfer);
      const destinations = await tx.inventoryPosition.findMany({
        where: {
          companyId: c.companyId,
          id: {
            in: transfer.effect.lines
              .filter((l) => l.delta > 0)
              .map((l) => l.positionId),
          },
          state: 'AVAILABLE',
          contextType: null,
          contextId: null,
        },
      });
      for (const item of returned) {
        const target = destinations.find(
          (p) =>
            p.productId === item.sourceDispatchItem.productId &&
            p.inventoryBatchId === item.sourceDispatchItem.batchId,
        );
        if (!target) throw healthcarePersistenceException();
        const result = this.materialResult(snapshots, item);
        result.returnedDestinationPositionId = target.id;
        result.returnedPhysicalEffectId = transfer.effect.id;
      }
    }
    if (used.length) {
      const result = await this.physical.definitiveOut(
        tx,
        {
          companyId: c.companyId,
          actorId: c.actorId,
          origin: {
            type: 'CASE_RECONCILIATION',
            id: root.id,
            operation: 'CONFIRM_USED',
          },
        },
        used.map((i) => {
          const previous = transfer?.effect.lines.find(
            (l) => l.positionId === i.sourceCustodyPositionId && l.delta < 0,
          );
          if (i.returnedQty! > 0 && !previous)
            throw healthcarePersistenceException();
          return {
            sourceId: i.sourceCustodyPositionId!,
            quantity: i.usedQty!,
            expectedSourceRevision:
              previous?.revisionAfter ?? i.expectedSourceRevision!,
          };
        }),
      );
      if (result.replay) throw healthcarePersistenceException();
      await this.projections.apply(tx, c.companyId, result);
      for (const item of used)
        this.materialResult(snapshots, item).usedPhysicalEffectId =
          result.effect.id;
    }
  }
  private materialResult(
    snapshots: Map<string, ReconciliationItemSnapshot>,
    item: Item,
  ): MaterialResult {
    const result = snapshots.get(item.id)?.result;
    if (result?.type !== 'MATERIAL') throw healthcarePersistenceException();
    return result;
  }
  private requireOne(result: Prisma.BatchPayload) {
    if (result.count !== 1) throw resourceStateChangedException();
  }
  private claimConflict(e: unknown) {
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
  private replay(c: Context, revision: number, hash: string) {
    return this.repo.commands.runInReadSnapshot(async (tx) => {
      const claim = await this.repo.commands.findClaim(c, scope, tx);
      if (!claim) return null;
      if (claim.requestHash !== hash) throw idempotencyKeyReusedException();
      if (claim.resourceId !== c.reconciliationId)
        throw healthcarePersistenceException();
      const root = await this.repo.root(tx, c),
        audit = await this.repo.commands.findWitness(
          c,
          c.reconciliationId,
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
        audit.reconciliationItemId !== null ||
        audit.revisionBefore !== revision ||
        audit.revisionAfter !== revision + 1 ||
        audit.actorId !== root.confirmedById ||
        audit.createdAt.getTime() !== root.confirmedAt?.getTime()
      )
        throw healthcarePersistenceException();
      parseReconciliationAuditChange(audit.change, 'CONFIRM');
      return this.result(tx, c, audit, true);
    });
  }
  private async result(
    tx: Tx,
    c: Context,
    audit: HealthcareCaseReconciliationAudit,
    replay: boolean,
  ): Promise<ReconciliationCommandResult> {
    const root = await this.repo.commands.detail(c, c.reconciliationId, tx);
    if (!root) throw healthcarePersistenceException();
    const data = mapReconciliationDetail(root);
    if (
      data.status !== 'CONFIRMED' ||
      data.snapshot?.confirmedBy.id !== audit.actorId ||
      Date.parse(data.snapshot.confirmedAt) !== audit.createdAt.getTime()
    )
      throw healthcarePersistenceException();
    return {
      replay,
      command: {
        auditId: audit.id,
        operation: 'CONFIRM',
        reconciliationId: c.reconciliationId,
        itemId: null,
        revisionBefore: audit.revisionBefore,
        revisionAfter: audit.revisionAfter,
        actorId: audit.actorId,
        occurredAt: audit.createdAt.toISOString(),
      },
      data,
    };
  }
}
