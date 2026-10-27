import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  signScanEvidence,
  verifyScanEvidence,
  type ScanEvidenceClaims,
  type ExpectedScanIdentity,
  type EvidenceVerificationPolicy,
  type SignedScanEvidence,
} from './supplier-attachment-signed-scan-evidence';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const DOCUMENT = '22222222-2222-4222-8222-222222222222';
const ATTACHMENT = '33333333-3333-4333-8333-333333333333';
const NONCE = '44444444-4444-4444-8444-444444444444';
const CLOCK = Date.parse('2026-10-27T12:00:10.000Z');

describe('B3d5b1 signed evidence is NOT a release authorization', () => {
  const keys = generateKeyPairSync('ed25519');
  const otherKeys = generateKeyPairSync('ed25519');

  const claims: ScanEvidenceClaims = {
    protocol: 'zaping-scan-evidence-v1',
    companyId: COMPANY,
    documentId: DOCUMENT,
    attachmentId: ATTACHMENT,
    reservationId: ATTACHMENT,
    requestNonce: NONCE,
    quarantineKey: 'quarantine/' + COMPANY + '/' + DOCUMENT + '/' + ATTACHMENT,
    contentSizeBytes: 42,
    contentSha256: 'a'.repeat(64),
    bytesVerified: true,
    verdict: 'CLEAN_CANDIDATE',
    engineVersion: '1.4.3',
    databaseVersion: 28001,
    databaseBuiltAt: '2026-10-27T11:30:00.000Z',
    readinessBeforeAt: '2026-10-27T11:59:58.000Z',
    readinessAfterAt: '2026-10-27T12:00:09.000Z',
    startedAt: '2026-10-27T12:00:00.000Z',
    completedAt: '2026-10-27T12:00:08.000Z',
    policyVersion: 'scanner-v1',
    workerIdentity: 'scanner-qa-1',
    workerBuildDigest: 'f'.repeat(64),
    failureCode: null,
  };

  const expected: ExpectedScanIdentity = {
    companyId: COMPANY,
    documentId: DOCUMENT,
    attachmentId: ATTACHMENT,
    reservationId: ATTACHMENT,
    requestNonce: NONCE,
    contentSha256: 'a'.repeat(64),
    contentSizeBytes: 42,
  };

  function policy(
    publicKey: KeyObject = keys.publicKey,
  ): EvidenceVerificationPolicy {
    return {
      trustedKeys: new Map([
        [
          'scan-key-v1',
          {
            publicKey,
            workerIdentity: 'scanner-qa-1',
            workerBuildDigest: 'f'.repeat(64),
          },
        ],
      ]),
      allowedPolicyVersions: new Set(['scanner-v1']),
      allowedEngineVersions: new Set(['1.4.3']),
      maxEvidenceAgeMs: 120_000,
      maxDatabaseAgeMs: 48 * 60 * 60_000,
      maxFutureClockSkewMs: 5_000,
    };
  }

  function sign(
    value: ScanEvidenceClaims = claims,
    privateKey = keys.privateKey,
  ): SignedScanEvidence {
    return signScanEvidence(value, 'scan-key-v1', privateKey);
  }

  it('verifies exact byte/job identity under one pinned Ed25519 public key', () => {
    const envelope = sign();
    const verified = verifyScanEvidence(envelope, expected, policy(), CLOCK);
    expect(verified).toEqual(claims);
    expect(envelope).toHaveProperty('signature');
    expect(envelope.claims.verdict).toBe('CLEAN_CANDIDATE');
  });

  it('rejects tampering of signed byte hash, result and worker identity', () => {
    const envelope = sign();
    for (const change of [
      { contentSha256: 'b'.repeat(64) },
      { verdict: 'MALWARE_DETECTED' },
      { workerIdentity: 'attacker' },
      { readinessAfterAt: '2026-10-27T12:00:10.000Z' },
    ]) {
      expect(() =>
        verifyScanEvidence(
          { ...envelope, claims: { ...envelope.claims, ...change } },
          expected,
          policy(),
          CLOCK,
        ),
      ).toThrow(ServiceUnavailableException);
    }
  });

  it('rejects key swapping, unknown key ID, malformed signature and fields', () => {
    const envelope = sign();
    for (const candidate of [
      { ...envelope, keyId: 'unknown-key' },
      { ...envelope, signature: 'wrong' },
      { ...envelope, extra: 'not-canonical' },
      {
        ...envelope,
        claims: { ...envelope.claims, extra: 'unauthorized' },
      },
    ]) {
      expect(() =>
        verifyScanEvidence(candidate, expected, policy(), CLOCK),
      ).toThrow(ServiceUnavailableException);
    }
    const swappedKey = () =>
      verifyScanEvidence(
        envelope,
        expected,
        policy(otherKeys.publicKey),
        CLOCK,
      );
    expect(swappedKey).toThrow(ServiceUnavailableException);
  });

  it('denies other companies, nonces and attachment hash expectations', () => {
    const envelope = sign();
    for (const changed of [
      { companyId: '99999999-9999-4999-8999-999999999999' },
      { requestNonce: '99999999-9999-4999-8999-999999999999' },
      { contentSha256: 'b'.repeat(64) },
      { contentSizeBytes: 43 },
    ]) {
      expect(() =>
        verifyScanEvidence(
          envelope,
          { ...expected, ...changed },
          policy(),
          CLOCK,
        ),
      ).toThrow(ServiceUnavailableException);
    }
  });

  it('denies expired claims, future clock and stale signature database', () => {
    const envelope = sign();
    expect(() =>
      verifyScanEvidence(envelope, expected, policy(), CLOCK + 121_000),
    ).toThrow(ServiceUnavailableException);
    expect(() =>
      verifyScanEvidence(envelope, expected, policy(), CLOCK - 30_000),
    ).toThrow(ServiceUnavailableException);
    const stale = sign({
      ...claims,
      databaseBuiltAt: '2026-10-25T00:00:00.000Z',
    });
    const staleEvidence = () =>
      verifyScanEvidence(stale, expected, policy(), CLOCK);
    expect(staleEvidence).toThrow(ServiceUnavailableException);
  });

  it('rejects unverified clean verdicts and unknown policy pins at signing', () => {
    const unverifiedBytes = () => sign({ ...claims, bytesVerified: false });
    expect(unverifiedBytes).toThrow(ServiceUnavailableException);
    const invalidFailure = () =>
      sign({ ...claims, failureCode: 'NOT_A_REAL_CODE' });
    expect(invalidFailure).toThrow(ServiceUnavailableException);
    const envelope = sign();
    const outdatedPolicy = {
      ...policy(),
      allowedPolicyVersions: new Set(['scanner-v2']),
    };
    const outdatedEngine = {
      ...policy(),
      allowedEngineVersions: new Set(['1.0.0']),
    };
    const badPolicyEvidence = () =>
      verifyScanEvidence(envelope, expected, outdatedPolicy, CLOCK);
    const badEngineEvidence = () =>
      verifyScanEvidence(envelope, expected, outdatedEngine, CLOCK);
    expect(badPolicyEvidence).toThrow(ServiceUnavailableException);
    expect(badEngineEvidence).toThrow(ServiceUnavailableException);
  });

  it('can authenticate a failure without ever upgrading it into clean', () => {
    const failure: ScanEvidenceClaims = {
      ...claims,
      bytesVerified: false,
      verdict: 'SCAN_FAILED',
      engineVersion: null,
      databaseVersion: null,
      databaseBuiltAt: null,
      readinessBeforeAt: null,
      readinessAfterAt: null,
      failureCode: 'SCANNER_UNAVAILABLE',
    };
    const authenticated = verifyScanEvidence(
      sign(failure),
      expected,
      policy(),
      CLOCK,
    );
    expect(authenticated.verdict).toBe('SCAN_FAILED');
    expect(authenticated.bytesVerified).toBe(false);
  });
});
