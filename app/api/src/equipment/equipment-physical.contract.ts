import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';

export const MAX_EQUIPMENT_PHYSICAL_REVISION = 2147483647;
export type EquipmentPhysicalCode =
  | 'INVALID_REQUEST_BODY'
  | 'EQUIPMENT_ASSET_NOT_FOUND'
  | 'RESOURCE_STATE_CHANGED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'EQUIPMENT_PHYSICAL_EVIDENCE_REQUIRED'
  | 'EQUIPMENT_PHYSICAL_EVIDENCE_INVALID'
  | 'EQUIPMENT_PHYSICAL_ACTOR_INVALID'
  | 'HEALTHCARE_CONCURRENCY_TIMEOUT'
  | 'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR';

export class EquipmentPhysicalError extends HttpException {
  constructor(readonly code: EquipmentPhysicalCode) {
    const status =
      code === 'INVALID_REQUEST_BODY'
        ? HttpStatus.BAD_REQUEST
        : code === 'EQUIPMENT_ASSET_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : code === 'EQUIPMENT_PHYSICAL_ACTOR_INVALID'
            ? HttpStatus.FORBIDDEN
            : code === 'EQUIPMENT_PHYSICAL_EVIDENCE_REQUIRED' ||
                code === 'HEALTHCARE_CONCURRENCY_TIMEOUT'
              ? HttpStatus.SERVICE_UNAVAILABLE
              : code === 'EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR'
                ? HttpStatus.INTERNAL_SERVER_ERROR
                : HttpStatus.CONFLICT;
    super({ statusCode: status, code, message: code }, status);
  }
}
export function equipmentPhysicalAssert(
  value: unknown,
  code: EquipmentPhysicalCode = 'INVALID_REQUEST_BODY',
): asserts value {
  if (!value) throw new EquipmentPhysicalError(code);
}
export function equipmentPhysicalFailure(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new EquipmentPhysicalError('IDEMPOTENCY_KEY_REUSED');
    if (
      ['P2034', 'P2028'].includes(error.code) ||
      ['55P03', '40P01', '40001'].includes(String(error.meta?.code))
    )
      throw new EquipmentPhysicalError('HEALTHCARE_CONCURRENCY_TIMEOUT');
  }
  throw new EquipmentPhysicalError('EQUIPMENT_PHYSICAL_PERSISTENCE_ERROR');
}
export function physicalText(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    value === value.trim()
  );
}
export function physicalId(value: unknown): asserts value is string {
  equipmentPhysicalAssert(typeof value === 'string' && isUUID(value));
}
export function physicalRevision(value: unknown): asserts value is number {
  equipmentPhysicalAssert(
    Number.isSafeInteger(value) &&
      Number(value) >= 0 &&
      Number(value) < MAX_EQUIPMENT_PHYSICAL_REVISION,
  );
}
export function equipmentPhysicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export type EquipmentBaselineCommand = {
  companyId: string;
  assetId: string;
  reconciliationId: string;
  expectedPhysicalRevision: number;
  targetPhysicalLocation: 'WAREHOUSE';
  operatorIdentity: string;
  evidenceReference: string;
  evidenceHash: string;
  businessActorId?: string;
};
export function validateEquipmentBaseline(
  command: EquipmentBaselineCommand,
): void {
  physicalId(command.companyId);
  physicalId(command.assetId);
  physicalId(command.reconciliationId);
  physicalRevision(command.expectedPhysicalRevision);
  equipmentPhysicalAssert(
    command.targetPhysicalLocation === 'WAREHOUSE' &&
      physicalText(command.operatorIdentity, 128) &&
      physicalText(command.evidenceReference, 1024) &&
      /^[0-9a-f]{64}$/.test(command.evidenceHash),
  );
  if (command.businessActorId !== undefined)
    physicalId(command.businessActorId);
}
export function equipmentBaselineHash(c: EquipmentBaselineCommand): string {
  // Fixed-order, versioned whitelist: caller object property order is irrelevant.
  return equipmentPhysicalHash({
    version: 1,
    companyId: c.companyId,
    assetId: c.assetId,
    reconciliationId: c.reconciliationId,
    expectedPhysicalRevision: c.expectedPhysicalRevision,
    targetPhysicalLocation: c.targetPhysicalLocation,
    operatorIdentity: c.operatorIdentity,
    evidenceReference: c.evidenceReference,
    evidenceHash: c.evidenceHash,
    businessActorId: c.businessActorId ?? null,
  });
}
// Privileged, explicitly configured adapter authenticates actual retained evidence.
// User-supplied JSON booleans/hashes alone are never a warehouse attestation.
export interface EquipmentBaselineEvidenceAdapter {
  accept(
    command: EquipmentBaselineCommand,
    requestHash: string,
    mode: 'APPLY' | 'REPLAY',
  ): Promise<{
    requestHash: string;
    evidenceHash: string;
    operatorIdentity: string;
    warehousePresenceVerified: boolean;
  }>;
}
export class ClosedEquipmentBaselineEvidence implements EquipmentBaselineEvidenceAdapter {
  accept(): Promise<never> {
    return Promise.reject(
      new EquipmentPhysicalError('EQUIPMENT_PHYSICAL_EVIDENCE_REQUIRED'),
    );
  }
}

export const equipmentPhysicalPublicOmit = {
  physicalLocation: true,
  physicalRevision: true,
  activeCustodyId: true,
} as const satisfies Prisma.EquipmentAssetOmit;
