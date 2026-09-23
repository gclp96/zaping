import {
  HealthcareCompanyTimeoutPolicyReleaseError,
  resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor,
} from './healthcare-company-transaction-timeout-release-policy';

export interface HealthcareCompanyTimeoutReleaseGateOutput {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

const PROCESS_OUTPUT: HealthcareCompanyTimeoutReleaseGateOutput = {
  stdout: (message) => process.stdout.write(`${message}\n`),
  stderr: (message) => process.stderr.write(`${message}\n`),
};

export function runHealthcareCompanyTimeoutReleaseGate(
  environment: NodeJS.ProcessEnv = process.env,
  output: HealthcareCompanyTimeoutReleaseGateOutput = PROCESS_OUTPUT,
): number {
  try {
    const descriptor =
      resolveRuntimeHealthcareCompanyTimeoutPolicyDescriptor(environment);

    if (environment.NODE_ENV !== 'production') {
      throw new HealthcareCompanyTimeoutPolicyReleaseError(
        'INVALID_ENVIRONMENT',
        'Healthcare Company timeout production release gate requires NODE_ENV=production.',
      );
    }

    output.stdout(
      `Healthcare Company timeout production policy validated: ${descriptor.policyId}`,
    );
    return 0;
  } catch (error) {
    output.stderr(
      error instanceof HealthcareCompanyTimeoutPolicyReleaseError
        ? error.message
        : 'Healthcare Company timeout production policy validation failed.',
    );
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runHealthcareCompanyTimeoutReleaseGate();
}
