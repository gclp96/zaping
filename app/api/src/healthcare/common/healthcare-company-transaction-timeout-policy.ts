export interface HealthcareCompanyTransactionTimeoutPolicy {
  readonly companyLockAcquisitionTimeoutMs: number;
  readonly subsequentLockTimeoutMs: number;
  readonly subsequentStatementTimeoutMs: number;
  readonly prismaMaxWaitMs: number;
  readonly prismaTransactionTimeoutMs: number;
}

const TIMEOUT_FIELDS = [
  'companyLockAcquisitionTimeoutMs',
  'subsequentLockTimeoutMs',
  'subsequentStatementTimeoutMs',
  'prismaMaxWaitMs',
  'prismaTransactionTimeoutMs',
] as const satisfies ReadonlyArray<
  keyof HealthcareCompanyTransactionTimeoutPolicy
>;

export function assertValidHealthcareCompanyTransactionTimeoutPolicy(
  policy: unknown,
): asserts policy is HealthcareCompanyTransactionTimeoutPolicy {
  if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) {
    throw new TypeError(
      'Healthcare Company transaction timeout policy must be an object.',
    );
  }

  const candidate = policy as Record<string, unknown>;

  for (const field of TIMEOUT_FIELDS) {
    const value = candidate[field];

    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw new RangeError(`${field} must be a positive safe integer.`);
    }
  }

  const validated =
    candidate as unknown as HealthcareCompanyTransactionTimeoutPolicy;

  if (
    validated.subsequentLockTimeoutMs >= validated.subsequentStatementTimeoutMs
  ) {
    throw new RangeError(
      'subsequentLockTimeoutMs must be less than subsequentStatementTimeoutMs.',
    );
  }

  if (
    validated.companyLockAcquisitionTimeoutMs >=
    validated.prismaTransactionTimeoutMs
  ) {
    throw new RangeError(
      'companyLockAcquisitionTimeoutMs must be less than prismaTransactionTimeoutMs.',
    );
  }

  if (
    validated.subsequentStatementTimeoutMs >=
    validated.prismaTransactionTimeoutMs
  ) {
    throw new RangeError(
      'subsequentStatementTimeoutMs must be less than prismaTransactionTimeoutMs.',
    );
  }
}
