import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  orchestrationOrigin,
  orchestrationState,
  OrchestrationOrigin,
} from './dispatch-correction-material-orchestration-fixture';
import { MaterialCorrectionResult } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction-command.contract';
import { DISPATCH_CORRECTION_SCOPE } from '../../src/healthcare/case-dispatch-corrections/healthcare-case-dispatch-correction.contract';

export function latch() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
}

export function abortableTwoPartyBarrier() {
  let arrivals = 0,
    release!: () => void,
    abort!: (error: unknown) => void;
  const gate = new Promise<void>((resolve, reject) => {
    release = resolve;
    abort = reject;
  });
  // Abort may precede the other participant reaching the gate.
  void gate.catch(() => undefined);
  return {
    async arrive() {
      if (++arrivals === 2) release();
      await gate;
    },
    abort,
  };
}

export function settled<T>(
  promise: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

export async function transactionPid(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<
    { pid: number }[]
  >`SELECT pg_backend_pid() AS pid`;
  return row.pid;
}

// Diagnostic sampling only: no sleeps and NO retry of a writer/transaction.
// Fails if real server blocking cannot be observed within the existing lock budget.
export async function observeBlocking(
  observer: PrismaClient,
  waiter: number,
  blocker: number,
) {
  const deadline = Date.now() + 1000;
  for (let sample = 0; sample < 250 && Date.now() < deadline; sample++) {
    const [row] = await observer.$queryRaw<{ blocked: boolean }[]>`
      SELECT ${blocker}::integer=ANY(pg_blocking_pids(${waiter}::integer)) AS blocked`;
    if (row.blocked) return;
  }
  throw new Error(
    'Expected PostgreSQL blocking edge was not observed (no writer retry)',
  );
}

export async function concurrencyOrigin(
  db: PrismaClient,
  runId: string,
  kind: 'simple' | 'grouped' | 'batch' = 'simple',
) {
  // Only builders from B/A/01B are reused; never their database authorization.
  const origin = await orchestrationOrigin(db, kind);
  await db.company.update({
    where: { id: origin.f.companyId },
    data: { name: 'HC-DSP-COR-01C-C QA ' + runId },
  });
  return origin;
}

export type State = Awaited<ReturnType<typeof orchestrationState>>;

export function expectOriginalHistory(before: State, after: State) {
  expect(after.dispatch).toEqual(before.dispatch);
  expect(after.sources).toEqual(before.sources);
  expect(after.dispatchAudit).toEqual(before.dispatchAudit);
  expect(after.kits).toEqual(before.kits);
  expect(after.assets).toEqual(before.assets);
  expect(after.events).toEqual(before.events);
  expect(after.rr).toEqual(before.rr);
  expect(
    after.effects.filter((e) => e.originType !== 'CASE_DISPATCH_CORRECTION'),
  ).toEqual(
    before.effects.filter((e) => e.originType !== 'CASE_DISPATCH_CORRECTION'),
  );
}

export function expectCommittedCorrection(
  o: OrchestrationOrigin,
  before: State,
  after: State,
  result: MaterialCorrectionResult,
  winningKey: string,
) {
  expect(result.replay).toBe(false);
  expect(after.roots).toHaveLength(1);
  const root = after.roots[0];
  expect(root.snapshot).not.toBeNull();
  expect(root.confirmedById).toBe(o.f.user.id);
  expect(result.witness).toMatchObject(root);
  expect(result.witness.id).toBe(root.id);
  expect(result.witness.requestHash).toBe(root.requestHash);
  expect(result.witness.confirmedAt).toEqual(root.confirmedAt);
  expect(result.witness.confirmedById).toBe(root.confirmedById);
  const claims = after.claims.filter(
    (c) => c.scope === DISPATCH_CORRECTION_SCOPE,
  );
  expect(claims).toHaveLength(1);
  expect(claims[0]).toMatchObject({
    id: root.idempotencyRecordId,
    key: winningKey,
    requestHash: root.requestHash,
    resourceId: root.id,
  });
  const effects = after.effects.filter(
    (e) => e.originType === 'CASE_DISPATCH_CORRECTION',
  );
  expect(effects).toHaveLength(1);
  const effect = effects[0];
  expect(effect).toMatchObject({
    originId: root.id,
    originOperation: 'COMPENSATE_NO_HANDOFF_QUANTITY',
    actorId: root.confirmedById,
    requestHash: root.requestHash,
    occurredAt: root.confirmedAt,
  });
  expect(effect.lines).toHaveLength(effect.lineCount);
  expect(effect.lines.reduce((n, l) => n + l.delta, 0)).toBe(0);
  const sources = before.sources.filter((s) => s.lifecycle === 'ACTIVE');
  expect(effect.lineCount).toBe(
    sources.length +
      new Set(after.items.map((i) => i.destinationPositionId)).size,
  );
  for (const line of effect.lines) {
    const position = after.positions.find((p) => p.id === line.positionId)!;
    expect(position).toMatchObject({
      quantity: line.quantityAfter,
      revision: line.revisionAfter,
    });
    expect(line.quantityAfter).toBe(line.quantityBefore + line.delta);
    expect(line.revisionAfter).toBe(line.revisionBefore + 1);
  }
  expect(after.items).toHaveLength(sources.length);
  expect(result.witness.items).toHaveLength(sources.length);
  for (const source of sources) {
    const item = after.items.find((i) => i.sourceDispatchItemId === source.id)!;
    expect(item).toMatchObject({
      correctionId: root.id,
      quantity: source.quantity,
      originalPhysicalEffectId: source.physicalEffectId,
      sourceCustodyPositionId: source.destinationPositionId,
      compensatingEffectId: effect.id,
    });
    expect(item.snapshot).not.toBeNull();
    expect(result.witness.items.find((i) => i.id === item.id)).toMatchObject(
      item,
    );
    expect(
      after.positions.find((p) => p.id === source.destinationPositionId),
    ).toMatchObject({
      quantity: 0,
      revision: 2,
      state: 'CUSTODY',
      contextId: source.id,
    });
    expect(
      effect.lines.find((l) => l.positionId === source.destinationPositionId),
    ).toMatchObject({
      delta: -source.quantity!,
      quantityAfter: 0,
      revisionAfter: 2,
    });
    const available = after.positions.find(
      (p) => p.id === item.destinationPositionId,
    )!;
    expect(available).toMatchObject({
      state: 'AVAILABLE',
      contextType: null,
      contextId: null,
      productId: source.productId,
      inventoryBatchId: source.batchId,
    });
    const total = sources
      .filter(
        (s) => s.productId === source.productId && s.batchId === source.batchId,
      )
      .reduce((n, s) => n + s.quantity!, 0);
    const old = before.positions.find((p) => p.id === available.id)!;
    expect(available.quantity).toBe(old.quantity + total);
    expect(
      effect.lines.find((l) => l.positionId === available.id),
    ).toMatchObject({
      delta: total,
      quantityBefore: old.quantity,
      quantityAfter: available.quantity,
      revisionBefore: old.revision,
      revisionAfter: available.revision,
    });
  }
  for (const p of before.products) {
    const sum = (state: State) =>
      state.positions
        .filter((x) => x.productId === p.id)
        .reduce((n, x) => n + x.quantity, 0);
    expect(sum(after)).toBe(sum(before));
  }
  expect(after.products).toEqual(before.products);
  for (const batch of before.batches) {
    const returned = sources
      .filter((s) => s.batchId === batch.id)
      .reduce((n, s) => n + s.quantity!, 0);
    expect(after.batches.find((b) => b.id === batch.id)).toMatchObject({
      initialQuantity: batch.initialQuantity,
      availableQuantity: batch.availableQuantity + returned,
    });
  }
  expectOriginalHistory(before, after);
}

export function movingCommand(o: OrchestrationOrigin) {
  return {
    companyId: o.f.companyId,
    actorId: o.f.user.id,
    origin: {
      type: 'HC_DSP_COR_01C_C_QA',
      id: randomUUID(),
      operation: 'COMPETING_TRANSFER',
    },
  };
}
export function movingTransfer(o: OrchestrationOrigin) {
  return [
    {
      sourceId: o.source.destinationPositionId!,
      quantity: 1,
      expectedSourceRevision: 1,
      target: {
        productId: o.source.productId,
        inventoryBatchId: o.source.batchId,
        state: 'AVAILABLE' as const,
        contextType: null,
        contextId: null,
      },
    },
  ];
}
