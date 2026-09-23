import {
  canonicalizeHealthcareCompanyTimeoutPolicyDescriptor,
  createHealthcareCompanyTimeoutPolicyDescriptor,
  fingerprintHealthcareCompanyTimeoutPolicyDescriptor,
  HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR,
  HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID,
  HEALTHCARE_COMPANY_TIMEOUT_POLICY_ENVIRONMENT_VARIABLE,
  HealthcareCompanyTimeoutPolicyDescriptor,
  HealthcareCompanyTimeoutPolicyDescriptorInput,
  HealthcareCompanyTimeoutPolicyRegistry,
  HealthcareCompanyTimeoutPolicyReleaseError,
  resolveHealthcareCompanyTimeoutPolicyDescriptor,
  resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor,
} from './healthcare-company-transaction-timeout-release-policy';

const APPROVED_POLICY_ID =
  'zaping:healthcare:company-timeout-policy:v1:production-test-fixture';

function approvedDescriptorInput(): HealthcareCompanyTimeoutPolicyDescriptorInput {
  return {
    policyId: APPROVED_POLICY_ID,
    protocolVersion: 'v1',
    usage: 'production-approved',
    policy: {
      companyLockAcquisitionTimeoutMs: 2_400,
      subsequentLockTimeoutMs: 1_400,
      subsequentStatementTimeoutMs: 3_900,
      prismaMaxWaitMs: 2_900,
      prismaTransactionTimeoutMs: 19_000,
    },
    calibrationEvidenceRef: 'test-fixture-calibration-evidence',
    approvalRef: 'test-fixture-approval',
  };
}

function registryWith(
  descriptor: HealthcareCompanyTimeoutPolicyDescriptor,
): HealthcareCompanyTimeoutPolicyRegistry {
  return Object.freeze({ [descriptor.policyId]: descriptor });
}

function expectReleaseFailure(
  action: () => unknown,
  failure: HealthcareCompanyTimeoutPolicyReleaseError['failure'],
): void {
  try {
    action();
    throw new Error('Expected Healthcare timeout release policy failure.');
  } catch (error) {
    expect(error).toBeInstanceOf(HealthcareCompanyTimeoutPolicyReleaseError);
    expect((error as HealthcareCompanyTimeoutPolicyReleaseError).failure).toBe(
      failure,
    );
  }
}

