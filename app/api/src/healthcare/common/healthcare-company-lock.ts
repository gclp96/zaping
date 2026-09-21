import { Prisma } from '@prisma/client';

import { deriveHealthcareCompanyLockKey } from './healthcare-company-lock-key';
import { HealthcareCompanyLockTimeoutError } from './healthcare-company-lock-timeout.error';

export interface HealthcareCompanyLockOptions {
  acquisitionTimeoutMs: number;
}

interface LockTimeoutSetting {
  lockTimeout: string;
  lockTimeoutMilliseconds: number;
  lockTimeoutUnit: string;
}

export async function acquireHealthcareCompanyLock(
  transaction: Prisma.TransactionClient,
  companyId: string,
  options: HealthcareCompanyLockOptions,
): Promise<void> {
  assertValidAcquisitionTimeout(options.acquisitionTimeoutMs);

  const lockKey = deriveHealthcareCompanyLockKey(companyId);
  const [inheritedSetting] = await transaction.$queryRaw<
    LockTimeoutSetting[]
  >(Prisma.sql`
    SELECT
      current_setting('lock_timeout') AS "lockTimeout",
      setting::int AS "lockTimeoutMilliseconds",
      unit AS "lockTimeoutUnit"
    FROM pg_catalog.pg_settings
    WHERE name = 'lock_timeout'
  `);

  if (!isValidLockTimeoutSetting(inheritedSetting)) {
    throw new Error('Could not resolve the effective PostgreSQL lock_timeout.');
  }

  const shouldApplyAcquisitionTimeout =
    inheritedSetting.lockTimeoutMilliseconds === 0 ||
    options.acquisitionTimeoutMs < inheritedSetting.lockTimeoutMilliseconds;

  if (shouldApplyAcquisitionTimeout) {
    await setTransactionLocalLockTimeout(
      transaction,
      `${options.acquisitionTimeoutMs}ms`,
    );
  }

  try {
    await transaction.$queryRaw<Array<{ lock: string }>>(Prisma.sql`
      SELECT pg_advisory_xact_lock(${lockKey}::bigint)::text AS "lock"
    `);
  } catch (error) {
    if (isCompanyAdvisoryLockTimeout(error)) {
      throw new HealthcareCompanyLockTimeoutError(error);
    }

    throw error;
  }

  if (shouldApplyAcquisitionTimeout) {
    await setTransactionLocalLockTimeout(
      transaction,
      inheritedSetting.lockTimeout,
    );
  }
}

async function setTransactionLocalLockTimeout(
  transaction: Prisma.TransactionClient,
  value: string,
): Promise<void> {
  await transaction.$queryRaw<Array<{ lockTimeout: string }>>(Prisma.sql`
    SELECT set_config('lock_timeout', ${value}, true) AS "lockTimeout"
  `);
}

function assertValidAcquisitionTimeout(acquisitionTimeoutMs: number): void {
  if (
    !Number.isSafeInteger(acquisitionTimeoutMs) ||
    acquisitionTimeoutMs <= 0
  ) {
    throw new RangeError(
      'Healthcare Company lock acquisitionTimeoutMs must be a positive safe integer.',
    );
  }
}

function isValidLockTimeoutSetting(
  setting: LockTimeoutSetting | undefined,
): setting is LockTimeoutSetting {
  return (
    setting !== undefined &&
    typeof setting.lockTimeout === 'string' &&
    setting.lockTimeout.length > 0 &&
    Number.isInteger(setting.lockTimeoutMilliseconds) &&
    setting.lockTimeoutMilliseconds >= 0 &&
    setting.lockTimeoutUnit === 'ms'
  );
}

function isCompanyAdvisoryLockTimeout(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2010' &&
    error.meta?.code === '55P03'
  );
}
