import { createHash } from 'node:crypto';

import {
  assertValidHealthcareCompanyTransactionTimeoutPolicy,
  HealthcareCompanyTransactionTimeoutPolicy,
} from './healthcare-company-transaction-timeout-policy';

export const HEALTHCARE_COMPANY_TIMEOUT_POLICY_ENVIRONMENT_VARIABLE =
  'HEALTHCARE_COMPANY_TIMEOUT_POLICY_ID';
export const HEALTHCARE_COMPANY_TIMEOUT_POLICY_PROTOCOL_VERSION = 'v1';
export const HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID =
  'zaping:healthcare:company-timeout-policy:v1:hc-lock-02-integration-test';

export type HealthcareCompanyTimeoutPolicyUsage =
  'integration-test' | 'production-approved';

export interface HealthcareCompanyTimeoutPolicyDescriptor {
  readonly policyId: string;
  readonly protocolVersion: string;
  readonly usage: HealthcareCompanyTimeoutPolicyUsage;
  readonly policy: HealthcareCompanyTransactionTimeoutPolicy;
  readonly fingerprint: string;
  readonly calibrationEvidenceRef: string;
  readonly approvalRef: string;
}

export type HealthcareCompanyTimeoutPolicyDescriptorInput = Omit<
  HealthcareCompanyTimeoutPolicyDescriptor,
  'fingerprint'
>;

export type HealthcareCompanyTimeoutPolicyRegistry = Readonly<
  Record<string, HealthcareCompanyTimeoutPolicyDescriptor>
>;

export type HealthcareCompanyTimeoutPolicyReleaseFailure =
  | 'INVALID_ENVIRONMENT'
  | 'MISSING_PRODUCTION_SELECTION'
  | 'PROVISIONAL_PRODUCTION_SELECTION'
  | 'UNKNOWN_PRODUCTION_SELECTION'
  | 'UNKNOWN_NON_PRODUCTION_SELECTION'
  | 'INVALID_DESCRIPTOR'
  | 'PROTOCOL_MISMATCH'
  | 'USAGE_MISMATCH'
  | 'POLICY_ID_MISMATCH'
  | 'MISSING_CALIBRATION_EVIDENCE'
  | 'MISSING_APPROVAL'
  | 'INVALID_FINGERPRINT'
  | 'INVALID_POLICY';

export class HealthcareCompanyTimeoutPolicyReleaseError extends Error {
  constructor(
    public readonly failure: HealthcareCompanyTimeoutPolicyReleaseFailure,
    message: string,
  ) {
    super(message);
    this.name = 'HealthcareCompanyTimeoutPolicyReleaseError';
  }
}

const PRODUCTION_APPROVED_TIMEOUT_POLICY_REGISTRY = Object.freeze(
  {},
) as HealthcareCompanyTimeoutPolicyRegistry;

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'INVALID_DESCRIPTOR',
      `Healthcare Company timeout policy descriptor ${field} must be a non-empty string.`,
    );
  }

  return value;
}

export function canonicalizeHealthcareCompanyTimeoutPolicyDescriptor(
  descriptor: HealthcareCompanyTimeoutPolicyDescriptorInput,
): string {
  return JSON.stringify({
    schema: 'zaping:healthcare:company-timeout-policy-descriptor:v1',
    policyId: descriptor.policyId,
    protocolVersion: descriptor.protocolVersion,
    usage: descriptor.usage,
    policy: {
      companyLockAcquisitionTimeoutMs:
        descriptor.policy.companyLockAcquisitionTimeoutMs,
      subsequentLockTimeoutMs: descriptor.policy.subsequentLockTimeoutMs,
      subsequentStatementTimeoutMs:
        descriptor.policy.subsequentStatementTimeoutMs,
      prismaMaxWaitMs: descriptor.policy.prismaMaxWaitMs,
      prismaTransactionTimeoutMs: descriptor.policy.prismaTransactionTimeoutMs,
    },
    calibrationEvidenceRef: descriptor.calibrationEvidenceRef,
    approvalRef: descriptor.approvalRef,
  });
}

