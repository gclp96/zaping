import { Prisma } from '@prisma/client';

import {
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
  HealthcareCompanyTransactionTimeoutPolicy,
} from './healthcare-company-transaction-timeout-policy';

interface InheritedTimeoutSettings {
  lockTimeout: string;
  lockTimeoutMilliseconds: number;
  lockTimeoutUnit: string;
  statementTimeout: string;
  statementTimeoutMilliseconds: number;
  statementTimeoutUnit: string;
}

type TimeoutSettingName = 'lock_timeout' | 'statement_timeout';

export async function applyHealthcareSubsequentTransactionTimeouts(
  transaction: Prisma.TransactionClient,
  policy: HealthcareCompanyTransactionTimeoutPolicy,
): Promise<void> {
  assertValidHealthcareCompanyTransactionTimeoutPolicy(policy);

  const [inherited] = await transaction.$queryRaw<InheritedTimeoutSettings[]>(
    Prisma.sql`
      SELECT
        current_setting('lock_timeout') AS "lockTimeout",
        lock_settings.setting::int AS "lockTimeoutMilliseconds",
        lock_settings.unit AS "lockTimeoutUnit",
        current_setting('statement_timeout') AS "statementTimeout",
        statement_settings.setting::int AS "statementTimeoutMilliseconds",
        statement_settings.unit AS "statementTimeoutUnit"
      FROM pg_catalog.pg_settings AS lock_settings
      CROSS JOIN pg_catalog.pg_settings AS statement_settings
      WHERE lock_settings.name = 'lock_timeout'
        AND statement_settings.name = 'statement_timeout'
    `,
  );

  if (!isValidInheritedTimeoutSettings(inherited)) {
    throw new Error(
      'Could not resolve the effective PostgreSQL transaction timeouts.',
    );
  }

  if (
    shouldTightenTimeout(
      inherited.lockTimeoutMilliseconds,
      policy.subsequentLockTimeoutMs,
    )
  ) {
    await setTransactionLocalTimeout(
      transaction,
      'lock_timeout',
      policy.subsequentLockTimeoutMs,
    );
  }

  if (
    shouldTightenTimeout(
      inherited.statementTimeoutMilliseconds,
      policy.subsequentStatementTimeoutMs,
    )
  ) {
    await setTransactionLocalTimeout(
      transaction,
      'statement_timeout',
      policy.subsequentStatementTimeoutMs,
    );
  }
}

async function setTransactionLocalTimeout(
  transaction: Prisma.TransactionClient,
  setting: TimeoutSettingName,
  timeoutMs: number,
): Promise<void> {
  await transaction.$queryRaw<Array<{ configuredValue: string }>>(Prisma.sql`
    SELECT set_config(${setting}, ${`${timeoutMs}ms`}, true) AS "configuredValue"
  `);
}

function shouldTightenTimeout(
  inheritedTimeoutMs: number,
  configuredTimeoutMs: number,
): boolean {
  return inheritedTimeoutMs === 0 || configuredTimeoutMs < inheritedTimeoutMs;
}

function isValidInheritedTimeoutSettings(
  settings: InheritedTimeoutSettings | undefined,
): settings is InheritedTimeoutSettings {
  return (
    settings !== undefined &&
    typeof settings.lockTimeout === 'string' &&
    settings.lockTimeout.length > 0 &&
    Number.isInteger(settings.lockTimeoutMilliseconds) &&
    settings.lockTimeoutMilliseconds >= 0 &&
    settings.lockTimeoutUnit === 'ms' &&
    typeof settings.statementTimeout === 'string' &&
    settings.statementTimeout.length > 0 &&
    Number.isInteger(settings.statementTimeoutMilliseconds) &&
    settings.statementTimeoutMilliseconds >= 0 &&
    settings.statementTimeoutUnit === 'ms'
  );
}