describe('Healthcare Company timeout release policy', () => {
  it('uses a stable canonical payload and SHA-256 fingerprint', () => {
    expect(
      canonicalizeHealthcareCompanyTimeoutPolicyDescriptor({
        policyId: HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.policyId,
        protocolVersion:
          HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.protocolVersion,
        usage: HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.usage,
        policy: HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.policy,
        calibrationEvidenceRef:
          HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.calibrationEvidenceRef,
        approvalRef:
          HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.approvalRef,
      }),
    ).toBe(
      '{"schema":"zaping:healthcare:company-timeout-policy-descriptor:v1","policyId":"zaping:healthcare:company-timeout-policy:v1:hc-lock-02-integration-test","protocolVersion":"v1","usage":"integration-test","policy":{"companyLockAcquisitionTimeoutMs":2500,"subsequentLockTimeoutMs":1500,"subsequentStatementTimeoutMs":4000,"prismaMaxWaitMs":3000,"prismaTransactionTimeoutMs":20000},"calibrationEvidenceRef":"HC-LOCK-02 focused PostgreSQL integration gates","approvalRef":"NOT_APPROVED_FOR_PRODUCTION"}',
    );
    expect(HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR.fingerprint).toBe(
      '185f0f87b6b2768d26cb8f5453df32bfcd7b838a737ce077b03cabe108091b93',
    );
  });

  it.each(['development', 'test'])(
    'accepts the provisional policy in %s',
    (nodeEnv) => {
      expect(
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          nodeEnv,
          undefined,
          Object.freeze({}),
        ),
      ).toEqual(HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR);
    },
  );

  it('rejects a missing production selection', () => {
    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          undefined,
          Object.freeze({}),
        ),
      'MISSING_PRODUCTION_SELECTION',
    );
  });

  it('rejects the provisional policy in production', () => {
    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID,
          Object.freeze({}),
        ),
      'PROVISIONAL_PRODUCTION_SELECTION',
    );
  });

  it('rejects an unknown production policy ID', () => {
    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          APPROVED_POLICY_ID,
          Object.freeze({}),
        ),
      'UNKNOWN_PRODUCTION_SELECTION',
    );
  });

  it('accepts a synthetic approved descriptor only through an injected registry', () => {
    const descriptor = createHealthcareCompanyTimeoutPolicyDescriptor(
      approvedDescriptorInput(),
    );

    expect(
      resolveHealthcareCompanyTimeoutPolicyDescriptor(
        'production',
        APPROVED_POLICY_ID,
        registryWith(descriptor),
      ),
    ).toEqual(descriptor);
    expectReleaseFailure(
      () =>
        resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor({
          NODE_ENV: 'production',
          [HEALTHCARE_COMPANY_TIMEOUT_POLICY_ENVIRONMENT_VARIABLE]:
            APPROVED_POLICY_ID,
        }),
      'UNKNOWN_PRODUCTION_SELECTION',
    );
  });

  it.each([
    [
      'calibration evidence',
      'calibrationEvidenceRef',
      'MISSING_CALIBRATION_EVIDENCE',
    ],
    ['approval', 'approvalRef', 'MISSING_APPROVAL'],
  ] as const)('rejects missing %s', (_label, field, failure) => {
    const descriptor = createHealthcareCompanyTimeoutPolicyDescriptor(
      approvedDescriptorInput(),
    );
    const invalid = { ...descriptor, [field]: '' };

    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          APPROVED_POLICY_ID,
          registryWith(invalid),
        ),
      failure,
    );
  });

  it('rejects a protocol mismatch even with a content-consistent fingerprint', () => {
    const input = { ...approvedDescriptorInput(), protocolVersion: 'v2' };
    const descriptor = {
      ...input,
      fingerprint: fingerprintHealthcareCompanyTimeoutPolicyDescriptor(input),
    };

    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          APPROVED_POLICY_ID,
          registryWith(descriptor),
        ),
      'PROTOCOL_MISMATCH',
    );
  });

  it('rejects integration-test usage under a production registry entry', () => {
    const input = {
      ...approvedDescriptorInput(),
      usage: 'integration-test' as const,
    };
    const descriptor = {
      ...input,
      fingerprint: fingerprintHealthcareCompanyTimeoutPolicyDescriptor(input),
    };

    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          APPROVED_POLICY_ID,
          registryWith(descriptor),
        ),
      'USAGE_MISMATCH',
    );
  });

  it('rejects an invalid fingerprint', () => {
    const descriptor = {
      ...createHealthcareCompanyTimeoutPolicyDescriptor(
        approvedDescriptorInput(),
      ),
      fingerprint: '0'.repeat(64),
    };

    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          APPROVED_POLICY_ID,
          registryWith(descriptor),
        ),
      'INVALID_FINGERPRINT',
    );
  });

  it.each([
    ['invalid', { companyLockAcquisitionTimeoutMs: 0 }],
    [
      'inconsistent',
      { subsequentLockTimeoutMs: 4_000, subsequentStatementTimeoutMs: 4_000 },
    ],
  ])('rejects %s policy values', (_label, policyPatch) => {
    const valid = createHealthcareCompanyTimeoutPolicyDescriptor(
      approvedDescriptorInput(),
    );
    const descriptor = {
      ...valid,
      policy: { ...valid.policy, ...policyPatch },
    };

    expectReleaseFailure(
      () =>
        resolveHealthcareCompanyTimeoutPolicyDescriptor(
          'production',
          APPROVED_POLICY_ID,
          registryWith(descriptor),
        ),
      'INVALID_POLICY',
    );
  });
});
