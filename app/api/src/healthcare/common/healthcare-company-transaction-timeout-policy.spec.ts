import {
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
  HealthcareCompanyTransactionTimeoutPolicy,
} from './healthcare-company-transaction-timeout-policy';

const timeoutFields = [
  'companyLockAcquisitionTimeoutMs',
  'subsequentLockTimeoutMs',
  'subsequentStatementTimeoutMs',
  'prismaMaxWaitMs',
  'prismaTransactionTimeoutMs',
] as const satisfies ReadonlyArray<
  keyof HealthcareCompanyTransactionTimeoutPolicy
>;

describe('assertValidHealthcareCompanyTransactionTimeoutPolicy', () => {
  it('accepts a complete policy with the required timeout precedence', () => {
    expect(() =>
      assertValidHealthcareCompanyTransactionTimeoutPolicy(validPolicy()),
    ).not.toThrow();
  });

  it.each([undefined, null, 'policy', 42, []])(
    'rejects a non-object policy: %p',
    (policy) => {
      expect(() =>
        assertValidHealthcareCompanyTransactionTimeoutPolicy(policy),
      ).toThrow(
        new TypeError(
          'Healthcare Company transaction timeout policy must be an object.',
        ),
      );
    },
  );

  it.each(
    timeoutFields.flatMap((field) =>
      [
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
      ].map((value) => [field, value] as const),
    ),
  )('rejects invalid %s value %p', (field, value) => {
    const policy = { ...validPolicy(), [field]: value };

    expect(() =>
      assertValidHealthcareCompanyTransactionTimeoutPolicy(policy),
    ).toThrow(new RangeError(`${field} must be a positive safe integer.`));
  });

  it.each([
    [
      'equal subsequent lock and statement limits',
      { subsequentLockTimeoutMs: 3_000 },
      'subsequentLockTimeoutMs must be less than subsequentStatementTimeoutMs.',
    ],
    [
      'looser subsequent lock limit',
      { subsequentLockTimeoutMs: 3_001 },
      'subsequentLockTimeoutMs must be less than subsequentStatementTimeoutMs.',
    ],
    [
      'equal Company acquisition and Prisma transaction limits',
      { companyLockAcquisitionTimeoutMs: 10_000 },
      'companyLockAcquisitionTimeoutMs must be less than prismaTransactionTimeoutMs.',
    ],
    [
      'equal subsequent statement and Prisma transaction limits',
      { subsequentStatementTimeoutMs: 10_000 },
      'subsequentStatementTimeoutMs must be less than prismaTransactionTimeoutMs.',
    ],
  ] as const)('rejects %s', (_label, override, message) => {
    expect(() =>
      assertValidHealthcareCompanyTransactionTimeoutPolicy({
        ...validPolicy(),
        ...override,
      }),
    ).toThrow(new RangeError(message));
  });

  it('does not impose ordering between Prisma maxWait and transaction timeout', () => {
    expect(() =>
      assertValidHealthcareCompanyTransactionTimeoutPolicy({
        ...validPolicy(),
        prismaMaxWaitMs: Number.MAX_SAFE_INTEGER,
      }),
    ).not.toThrow();
  });
});

function validPolicy(): HealthcareCompanyTransactionTimeoutPolicy {
  return {
    companyLockAcquisitionTimeoutMs: 750,
    subsequentLockTimeoutMs: 1_250,
    subsequentStatementTimeoutMs: 3_000,
    prismaMaxWaitMs: 2_000,
    prismaTransactionTimeoutMs: 10_000,
  };
}
