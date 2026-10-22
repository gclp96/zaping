import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { HealthcareCaseDispatchCorrectionCommandRepository } from './healthcare-case-dispatch-correction-command.repository';
import {
  MaterialCorrectionContext,
  MaterialCorrectionIntent,
  MaterialCorrectionResult,
  normalizeMaterialCorrection,
  assertMaterialCommand,
  correctionCollision,
  materialCommandFailure,
} from './healthcare-case-dispatch-correction-command.contract';
import { PhysicalInventoryService } from '../../inventory/physical/physical-inventory.service';
import { InventoryCompatibilityProjectionService } from '../../inventory/physical/inventory-compatibility-projection.service';
import { InventoryAuthorityResolver } from '../../inventory/physical/inventory-authority-resolver';
import { InventoryRuntimeCompatibilityService } from '../../inventory/physical/inventory-runtime-compatibility.service';
import { inventoryAuthorityFence } from '../../inventory/physical/inventory-authority-fence';
import { InventoryAuthorityError } from '../../inventory/physical/inventory-authority-error';
import {
  HealthcareCompanyTransactionTimeoutPolicy,
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
} from '../common/healthcare-company-transaction-timeout-policy';
import { acquireHealthcareCompanyLock } from '../common/healthcare-company-lock';

// No decorator, module registration, controller or productive caller.
export class HealthcareCaseDispatchCorrectionCommandService {
  constructor(
    private readonly repo: HealthcareCaseDispatchCorrectionCommandRepository,
    private readonly policy: HealthcareCompanyTransactionTimeoutPolicy,
    private readonly physical: PhysicalInventoryService,
    private readonly projections: InventoryCompatibilityProjectionService,
    private readonly authority: InventoryAuthorityResolver,
    private readonly runtime: InventoryRuntimeCompatibilityService,
  ) {
    assertValidHealthcareCompanyTransactionTimeoutPolicy(policy);
  }

  private async replay(
    tx: Prisma.TransactionClient,
    c: MaterialCorrectionContext,
    intent: MaterialCorrectionIntent,
    hash: string,
  ): Promise<MaterialCorrectionResult | null> {
    await this.repo.authorize(tx, c);
    const witness = await this.repo.replayWitness(tx, c, hash);
    if (!witness) return null;
    const evidence =
      await this.physical.classifyCommittedDispatchCorrectionMaterial(tx, {
        ...c,
        ...intent,
        correctionId: witness.id,
      });
    assertMaterialCommand(evidence?.replay, 'CORRECTION_EVIDENCE_INCONSISTENT');
    return { replay: true, witness };
  }

  async execute(
    context: MaterialCorrectionContext,
    intent: MaterialCorrectionIntent,
  ): Promise<MaterialCorrectionResult> {
    const n = normalizeMaterialCorrection(context, intent),
      c = n.context,
      i = n.intent;
    try {
      const replay = await this.repo.read(
        (tx) => this.replay(tx, c, i, n.hash),
        this.policy,
      );
      if (replay) return replay;
      try {
        return await this.repo.write(async (tx) => {
          await inventoryAuthorityFence(tx, c.companyId, 'shared');
          const control = await this.repo.control(tx, c.companyId);
          if (!control)
            throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
          const authority = await this.authority.resolve(tx, c.companyId);
          if (authority === 'LEGACY')
            throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
          if (authority !== 'PHYSICAL')
            throw new InventoryAuthorityError(
              control.status === 'RECOVERY_REQUIRED'
                ? 'RECOVERY_REQUIRED'
                : 'CUTOVER_FROZEN',
            );
          this.runtime.identity();
          const winner = await this.replay(tx, c, i, n.hash);
          if (winner) return winner;
          const id = randomUUID();
          const claim = await this.repo.createClaim(tx, {
            companyId: c.companyId,
            key: c.idempotencyKey,
            requestHash: n.hash,
            resourceId: id,
          });
          await acquireHealthcareCompanyLock(tx, c.companyId, {
            acquisitionTimeoutMs: this.policy.companyLockAcquisitionTimeoutMs,
          });
          const source = await this.repo.lockStructure(tx, c);
          await this.repo.assertNoCorrection(tx, c);
          await this.repo.assertSource(tx, c, source);
          await this.repo.authorize(tx, c);
          const at = await this.repo.serverTime(tx);
          const root = await this.repo.createRoot(tx, {
            id,
            companyId: c.companyId,
            caseId: c.caseId,
            caseKitId: source.caseKitId,
            dispatchId: c.dispatchId,
            reason: i.reason,
            attestedNoHandoff: true,
            confirmedById: c.requesterId,
            confirmedAt: at,
            requestHash: n.hash,
            idempotencyRecordId: claim.id,
          });
          const result = await this.physical.transferDispatchCorrectionMaterial(
            tx,
            { ...c, ...i, correctionId: id },
          );
          assertMaterialCommand(
            !result.replay,
            'CORRECTION_EVIDENCE_INCONSISTENT',
          );
          await this.projections.apply(tx, c.companyId, result);
          await this.repo.createEvidenceItems(tx, c, root, source, result);
          const actor = await this.repo.authorize(tx, c);
          await this.repo.seal(tx, root, source, actor);
          await this.repo.authorize(tx, c);
          await this.repo.constraints(tx);
          const witness = await this.repo.witness(tx, c);
          assertMaterialCommand(
            witness && witness.id === id && witness.requestHash === n.hash,
            'CORRECTION_EVIDENCE_INCONSISTENT',
          );
          return { replay: false, witness };
        }, this.policy);
      } catch (error) {
        // write() has rejected: no query is issued on its aborted client.
        const collision = correctionCollision(error);
        if (!collision) throw error;
        return await this.repo.read(async (tx) => {
          const winner = await this.replay(tx, c, i, n.hash);
          if (winner) return winner;
          if (collision === 'dispatch')
            await this.repo.assertNoCorrection(tx, c);
          assertMaterialCommand(false, 'CORRECTION_EVIDENCE_INCONSISTENT');
        }, this.policy);
      }
    } catch (error) {
      materialCommandFailure(error);
    }
  }
}
