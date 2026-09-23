import { registerAs } from '@nestjs/config';

import {
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
  HealthcareCompanyTransactionTimeoutPolicy,
} from './healthcare-company-transaction-timeout-policy';
import { resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor } from './healthcare-company-transaction-timeout-release-policy';

export const healthcareCompanyTransactionTimeoutConfiguration = registerAs(
  'healthcareCompanyTransactionTimeoutPolicy',
  (): HealthcareCompanyTransactionTimeoutPolicy =>
    createHealthcareCompanyTransactionTimeoutPolicy(
      resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor().policy,
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
