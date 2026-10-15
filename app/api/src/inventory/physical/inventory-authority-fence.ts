import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  assertCutoverTransaction,
  cutoverId,
  cutoverAssert,
} from './inventory-cutover.contract';

// Two-int advisory namespace, deliberately separate from business sequences.
export const INVENTORY_AUTHORITY_NAMESPACE = 0x494e5641;
export function inventoryAuthorityKey(companyId: string): number {
  cutoverId(companyId);
  return createHash('sha256')
    .update(companyId.toLowerCase())
    .digest()
    .readInt32BE(0);
}

// Acquire before ANY control/business row lock. Callers own READ COMMITTED tx.
// Hash collisions serialize unrelated Companies conservatively; never change identity.
export async function inventoryAuthorityFence(
  tx: Prisma.TransactionClient,
  companyId: string,
  mode: 'shared' | 'exclusive',
): Promise<void> {
  assertCutoverTransaction(tx);
  const key = inventoryAuthorityKey(companyId);
  if (mode === 'shared') {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock_shared(${INVENTORY_AUTHORITY_NAMESPACE}::int, ${key}::int)::text`,
    );
  } else {
    const [settings] = await tx.$queryRaw<{ isolation: string }[]>(
      Prisma.sql`SELECT current_setting('transaction_isolation') AS isolation`,
    );
    cutoverAssert(
      settings?.isolation === 'read committed',
      'INVALID_TRANSITION',
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(${INVENTORY_AUTHORITY_NAMESPACE}::int, ${key}::int)::text`,
    );
  }
}
