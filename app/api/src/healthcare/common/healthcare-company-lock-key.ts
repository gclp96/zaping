import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';

const HEALTHCARE_COMPANY_LOCK_KEY_PREFIX = 'zaping:healthcare:company-lock:v1:';

export function deriveHealthcareCompanyLockKey(companyId: string): bigint {
  if (!isUUID(companyId)) {
    throw new TypeError('companyId must be a valid UUID.');
  }

  const canonicalCompanyId = companyId.toLowerCase();
  const digest = createHash('sha256')
    .update(
      `${HEALTHCARE_COMPANY_LOCK_KEY_PREFIX}${canonicalCompanyId}`,
      'utf8',
    )
    .digest();

  return digest.readBigInt64BE(0);
}
