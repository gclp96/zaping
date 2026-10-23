import { Injectable } from '@nestjs/common';
import {
  InventoryBatch,
  InventoryPosition,
  Prisma,
  Product,
  HealthcareCaseDispatchCorrection,
} from '@prisma/client';
import {
  PhysicalInventoryError,
  PhysicalRequest,
  PositionKey,
  isPhysicalUniqueViolation,
  requirePhysical,
  normalizePositionKey,
} from './physical-inventory.contract';

@Injectable()
export class PhysicalInventoryRepository {
  // Only the specific adapter derives this root; no general writer overrides.
  async claimDispatchCorrectionEffect(
    tx: Prisma.TransactionClient,
    root: HealthcareCaseDispatchCorrection,
    lineCount: number,
  ) {
    try {
      return await tx.inventoryPhysicalEffect.create({
        data: {
          companyId: root.companyId,
          actorId: root.confirmedById,
          kind: 'TRANSFER',
          originType: 'CASE_DISPATCH_CORRECTION',
          originId: root.id,
          originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
          requestHash: root.requestHash,
          occurredAt: root.confirmedAt,
          reason: root.reason,
          lineCount,
        },
      });
    } catch (error) {
      if (isPhysicalUniqueViolation(error))
        throw new PhysicalInventoryError('PHYSICAL_EFFECT_CLAIM_CONFLICT');
      throw error;
    }
  }
  // Internal cutover primitive, deliberately absent from PhysicalRequest.
  claimOpeningEffect(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      cutoverId: string;
      productId: string;
      actorId: string;
      requestHash: string;
      lineCount: number;
    },
  ) {
    return tx.inventoryPhysicalEffect.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        kind: 'OPENING',
        originType: 'INVENTORY_OPENING',
        originId: input.cutoverId,
        originOperation: `OPEN_${input.productId}`,
        requestHash: input.requestHash,
        lineCount: input.lineCount,
      },
    });
  }
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
      where: {
        companyId,
        OR: [{ id: { in: sources } }, ...targets.map(positionData)],
      },
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
      return await tx.inventoryPosition.create({
        data: { companyId, ...positionData(key) },
      });
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

  // Keep Position CAS separate. Prisma generates real IDs and RETURNING supplies
  // persisted evidence; never infer identities from INSERT return order.
  async appendLines(
    tx: Prisma.TransactionClient,
    data: Prisma.InventoryPhysicalEffectLineCreateManyInput[],
  ) {
    requirePhysical(data.length > 0);
    const first = data[0];
    requirePhysical(
      new Set(data.map((l) => l.positionId)).size === data.length,
    );
    requirePhysical(
      data.every(
        (l, i) =>
          l.companyId === first.companyId &&
          l.effectId === first.effectId &&
          l.sequence === i + 1 &&
          l.id === undefined,
      ),
    );
    const persisted: Awaited<
      ReturnType<typeof tx.inventoryPhysicalEffectLine.createManyAndReturn>
    > = [];
    for (let offset = 0; offset < data.length; offset += 250) {
      const chunk = data.slice(offset, offset + 250);
      const rows = await tx.inventoryPhysicalEffectLine.createManyAndReturn({
        data: chunk,
      });
      requirePhysical(rows.length === chunk.length);
      const bySequence = new Map(rows.map((l) => [l.sequence, l]));
      requirePhysical(bySequence.size === chunk.length);
      for (const expected of chunk) {
        const row = bySequence.get(expected.sequence);
        requirePhysical(
          row &&
            Object.entries(expected).every(
              ([key, value]) => Reflect.get(row, key) === value,
            ),
        );
        persisted.push(row);
      }
    }
    requirePhysical(new Set(persisted.map((l) => l.id)).size === data.length);
    return persisted;
  }

  appendLine(
    tx: Prisma.TransactionClient,
    data: Prisma.InventoryPhysicalEffectLineUncheckedCreateInput,
  ) {
    return tx.inventoryPhysicalEffectLine.create({ data });
  }
}

function positionData(key: PositionKey) {
  const normalized = normalizePositionKey(key);
  return {
    ...normalized,
    expirationDate: normalized.expirationDate
      ? new Date(`${normalized.expirationDate}T00:00:00.000Z`)
      : null,
  };
}
