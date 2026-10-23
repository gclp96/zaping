import {
  Prisma,
  PrismaClient,
  HealthcareCaseDispatchCorrection,
} from '@prisma/client';
import {
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
  HealthcareCompanyTransactionTimeoutPolicy,
} from '../common/healthcare-company-transaction-timeout-policy';
import { applyHealthcareSubsequentTransactionTimeouts } from '../common/healthcare-subsequent-transaction-timeouts';
import {
  DispatchCorrectionLookup,
  HealthcareCaseDispatchCorrectionRepository,
} from './healthcare-case-dispatch-correction.repository';
import { DISPATCH_CORRECTION_SCOPE } from './healthcare-case-dispatch-correction.contract';
import {
  assertMaterialCommand,
  MaterialCorrectionContext,
} from './healthcare-case-dispatch-correction-command.contract';
import type { PhysicalResult } from '../../inventory/physical/physical-inventory.contract';

type Tx = Prisma.TransactionClient;
const sourceInclude = {
  items: {
    where: { lifecycle: 'ACTIVE' as const },
    orderBy: { id: 'asc' as const },
  },
};
export type MaterialCorrectionSource = Prisma.HealthcareCaseDispatchGetPayload<{
  include: typeof sourceInclude;
}>;

// Internal, deliberately unregistered. No existing Dispatch command repository is mutated.
export class HealthcareCaseDispatchCorrectionCommandRepository {
  constructor(private readonly db: PrismaClient) {}
  read<T>(
    fn: (tx: Tx) => Promise<T>,
    p: HealthcareCompanyTransactionTimeoutPolicy,
  ) {
    assertValidHealthcareCompanyTransactionTimeoutPolicy(p);
    return this.db.$transaction(fn, {
      isolationLevel: 'RepeatableRead',
      maxWait: p.prismaMaxWaitMs,
      timeout: p.prismaTransactionTimeoutMs,
    });
  }
  write<T>(
    fn: (tx: Tx) => Promise<T>,
    p: HealthcareCompanyTransactionTimeoutPolicy,
  ) {
    assertValidHealthcareCompanyTransactionTimeoutPolicy(p);
    return this.db.$transaction(
      async (tx) => {
        await applyHealthcareSubsequentTransactionTimeouts(tx, p);
        return fn(tx);
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: p.prismaMaxWaitMs,
        timeout: p.prismaTransactionTimeoutMs,
      },
    );
  }
  async authorize(tx: Tx, c: MaterialCorrectionContext) {
    const actor = await tx.user.findFirst({
      where: {
        id: c.requesterId,
        companyId: c.companyId,
        isActive: true,
        role: { in: ['ADMIN', 'MANAGER'] },
      },
    });
    assertMaterialCommand(actor, 'CORRECTION_ACTOR_FORBIDDEN');
    return actor;
  }
  replayWitness(tx: Tx, c: MaterialCorrectionContext, hash: string) {
    const lookup: DispatchCorrectionLookup = {
      companyId: c.companyId,
      caseId: c.caseId,
      dispatchId: c.dispatchId,
    };
    return new HealthcareCaseDispatchCorrectionRepository(tx).findReplay(
      lookup,
      c.idempotencyKey,
      hash,
    );
  }
  witness(tx: Tx, c: MaterialCorrectionContext) {
    const lookup: DispatchCorrectionLookup = {
      companyId: c.companyId,
      caseId: c.caseId,
      dispatchId: c.dispatchId,
    };
    return new HealthcareCaseDispatchCorrectionRepository(tx).findWitness(
      lookup,
    );
  }
  control(tx: Tx, companyId: string) {
    return tx.inventoryCutover.findUnique({ where: { companyId } });
  }
  async createClaim(
    tx: Tx,
    input: {
      companyId: string;
      resourceId: string;
      key: string;
      requestHash: string;
    },
  ) {
    return tx.idempotencyRecord.create({
      data: { ...input, scope: DISPATCH_CORRECTION_SCOPE },
    });
  }
  async lockStructure(tx: Tx, c: MaterialCorrectionContext) {
    const cases = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "HealthcareCase" WHERE id=${c.caseId} AND "companyId"=${c.companyId} FOR SHARE`;
    assertMaterialCommand(cases.length === 1, 'CORRECTION_DISPATCH_NOT_FOUND');
    const dispatch = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "HealthcareCaseDispatch" WHERE id=${c.dispatchId} AND "caseId"=${c.caseId} AND "companyId"=${c.companyId} FOR UPDATE`;
    assertMaterialCommand(
      dispatch.length === 1,
      'CORRECTION_DISPATCH_NOT_FOUND',
    );
    await tx.$queryRaw`SELECT id FROM "HealthcareCaseDispatchItem" WHERE "dispatchId"=${c.dispatchId} AND "companyId"=${c.companyId} AND lifecycle='ACTIVE' ORDER BY id FOR UPDATE`;
    const source = await tx.healthcareCaseDispatch.findFirst({
      where: { id: c.dispatchId, companyId: c.companyId, caseId: c.caseId },
      include: sourceInclude,
    });
    assertMaterialCommand(source, 'CORRECTION_DISPATCH_NOT_FOUND');
    return source;
  }
  async assertNoCorrection(tx: Tx, c: MaterialCorrectionContext) {
    assertMaterialCommand(
      !(await tx.healthcareCaseDispatchCorrection.findFirst({
        where: { companyId: c.companyId, dispatchId: c.dispatchId },
        select: { id: true },
      })),
      'CORRECTION_ALREADY_EXISTS',
    );
  }
  async assertSource(
    tx: Tx,
    c: MaterialCorrectionContext,
    source: MaterialCorrectionSource,
    equipment = false,
  ) {
    assertMaterialCommand(
      source.companyId === c.companyId &&
        source.caseId === c.caseId &&
        source.id === c.dispatchId,
      'CORRECTION_DISPATCH_NOT_FOUND',
    );
    assertMaterialCommand(
      source.status === 'CONFIRMED' && source.snapshot !== null,
      'CORRECTION_DISPATCH_NOT_CONFIRMED',
    );
    assertMaterialCommand(
      source.items.length > 0 &&
        source.items.length <= 1000 &&
        source.items.every(
          (i) => i.type === 'MATERIAL' || (equipment && i.type === 'EQUIPMENT'),
        ),
      'CORRECTION_MATERIAL_ONLY',
    );
    const rr = await tx.healthcareCaseReconciliation.findFirst({
      where: {
        companyId: c.companyId,
        dispatchId: c.dispatchId,
        OR: [
          { status: { not: 'CANCELLED' } },
          {
            items: {
              some: {
                OR: [
                  { returnedPhysicalEffectId: { not: null } },
                  { usedPhysicalEffectId: { not: null } },
                  { closePhysicalEventId: { not: null } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    assertMaterialCommand(!rr, 'CORRECTION_RECONCILIATION_INCOMPATIBLE');
  }
  async serverTime(tx: Tx) {
    const [row] = await tx.$queryRaw<
      { at: Date }[]
    >`SELECT date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC') AS at`;
    assertMaterialCommand(
      row?.at instanceof Date,
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    return row.at;
  }
  async createRoot(
    tx: Tx,
    data: Prisma.HealthcareCaseDispatchCorrectionUncheckedCreateInput,
  ) {
    return tx.healthcareCaseDispatchCorrection.create({ data });
  }
  async createEvidenceItems(
    tx: Tx,
    c: MaterialCorrectionContext,
    root: HealthcareCaseDispatchCorrection,
    source: MaterialCorrectionSource,
    result: PhysicalResult,
  ) {
    const effect = result.effect;
    assertMaterialCommand(
      !result.replay &&
        effect.companyId === c.companyId &&
        effect.originType === 'CASE_DISPATCH_CORRECTION' &&
        effect.originId === root.id &&
        effect.originOperation === 'COMPENSATE_NO_HANDOFF_QUANTITY' &&
        effect.kind === 'TRANSFER' &&
        effect.requestHash === root.requestHash &&
        effect.actorId === root.confirmedById &&
        effect.occurredAt.getTime() === root.confirmedAt.getTime(),
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    const facts = await tx.inventoryPhysicalEffectLine.findMany({
      where: { companyId: c.companyId, effectId: effect.id },
      include: { position: true },
      orderBy: { sequence: 'asc' },
    });
    assertMaterialCommand(
      facts.length === effect.lineCount &&
        facts.length === effect.lines.length &&
        facts.every((l) =>
          effect.lines.some(
            (e) =>
              e.id === l.id &&
              e.delta === l.delta &&
              e.positionId === l.positionId &&
              e.quantityBefore === l.quantityBefore &&
              e.quantityAfter === l.quantityAfter &&
              e.revisionBefore === l.revisionBefore &&
              e.revisionAfter === l.revisionAfter,
          ),
        ),
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    const used = new Set<string>(),
      totals = new Map<string, number>(),
      owned = new Map<string, number>();
    const data: Prisma.HealthcareCaseDispatchCorrectionItemCreateManyInput[] =
      [];
    for (const line of facts) {
      assertMaterialCommand(
        line.position.companyId === c.companyId &&
          line.position.quantity === line.quantityAfter &&
          line.position.revision === line.revisionAfter,
        'CORRECTION_EVIDENCE_INCONSISTENT',
      );
      owned.set(
        line.position.productId,
        (owned.get(line.position.productId) ?? 0) + line.delta,
      );
    }
    for (const item of source.items) {
      const debit = facts.find(
        (l) => l.positionId === item.destinationPositionId,
      );
      const credit = facts.find(
        (l) =>
          l.position.productId === item.productId &&
          l.position.inventoryBatchId === item.batchId &&
          l.position.state === 'AVAILABLE' &&
          l.position.contextType === null &&
          l.position.contextId === null,
      );
      assertMaterialCommand(
        item.type === 'MATERIAL' &&
          item.quantity !== null &&
          debit &&
          credit &&
          debit.position.productId === item.productId &&
          debit.position.inventoryBatchId === item.batchId &&
          debit.position.state === 'CUSTODY' &&
          debit.position.contextType === 'CASE_DISPATCH_ITEM' &&
          debit.position.contextId === item.id &&
          debit.delta === -item.quantity &&
          debit.quantityBefore === item.quantity &&
          debit.quantityAfter === 0,
        'CORRECTION_EVIDENCE_INCONSISTENT',
      );
      used.add(debit.id);
      used.add(credit.id);
      totals.set(credit.id, (totals.get(credit.id) ?? 0) + item.quantity);
      data.push({
        companyId: c.companyId,
        correctionId: root.id,
        dispatchId: c.dispatchId,
        sourceDispatchItemId: item.id,
        type: 'MATERIAL',
        quantity: item.quantity,
        originalPhysicalEffectId: item.physicalEffectId,
        sourceCustodyPositionId: item.destinationPositionId,
        compensatingEffectId: effect.id,
        destinationPositionId: credit.positionId,
      });
    }
    assertMaterialCommand(
      used.size === facts.length &&
        [...owned.values()].every((n) => n === 0) &&
        [...totals].every(
          ([id, total]) => facts.find((l) => l.id === id)?.delta === total,
        ) &&
        result.projectionDeltas.every((d) => d.ownedDelta === 0),
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    const inserted = await tx.healthcareCaseDispatchCorrectionItem.createMany({
      data,
    });
    assertMaterialCommand(
      inserted.count === data.length,
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
    const snapshots =
      await tx.$executeRaw`UPDATE "HealthcareCaseDispatchCorrectionItem" SET snapshot=public.dispatch_correction_item_snapshot(id) WHERE "correctionId"=${root.id} AND "companyId"=${c.companyId} AND type='MATERIAL'`;
    assertMaterialCommand(
      snapshots === data.length,
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
  }
  async seal(
    tx: Tx,
    root: HealthcareCaseDispatchCorrection,
    source: MaterialCorrectionSource,
    actor: { id: string; role: string },
  ) {
    const snapshot: Prisma.InputJsonObject = {
      version: 1,
      correctionId: root.id,
      kind: root.kind,
      reason: root.reason,
      attestedNoHandoff: true,
      sourceDispatch: { id: source.id, history: source.snapshot },
      confirmedBy: { id: actor.id, role: actor.role },
      confirmedAt: root.confirmedAt.toISOString(),
      requestHash: root.requestHash,
    };
    const count = await tx.healthcareCaseDispatchCorrection.updateMany({
      where: {
        id: root.id,
        companyId: root.companyId,
        snapshot: { equals: Prisma.DbNull },
      },
      data: { snapshot },
    });
    assertMaterialCommand(
      count.count === 1,
      'CORRECTION_EVIDENCE_INCONSISTENT',
    );
  }
  async constraints(tx: Tx) {
    await tx.$executeRaw`SET CONSTRAINTS "InventoryPhysicalEffect_complete", "DispatchCorrection_complete", "DispatchCorrectionItem_complete", "DispatchCorrection_idempotency_complete" IMMEDIATE`;
  }
}
