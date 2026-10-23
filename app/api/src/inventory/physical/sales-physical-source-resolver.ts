import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import {
  MAX_PHYSICAL_QUANTITY,
  requirePhysical,
} from './physical-inventory.contract';
import { requireTransaction } from './inventory-compatibility-projection.service';
import {
  physicalExpirationEligibility,
  storedExpirationDay,
  companyLocalDay,
} from './physical-expiration-policy';

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

  // Caller holds the business aggregate. Discovery supplies IDs only; final
  // quantities, dates and revisions always come from the locked Positions.
  private async lockUnbatched(
    tx: Prisma.TransactionClient,
    companyId: string,
    items: SalesPhysicalItem[],
    expiryFilter: { expirationDate?: null },
  ) {
    requireTransaction(tx);
    validateSalesItems(items);
    const ids = items.map((i) => i.productId).sort();
    const products = await this.repository.lockProducts(tx, companyId, ids);
    requirePhysical(
      products.length === ids.length &&
        new Set(products.map((p) => p.id)).size === ids.length,
      'SALE_PHYSICAL_SOURCE_INVALID',
    );
    for (const p of products) {
      requirePhysical(
        ids.includes(p.id) && p.companyId === companyId && p.isActive,
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
        ...expiryFilter,
      },
      select: { id: true },
    });
    // Candidate C has no eligible batches. No batch is selected even for a shortfall.
    await this.repository.lockBatches(tx, companyId, []);
    const positions = await this.repository.lockPositions(
      tx,
      companyId,
      candidates.map((p) => p.id),
      [],
    );
    return { products, positions };
  }

  // Locks belong to the caller transaction. A plan never authorizes a mutation;
  // W2a's Sale boundary separately proves durable confirmation and allocations.
  async planUnbatchedSources(
    tx: Prisma.TransactionClient,
    companyId: string,
    items: SalesPhysicalItem[],
  ) {
    return this.plan(tx, companyId, items, false);
  }

  async planConfirmedSaleSources(
    tx: Prisma.TransactionClient,
    companyId: string,
    items: SalesPhysicalItem[],
  ) {
    return this.plan(tx, companyId, items, true);
  }

  private async plan(
    tx: Prisma.TransactionClient,
    companyId: string,
    items: SalesPhysicalItem[],
    diagnoseSaleShortfall: boolean,
  ) {
    const { products, positions } = await this.lockUnbatched(
      tx,
      companyId,
      items,
      {},
    );
    requirePhysical(
      positions.every(
        (p) =>
          p.companyId === companyId &&
          items.some((i) => i.productId === p.productId),
      ) && new Set(positions.map((p) => p.id)).size === positions.length,
      'SALE_PHYSICAL_SOURCE_INVALID',
    );
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    requirePhysical(company, 'INVENTORY_TENANT_MISMATCH');
    const asOf = new Date();
    const eligible = positions
      .filter((p) => {
        if (
          p.state !== 'AVAILABLE' ||
          p.inventoryBatchId !== null ||
          p.contextType !== null ||
          p.contextId !== null
        )
          return false;
        requirePhysical(
          Number.isInteger(p.quantity) &&
            p.quantity >= 0 &&
            p.quantity <= MAX_PHYSICAL_QUANTITY &&
            Number.isInteger(p.revision) &&
            p.revision >= 0 &&
            p.revision <= MAX_PHYSICAL_QUANTITY,
          'SALE_PHYSICAL_SOURCE_INVALID',
        );
        return (
          p.quantity > 0 &&
          p.revision < MAX_PHYSICAL_QUANTITY &&
          physicalExpirationEligibility(
            storedExpirationDay(p.expirationDate),
            company.timezone,
            asOf,
          ) !== 'EXPIRED'
        );
      })
      .map((position) => ({
        position,
        day: storedExpirationDay(position.expirationDate),
      }))
      .sort((a, b) => {
        if (a.day !== b.day) {
          if (a.day === null) return 1;
          if (b.day === null) return -1;
          return a.day < b.day ? -1 : 1;
        }
        return a.position.id < b.position.id
          ? -1
          : a.position.id > b.position.id
            ? 1
            : 0;
      });
    const plan: SalesSourcePlan[] = [];
    for (const item of [...items].sort((a, b) =>
      a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
    )) {
      let remaining = item.quantity;
      const sources: SalesSourcePlan['sources'] = [];
      for (const { position } of eligible) {
        if (position.productId !== item.productId || remaining === 0) continue;
        const quantity = Math.min(remaining, position.quantity);
        sources.push({
          positionId: position.id,
          quantity,
          expectedRevision: position.revision,
        });
        remaining -= quantity;
      }
      if (remaining > 0) {
        const product = products.find((p) => p.id === item.productId)!;
        // Diagnostic only: no Batch allocation or new lock acquisition. Preserve
        // the historical OPTIONAL shortfall error using the same local day.
        if (diagnoseSaleShortfall && product.lotTracking === 'OPTIONAL') {
          const batchQuantity = await tx.inventoryPosition.aggregate({
            where: {
              companyId,
              productId: item.productId,
              state: 'AVAILABLE',
              inventoryBatchId: { not: null },
              batch: {
                isActive: true,
                OR: [
                  { expirationDate: null },
                  {
                    expirationDate: {
                      gte: new Date(
                        `${companyLocalDay(company.timezone, asOf)}T00:00:00.000Z`,
                      ),
                    },
                  },
                ],
              },
            },
            _sum: { quantity: true },
          });
          requirePhysical(
            !batchQuantity._sum.quantity,
            'SALE_PHYSICAL_SOURCE_REQUIRED',
          );
        }
        requirePhysical(false, 'INSUFFICIENT_PHYSICAL_AVAILABILITY');
      }
      plan.push({
        saleItemId: item.id,
        productId: item.productId,
        requestedQuantity: item.quantity,
        sources,
      });
    }
    return { plan, products };
  }

  // Historical undated resolver retained for compatibility; W2a fulfillment
  // calls the locked FEFO planner and the separate durable Sale boundary.
  async resolve(
    tx: Prisma.TransactionClient,
    companyId: string,
    items: SalesPhysicalItem[],
  ) {
    const { products, positions } = await this.lockUnbatched(
      tx,
      companyId,
      items,
      { expirationDate: null },
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
            pool.contextId === null &&
            pool.expirationDate == null,
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
