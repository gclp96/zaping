import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import {
  MAX_PHYSICAL_QUANTITY,
  requirePhysical,
} from './physical-inventory.contract';
import { requireTransaction } from './inventory-compatibility-projection.service';

export type SalesPhysicalItem = {
  id: string;
  productId: string;
  quantity: number;
};
export type SalesSourcePlan = {
  saleItemId: string;
  productId: string;
  requestedQuantity: number;
  sources: { positionId: string; quantity: number; expectedRevision: number }[];
};
export function validateSalesItems(items: SalesPhysicalItem[]) {
  requirePhysical(items.length > 0, 'SALE_PHYSICAL_SOURCE_INVALID');
  requirePhysical(
    new Set(items.map((i) => i.productId)).size === items.length,
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
  requirePhysical(
    new Set(items.map((i) => i.id)).size === items.length,
    'SALE_PHYSICAL_SOURCE_INVALID',
  );
  for (const item of items)
    requirePhysical(
      Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= MAX_PHYSICAL_QUANTITY,
      'SALE_PHYSICAL_SOURCE_INVALID',
    );
}

@Injectable()
export class SalesPhysicalSourceResolver {
  constructor(private readonly repository: PhysicalInventoryRepository) {}

  // Caller holds the business aggregate. No quantity decision precedes ALL roots.
  async resolve(
    tx: Prisma.TransactionClient,
    companyId: string,
    items: SalesPhysicalItem[],
  ) {
    requireTransaction(tx);
    validateSalesItems(items);
    const ids = items.map((i) => i.productId).sort();
    const products = await this.repository.lockProducts(tx, companyId, ids);
    requirePhysical(
      products.length === ids.length,
      'SALE_PHYSICAL_SOURCE_INVALID',
    );
    for (const p of products) {
      requirePhysical(
        p.companyId === companyId && p.isActive,
        'SALE_PHYSICAL_SOURCE_INVALID',
      );
      if (p.inventoryTracking !== 'QUANTITY')
        throw new BadRequestException(
          `El producto ${p.name} no es compatible con el flujo de venta genérico por su tipo de seguimiento de inventario`,
        );
      if (p.lotTracking === 'REQUIRED')
        throw new BadRequestException(
          `El producto ${p.name} requiere selección de lote para completar la venta`,
        );
    }
    const candidates = await tx.inventoryPosition.findMany({
      where: {
        companyId,
        productId: { in: ids },
        state: 'AVAILABLE',
        inventoryBatchId: null,
      },
    });
    // Candidate C has no eligible batches. No batch is selected even for a shortfall.
    await this.repository.lockBatches(tx, companyId, []);
    const positions = await this.repository.lockPositions(
      tx,
      companyId,
      candidates.map((p) => p.id),
      [],
    );
    const plan: SalesSourcePlan[] = [];
    for (const item of [...items].sort((a, b) =>
      a.productId < b.productId ? -1 : 1,
    )) {
      const pools = positions.filter((p) => p.productId === item.productId);
      requirePhysical(pools.length <= 1, 'SALE_PHYSICAL_SOURCE_INVALID');
      const pool = pools[0];
      if (pool)
        requirePhysical(
          pool.companyId === companyId &&
            pool.state === 'AVAILABLE' &&
            pool.inventoryBatchId === null &&
            pool.contextType === null &&
            pool.contextId === null,
          'SALE_PHYSICAL_SOURCE_INVALID',
        );
      if (!pool || pool.quantity < item.quantity) {
        const product = products.find((p) => p.id === item.productId)!;
        const batchQuantity =
          product.lotTracking === 'OPTIONAL'
            ? await tx.inventoryPosition.aggregate({
                where: {
                  companyId,
                  productId: item.productId,
                  state: 'AVAILABLE',
                  inventoryBatchId: { not: null },
                  batch: {
                    isActive: true,
                    OR: [
                      { expirationDate: null },
                      { expirationDate: { gt: new Date() } },
                    ],
                  },
                },
                _sum: { quantity: true },
              })
            : null;
        requirePhysical(
          !batchQuantity?._sum.quantity,
          'SALE_PHYSICAL_SOURCE_REQUIRED',
        );
        requirePhysical(false, 'INSUFFICIENT_PHYSICAL_AVAILABILITY');
      }
      plan.push({
        saleItemId: item.id,
        productId: item.productId,
        requestedQuantity: item.quantity,
        sources: [
          {
            positionId: pool.id,
            quantity: item.quantity,
            expectedRevision: pool.revision,
          },
        ],
      });
    }
    return { plan, products };
  }
}