export function fingerprintHealthcareCompanyTimeoutPolicyDescriptor(
  descriptor: HealthcareCompanyTimeoutPolicyDescriptorInput,
): string {
  return createHash('sha256')
    .update(canonicalizeHealthcareCompanyTimeoutPolicyDescriptor(descriptor))
    .digest('hex');
}

export function createHealthcareCompanyTimeoutPolicyDescriptor(
  descriptor: HealthcareCompanyTimeoutPolicyDescriptorInput,
): HealthcareCompanyTimeoutPolicyDescriptor {
  assertValidHealthcareCompanyTransactionTimeoutPolicy(descriptor.policy);

  const policy = Object.freeze({
    companyLockAcquisitionTimeoutMs:
      descriptor.policy.companyLockAcquisitionTimeoutMs,
    subsequentLockTimeoutMs: descriptor.policy.subsequentLockTimeoutMs,
    subsequentStatementTimeoutMs:
      descriptor.policy.subsequentStatementTimeoutMs,
    prismaMaxWaitMs: descriptor.policy.prismaMaxWaitMs,
    prismaTransactionTimeoutMs: descriptor.policy.prismaTransactionTimeoutMs,
  });
  const content = {
    policyId: descriptor.policyId,
    protocolVersion: descriptor.protocolVersion,
    usage: descriptor.usage,
    policy,
    calibrationEvidenceRef: descriptor.calibrationEvidenceRef,
    approvalRef: descriptor.approvalRef,
  } satisfies HealthcareCompanyTimeoutPolicyDescriptorInput;

  return Object.freeze({
    ...content,
    fingerprint: fingerprintHealthcareCompanyTimeoutPolicyDescriptor(content),
  });
}

export const HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR =
  createHealthcareCompanyTimeoutPolicyDescriptor({
    policyId: HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID,
    protocolVersion: HEALTHCARE_COMPANY_TIMEOUT_POLICY_PROTOCOL_VERSION,
    usage: 'integration-test',
    policy: {
      companyLockAcquisitionTimeoutMs: 2_500,
      subsequentLockTimeoutMs: 1_500,
      subsequentStatementTimeoutMs: 4_000,
      prismaMaxWaitMs: 3_000,
      prismaTransactionTimeoutMs: 20_000,
    },
    calibrationEvidenceRef: 'HC-LOCK-02 focused PostgreSQL integration gates',
    approvalRef: 'NOT_APPROVED_FOR_PRODUCTION',
  });

function validateDescriptor(
  descriptor: unknown,
  expectedPolicyId: string,
  expectedUsage: HealthcareCompanyTimeoutPolicyUsage,
): HealthcareCompanyTimeoutPolicyDescriptor {
  if (
    typeof descriptor !== 'object' ||
    descriptor === null ||
    Array.isArray(descriptor)
  ) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'INVALID_DESCRIPTOR',
      'Healthcare Company timeout policy descriptor must be an object.',
    );
  }

  const candidate = descriptor as Record<string, unknown>;
  const policyId = requireNonEmptyString(candidate.policyId, 'policyId');
  const protocolVersion = requireNonEmptyString(
    candidate.protocolVersion,
    'protocolVersion',
  );
  const usage = requireNonEmptyString(candidate.usage, 'usage');
  if (
    typeof candidate.calibrationEvidenceRef !== 'string' ||
    candidate.calibrationEvidenceRef.trim().length === 0
  ) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'MISSING_CALIBRATION_EVIDENCE',
      'Healthcare Company timeout policy calibration evidence is required.',
    );
  }
  const calibrationEvidenceRef = candidate.calibrationEvidenceRef;

  if (
    typeof candidate.approvalRef !== 'string' ||
    candidate.approvalRef.trim().length === 0
  ) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'MISSING_APPROVAL',
      'Healthcare Company timeout policy approval reference is required.',
    );
  }
  const approvalRef = candidate.approvalRef;
  const fingerprint = requireNonEmptyString(
    candidate.fingerprint,
    'fingerprint',
  );

  if (policyId !== expectedPolicyId) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'POLICY_ID_MISMATCH',
      'Healthcare Company timeout policy registry key does not match its descriptor.',
    );
  }

  if (protocolVersion !== HEALTHCARE_COMPANY_TIMEOUT_POLICY_PROTOCOL_VERSION) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'PROTOCOL_MISMATCH',
      'Healthcare Company timeout policy protocol version is not supported.',
    );
  }

  if (usage !== expectedUsage) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'USAGE_MISMATCH',
      'Healthcare Company timeout policy usage is not valid for this environment.',
    );
  }

  try {
    assertValidHealthcareCompanyTransactionTimeoutPolicy(candidate.policy);
  } catch {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'INVALID_POLICY',
      'Healthcare Company timeout policy values are invalid or inconsistent.',
    );
  }

  const validated = {
    policyId,
    protocolVersion,
    usage,
    policy: candidate.policy,
    calibrationEvidenceRef,
    approvalRef,
  } satisfies HealthcareCompanyTimeoutPolicyDescriptorInput;
  const expectedFingerprint =
    fingerprintHealthcareCompanyTimeoutPolicyDescriptor(validated);

  if (fingerprint !== expectedFingerprint) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'INVALID_FINGERPRINT',
      'Healthcare Company timeout policy descriptor fingerprint is invalid.',
    );
  }

  return Object.freeze({
    ...validated,
    policy: Object.freeze({ ...validated.policy }),
    fingerprint,
  });
}

