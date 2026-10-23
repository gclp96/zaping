import { InventoryPosition, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import {
  assertDispatchCorrectionReplayHash,
  createDispatchCorrectionRequestHash,
  DISPATCH_CORRECTION_SCOPE,
} from '../../healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract';
import {
  PhysicalRequest,
  PhysicalEffect,
  PhysicalResult,
  Transfer,
  requirePhysical,
  normalizePhysicalRequest,
} from './physical-inventory.contract';
import {
  INVENTORY_AUTHORITY_NAMESPACE,
  inventoryAuthorityKey,
} from './inventory-authority-fence';
import { InventoryAuthorityError } from './inventory-authority-error';
import { assertCutoverControl } from './inventory-cutover.contract';
import { InventoryRuntimeCompatibilityService } from './inventory-runtime-compatibility.service';

export type DispatchCorrectionMaterialInput = {
  companyId: string;
  caseId: string;
  dispatchId: string;
  correctionId: string;
  requesterId: string;
  idempotencyKey: string;
  attestedNoHandoff: true;
  reason: string;
};

export class DispatchCorrectionMaterialError extends Error {
  constructor(
    readonly code:
      | 'CORRECTION_NOT_FOUND'
      | 'CORRECTION_ACTOR_FORBIDDEN'
      | 'CORRECTION_ALREADY_EXISTS'
      | 'CORRECTION_MATERIAL_ONLY'
      | 'CORRECTION_SOURCE_CHANGED'
      | 'CORRECTION_TRANSACTION_REQUIRED'
      | 'CORRECTION_FENCE_REQUIRED',
  ) {
    super(code);
    this.name = 'DispatchCorrectionMaterialError';
  }
}
function assertCorrection(
  value: unknown,
  code: DispatchCorrectionMaterialError['code'],
): asserts value {
  if (!value) throw new DispatchCorrectionMaterialError(code);
}

export function correctionTransaction(tx: Prisma.TransactionClient): void {
  assertCorrection(
    tx && typeof tx === 'object' && !('$transaction' in tx),
    'CORRECTION_TRANSACTION_REQUIRED',
  );
}

export function correctionOrigin(id: string) {
  return {
    type: 'CASE_DISPATCH_CORRECTION',
    id,
    operation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
  };
}

// Read-only context derivation. Never accepts writer metadata overrides.
export async function loadCorrectionContext(
  tx: Prisma.TransactionClient,
  input: DispatchCorrectionMaterialInput,
  mixedDispatch = false,
) {
  correctionTransaction(tx);
  for (const id of [
    input.companyId,
    input.caseId,
    input.dispatchId,
    input.correctionId,
    input.requesterId,
  ])
    requirePhysical(typeof id === 'string' && isUUID(id));
  requirePhysical(
    typeof input.idempotencyKey === 'string' &&
      input.idempotencyKey === input.idempotencyKey.trim() &&
      input.idempotencyKey.length >= 1 &&
      input.idempotencyKey.length <= 128,
  );
  const hash = createDispatchCorrectionRequestHash(input);
  const actor = await tx.user.findFirst({
    where: {
      id: input.requesterId,
      companyId: input.companyId,
      isActive: true,
      role: { in: ['ADMIN', 'MANAGER'] },
    },
  });
  assertCorrection(actor, 'CORRECTION_ACTOR_FORBIDDEN');
  const claim = await tx.idempotencyRecord.findUnique({
    where: {
      companyId_scope_key: {
        companyId: input.companyId,
        scope: DISPATCH_CORRECTION_SCOPE,
        key: input.idempotencyKey,
      },
    },
  });
  if (claim) assertDispatchCorrectionReplayHash(claim.requestHash, hash);
  const root = await tx.healthcareCaseDispatchCorrection.findFirst({
    where: {
      companyId: input.companyId,
      caseId: input.caseId,
      dispatchId: input.dispatchId,
    },
    include: {
      idempotencyRecord: true,
      items: { orderBy: { sourceDispatchItemId: 'asc' } },
    },
  });
  if (!root) {
    requirePhysical(!claim, 'PHYSICAL_EFFECT_MISMATCH');
    return null;
  }
  requirePhysical(
    root.companyId === input.companyId &&
      root.caseId === input.caseId &&
      root.dispatchId === input.dispatchId,
    'INVENTORY_TENANT_MISMATCH',
  );
  // A winner can commit between the key read and root read under READ COMMITTED.
  // Resolve that window through its immutable linked claim, never an alien key.
  const recorded = claim ?? root.idempotencyRecord;
  assertCorrection(
    root.id === input.correctionId &&
      recorded?.id === root.idempotencyRecordId &&
      recorded.key === input.idempotencyKey,
    'CORRECTION_ALREADY_EXISTS',
  );
  requirePhysical(
    recorded &&
      recorded.companyId === root.companyId &&
      recorded.scope === DISPATCH_CORRECTION_SCOPE &&
      recorded.key === input.idempotencyKey &&
      recorded.resourceId === root.id &&
      recorded.requestHash === root.requestHash,
    'PHYSICAL_EFFECT_MISMATCH',
  );
  assertDispatchCorrectionReplayHash(root.requestHash, hash);
  requirePhysical(
    root.reason === input.reason.trim() &&
      root.attestedNoHandoff &&
      root.hashVersion === 1 &&
      root.snapshotVersion === 1 &&
      root.kind === 'NO_PHYSICAL_HANDOFF' &&
      root.status === 'CONFIRMED',
    'PHYSICAL_EFFECT_MISMATCH',
  );
  const source = await tx.healthcareCaseDispatch.findFirst({
    where: {
      id: root.dispatchId,
      companyId: root.companyId,
      caseId: root.caseId,
    },
    include: {
      items: { where: { lifecycle: 'ACTIVE' }, orderBy: { id: 'asc' } },
    },
  });
  requirePhysical(
    source &&
      source.status === 'CONFIRMED' &&
      source.companyId === root.companyId &&
      source.caseId === root.caseId &&
      source.id === root.dispatchId &&
      source.confirmedAt &&
      source.confirmedAt <= root.confirmedAt,
    'PHYSICAL_EFFECT_MISMATCH',
  );
  assertCorrection(
    source.items.length > 0 &&
      source.items.every(
        (i) =>
          i.type === 'MATERIAL' || (mixedDispatch && i.type === 'EQUIPMENT'),
      ),
    'CORRECTION_MATERIAL_ONLY',
  );
  // Only the internal 01D composition selects this path. SQL 01B still requires
  // a terminal witness for EVERY ACTIVE source, including Equipment.
  if (mixedDispatch) {
    source.items = source.items.filter((i) => i.type === 'MATERIAL');
    root.items = root.items.filter((i) => i.type === 'MATERIAL');
  }
  assertCorrection(source.items.length > 0, 'CORRECTION_MATERIAL_ONLY');
  return { root, source, input, requestHash: hash };
}

export type CorrectionContext = NonNullable<
  Awaited<ReturnType<typeof loadCorrectionContext>>
>;

// Caller MUST have acquired this fence and PHYSICAL authority BEFORE staging.
// Do not acquire it here: doing so after business rows would invert the protocol.
export async function assertCorrectionWriterBoundary(
  tx: Prisma.TransactionClient,
  c: CorrectionContext,
) {
  const [proof] = await tx.$queryRaw<{ valid: boolean }[]>(Prisma.sql`
    SELECT current_setting('transaction_isolation')='read committed'
      AND EXISTS (SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'
        AND classid=${INVENTORY_AUTHORITY_NAMESPACE}::oid
        AND objid=(${inventoryAuthorityKey(c.root.companyId)}::bigint & 4294967295)::oid
        AND objsubid=2 AND mode IN ('ShareLock','ExclusiveLock') AND granted)
      AND EXISTS (SELECT 1 FROM "HealthcareCaseDispatchCorrection" WHERE id=${c.root.id}
        AND "companyId"=${c.root.companyId} AND snapshot IS NULL
        AND "creationTransactionId"=pg_current_xact_id()) AS valid`);
  assertCorrection(proof?.valid, 'CORRECTION_FENCE_REQUIRED');
  const control = await tx.inventoryCutover.findUnique({
    where: { companyId: c.root.companyId },
  });
  if (!control)
    throw new InventoryAuthorityError('PHYSICAL_AUTHORITY_REQUIRED');
  assertCutoverControl(control);
  if (control.status !== 'PHYSICAL_ACTIVE')
    throw new InventoryAuthorityError(
      control.status === 'RECOVERY_REQUIRED'
        ? 'RECOVERY_REQUIRED'
        : 'CUTOVER_FROZEN',
    );
  new InventoryRuntimeCompatibilityService().identity();
  assertCorrection(
    c.root.snapshot === null && c.root.confirmedById === c.input.requesterId,
    'CORRECTION_ACTOR_FORBIDDEN',
  );
  const rr = await tx.healthcareCaseReconciliation.findFirst({
    where: {
      companyId: c.root.companyId,
      dispatchId: c.root.dispatchId,
      OR: [
        { status: { not: 'CANCELLED' } },
        {
          items: {
            some: {
              OR: [
                { returnedPhysicalEffectId: { not: null } },
                { usedPhysicalEffectId: { not: null } },
                { closePhysicalEventId: { not: null } },
              ],
            },
          },
        },
      ],
    },
  });
  assertCorrection(!rr, 'CORRECTION_SOURCE_CHANGED');
}

export async function correctionTransferRequest(
  tx: Prisma.TransactionClient,
  c: CorrectionContext,
): Promise<PhysicalRequest> {
  const transfers: Transfer[] = [];
  for (const item of c.source.items) {
    requirePhysical(
      item.quantity &&
        item.destinationPositionId &&
        item.physicalEffectId &&
        item.sourcePositionId,
      'PHYSICAL_EFFECT_MISMATCH',
    );
    const original = await tx.inventoryPhysicalEffect.findFirst({
      where: {
        id: item.physicalEffectId,
        companyId: c.root.companyId,
      },
      include: { lines: true },
    });
    requirePhysical(
      original &&
        original.kind === 'TRANSFER' &&
        original.originType === 'CASE_DISPATCH' &&
        original.originId === c.root.dispatchId &&
        original.originOperation === 'CONFIRM_QUANTITY' &&
        original.actorId === c.source.confirmedById &&
        original.occurredAt <= c.root.confirmedAt &&
        original.lineCount === original.lines.length,
      'PHYSICAL_EFFECT_MISMATCH',
    );
    const line = original.lines.find(
      (l) => l.positionId === item.destinationPositionId,
    );
    const originalTotal = c.source.items
      .filter(
        (i) =>
          i.physicalEffectId === item.physicalEffectId &&
          i.sourcePositionId === item.sourcePositionId,
      )
      .reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    requirePhysical(
      original.lines.some(
        (l) =>
          l.positionId === item.sourcePositionId &&
          l.delta === -originalTotal &&
          l.revisionBefore === item.expectedPositionRevision,
      ),
      'PHYSICAL_EFFECT_MISMATCH',
    );
    requirePhysical(
      line &&
        line.delta === item.quantity &&
        line.quantityBefore === 0 &&
        line.quantityAfter === item.quantity &&
        line.revisionAfter === line.revisionBefore + 1,
      'PHYSICAL_EFFECT_MISMATCH',
    );
    transfers.push({
      sourceId: item.destinationPositionId,
      quantity: item.quantity,
      expectedSourceRevision: line.revisionAfter,
      target: {
        productId: item.productId,
        inventoryBatchId: item.batchId,
        state: 'AVAILABLE' as const,
        contextType: null,
        contextId: null,
      },
    });
  }
  // Geometry uses the existing validator. Unicode reason follows 01B exclusively.
  return normalizePhysicalRequest({
    companyId: c.root.companyId,
    actorId: c.root.confirmedById,
    origin: correctionOrigin(c.root.id),
    operation: { kind: 'TRANSFER', transfers },
  });
}

export async function assertCorrectionSources(
  tx: Prisma.TransactionClient,
  c: CorrectionContext,
  request: PhysicalRequest,
  positions: InventoryPosition[],
) {
  requirePhysical(request.operation.kind === 'TRANSFER');
  for (const transfer of request.operation.transfers) {
    const item = c.source.items.find(
      (i) => i.destinationPositionId === transfer.sourceId,
    );
    const p = positions.find((p) => p.id === transfer.sourceId);
    assertCorrection(
      item &&
        p &&
        p.companyId === c.root.companyId &&
        p.productId === item.productId &&
        p.inventoryBatchId === item.batchId &&
        p.state === 'CUSTODY' &&
        p.contextType === 'CASE_DISPATCH_ITEM' &&
        p.contextId === item.id &&
        p.quantity === item.quantity,
      'CORRECTION_SOURCE_CHANGED',
    );
    requirePhysical(
      p.revision === transfer.expectedSourceRevision,
      'STALE_INVENTORY_REVISION',
    );
    const count = await tx.inventoryPhysicalEffectLine.count({
      where: { companyId: c.root.companyId, positionId: p.id },
    });
    assertCorrection(count === 1, 'CORRECTION_SOURCE_CHANGED');
  }
}

export async function classifyCorrectionEvidence(
  tx: Prisma.TransactionClient,
  c: CorrectionContext,
  effect: PhysicalEffect | null,
): Promise<PhysicalResult | null> {
  if (!effect) {
    requirePhysical(c.root.snapshot === null, 'PHYSICAL_EFFECT_MISMATCH');
    return null;
  }
  // No staged/orphan Effect is a historical replay, even in its creator tx.
  requirePhysical(
    c.root.snapshot !== null &&
      c.root.items.length === c.source.items.length &&
      effect.companyId === c.root.companyId &&
      effect.originType === 'CASE_DISPATCH_CORRECTION' &&
      effect.originId === c.root.id &&
      effect.originOperation === 'COMPENSATE_NO_HANDOFF_QUANTITY' &&
      effect.kind === 'TRANSFER' &&
      effect.requestHash === c.root.requestHash &&
      effect.actorId === c.root.confirmedById &&
      effect.occurredAt.getTime() === c.root.confirmedAt.getTime() &&
      effect.lineCount === effect.lines.length,
    'PHYSICAL_EFFECT_MISMATCH',
  );
  const deltas = new Map<string, number>();
  for (const source of c.source.items) {
    const item = c.root.items.find((i) => i.sourceDispatchItemId === source.id);
    requirePhysical(
      item &&
        item.type === 'MATERIAL' &&
        item.snapshot !== null &&
        item.quantity === source.quantity &&
        item.originalPhysicalEffectId === source.physicalEffectId &&
        item.sourceCustodyPositionId === source.destinationPositionId &&
        item.compensatingEffectId === effect.id &&
        item.destinationPositionId,
      'PHYSICAL_EFFECT_MISMATCH',
    );
    deltas.set(item.sourceCustodyPositionId!, -item.quantity!);
    deltas.set(
      item.destinationPositionId,
      (deltas.get(item.destinationPositionId) ?? 0) + item.quantity!,
    );
  }
  requirePhysical(
    deltas.size === effect.lines.length &&
      new Set(effect.lines.map((l) => l.positionId)).size ===
        effect.lines.length &&
      effect.lines.every(
        (l) =>
          deltas.get(l.positionId) === l.delta &&
          l.quantityAfter === l.quantityBefore + l.delta &&
          l.revisionAfter === l.revisionBefore + 1,
      ),
    'PHYSICAL_EFFECT_MISMATCH',
  );
  const [snapshot] = await tx.$queryRaw<{ valid: boolean }[]>`
    SELECT r.snapshot-'confirmedAt'-'confirmedBy' = jsonb_build_object(
        'version',1,'correctionId',r.id,'kind',r.kind,'reason',r.reason,
        'attestedNoHandoff',true,'requestHash',r."requestHash",
        'sourceDispatch',jsonb_build_object('id',d.id,'history',d.snapshot))
      AND (r.snapshot->'confirmedBy')-'role'=jsonb_build_object('id',r."confirmedById")
      AND r.snapshot->'confirmedBy'->>'role' IN ('ADMIN','MANAGER')
      AND (r.snapshot->>'confirmedAt')::timestamptz = r."confirmedAt" AT TIME ZONE 'UTC'
      AND NOT EXISTS (SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i WHERE i."correctionId"=r.id
        AND i.snapshot IS DISTINCT FROM public.dispatch_correction_item_snapshot(i.id)) AS valid
    FROM "HealthcareCaseDispatchCorrection" r
    JOIN "HealthcareCaseDispatch" d ON d.id=r."dispatchId" AND d."companyId"=r."companyId" AND d."caseId"=r."caseId"
    WHERE r.id=${c.root.id} AND r."companyId"=${c.root.companyId}`;
  requirePhysical(snapshot?.valid, 'PHYSICAL_EFFECT_MISMATCH');
  return { replay: true, effect, projectionDeltas: [] };
}
