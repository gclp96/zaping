import { ServiceUnavailableException } from '@nestjs/common';
import { generateKeyPairSync } from 'node:crypto';
import {
  IsolatedScannerEvidenceWorker,
  type VerifiedQuarantineScanner,
  type WorkerReadinessProbe,
} from './isolated-scanner-evidence-worker';
import {
  verifyScanEvidence,
  type ExpectedScanIdentity,
  type EvidenceVerificationPolicy,
} from './supplier-attachment-signed-scan-evidence';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const DOCUMENT = '22222222-2222-4222-8222-222222222222';
const FILE = '33333333-3333-4333-8333-333333333333';
const NONCE = '44444444-4444-4444-8444-444444444444';
const T = Date.parse('2026-10-27T12:00:10.000Z');
const BUILT = '2026-10-27T11:00:00.000Z';

describe('B3d5b2 isolated scanner: fail-closed, no persistence', () => {
  const keys = generateKeyPairSync('ed25519');
  const job: ExpectedScanIdentity = {
    companyId: COMPANY,
    documentId: DOCUMENT,
    attachmentId: FILE,
    reservationId: FILE,
    requestNonce: NONCE,
    contentSizeBytes: 42,
    contentSha256: 'a'.repeat(64),
  };

  const verification: EvidenceVerificationPolicy = {
    trustedKeys: new Map([
      [
        'scan-key-v1',
        {
          publicKey: keys.publicKey,
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

  function fixture() {
    const scanner: VerifiedQuarantineScanner = {
      scan: jest.fn().mockResolvedValue('CLAMD_OK_UNATTESTED'),
    };
    const readiness: WorkerReadinessProbe = {
      check: jest.fn(async (nowMs: number) => ({
        engineVersion: '1.4.3',
        databaseVersion: 28001,
        databaseBuiltAt: BUILT,
        observedAt: new Date(nowMs).toISOString(),
        policyVersion: 'scanner-v1',
        attested: false as const,
      })),
    };
    const stamps = [T - 1000, T - 900, T - 500, T - 400];
    const worker = new IsolatedScannerEvidenceWorker(
      readiness,
      scanner,
      {
        keyId: 'scan-key-v1',
        privateKey: keys.privateKey,
        workerIdentity: 'scanner-qa-1',
        workerBuildDigest: 'f'.repeat(64),
        policyVersion: 'scanner-v1',
      },
      () => stamps.shift() ?? T,
    );
    return { worker, scanner, readiness };
  }

  it('signs the same registered bytes only after two matching probes', async () => {
    const f = fixture();
    const signed = await f.worker.scan(job);
    const verified = verifyScanEvidence(signed, job, verification, T);
    expect(verified.verdict).toBe('CLEAN_CANDIDATE');
    expect(verified.bytesVerified).toBe(true);
    expect(verified.quarantineKey).toBe(
      'quarantine/' + COMPANY + '/' + DOCUMENT + '/' + FILE,
    );
    expect(f.readiness.check).toHaveBeenCalledTimes(2);
    expect(f.scanner.scan).toHaveBeenCalledWith(
      COMPANY,
      verified.quarantineKey,
      42,
      'a'.repeat(64),
    );
  });

  it('keeps a real malware detection out of the clean state', async () => {
    const f = fixture();
    jest.mocked(f.scanner.scan).mockResolvedValue('MALWARE_DETECTED');
    const signed = await f.worker.scan(job);
    const verified = verifyScanEvidence(signed, job, verification, T);
    expect(verified.verdict).toBe('MALWARE_DETECTED');
  });

  it('never scans when the initial readiness check fails', async () => {
    const f = fixture();
    jest.mocked(f.readiness.check).mockRejectedValueOnce(
      new Error('clamd unavailable'),
    );
    await expect(f.worker.scan(job)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(f.scanner.scan).not.toHaveBeenCalled();
  });

  it('never signs clean evidence if the quarantine read fails', async () => {
    const f = fixture();
    jest.mocked(f.scanner.scan).mockRejectedValueOnce(
      new Error('SHA-256 mismatch'),
    );
    await expect(f.worker.scan(job)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(f.readiness.check).toHaveBeenCalledTimes(1);
  });

  it('rejects changed ClamAV signatures during a scan', async () => {
    const f = fixture();
    jest.mocked(f.readiness.check).mockImplementation(async (nowMs) => ({
      engineVersion: '1.4.3',
      databaseVersion: nowMs >= T - 400 ? 28002 : 28001,
      databaseBuiltAt: BUILT,
      observedAt: new Date(nowMs).toISOString(),
      policyVersion: 'scanner-v1',
      attested: false,
    }));
    await expect(f.worker.scan(job)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects stale or inconsistent policy between probes', async () => {
    const f = fixture();
    jest.mocked(f.readiness.check).mockImplementation(async (nowMs) => ({
      engineVersion: '1.4.3',
      databaseVersion: 28001,
      databaseBuiltAt: BUILT,
      observedAt: new Date(nowMs).toISOString(),
      policyVersion: nowMs >= T - 400 ? 'scanner-v2' : 'scanner-v1',
      attested: false,
    }));
    await expect(f.worker.scan(job)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('never signs on post-scan probe failure', async () => {
    const f = fixture();
    jest.mocked(f.readiness.check).mockRejectedValueOnce(
      new Error('post-scan ClamAV offline'),
    );
    jest.mocked(f.readiness.check).mockClear();
    jest.mocked(f.readiness.check)
      .mockResolvedValueOnce({
        engineVersion: '1.4.3',
        databaseVersion: 28001,
        databaseBuiltAt: BUILT,
        observedAt: new Date(T - 1000).toISOString(),
        policyVersion: 'scanner-v1',
        attested: false,
      })
      .mockRejectedValueOnce(new Error('post-scan outage'));
    await expect(f.worker.scan(job)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(f.scanner.scan).toHaveBeenCalledTimes(1);
  });
});
