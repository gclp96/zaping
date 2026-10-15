import { PrismaClient } from '@prisma/client';
import { acquireHealthcareCompanyLock } from '../healthcare/common/healthcare-company-lock';
import { applyHealthcareSubsequentTransactionTimeouts } from '../healthcare/common/healthcare-subsequent-transaction-timeouts';
import { healthcareCompanyTransactionTimeoutConfiguration } from '../healthcare/common/healthcare-company-transaction-timeout.config';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../healthcare/common/healthcare-company-transaction-timeout-policy';
import { HealthcareCompanyLockTimeoutError } from '../healthcare/common/healthcare-company-lock-timeout.error';
import { EquipmentPhysicalRepository } from './equipment-physical.repository';
import {
  ClosedEquipmentBaselineEvidence,
  EquipmentBaselineCommand,
  EquipmentBaselineEvidenceAdapter,
  EquipmentPhysicalError,
  equipmentBaselineHash,
  equipmentPhysicalAssert,
  equipmentPhysicalFailure,
  validateEquipmentBaseline,
} from './equipment-physical.contract';

// Internal tool only. No AppModule provider, HTTP controller or startup invocation.
export class EquipmentPhysicalBaselineService {
  constructor(
    private readonly db: PrismaClient,
    private readonly evidence: EquipmentBaselineEvidenceAdapter = new ClosedEquipmentBaselineEvidence(),
    private readonly policy: HealthcareCompanyTransactionTimeoutPolicy = healthcareCompanyTransactionTimeoutConfiguration(),
    private readonly repository = new EquipmentPhysicalRepository(),
  ) {}

  async reconcile(command: EquipmentBaselineCommand) {
    validateEquipmentBaseline(command);
    const requestHash = equipmentBaselineHash(command);
    try {
      return await this.db.$transaction(
        async (tx) => {
          await acquireHealthcareCompanyLock(tx, command.companyId, {
            acquisitionTimeoutMs: this.policy.companyLockAcquisitionTimeoutMs,
          });
          await applyHealthcareSubsequentTransactionTimeouts(tx, this.policy);
          const asset = await this.repository.lockAssetForPhysicalMutation(
            tx,
            command.companyId,
            command.assetId,
          );
          const previous = await this.repository.findPhysicalEventByOrigin(
            tx,
            command.companyId,
            command.assetId,
            'BASELINE_RECONCILIATION',
            command.reconciliationId,
            'ESTABLISH_WAREHOUSE',
          );
          if (previous)
            equipmentPhysicalAssert(
              previous.hashVersion === 1 &&
                previous.requestHash === requestHash &&
                previous.operation === 'BASELINE_RECONCILIATION',
              'IDEMPOTENCY_KEY_REUSED',
            );
          const proof = await this.evidence.accept(
            command,
            requestHash,
            previous ? 'REPLAY' : 'APPLY',
          );
          equipmentPhysicalAssert(
            proof?.warehousePresenceVerified === true &&
              proof.requestHash === requestHash &&
              proof.evidenceHash === command.evidenceHash &&
              proof.operatorIdentity === command.operatorIdentity,
            'EQUIPMENT_PHYSICAL_EVIDENCE_INVALID',
          );
          if (command.businessActorId) {
            const actor = await tx.user.findFirst({
              where: {
                id: command.businessActorId,
                companyId: command.companyId,
                isActive: true,
              },
              select: { id: true, role: true },
            });
            equipmentPhysicalAssert(
              actor && ['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(actor.role),
              'EQUIPMENT_PHYSICAL_ACTOR_INVALID',
            );
          }
          if (previous) return { outcome: 'REPLAY' as const, event: previous };
          const product = await tx.product.findFirst({
            where: {
              id: asset.productId,
              companyId: command.companyId,
              inventoryTracking: 'ASSET',
            },
            select: { id: true },
          });
          equipmentPhysicalAssert(
            product &&
              asset.physicalLocation === 'UNVERIFIED' &&
              asset.activeCustodyId === null &&
              asset.physicalRevision === command.expectedPhysicalRevision &&
              asset.physicalRevision === 0,
            'RESOURCE_STATE_CHANGED',
          );
          await this.repository.establishWarehouse(tx, asset);
          const event = await this.repository.appendPhysicalEvent(tx, {
            companyId: command.companyId,
            equipmentAssetId: command.assetId,
            operation: 'BASELINE_RECONCILIATION',
            originType: 'BASELINE_RECONCILIATION',
            originId: command.reconciliationId,
            originOperation: 'ESTABLISH_WAREHOUSE',
            hashVersion: 1,
            requestHash,
            physicalLocationBefore: 'UNVERIFIED',
            physicalLocationAfter: 'WAREHOUSE',
            conditionBefore: asset.condition,
            conditionAfter: asset.condition,
            lifecycleBefore: asset.lifecycle,
            lifecycleAfter: asset.lifecycle,
            revisionBefore: 0,
            revisionAfter: 1,
            actorId: command.businessActorId ?? null,
            reasonCode: 'BASELINE_RECONCILIATION',
            operatorIdentity: command.operatorIdentity,
            evidenceReference: command.evidenceReference,
            evidenceHash: command.evidenceHash,
          });
          return { outcome: 'APPLIED' as const, event };
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: this.policy.prismaMaxWaitMs,
          timeout: this.policy.prismaTransactionTimeoutMs,
        },
      );
    } catch (error) {
      if (error instanceof HealthcareCompanyLockTimeoutError)
        throw new EquipmentPhysicalError('HEALTHCARE_CONCURRENCY_TIMEOUT');
      equipmentPhysicalFailure(error);
    }
  }
}
