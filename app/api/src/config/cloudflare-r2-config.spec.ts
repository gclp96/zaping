import { parseCloudflareR2Config } from './cloudflare-r2-config';

const valid = {
  R2_STORAGE_MODE: 'r2',
  R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_PRIVATE_BUCKET: 'zaping-private-qa',
  R2_QUARANTINE_BUCKET: 'zaping-quarantine-qa',
  R2_READ_ACCESS_KEY_ID: 'test-access-key-12345678',
  R2_READ_SECRET_ACCESS_KEY: 'test-secret-key-12345678901234567890',
};

describe('Cloudflare R2 configuration validation', () => {
  it('defaults to disabled without requiring secrets in local/CI', () => {
    expect(parseCloudflareR2Config({})).toBeNull();
    expect(parseCloudflareR2Config({ R2_STORAGE_MODE: 'disabled' })).toBeNull();
  });

  it('produces an official account endpoint and auto region', () => {
    expect(parseCloudflareR2Config(valid)).toMatchObject({
      endpoint: `https://${valid.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: 'auto',
      forcePathStyle: true,
      privateBucket: valid.R2_PRIVATE_BUCKET,
      quarantineBucket: valid.R2_QUARANTINE_BUCKET,
    });
  });

  it.each([
    ['eu', 'eu.r2.cloudflarestorage.com'],
    ['us', 'us.r2.cloudflarestorage.com'],
    ['fedramp', 'fedramp.r2.cloudflarestorage.com'],
  ])('uses the restricted %s jurisdiction endpoint', (jurisdiction, suffix) => {
    const config = parseCloudflareR2Config({
      ...valid,
      R2_JURISDICTION: jurisdiction,
    });
    expect(config?.endpoint).toBe(`https://${valid.R2_ACCOUNT_ID}.${suffix}`);
  });

  it.each([
    [{ R2_STORAGE_MODE: 'other' }, 'R2_STORAGE_MODE'],
    [{ R2_ACCOUNT_ID: 'not-hex' }, 'R2_ACCOUNT_ID'],
    [{ R2_JURISDICTION: 'unknown' }, 'R2_JURISDICTION'],
    [{ R2_PRIVATE_BUCKET: '../unsafe' }, 'R2_PRIVATE_BUCKET'],
    [{ R2_QUARANTINE_BUCKET: 'wrong.bucket' }, 'R2_QUARANTINE_BUCKET'],
    [{ R2_QUARANTINE_BUCKET: valid.R2_PRIVATE_BUCKET }, 'distinct'],
    [{ R2_READ_ACCESS_KEY_ID: '' }, 'credentials'],
    [{ R2_READ_SECRET_ACCESS_KEY: 'bad secret\nvalue' }, 'credentials'],
  ])('rejects unsafe configuration %j', (patch, expectedError) => {
    expect(() => parseCloudflareR2Config({ ...valid, ...patch })).toThrow(
      expectedError,
    );
  });

  it('never interpolates credential values into validation errors', () => {
    try {
      parseCloudflareR2Config({ ...valid, R2_PRIVATE_BUCKET: '-bad' });
      throw new Error('Expected rejected config');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toContain(valid.R2_READ_SECRET_ACCESS_KEY);
      expect(message).not.toContain(valid.R2_READ_ACCESS_KEY_ID);
    }
  });
});
