import { Injectable } from '@nestjs/common';
import {
  InventoryBatch,
  InventoryPosition,
  Prisma,
  Product,
} from '@prisma/client';
import {
  PhysicalInventoryError,
  PhysicalRequest,
  PositionKey,
  isPhysicalUniqueViolation,
} from './physical-inventory.contract';

@Injectable()
export class PhysicalInventoryRepository {
  findEffect(tx: Prisma.TransactionClient, request: PhysicalRequest) {
    return tx.inventoryPhysicalEffect.findUnique({
      where: {
        companyId_originType_originId_originOperation: {
          companyId: request.companyId,
          originType: request.origin.type,
          originId: request.origin.id,
          originOperation: request.origin.operation,
        },
      },
      include: { lines: { orderBy: { sequence: 'asc' } } },
    });
  }

  findSources(tx: Prisma.TransactionClient, companyId: string, ids: string[]) {
    return tx.inventoryPosition.findMany({
      where: { companyId, id: { in: ids } },
    });
  }

  lockProducts(
    tx: Prisma.TransactionClient,
    companyId: string,
    ids: string[],
  ): Promise<Product[]> {
    return tx.$queryRaw<Product[]>(Prisma.sql`
      SELECT * FROM "Product" WHERE "companyId"=${companyId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
    `);
  }

  lockBatches(tx: Prisma.TransactionClient, companyId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve<InventoryBatch[]>([]);
    return tx.$queryRaw<InventoryBatch[]>(Prisma.sql`
      SELECT * FROM "InventoryBatch" WHERE "companyId"=${companyId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
    `);
  }

  async lockPositions(
    tx: Prisma.TransactionClient,
    companyId: string,
    sources: string[],
    targets: PositionKey[],
  ) {
    const candidates = await tx.inventoryPosition.findMany({
      where: { companyId, OR: [{ id: { in: sources } }, ...targets] },
      select: { id: true },
    });
    if (!candidates.length) return [];
    return tx.$queryRaw<InventoryPosition[]>(Prisma.sql`
      SELECT * FROM "InventoryPosition" WHERE "companyId"=${companyId}
      AND id IN (${Prisma.join(candidates.map((p) => p.id).sort())}) ORDER BY id FOR UPDATE
    `);
  }

  async createPosition(
    tx: Prisma.TransactionClient,
    companyId: string,
    key: PositionKey,
  ) {
    try {
      return await tx.inventoryPosition.create({ data: { companyId, ...key } });
    } catch (error) {
      // Propagate immediately. No query may follow an aborted INSERT.
      if (isPhysicalUniqueViolation(error))
        throw new PhysicalInventoryError('PHYSICAL_POSITION_CONFLICT');
      throw error;
    }
  }

  async claimEffect(
    tx: Prisma.TransactionClient,
    request: PhysicalRequest,
    requestHash: string,
    lineCount: number,
  ) {
    try {
      return await tx.inventoryPhysicalEffect.create({
        data: {
          companyId: request.companyId,
          actorId: request.actorId,
          originType: request.origin.type,
          originId: request.origin.id,
          originOperation: request.origin.operation,
          kind: request.operation.kind,
          requestHash,
          lineCount,
          reason: request.reason,
        },
      });
    } catch (error) {
      if (isPhysicalUniqueViolation(error))
        throw new PhysicalInventoryError('PHYSICAL_EFFECT_CLAIM_CONFLICT');
      throw error;
    }
  }

  mutatePosition(
    tx: Prisma.TransactionClient,
    position: InventoryPosition,
    delta: number,
  ): Promise<Prisma.BatchPayload> {
    return tx.inventoryPosition.updateMany({
      where: {
        id: position.id,
        companyId: position.companyId,
        revision: position.revision,
        quantity: { gte: delta < 0 ? -delta : 0 },
      },
      data: { quantity: { increment: delta }, revision: { increment: 1 } },
    });
  }

  appendLine(
    tx: Prisma.TransactionClient,
    data: Prisma.InventoryPhysicalEffectLineUncheckedCreateInput,
  ) {
    return tx.inventoryPhysicalEffectLine.create({ data });
  }
}
