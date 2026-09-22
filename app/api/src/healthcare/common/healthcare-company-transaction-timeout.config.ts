import { registerAs } from '@nestjs/config';

import {
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
  HealthcareCompanyTransactionTimeoutPolicy,
} from './healthcare-company-transaction-timeout-policy';

// Complete initial HC-LOCK-02 integration/test values; no external timeout
// configuration is currently required. Production calibration remains pending.
const INITIAL_HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY = {
  companyLockAcquisitionTimeoutMs: 2_500,
  subsequentLockTimeoutMs: 1_500,
  subsequentStatementTimeoutMs: 4_000,
  prismaMaxWaitMs: 3_000,
  prismaTransactionTimeoutMs: 20_000,
} satisfies HealthcareCompanyTransactionTimeoutPolicy;

export const healthcareCompanyTransactionTimeoutConfiguration = registerAs(
  'healthcareCompanyTransactionTimeoutPolicy',
  (): HealthcareCompanyTransactionTimeoutPolicy =>
    createHealthcareCompanyTransactionTimeoutPolicy(
      INITIAL_HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY,
    ),
);

export function createHealthcareCompanyTransactionTimeoutPolicy(
  configuration: unknown,
): HealthcareCompanyTransactionTimeoutPolicy {
  assertValidHealthcareCompanyTransactionTimeoutPolicy(configuration);

  return Object.freeze({
    companyLockAcquisitionTimeoutMs:
      configuration.companyLockAcquisitionTimeoutMs,
    subsequentLockTimeoutMs: configuration.subsequentLockTimeoutMs,
    subsequentStatementTimeoutMs: configuration.subsequentStatementTimeoutMs,
    prismaMaxWaitMs: configuration.prismaMaxWaitMs,
    prismaTransactionTimeoutMs: configuration.prismaTransactionTimeoutMs,
  });
}
