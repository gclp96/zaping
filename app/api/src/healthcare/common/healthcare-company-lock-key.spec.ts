import { deriveHealthcareCompanyLockKey } from './healthcare-company-lock-key';

const POSITIVE_VECTOR = {
  companyId: '11111111-1111-4111-8111-111111111111',
  firstEightDigestBytesHex: '516835ca84cb745c',
  expectedKey: 5865997658577663068n,
};
const NEGATIVE_VECTOR = {
  companyId: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
  firstEightDigestBytesHex: '86ca2782db8b1b08',
  expectedKey: -8734125084349097208n,
};
const SIGNED_INT64_MIN = -(1n << 63n);
const SIGNED_INT64_MAX = (1n << 63n) - 1n;

describe('deriveHealthcareCompanyLockKey', () => {
  it('derives the same key for the same Company UUID', () => {
    const first = deriveHealthcareCompanyLockKey(POSITIVE_VECTOR.companyId);
    const second = deriveHealthcareCompanyLockKey(POSITIVE_VECTOR.companyId);

    expect(second).toBe(first);
  });

  it('canonicalizes uppercase and lowercase UUID representations', () => {
    expect(
      deriveHealthcareCompanyLockKey('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),
    ).toBe(
      deriveHealthcareCompanyLockKey('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    );
  });

  it('derives different keys for different valid Company UUIDs', () => {
    expect(deriveHealthcareCompanyLockKey(POSITIVE_VECTOR.companyId)).not.toBe(
      deriveHealthcareCompanyLockKey('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    );
  });

  it.each([
    '',
    'not-a-uuid',
    'aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa',
    ' aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa ',
    'aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-7aaa-aaaaaaaaaaaa',
  ])('rejects invalid UUID input deterministically: %j', (companyId) => {
    expect(() => deriveHealthcareCompanyLockKey(companyId)).toThrow(
      new TypeError('companyId must be a valid UUID.'),
    );
  });

  it(`matches the independently verified positive int64 vector ${POSITIVE_VECTOR.firstEightDigestBytesHex}`, () => {
    expect(deriveHealthcareCompanyLockKey(POSITIVE_VECTOR.companyId)).toBe(
      POSITIVE_VECTOR.expectedKey,
    );
  });

  it(`matches the independently verified negative int64 vector ${NEGATIVE_VECTOR.firstEightDigestBytesHex}`, () => {
    expect(deriveHealthcareCompanyLockKey(NEGATIVE_VECTOR.companyId)).toBe(
      NEGATIVE_VECTOR.expectedKey,
    );
  });

  it('returns bigint values safely within signed int64 boundaries', () => {
    const keys = [
      deriveHealthcareCompanyLockKey(POSITIVE_VECTOR.companyId),
      deriveHealthcareCompanyLockKey(NEGATIVE_VECTOR.companyId),
    ];

    for (const key of keys) {
      expect(typeof key).toBe('bigint');
      expect(key).toBeGreaterThanOrEqual(SIGNED_INT64_MIN);
      expect(key).toBeLessThanOrEqual(SIGNED_INT64_MAX);
      expect(Number.isSafeInteger(Number(key))).toBe(false);
    }
  });
});
