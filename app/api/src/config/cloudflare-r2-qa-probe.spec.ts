import { randomUUID } from 'node:crypto';
import { parseCloudflareR2Config } from './cloudflare-r2-config';
import { requireCloudflareR2QaFixture } from './cloudflare-r2-qa-probe';

const companyId = randomUUID();
const documentId = randomUUID();
const attachmentId = randomUUID();
const env: NodeJS.ProcessEnv = {
  RUN_CLOUDFLARE_R2_QA_SMOKE: '1',
  R2_STORAGE_MODE: 'r2',
  R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_PRIVATE_BUCKET: 'zaping-private-qa',
  R2_QUARANTINE_BUCKET: 'zaping-quarantine-qa',
  R2_READ_ACCESS_KEY_ID: 'synthetic-read-key',
  R2_READ_SECRET_ACCESS_KEY: 'synthetic-read-secret',
  R2_QA_FIXTURE_COMPANY_ID: companyId,
  R2_QA_FIXTURE_OBJECT_KEY: `private/${companyId}/${documentId}/${attachmentId}`,
  R2_QA_FIXTURE_SHA256: 'b'.repeat(64),
  R2_QA_FIXTURE_SIZE_BYTES: '128',
};

function validate(overrides: NodeJS.ProcessEnv = {}) {
  const input = { ...env, ...overrides };
  return requireCloudflareR2QaFixture(input, parseCloudflareR2Config(input));
}

describe('Cloudflare R2 QA smoke opt-in and tenant safety', () => {
  it('accepts a synthetic QA-only private fixture', () => {
    expect(validate()).toEqual({
      companyId,
      objectKey: env.R2_QA_FIXTURE_OBJECT_KEY,
      sha256: env.R2_QA_FIXTURE_SHA256,
      sizeBytes: 128,
    });
  });

  it.each([
    { RUN_CLOUDFLARE_R2_QA_SMOKE: '0' },
    { R2_STORAGE_MODE: 'disabled' },
    { R2_PRIVATE_BUCKET: 'zaping-private-prod' },
    { R2_QUARANTINE_BUCKET: 'zaping-quarantine-prod' },
    { R2_PRIVATE_BUCKET: 'zaping-quarantine-qa' },
    { R2_QA_FIXTURE_COMPANY_ID: randomUUID() },
    { R2_QA_FIXTURE_OBJECT_KEY: 'quarantine/arbitrary' },
    { R2_QA_FIXTURE_OBJECT_KEY: 'https://example.invalid/object.pdf' },
    { R2_QA_FIXTURE_SHA256: 'bad-digest' },
    { R2_QA_FIXTURE_SIZE_BYTES: '10485761' },
    { R2_QA_FIXTURE_SIZE_BYTES: '1e3' },
  ])('rejects unsafe or incomplete configuration: %j', (patch) => {
    expect(() => validate(patch)).toThrow();
  });

  it('does not expose credentials or fixture details in failures', () => {
    try {
      validate({ R2_QA_FIXTURE_SIZE_BYTES: '0' });
      throw new Error('Expected rejection');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toContain(env.R2_READ_SECRET_ACCESS_KEY);
      expect(message).not.toContain(env.R2_QA_FIXTURE_OBJECT_KEY);
    }
  });
});
