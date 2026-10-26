/**
 * Cloudflare R2 settings are parsed, never logged, and do not themselves
 * enable object downloads. A real S3 SDK + verified scanner must be wired
 * deliberately in a later release before replacing the fail-closed provider.
 */
export type CloudflareR2Jurisdiction = 'default' | 'eu' | 'us' | 'fedramp';

export type CloudflareR2Config = {
  endpoint: string;
  region: 'auto';
  forcePathStyle: true;
  jurisdiction: CloudflareR2Jurisdiction;
  privateBucket: string;
  quarantineBucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type Env = Record<string, string | undefined>;

function validBucket(name: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$/.test(name);
}

export function parseCloudflareR2Config(
  env: Env,
): CloudflareR2Config | null {
  const mode = env.R2_STORAGE_MODE?.trim() || 'disabled';
  if (!['disabled', 'r2'].includes(mode)) {
    throw new Error('R2_STORAGE_MODE must be disabled or r2');
  }
  if (mode === 'disabled') {
    return null;
  }

  const accountId = env.R2_ACCOUNT_ID?.trim() ?? '';
  const jurisdiction = env.R2_JURISDICTION?.trim() || 'default';
  const privateBucket = env.R2_PRIVATE_BUCKET?.trim() ?? '';
  const quarantineBucket = env.R2_QUARANTINE_BUCKET?.trim() ?? '';
  const accessKeyId = env.R2_READ_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = env.R2_READ_SECRET_ACCESS_KEY?.trim() ?? '';

  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error('R2_ACCOUNT_ID must be a 32-character hex account ID');
  }
  if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) {
    throw new Error('R2_JURISDICTION is unsupported');
  }
  if (!validBucket(privateBucket)) {
    throw new Error('R2_PRIVATE_BUCKET has an invalid bucket name');
  }
  if (!validBucket(quarantineBucket)) {
    throw new Error('R2_QUARANTINE_BUCKET has an invalid bucket name');
  }
  if (privateBucket === quarantineBucket) {
    throw new Error('R2 private and quarantine buckets must be distinct');
  }
  if (
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId.length > 256 ||
    secretAccessKey.length > 256 ||
    /\s/u.test(accessKeyId) ||
    /\s/u.test(secretAccessKey)
  ) {
    throw new Error('R2 read-only credentials must be configured securely');
  }

  const prefix = jurisdiction === 'default' ? '' : `${jurisdiction}.`;
  return {
    endpoint: `https://${accountId.toLowerCase()}.${prefix}r2.cloudflarestorage.com`,
    region: 'auto',
    forcePathStyle: true,
    jurisdiction: jurisdiction as CloudflareR2Jurisdiction,
    privateBucket,
    quarantineBucket,
    accessKeyId,
    secretAccessKey,
  };
}
