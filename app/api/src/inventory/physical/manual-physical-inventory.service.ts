import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PhysicalInventoryService } from './physical-inventory.service';
import {
  PhysicalOperation,
  normalizePhysicalRequest,
  physicalRequestHash,
  requirePhysical,
} from './physical-inventory.contract';
import {
  InventoryCompatibilityProjectionService,
  requireTransaction,
} from './inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from './inventory-compatibility-history.service';

export type ManualPhysicalInput = {
  companyId: string;
  actorId: string;
  key: string;
  reason?: string;
  operation:
    | {
        kind: 'IN';
        productId: string;
        batchId: string | null;
        quantity: number;
      }
    | {
        kind: 'OUT';
        sources: {
          positionId: string;
          quantity: number;
          expectedRevision: number;
        }[];
      }
    | {
        kind: 'COUNT_CORRECTION';
        positionId: string;
        countedQuantity: number;
        expectedRevision: number;
      };
};
const scope = 'INVENTORY_MANUAL_PHYSICAL_MUTATION' as const;

@Injectable()
export class ManualPhysicalInventoryService {
  constructor(
    private readonly physical: PhysicalInventoryService,
    private readonly projections: InventoryCompatibilityProjectionService,
    private readonly history: InventoryCompatibilityHistoryService,
  ) {}

  // No transaction/retry owner here. The outer owner must abort and classify key
  // collisions in a fresh transaction; re-invoking execute then returns replay.
  async execute(tx: Prisma.TransactionClient, input: ManualPhysicalInput) {
    requireTransaction(tx);
    requirePhysical(typeof input.key === 'string');
    const key = input.key.trim();
    requirePhysical(key.length > 0 && key.length <= 128);
    const op = input.operation;
    let operation: PhysicalOperation;
    if (op.kind === 'IN')
      operation = {
        kind: 'CREDIT',
        credits: [
          {
            target: {
              productId: op.productId,
              inventoryBatchId: op.batchId,
              state: 'AVAILABLE',
              contextType: null,
              contextId: null,
            },
            quantity: op.quantity,
          },
        ],
      };
    else if (op.kind === 'OUT') {
      requirePhysical(Array.isArray(op.sources));
      const revisions = new Map<string, number>();
      operation = {
        kind: 'DEFINITIVE_OUT',
        debits: op.sources.map((s) => {
          requirePhysical(
            Number.isInteger(s.expectedRevision) && s.expectedRevision >= 0,
          );
          requirePhysical(
            !revisions.has(s.positionId) ||
              revisions.get(s.positionId) === s.expectedRevision,
          );
          revisions.set(s.positionId, s.expectedRevision);
          return {
            sourceId: s.positionId,
            quantity: s.quantity,
            expectedSourceRevision: s.expectedRevision,
          };
        }),
      };
    } else {
      requirePhysical(op.kind === 'COUNT_CORRECTION' && !!input.reason?.trim());
      operation = {
        kind: 'COUNT_CORRECTION',
        sourceId: op.positionId,
        countedQuantity: op.countedQuantity,
        expectedRevision: op.expectedRevision,
      };
    }
    const request = normalizePhysicalRequest({
      companyId: input.companyId,
      actorId: input.actorId,
      reason: input.reason,
      origin: { type: scope, id: 'BUSINESS_HASH', operation: op.kind },
      operation,
    });
    const actor = await tx.user.findFirst({
      where: { id: input.actorId, companyId: input.companyId, isActive: true },
    });
    requirePhysical(
      actor && ['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(actor.role),
      'INVENTORY_TENANT_MISMATCH',
    );
    requirePhysical(
      op.kind !== 'COUNT_CORRECTION' ||
        actor.role === 'ADMIN' ||
        actor.role === 'MANAGER',
    );
    const requestHash = physicalRequestHash(request);
    const existing = await tx.idempotencyRecord.findUnique({
      where: {
        companyId_scope_key: { companyId: input.companyId, scope, key },
      },
    });
    if (existing) {
      requirePhysical(
        existing.requestHash === requestHash,
        'PHYSICAL_EFFECT_MISMATCH',
      );
      requirePhysical(existing.resourceId, 'PHYSICAL_EFFECT_CLAIM_CONFLICT');
      const effect = await tx.inventoryPhysicalEffect.findFirstOrThrow({
        where: { id: existing.resourceId, companyId: input.companyId },
        include: { lines: { orderBy: { sequence: 'asc' } } },
      });
      return { replay: true, effect, projectionDeltas: [] };
    }
    const claim = await tx.idempotencyRecord.create({
      data: { companyId: input.companyId, scope, key, requestHash },
    });
    if (operation.kind === 'DEFINITIVE_OUT') {
      const ids = [...new Set(operation.debits.map((d) => d.sourceId))];
      const sources = await tx.inventoryPosition.findMany({
        where: { companyId: input.companyId, id: { in: ids } },
      });
      requirePhysical(
        sources.length === ids.length,
        'PHYSICAL_POSITION_NOT_FOUND',
      );
      requirePhysical(
        sources.every((s) => s.state === 'AVAILABLE'),
        'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      );
    }
    const result = await this.physical.apply(tx, {
      ...request,
      origin: { ...request.origin, id: randomUUID() },
    });
    requirePhysical(!result.replay);
    await this.projections.apply(tx, input.companyId, result);
    await this.history.write(tx, result);
    await tx.idempotencyRecord.update({
      where: { id: claim.id },
      data: { resourceId: result.effect.id },
    });
    return result;
  }
}
