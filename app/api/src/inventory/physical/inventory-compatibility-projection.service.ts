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
    const batchDeltas = new Map<string, { productId: string; delta: number }>();
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
        const previous = batchDeltas.get(id);
        requirePhysical(
          !previous || previous.productId === line.position.productId,
        );
        batchDeltas.set(id, {
          productId: line.position.productId,
          delta: (previous?.delta ?? 0) + line.delta,
        });
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
    await this.applyBatchDeltas(
      tx,
      companyId,
      [...batchDeltas]
        .map(([id, value]) => ({ id, ...value }))
        .filter((b) => b.delta !== 0),
    );
  }

  // Domain-specific projection writer. Caller MUST retain the Product/Batch locks
  // acquired in sorted order by physical apply BEFORE Positions and physical writes.
  // Every supported integration calls apply only after that primitive; UPDATE FROM
  // therefore reacquires held rows, never lets planner order define new locks.
  async applyBatchDeltas(
    tx: Prisma.TransactionClient,
    companyId: string,
    deltas: { id: string; productId: string; delta: number }[],
  ) {
    requireTransaction(tx);
    requirePhysical(new Set(deltas.map((b) => b.id)).size === deltas.length);
    for (const b of deltas)
      requirePhysical(
        Number.isInteger(b.delta) &&
          b.delta !== 0 &&
          Math.abs(b.delta) <= MAX_PHYSICAL_QUANTITY,
        'PHYSICAL_QUANTITY_LIMIT',
      );
    const sorted = [...deltas].sort((a, b) => a.id.localeCompare(b.id));
    for (let offset = 0; offset < sorted.length; offset += 250) {
      const chunk = sorted.slice(offset, offset + 250);
      const values = chunk.map(
        (b) =>
          Prisma.sql`(${b.id}::text, ${b.productId}::text, ${b.delta}::integer)`,
      );
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "InventoryBatch" b SET "availableQuantity"=b."availableQuantity"+v.delta, "updatedAt"=${new Date()}
        FROM (VALUES ${Prisma.join(values)}) AS v(id, "productId", delta)
        WHERE b.id=v.id AND b."companyId"=${companyId} AND b."productId"=v."productId"
          AND b."availableQuantity" >= GREATEST(0, -v.delta)
          AND b."availableQuantity" <= ${MAX_PHYSICAL_QUANTITY} - GREATEST(0, v.delta)
        RETURNING b.id`);
      const ids = new Set(rows.map((r) => r.id));
      requirePhysical(
        rows.length === chunk.length &&
          ids.size === chunk.length &&
          chunk.every((b) => ids.has(b.id)),
        'PHYSICAL_POSITION_CONFLICT',
      );
    }
  }
}
