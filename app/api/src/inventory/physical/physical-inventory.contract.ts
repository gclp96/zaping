import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import { Prisma } from '@prisma/client';

export const MAX_PHYSICAL_QUANTITY = 2147483647;
export type PhysicalErrorCode =
  | 'INVALID_PHYSICAL_REQUEST'
  | 'PRODUCT_NOT_FOUND'
  | 'INVENTORY_BATCH_NOT_FOUND'
  | 'PHYSICAL_POSITION_NOT_FOUND'
  | 'INVENTORY_TENANT_MISMATCH'
  | 'INVENTORY_BATCH_PRODUCT_MISMATCH'
  | 'INSUFFICIENT_PHYSICAL_AVAILABILITY'
  | 'PHYSICAL_SOURCE_NOT_ELIGIBLE'
  | 'PHYSICAL_POSITION_CONFLICT'
  | 'STALE_INVENTORY_REVISION'
  | 'PHYSICAL_EFFECT_MISMATCH'
  | 'PHYSICAL_EFFECT_CLAIM_CONFLICT'
  | 'PHYSICAL_QUANTITY_LIMIT'
  | 'PHYSICAL_CONCURRENCY_TIMEOUT'
  | 'SALE_PHYSICAL_SOURCE_REQUIRED'
  | 'SALE_PHYSICAL_SOURCE_INVALID'
  | 'SALE_PHYSICAL_EFFECT_MISMATCH'
  | 'SALE_PHYSICAL_STATE_INCONSISTENT'
  | 'INVENTORY_PHYSICAL_PERSISTENCE_ERROR';

// No HTTP mapping or raw database cause crosses this internal domain boundary.
export class PhysicalInventoryError extends Error {
  constructor(
    readonly code: PhysicalErrorCode,
    // Internal classification only; never retain raw database diagnostics.
    readonly transactionAborted = false,
  ) {
    super(code);
    this.name = 'PhysicalInventoryError';
  }
}
export function requirePhysical(
  condition: unknown,
  code: PhysicalErrorCode = 'INVALID_PHYSICAL_REQUEST',
): asserts condition {
  if (!condition) throw new PhysicalInventoryError(code);
}
export function physicalPersistenceError(
  error: unknown,
): PhysicalInventoryError {
  if (error instanceof PhysicalInventoryError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (
      error.code === 'P2034' ||
      error.meta?.code === '40001' ||
      error.meta?.code === '55P03' ||
      error.meta?.code === '40P01'
    ) {
      return new PhysicalInventoryError(
        'PHYSICAL_CONCURRENCY_TIMEOUT',
        error.code === 'P2034' ||
          error.meta?.code === '40001' ||
          error.meta?.code === '40P01',
      );
    }
  }
  return new PhysicalInventoryError('INVENTORY_PHYSICAL_PERSISTENCE_ERROR');
}
export function isPhysicalUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' ||
      (error.code === 'P2010' && error.meta?.code === '23505'))
  );
}

export type PositionKey = {
  productId: string;
  inventoryBatchId: string | null;
  // Calendar day, never an instant. Omission/null retains the legacy identity.
  expirationDate?: string | null;
} & (
  | { state: 'AVAILABLE'; contextType: null; contextId: null }
  | { state: 'CUSTODY'; contextType: string; contextId: string }
);
export type PhysicalOrigin = { type: string; id: string; operation: string };
export type PhysicalCommand = {
  companyId: string;
  actorId: string;
  origin: PhysicalOrigin;
  reason?: string;
};
export type Credit = { target: PositionKey; quantity: number };
export type Debit = {
  sourceId: string;
  quantity: number;
  expectedSourceRevision?: number;
};
export type Transfer = Debit & { target: PositionKey };
export type CountCorrection = {
  sourceId: string;
  countedQuantity: number;
  expectedRevision: number;
};
export type PhysicalOperation =
  | ({ kind: 'COUNT_CORRECTION' } & CountCorrection)
  | { kind: 'CREDIT'; credits: Credit[] }
  | { kind: 'TRANSFER'; transfers: Transfer[] }
  | { kind: 'DEFINITIVE_OUT'; debits: Debit[] };
export type PhysicalRequest = PhysicalCommand & {
  operation: PhysicalOperation;
};
export type PhysicalEffect = Prisma.InventoryPhysicalEffectGetPayload<{
  include: { lines: true };
}>;
export type PhysicalResult = {
  replay: boolean;
  effect: PhysicalEffect;
  projectionDeltas: { productId: string; ownedDelta: number }[];
};

export function positionIdentity(key: PositionKey): string {
  const identity = [
    key.productId,
    key.inventoryBatchId,
    key.state,
    key.contextType,
    key.contextId,
  ];
  const day = normalizePositionExpirationDate(key.expirationDate);
  if (day !== null) identity.push(day);
  return JSON.stringify(identity);
}