export function resolveHealthcareCompanyTimeoutPolicyDescriptor(
  nodeEnv: string | undefined,
  selectedPolicyId: string | undefined,
  productionRegistry: HealthcareCompanyTimeoutPolicyRegistry,
): HealthcareCompanyTimeoutPolicyDescriptor {
  if (!['development', 'test', 'production'].includes(nodeEnv ?? '')) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'INVALID_ENVIRONMENT',
      'Healthcare Company timeout policy requires a valid NODE_ENV.',
    );
  }

  const normalizedPolicyId = selectedPolicyId?.trim();

  if (nodeEnv !== 'production') {
    if (
      normalizedPolicyId &&
      normalizedPolicyId !== HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID
    ) {
      throw new HealthcareCompanyTimeoutPolicyReleaseError(
        'UNKNOWN_NON_PRODUCTION_SELECTION',
        'Healthcare Company timeout policy selection is unknown in this environment.',
      );
    }

    return validateDescriptor(
      HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_DESCRIPTOR,
      HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID,
      'integration-test',
    );
  }

  if (!normalizedPolicyId) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'MISSING_PRODUCTION_SELECTION',
      'Healthcare Company timeout policy selection is required in production.',
    );
  }

  if (normalizedPolicyId === HC_LOCK_02_INTEGRATION_TIMEOUT_POLICY_ID) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'PROVISIONAL_PRODUCTION_SELECTION',
      'The provisional Healthcare Company timeout policy cannot be used in production.',
    );
  }

  const descriptor = Object.prototype.hasOwnProperty.call(
    productionRegistry,
    normalizedPolicyId,
  )
    ? productionRegistry[normalizedPolicyId]
    : undefined;

  if (!descriptor) {
    throw new HealthcareCompanyTimeoutPolicyReleaseError(
      'UNKNOWN_PRODUCTION_SELECTION',
      'Healthcare Company timeout policy selection is not registered for production.',
    );
  }

  return validateDescriptor(
    descriptor,
    normalizedPolicyId,
    'production-approved',
  );
}

export function resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor(
  environment: NodeJS.ProcessEnv = process.env,
): HealthcareCompanyTimeoutPolicyDescriptor {
  return resolveHealthcareCompanyTimeoutPolicyDescriptor(
    environment.NODE_ENV,
    environment[HEALTHCARE_COMPANY_TIMEOUT_POLICY_ENVIRONMENT_VARIABLE],
    PRODUCTION_APPROVED_TIMEOUT_POLICY_REGISTRY,
  );
}
