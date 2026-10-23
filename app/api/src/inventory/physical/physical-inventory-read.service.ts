import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import {
  MAX_PHYSICAL_QUANTITY,
  physicalPersistenceError,
  requirePhysical,
} from './physical-inventory.contract';

type AggregateRow = {
  owned: bigint;
  available: bigint;
  inCustody: bigint;
  count: bigint;
  batchId: string | null;
  batchProductId: string | null;
};

@Injectable()
export class PhysicalInventoryReadService {
  product(tx: Prisma.TransactionClient, companyId: string, productId: string) {
    return this.read(tx, companyId, productId);
  }
  batch(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    inventoryBatchId: string,
  ) {
    return this.read(tx, companyId, productId, inventoryBatchId);
  }

  private async read(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    batchId?: string,
  ) {
    try {
      requirePhysical(
        isUUID(companyId) &&
          isUUID(productId) &&
          (batchId === undefined || isUUID(batchId)),
      );
      // Product existence, requested Batch coherence, eligibility and sums all
      // share one statement snapshot. statement_timestamp() is fresh per read,
      // unlike CURRENT_DATE/now(), even in an older caller transaction.
      // Batch is historical TIMESTAMP WITHOUT TIME ZONE: ::date preserves its
      // stored calendar component, matching storedExpirationDay in S3a.
      const rows = await tx.$queryRaw<AggregateRow[]>(Prisma.sql`
        SELECT COALESCE(SUM(pos.quantity),0)::bigint AS owned,
          COALESCE(SUM(CASE WHEN pos.state='AVAILABLE' AND p."isActive"
            AND (
              (pos."inventoryBatchId" IS NULL AND (pos."expirationDate" IS NULL
                OR pos."expirationDate">=(statement_timestamp() AT TIME ZONE c.timezone)::date))
              OR (pos."inventoryBatchId" IS NOT NULL AND b."isActive" AND (b."expirationDate" IS NULL
                OR b."expirationDate"::date>=(statement_timestamp() AT TIME ZONE c.timezone)::date))
            )
            THEN pos.quantity ELSE 0 END),0)::bigint AS available,
          COALESCE(SUM(CASE WHEN pos.state='CUSTODY' THEN pos.quantity ELSE 0 END),0)::bigint AS "inCustody",
          COUNT(pos.id)::bigint AS count, requested.id AS "batchId", requested."productId" AS "batchProductId"
        FROM "Product" p
        JOIN "Company" c ON c.id=p."companyId"
        LEFT JOIN "InventoryBatch" requested ON requested.id=${batchId ?? null} AND requested."companyId"=p."companyId"
        LEFT JOIN "InventoryPosition" pos ON pos."productId"=p.id AND pos."companyId"=p."companyId"
          ${batchId === undefined ? Prisma.empty : Prisma.sql`AND pos."inventoryBatchId"=${batchId}`}
        LEFT JOIN "InventoryBatch" b ON b.id=pos."inventoryBatchId" AND b."companyId"=pos."companyId" AND b."productId"=pos."productId"
        WHERE p.id=${productId} AND p."companyId"=${companyId}
        GROUP BY p.id, requested.id, requested."productId"
      `);
      const row = rows[0];
      requirePhysical(row, 'PRODUCT_NOT_FOUND');
      if (batchId !== undefined) {
        requirePhysical(row.batchId, 'INVENTORY_BATCH_NOT_FOUND');
        requirePhysical(
          row.batchProductId === productId,
          'INVENTORY_BATCH_PRODUCT_MISMATCH',
        );
      }
      for (const value of [row.owned, row.available, row.inCustody]) {
        requirePhysical(
          value >= 0n && value <= BigInt(MAX_PHYSICAL_QUANTITY),
          'PHYSICAL_QUANTITY_LIMIT',
        );
      }
      return {
        authority: 'PHYSICAL_POSITIONS' as const,
        owned: Number(row.owned),
        available: Number(row.available),
        inCustody: Number(row.inCustody),
        hasPositions: row.count > 0n,
      };
    } catch (error) {
      throw physicalPersistenceError(error);
    }
  }
}
