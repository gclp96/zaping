import { BadRequestException } from '@nestjs/common';
import type { CloudflareR2Config } from './cloudflare-r2-config';
import { requireTenantPrivateR2Key } from '../supplier-documents/cloudflare-r2-object-keys';
import { SUPPLIER_ATTACHMENT_MAX_BYTES } from '../supplier-documents/supplier-document-attachment-validation';

export type CloudflareR2QaFixture = {
  companyId: string;
  objectKey: string;
  sha256: string;
  sizeBytes: number;
};

/**
 * Never run an R2 smoke test against production or an unscoped bucket.
 * This does not validate Cloudflare IAM; a human must verify token scope.
 */
export function requireCloudflareR2QaFixture(
  env: NodeJS.ProcessEnv,
  config: CloudflareR2Config | null,
): CloudflareR2QaFixture {
  if (env.RUN_CLOUDFLARE_R2_QA_SMOKE !== '1') {
    throw new BadRequestException('R2 QA smoke test not explicitly enabled');
  }
  if (
    !config ||
    !config.privateBucket.endsWith('-qa') ||
    !config.quarantineBucket.endsWith('-qa') ||
    config.privateBucket === config.quarantineBucket
  ) {
    throw new BadRequestException('R2 smoke requires distinct QA-only buckets');
  }

  const companyId = env.R2_QA_FIXTURE_COMPANY_ID?.trim() ?? '';
  const objectKey = env.R2_QA_FIXTURE_OBJECT_KEY?.trim() ?? '';
  const sha256 = env.R2_QA_FIXTURE_SHA256?.trim() ?? '';
  const rawSize = env.R2_QA_FIXTURE_SIZE_BYTES?.trim() ?? '';

  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new BadRequestException('R2 QA fixture SHA-256 is invalid');
  }
  if (!/^[1-9][0-9]*$/.test(rawSize)) {
    throw new BadRequestException('R2 QA fixture size is invalid');
  }
  const sizeBytes = Number(rawSize);
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes > SUPPLIER_ATTACHMENT_MAX_BYTES
  ) {
    throw new BadRequestException('R2 QA fixture exceeds attachment size limits');
  }
  requireTenantPrivateR2Key(objectKey, companyId);

  return { companyId, objectKey, sha256, sizeBytes };
}
