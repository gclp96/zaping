import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PhysicalResult, requirePhysical } from './physical-inventory.contract';
import { requireTransaction } from './inventory-compatibility-projection.service';

export type ReceiptHistoryItem = {
  id: string;
  productId: string;
  batchId: string | null;
  quantityReceived: number;
  unitCost: number;
};

@Injectable()
export class InventoryCompatibilityHistoryService {
  async write(
    tx: Prisma.TransactionClient,
    result: PhysicalResult,
    receiptItems?: ReceiptHistoryItem[],
  ) {
    requireTransaction(tx);
    if (result.replay) return;
    const effect = result.effect;
    const facts = await tx.inventoryPhysicalEffectLine.findMany({
      where: { effectId: effect.id, companyId: effect.companyId },
      include: { position: true },
      orderBy: { sequence: 'asc' },
    });
    const deltas = new Map<string, number>();
    for (const f of facts)
      deltas.set(
        f.position.productId,
        (deltas.get(f.position.productId) ?? 0) + f.delta,
      );
    const products = await tx.product.findMany({
      where: { companyId: effect.companyId, id: { in: [...deltas.keys()] } },
    });
    requirePhysical(products.length === deltas.size);
    const balances = new Map(
      products.map((p) => [p.id, p.stock - deltas.get(p.id)!]),
    );
    const rows = receiptItems
      ? [...receiptItems]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((i) => ({
            productId: i.productId,
            batchId: i.batchId,
            delta: i.quantityReceived,
            unitCost: i.unitCost,
            positionId: null,
          }))
      : facts.map((f) => ({
          productId: f.position.productId,
          batchId: f.position.inventoryBatchId,
          delta: f.delta,
          unitCost: undefined,
          positionId: f.positionId,
        }));
    const actual = new Map<string, number>();
    for (const row of rows)
      actual.set(row.productId, (actual.get(row.productId) ?? 0) + row.delta);
    requirePhysical(
      actual.size === deltas.size &&
        [...deltas].every(([id, q]) => actual.get(id) === q),
    );
    for (const row of rows) {
      const balance = balances.get(row.productId)! + row.delta;
      balances.set(row.productId, balance);
      const count = effect.kind === 'COUNT_CORRECTION';
      await tx.inventoryMovement.create({
        data: {
          companyId: effect.companyId,
          productId: row.productId,
          batchId: row.batchId,
          movementType: count ? 'ADJUSTMENT' : row.delta > 0 ? 'IN' : 'OUT',
          quantity: count ? balance : Math.abs(row.delta),
          balance,
          referenceType: receiptItems
            ? 'PURCHASE_RECEIPT'
            : 'INVENTORY_MANUAL_PHYSICAL_MUTATION',
          referenceId: receiptItems ? effect.originId : effect.id,
          createdBy: effect.actorId,
          unitCost: row.unitCost,
          notes: count
            ? `COUNT_CORRECTION position=${row.positionId}; ${effect.reason}`
            : effect.reason,
        },
      });
    }
  }
}
