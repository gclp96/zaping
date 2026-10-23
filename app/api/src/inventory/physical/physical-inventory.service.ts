import { Injectable } from '@nestjs/common';
import {
  InventoryBatch,
  InventoryPosition,
  Prisma,
  Product,
} from '@prisma/client';
import {
  Credit,
  CountCorrection,
  Debit,
  Transfer,
  PhysicalCommand,
  PhysicalRequest,
  PhysicalResult,
  PositionKey,
  MAX_PHYSICAL_QUANTITY,
  normalizePhysicalRequest,
  physicalRequestHash,
  positionIdentity,
  requirePhysical,
  physicalPersistenceError,
} from './physical-inventory.contract';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import {
  DispatchCorrectionMaterialInput,
  CorrectionContext,
  loadCorrectionContext,
  correctionTransaction,
  correctionOrigin,
  assertCorrectionWriterBoundary,
  correctionTransferRequest,
  assertCorrectionSources,
  classifyCorrectionEvidence,
} from './dispatch-correction-physical.adapter';

type PlannedLine = {
  key: PositionKey;
  position?: InventoryPosition;
  delta: number;
  expectedRevision?: number;
};
const sortedUnique = (ids: string[]) => [...new Set(ids)].sort();
function positionKey(position: InventoryPosition): PositionKey {
  return {
    productId: position.productId,
    inventoryBatchId: position.inventoryBatchId,
    state: position.state,
    contextType: position.contextType,
    contextId: position.contextId,
  } as PositionKey;
}

@Injectable()
export class PhysicalInventoryService {
  constructor(private readonly repository: PhysicalInventoryRepository) {}

  async classifyCommittedDispatchCorrectionMaterial(
    tx: Prisma.TransactionClient,
    input: DispatchCorrectionMaterialInput,
    mixedDispatch = false,
  ): Promise<PhysicalResult | null> {
    correctionTransaction(tx);
    let c = await loadCorrectionContext(tx, input, mixedDispatch);
    const lookup: PhysicalRequest = {
      companyId: input.companyId,
      actorId: input.requesterId,
      origin: correctionOrigin(input.correctionId),
      operation: { kind: 'TRANSFER', transfers: [] },
    };
    const effect = await this.repository.findEffect(tx, lookup);
    if (!c && effect) c = await loadCorrectionContext(tx, input, mixedDispatch);
    if (!c) {
      requirePhysical(!effect, 'PHYSICAL_EFFECT_MISMATCH');
      return null;
    }
    return classifyCorrectionEvidence(tx, c, effect);
  }

  async transferDispatchCorrectionMaterial(
    tx: Prisma.TransactionClient,
    input: DispatchCorrectionMaterialInput,
    mixedDispatch = false,
  ): Promise<PhysicalResult> {
    correctionTransaction(tx);
    const replay = await this.classifyCommittedDispatchCorrectionMaterial(
      tx,
      input,
      mixedDispatch,
    );
    if (replay) return replay;
    const c = await loadCorrectionContext(tx, input, mixedDispatch);
    requirePhysical(c, 'PHYSICAL_EFFECT_MISMATCH');
    await assertCorrectionWriterBoundary(tx, c);
    const request = await correctionTransferRequest(tx, c);
    return this.mutate(tx, request, c);
  }

  countCorrection(
    tx: Prisma.TransactionClient,
    command: PhysicalCommand,
    count: CountCorrection,
  ) {
    return this.apply(tx, {
      ...command,
      operation: { kind: 'COUNT_CORRECTION', ...count },
    });
  }

  creditAvailable(
    tx: Prisma.TransactionClient,
    command: PhysicalCommand,
    credits: Credit[],
  ) {
    return this.apply(tx, {
      ...command,
      operation: { kind: 'CREDIT', credits },
    });
  }
  transfer(
    tx: Prisma.TransactionClient,
    command: PhysicalCommand,
    transfers: Transfer[],
  ) {
    return this.apply(tx, {
      ...command,
      operation: { kind: 'TRANSFER', transfers },
    });
  }
  definitiveOut(
    tx: Prisma.TransactionClient,
    command: PhysicalCommand,
    debits: Debit[],
  ) {
    return this.apply(tx, {
      ...command,
      operation: { kind: 'DEFINITIVE_OUT', debits },
    });
  }

  // Caller MUST let any error escape its transaction callback. No partial commit.
  async apply(
    tx: Prisma.TransactionClient,
    input: PhysicalRequest,
  ): Promise<PhysicalResult> {
    try {
      // PrismaClient is structurally assignable to TransactionClient in TS.
      // Reject that accidental non-transactional call before any database access.
      requirePhysical(tx && typeof tx === 'object' && !('$transaction' in tx));
      return await this.mutate(tx, normalizePhysicalRequest(input));
    } catch (error) {
      throw physicalPersistenceError(error);
    }
  }

