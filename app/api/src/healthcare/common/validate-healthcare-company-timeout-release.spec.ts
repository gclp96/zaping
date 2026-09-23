import { runHealthcareCompanyTimeoutReleaseGate } from './validate-healthcare-company-timeout-release';

describe('Healthcare Company timeout production release CLI', () => {
  it('returns nonzero and a sanitized policy error with the runtime registry empty', () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = runHealthcareCompanyTimeoutReleaseGate(
      { NODE_ENV: 'production' },
      {
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message),
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([
      'Healthcare Company timeout policy selection is required in production.',
    ]);
  });

  it('does not allow the CLI to validate a non-production environment', () => {
    const stderr: string[] = [];

    expect(
      runHealthcareCompanyTimeoutReleaseGate(
        { NODE_ENV: 'test' },
        {
          stdout: jest.fn(),
          stderr: (message) => stderr.push(message),
        },
      ),
    ).toBe(1);
    expect(stderr).toEqual([
      'Healthcare Company timeout production release gate requires NODE_ENV=production.',
    ]);
  });
});
