import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MAX_PHYSICAL_QUANTITY,
  PhysicalResult,
  requirePhysical,
} from './physical-inventory.contract';

export function requireTransaction(tx: Prisma.TransactionClient) {
  requirePhysical(tx && typeof tx === 'object' && !('$transaction' in tx));
}

@Injectable()
export class InventoryCompatibilityProjectionService {
  // Caller holds the roots acquired by physical apply and must abort on failure.
  async apply(
    tx: Prisma.TransactionClient,
    companyId: string,
    result: PhysicalResult,
  ) {
    requireTransaction(tx);
    if (result.replay) return;
    requirePhysical(
      result.effect.companyId === companyId,
      'INVENTORY_TENANT_MISMATCH',
    );
    const facts = await tx.inventoryPhysicalEffectLine.findMany({
      where: { effectId: result.effect.id, companyId },
      include: { position: true },
    });
    requirePhysical(
      facts.length === result.effect.lineCount && facts.length > 0,
    );
    const productDeltas = new Map<string, number>();
    const batchDeltas = new Map<string, number>();
    for (const line of facts) {
      requirePhysical(
        line.position.companyId === companyId,
        'INVENTORY_TENANT_MISMATCH',
      );
      productDeltas.set(
        line.position.productId,
        (productDeltas.get(line.position.productId) ?? 0) + line.delta,
      );
      if (
        line.position.state === 'AVAILABLE' &&
        line.position.inventoryBatchId
      ) {
        const id = line.position.inventoryBatchId;
        batchDeltas.set(id, (batchDeltas.get(id) ?? 0) + line.delta);
      }
    }
    for (const [id, delta] of [...productDeltas].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!delta) continue;
      requirePhysical(
        Number.isInteger(delta) && Math.abs(delta) <= MAX_PHYSICAL_QUANTITY,
        'PHYSICAL_QUANTITY_LIMIT',
      );
      const updated = await tx.product.updateMany({
        where: {
          id,
          companyId,
          inventoryTracking: 'QUANTITY',
          stock: {
            gte: Math.max(0, -delta),
            lte: MAX_PHYSICAL_QUANTITY - Math.max(0, delta),
          },
        },
        data: { stock: { increment: delta } },
      });
      requirePhysical(updated.count === 1, 'PHYSICAL_POSITION_CONFLICT');
    }
    for (const [id, delta] of [...batchDeltas].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!delta) continue;
      requirePhysical(
        Number.isInteger(delta) && Math.abs(delta) <= MAX_PHYSICAL_QUANTITY,
        'PHYSICAL_QUANTITY_LIMIT',
      );
      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id,
          companyId,
          availableQuantity: {
            gte: Math.max(0, -delta),
            lte: MAX_PHYSICAL_QUANTITY - Math.max(0, delta),
          },
        },
        data: { availableQuantity: { increment: delta } },
      });
      requirePhysical(updated.count === 1, 'PHYSICAL_POSITION_CONFLICT');
    }
  }
}