  // Outer orchestration supplies a FRESH valid client only after the loser has
  // fully rolled back. This class never starts/retries a transaction.
  async classifyCommittedEffect(
    tx: Prisma.TransactionClient,
    input: PhysicalRequest,
  ): Promise<PhysicalResult | null> {
    try {
      const request = normalizePhysicalRequest(input);
      const effect = await this.repository.findEffect(tx, request);
      if (!effect) return null;
      requirePhysical(
        effect.requestHash === physicalRequestHash(request),
        'PHYSICAL_EFFECT_MISMATCH',
      );
      return { replay: true, effect, projectionDeltas: [] };
    } catch (error) {
      throw physicalPersistenceError(error);
    }
  }

  private async mutate(
    tx: Prisma.TransactionClient,
    request: PhysicalRequest,
    correction?: CorrectionContext,
  ): Promise<PhysicalResult> {
    const classify = () =>
      correction
        ? this.repository
            .findEffect(tx, request)
            .then((effect) =>
              classifyCorrectionEvidence(tx, correction, effect),
            )
        : this.classifyCommittedEffect(tx, request);
    const early = await classify();
    if (early) return early;
    const op = request.operation;
    const debits =
      op.kind === 'CREDIT' || op.kind === 'COUNT_CORRECTION'
        ? []
        : op.kind === 'TRANSFER'
          ? op.transfers
          : op.debits;
    const targets =
      op.kind === 'DEFINITIVE_OUT' || op.kind === 'COUNT_CORRECTION'
        ? []
        : op.kind === 'CREDIT'
          ? op.credits.map((v) => v.target)
          : op.transfers.map((v) => v.target);
    const sourceIds =
      op.kind === 'COUNT_CORRECTION'
        ? [op.sourceId]
        : sortedUnique(debits.map((d) => d.sourceId));
    const discovered = await this.repository.findSources(
      tx,
      request.companyId,
      sourceIds,
    );
    requirePhysical(
      discovered.length === sourceIds.length,
      'PHYSICAL_POSITION_NOT_FOUND',
    );
    if (correction)
      await assertCorrectionSources(tx, correction, request, discovered);
    const productIds = sortedUnique([
      ...discovered.map((p) => p.productId),
      ...targets.map((p) => p.productId),
    ]);
    const products = await this.repository.lockProducts(
      tx,
      request.companyId,
      productIds,
    );
    requirePhysical(products.length === productIds.length, 'PRODUCT_NOT_FOUND');
    const lockedReplay = await classify();
    if (lockedReplay) return lockedReplay;
    const batchIds = sortedUnique(
      [
        ...discovered.map((p) => p.inventoryBatchId),
        ...targets.map((p) => p.inventoryBatchId),
      ].filter((id): id is string => id !== null),
    );
    const batches = await this.repository.lockBatches(
      tx,
      request.companyId,
      batchIds,
    );
    requirePhysical(
      batches.length === batchIds.length,
      'INVENTORY_BATCH_NOT_FOUND',
    );
    const positions = await this.repository.lockPositions(
      tx,
      request.companyId,
      sourceIds,
      targets,
    );
    if (correction)
      await assertCorrectionSources(tx, correction, request, positions);
    const byId = new Map(positions.map((p) => [p.id, p]));
    requirePhysical(
      sourceIds.every((id) => byId.has(id)),
      'PHYSICAL_POSITION_NOT_FOUND',
    );
    const byKey = new Map(
      positions.map((p) => [positionIdentity(positionKey(p)), p]),
    );
    const productMap = new Map(products.map((p) => [p.id, p]));
    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const now = new Date();
    const plan = new Map<string, PlannedLine>();
    const add = (
      key: PositionKey,
      delta: number,
      expectedRevision?: number,
    ) => {
      const product = productMap.get(key.productId);
      requirePhysical(product, 'PRODUCT_NOT_FOUND');
      this.validateKey(key, product, batchMap, now);
      const identity = positionIdentity(key);
      const existing = plan.get(identity);
      requirePhysical(
        !existing || Math.sign(existing.delta) === Math.sign(delta),
      );
      requirePhysical(
        !existing ||
          existing.expectedRevision === undefined ||
          expectedRevision === undefined ||
          existing.expectedRevision === expectedRevision,
      );
      plan.set(identity, {
        key,
        position: byKey.get(identity),
        delta: (existing?.delta ?? 0) + delta,
        expectedRevision: existing?.expectedRevision ?? expectedRevision,
      });
    };
    if (op.kind === 'COUNT_CORRECTION') {
      const source = byId.get(op.sourceId)!;
      requirePhysical(
        source.state === 'AVAILABLE',
        'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      );
      add(
        positionKey(source),
        op.countedQuantity - source.quantity,
        op.expectedRevision,
      );
    } else if (op.kind === 'CREDIT') {
      for (const credit of op.credits) add(credit.target, credit.quantity);
    } else {
      for (const debit of debits) {
        const source = byId.get(debit.sourceId)!;
        add(positionKey(source), -debit.quantity, debit.expectedSourceRevision);
      }
      if (op.kind === 'TRANSFER') {
        for (const transfer of op.transfers) {
          const source = byId.get(transfer.sourceId)!;
          requirePhysical(
            source.productId === transfer.target.productId &&
              source.inventoryBatchId === transfer.target.inventoryBatchId,
            'INVENTORY_BATCH_PRODUCT_MISMATCH',
          );
          add(transfer.target, transfer.quantity);
        }
      }
    }
    const lines = [...plan.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, v]) => v);
    const deltas = new Map<string, number>();
    for (const line of lines) {
      const quantityBefore = line.position?.quantity ?? 0;
      requirePhysical(
        line.delta >= 0 || line.position,
        'PHYSICAL_POSITION_NOT_FOUND',
      );
      requirePhysical(
        line.expectedRevision === undefined ||
          line.expectedRevision === line.position?.revision,
        'STALE_INVENTORY_REVISION',
      );
      requirePhysical(
        quantityBefore + line.delta >= 0,
        'INSUFFICIENT_PHYSICAL_AVAILABILITY',
      );
      requirePhysical(
        Math.abs(line.delta) <= MAX_PHYSICAL_QUANTITY &&
          quantityBefore + line.delta <= MAX_PHYSICAL_QUANTITY &&
          (line.delta === 0 ||
            (line.position?.revision ?? 0) < MAX_PHYSICAL_QUANTITY),
        'PHYSICAL_QUANTITY_LIMIT',
      );
      deltas.set(
        line.key.productId,
        (deltas.get(line.key.productId) ?? 0) + line.delta,
      );
    }
    const owned = await tx.inventoryPosition.groupBy({
      by: ['productId'],
      where: { companyId: request.companyId, productId: { in: productIds } },
      _sum: { quantity: true },
    });
    for (const productId of productIds) {
      const total =
        (owned.find((p) => p.productId === productId)?._sum.quantity ?? 0) +
        (deltas.get(productId) ?? 0);
      requirePhysical(
        total >= 0 && total <= MAX_PHYSICAL_QUANTITY,
        'PHYSICAL_QUANTITY_LIMIT',
      );
    }
    const actor = await tx.user.findFirst({
      where: { id: request.actorId, companyId: request.companyId },
      select: { id: true },
    });
    requirePhysical(actor, 'INVENTORY_TENANT_MISMATCH');
    const replay = await classify();
    if (replay) return replay;
    const header = correction
      ? await this.repository.claimDispatchCorrectionEffect(
          tx,
          correction.root,
          lines.length,
        )
      : await this.repository.claimEffect(
          tx,
          request,
          physicalRequestHash(request),
          lines.length,
        );
    const staged: Prisma.InventoryPhysicalEffectLineCreateManyInput[] = [];
    for (const [index, line] of lines.entries()) {
      const position =
        line.position ??
        (await this.repository.createPosition(tx, request.companyId, line.key));
      const result =
        line.delta === 0
          ? { count: 1 }
          : await this.repository.mutatePosition(tx, position, line.delta);
      requirePhysical(result.count === 1, 'PHYSICAL_POSITION_CONFLICT');
      staged.push({
        companyId: request.companyId,
        effectId: header.id,
        positionId: position.id,
        sequence: index + 1,
        delta: line.delta,
        quantityBefore: position.quantity,
        quantityAfter: position.quantity + line.delta,
        revisionBefore: position.revision,
        revisionAfter: position.revision + (line.delta === 0 ? 0 : 1),
      });
    }
    const evidence = await this.repository.appendLines(tx, staged);
    return {
      replay: false,
      effect: { ...header, lines: evidence },
      projectionDeltas: productIds.map((productId) => ({
        productId,
        ownedDelta: deltas.get(productId) ?? 0,
      })),
    };
  }

  private validateKey(
    key: PositionKey,
    product: Product,
    batches: Map<string, InventoryBatch>,
    now: Date,
  ) {
    requirePhysical(product.inventoryTracking === 'QUANTITY');
    requirePhysical(
      product.lotTracking !== 'REQUIRED' || key.inventoryBatchId !== null,
    );
    requirePhysical(
      product.lotTracking !== 'NONE' || key.inventoryBatchId === null,
    );
    const batch = key.inventoryBatchId
      ? batches.get(key.inventoryBatchId)
      : undefined;
    if (key.inventoryBatchId) {
      requirePhysical(batch, 'INVENTORY_BATCH_NOT_FOUND');
      requirePhysical(
        batch.productId === product.id && batch.companyId === product.companyId,
        'INVENTORY_BATCH_PRODUCT_MISMATCH',
      );
    }
    if (key.state === 'AVAILABLE') {
      requirePhysical(
        product.isActive &&
          (!batch ||
            (batch.isActive &&
              (!batch.expirationDate || batch.expirationDate > now))),
        'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      );
    }
  }
}
