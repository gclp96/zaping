export class HealthcareCompanyLockTimeoutError extends Error {
  constructor(cause: unknown) {
    super('Healthcare Company advisory-lock acquisition timed out.', { cause });
    this.name = 'HealthcareCompanyLockTimeoutError';
  }
}
