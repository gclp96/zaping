import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { HealthcareCaseDispatchCorrectionRepository } from './healthcare-case-dispatch-correction.repository';
import { createDispatchCorrectionRequestHash } from './healthcare-case-dispatch-correction.contract';
import { DispatchCorrectionMaterialError } from '../../inventory/physical/dispatch-correction-physical.adapter';
import { InventoryAuthorityError } from '../../inventory/physical/inventory-authority-error';
import { InventoryCutoverError } from '../../inventory/physical/inventory-cutover.contract';
import { PhysicalInventoryError } from '../../inventory/physical/physical-inventory.contract';
import { classifyHealthcareTransactionError } from '../common/healthcare-transaction-error-classification';

export type MaterialCorrectionContext = Readonly<{
  companyId: string;
  caseId: string;
  dispatchId: string;
  requesterId: string;
  idempotencyKey: string;
}>;
export type MaterialCorrectionIntent = Readonly<{
  attestedNoHandoff: true;
  reason: string;
}>;
export type DispatchCorrectionWitness = NonNullable<
  Awaited<ReturnType<HealthcareCaseDispatchCorrectionRepository['findWitness']>>
>;
export type MaterialCorrectionResult = {
  replay: boolean;
  witness: DispatchCorrectionWitness;
};
export class MaterialCorrectionCommandError extends Error {
  constructor(
    readonly code:
      | 'CORRECTION_INVALID_REQUEST'
      | 'CORRECTION_ACTOR_FORBIDDEN'
      | 'CORRECTION_DISPATCH_NOT_FOUND'
      | 'CORRECTION_DISPATCH_NOT_CONFIRMED'
      | 'CORRECTION_MATERIAL_ONLY'
      | 'CORRECTION_ALREADY_EXISTS'
      | 'CORRECTION_RECONCILIATION_INCOMPATIBLE'
      | 'CORRECTION_EVIDENCE_INCONSISTENT'
      | 'CORRECTION_CONCURRENCY_ERROR'
      | 'CORRECTION_PERSISTENCE_ERROR',
  ) {
    super(code);
    this.name = 'MaterialCorrectionCommandError';
  }
}
export function assertMaterialCommand(
  value: unknown,
  code: MaterialCorrectionCommandError['code'],
): asserts value {
  if (!value) throw new MaterialCorrectionCommandError(code);
}
export function normalizeMaterialCorrection(
  context: MaterialCorrectionContext,
  intent: MaterialCorrectionIntent,
) {
  assertMaterialCommand(
    context &&
      intent &&
      [
        context.companyId,
        context.caseId,
        context.dispatchId,
        context.requesterId,
      ].every((id) => typeof id === 'string' && isUUID(id)) &&
      typeof context.idempotencyKey === 'string' &&
      typeof intent.reason === 'string' &&
      intent.attestedNoHandoff === true,
    'CORRECTION_INVALID_REQUEST',
  );
  const key = context.idempotencyKey.trim(),
    reason = intent.reason.trim();
  assertMaterialCommand(
    key.length > 0 &&
      key.length <= 128 &&
      reason.length > 0 &&
      [...reason].length <= 1000,
    'CORRECTION_INVALID_REQUEST',
  );
  const c = Object.freeze({
    companyId: context.companyId,
    caseId: context.caseId,
    dispatchId: context.dispatchId,
    requesterId: context.requesterId,
    idempotencyKey: key,
  });
  const i = Object.freeze({ attestedNoHandoff: true as const, reason });
  return {
    context: c,
    intent: i,
    hash: createDispatchCorrectionRequestHash({ ...c, ...i }),
  };
}
export function correctionCollision(
  error: unknown,
): 'claim' | 'dispatch' | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  )
    return null;
  const target = error.meta?.target;
  const exact = (columns: string[], name: string) =>
    Array.isArray(target)
      ? target.length === columns.length &&
        columns.every((c) => target.includes(c))
      : target === name;
  if (
    exact(
      ['companyId', 'scope', 'key'],
      'IdempotencyRecord_companyId_scope_key_key',
    )
  )
    return 'claim';
  if (exact(['companyId', 'dispatchId'], 'DispatchCorrection_dispatch_key'))
    return 'dispatch';
  return null;
}
export function materialCommandFailure(error: unknown): never {
  if (
    error instanceof MaterialCorrectionCommandError ||
    error instanceof DispatchCorrectionMaterialError ||
    error instanceof PhysicalInventoryError ||
    error instanceof HttpException
  )
    throw error;
  if (error instanceof InventoryCutoverError)
    throw new InventoryAuthorityError('RECOVERY_REQUIRED');
  if (
    classifyHealthcareTransactionError(error, 'subsequent-operation') ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034')
  )
    throw new MaterialCorrectionCommandError('CORRECTION_CONCURRENCY_ERROR');
  throw new MaterialCorrectionCommandError('CORRECTION_PERSISTENCE_ERROR');
}
