import {
  HealthcareCaseDispatchAuditOperation,
  HealthcareCaseDispatchCustodianType,
  ProductInventoryTracking,
  ProductLotTracking,
} from '@prisma/client';
import { healthcarePersistenceException } from '../common/healthcare-errors';
import {
  DispatchActor,
  DispatchAuditChange,
  DispatchItemSnapshot,
  DispatchRootSnapshot,
} from './healthcare-case-dispatch.types';
function fail(): never {
  throw healthcarePersistenceException();
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
}
function text(v: unknown, max = 1000): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) return fail();
  return v;
}
function nullableText(v: unknown, max = 1000) {
  return v === null ? null : text(v, max);
}
function date(v: unknown): string {
  const s = text(v, 40);
  if (!Number.isFinite(Date.parse(s))) return fail();
  return s;
}
function nullableDate(v: unknown) {
  return v === null ? null : date(v);
}
function enumValue<T extends string>(v: unknown, values: Record<string, T>): T {
  if (typeof v !== 'string' || !Object.values(values).includes(v as T))
    return fail();
  return v as T;
}
function version(v: unknown, max: number) {
  const o = object(v);
  if (o.version !== 1 || Buffer.byteLength(JSON.stringify(o)) > max)
    return fail();
  return o;
}
function actor(v: unknown): DispatchActor {
  const a = object(v);
  return {
    id: text(a.id, 128),
    firstName: text(a.firstName, 256),
    lastName: text(a.lastName, 256),
  };
}
export function parseDispatchRootSnapshot(
  value: unknown,
): DispatchRootSnapshot {
  const o = version(value, 32768),
    c = object(o.case),
    u = object(o.custodian);
  const custodian = {
    type: enumValue(u.type, HealthcareCaseDispatchCustodianType),
    userId: nullableText(u.userId, 128),
    displayName: text(u.displayName, 256),
  };
  if (
    custodian.displayName !== custodian.displayName.trim() ||
    (custodian.type === 'EXTERNAL_PERSON' && custodian.userId !== null)
  )
    return fail();
  return {
    version: 1,
    case: {
      id: text(c.id, 128),
      folio: text(c.folio, 256),
      scheduledStart: nullableDate(c.scheduledStart),
      scheduledEnd: nullableDate(c.scheduledEnd),
    },
    custodian,
    dispatchedBy: actor(o.dispatchedBy),
    dispatchedAt: date(o.dispatchedAt),
  };
}
export function parseDispatchItemSnapshot(
  value: unknown,
): DispatchItemSnapshot {
  const o = version(value, 32768),
    p = object(o.product),
    s = object(o.preparation);
  const q = s.preparedQuantity;
  if (q !== null && (typeof q !== 'number' || !Number.isInteger(q) || q < 1))
    return fail();
  const batch = o.batch === null ? null : object(o.batch),
    equipment = o.equipment === null ? null : object(o.equipment);
  return {
    version: 1,
    product: {
      id: text(p.id, 128),
      sku: text(p.sku, 256),
      name: text(p.name),
      inventoryTracking: enumValue(
        p.inventoryTracking,
        ProductInventoryTracking,
      ),
      lotTracking: enumValue(p.lotTracking, ProductLotTracking),
    },
    preparation: {
      sourceCaseKitItemId: text(s.sourceCaseKitItemId, 128),
      requirementId: nullableText(s.requirementId, 128),
      assignmentId: nullableText(s.assignmentId, 128),
      preparedQuantity: q,
    },
    batch: batch
      ? {
          id: text(batch.id, 128),
          lotNumber: text(batch.lotNumber, 256),
          expirationDate: nullableDate(batch.expirationDate),
        }
      : null,
    equipment: equipment
      ? {
          id: text(equipment.id, 128),
          assetCode: text(equipment.assetCode, 256),
          serialNumber: nullableText(equipment.serialNumber, 256),
        }
      : null,
  };
}
export function parseDispatchAuditChange(
  value: unknown,
  operation: HealthcareCaseDispatchAuditOperation,
): DispatchAuditChange {
  const o = version(value, 8192);
  if (o.operation !== operation) return fail();
  return { version: 1, operation, reason: nullableText(o.reason, 1000) };
}