export function normalizePositionExpirationDate(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  requirePhysical(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value),
  );
  const date = new Date(`${value}T00:00:00.000Z`);
  requirePhysical(
    Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= '0001-01-01',
  );
  return value;
}
function uuid(value: string): string {
  requirePhysical(typeof value === 'string' && isUUID(value));
  return value;
}
function text(value: string, max: number): string {
  requirePhysical(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= max &&
      value === value.trim(),
  );
  return value;
}
export function normalizePositionKey(key: PositionKey): PositionKey {
  requirePhysical(key && typeof key === 'object');
  const productId = uuid(key.productId);
  const inventoryBatchId =
    key.inventoryBatchId === null ? null : uuid(key.inventoryBatchId);
  const expirationDate = normalizePositionExpirationDate(key.expirationDate);
  requirePhysical(inventoryBatchId === null || expirationDate === null);
  // Do not append a null field: historical request serialization must not change.
  const expiry = expirationDate === null ? {} : { expirationDate };
  if (key.state === 'AVAILABLE') {
    requirePhysical(key.contextType === null && key.contextId === null);
    return {
      productId,
      inventoryBatchId,
      state: 'AVAILABLE',
      contextType: null,
      contextId: null,
      ...expiry,
    };
  }
  requirePhysical(key.state === 'CUSTODY');
  const contextType = text(key.contextType, 64);
  requirePhysical(/^[A-Z][A-Z0-9_]*$/.test(contextType));
  return {
    productId,
    inventoryBatchId,
    state: 'CUSTODY',
    contextType,
    contextId: text(key.contextId, 128),
    ...expiry,
  };
}
function quantity(value: number): number {
  requirePhysical(
    Number.isInteger(value) && value > 0 && value <= MAX_PHYSICAL_QUANTITY,
  );
  return value;
}
function source(value: Debit): Debit {
  requirePhysical(value && typeof value === 'object');
  const result: Debit = {
    sourceId: uuid(value.sourceId),
    quantity: quantity(value.quantity),
  };
  if (value.expectedSourceRevision !== undefined) {
    requirePhysical(
      Number.isInteger(value.expectedSourceRevision) &&
        value.expectedSourceRevision >= 0 &&
        value.expectedSourceRevision <= MAX_PHYSICAL_QUANTITY,
    );
    result.expectedSourceRevision = value.expectedSourceRevision;
  }
  return result;
}
function aggregate<T extends { quantity: number }>(
  items: T[],
  key: (item: T) => string,
): T[] {
  const grouped = new Map<string, T>();
  for (const item of items) {
    const identity = key(item);
    const existing = grouped.get(identity);
    const sum = (existing?.quantity ?? 0) + item.quantity;
    requirePhysical(sum <= MAX_PHYSICAL_QUANTITY, 'PHYSICAL_QUANTITY_LIMIT');
    grouped.set(identity, { ...item, quantity: sum });
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, item]) => item);
}
export function normalizePhysicalRequest(
  request: PhysicalRequest,
): PhysicalRequest {
  requirePhysical(request && request.origin && request.operation);
  const command: PhysicalCommand = {
    companyId: uuid(request.companyId),
    actorId: uuid(request.actorId),
    origin: {
      type: text(request.origin.type, 64),
      id: text(request.origin.id, 128),
      operation: text(request.origin.operation, 64),
    },
  };
  if (request.reason !== undefined) {
    requirePhysical(typeof request.reason === 'string');
    command.reason = text(request.reason.trim(), 1000);
  }
  const op = request.operation;
  if (op.kind === 'COUNT_CORRECTION') {
    requirePhysical(command.reason);
    for (const value of [op.countedQuantity, op.expectedRevision]) {
      requirePhysical(
        Number.isInteger(value) && value >= 0 && value <= MAX_PHYSICAL_QUANTITY,
      );
    }
    return {
      ...command,
      operation: {
        kind: 'COUNT_CORRECTION',
        sourceId: uuid(op.sourceId),
        countedQuantity: op.countedQuantity,
        expectedRevision: op.expectedRevision,
      },
    };
  }
  const items =
    op.kind === 'CREDIT'
      ? op.credits
      : op.kind === 'TRANSFER'
        ? op.transfers
        : op.kind === 'DEFINITIVE_OUT'
          ? op.debits
          : undefined;
  requirePhysical(
    Array.isArray(items) && items.length > 0 && items.length <= 1000,
  );
  let operation: PhysicalOperation;
  if (op.kind === 'CREDIT') {
    const credits = op.credits.map((item) => {
      requirePhysical(item && typeof item === 'object');
      const target = normalizePositionKey(item.target);
      requirePhysical(target.state === 'AVAILABLE');
      return { target, quantity: quantity(item.quantity) };
    });
    operation = {
      kind: 'CREDIT',
      credits: aggregate(credits, (item) => positionIdentity(item.target)),
    };
  } else if (op.kind === 'TRANSFER') {
    const transfers = op.transfers.map((item) => ({
      ...source(item),
      target: normalizePositionKey(item.target),
    }));
    operation = {
      kind: 'TRANSFER',
      transfers: aggregate(transfers, (item) =>
        JSON.stringify([
          item.sourceId,
          item.expectedSourceRevision ?? null,
          positionIdentity(item.target),
        ]),
      ),
    };
  } else {
    operation = {
      kind: 'DEFINITIVE_OUT',
      debits: aggregate(op.debits.map(source), (item) =>
        JSON.stringify([item.sourceId, item.expectedSourceRevision ?? null]),
      ),
    };
  }
  return { ...command, operation };
}
export function physicalRequestHash(request: PhysicalRequest): string {
  const normalized = normalizePhysicalRequest(request);
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        companyId: normalized.companyId,
        origin: normalized.origin,
        operation: normalized.operation,
        reason: normalized.reason ?? null,
      }),
    )
    .digest('hex');
}
