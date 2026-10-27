import { ServiceUnavailableException } from '@nestjs/common';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import {
  ClamAvReadinessProbe,
  type ClamAvReadinessPolicy,
} from '../src/supplier-documents/clamav-readiness-probe';
import { ClamAvInstreamScanner } from '../src/supplier-documents/clamav-instream-scanner';
import {
  IsolatedScannerEvidenceWorker,
  type VerifiedQuarantineScanner,
} from '../src/supplier-documents/isolated-scanner-evidence-worker';
import {
  verifyScanEvidence,
  type ExpectedScanIdentity,
  type EvidenceVerificationPolicy,
} from '../src/supplier-documents/supplier-attachment-signed-scan-evidence';

const describeLive =
  process.env.RUN_CLAMAV_B3D5B2_REAL_LAB === '1' ? describe : describe.skip;

function readVersion(socketPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    let bytes = Buffer.alloc(0);
    let finished = false;
    const fail = () => finish(new Error('ClamAV VERSION unavailable'));
    const timer = setTimeout(fail, 5_000);
    function finish(value: string | Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      if (value instanceof Error) reject(value);
      else resolve(value);
    }
    socket.on('error', fail);
    socket.on('close', fail);
    socket.on('data', (chunk: Buffer) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 512) return fail();
      const end = bytes.indexOf(0);
      if (end < 0) return;
      if (end !== bytes.length - 1) return fail();
      finish(bytes.subarray(0, end).toString('utf8'));
    });
    socket.once('connect', () => {
      socket.write(Buffer.from('zVERSION\0', 'ascii'), (error) => {
        if (error) fail();
      });
    });
  });
}

/** Disposable CI only: real daemon, synthetic bytes/clock, no R2 or DB. */
describeLive('B3d5b2 signed worker real ClamAV lab', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const documentId = '22222222-2222-4222-8222-222222222222';
  const attachmentId = '33333333-3333-4333-8333-333333333333';
  const keys = generateKeyPairSync('ed25519');
  let builtMs: number;
  let engineVersion: string;
  let clamAv: ClamAvInstreamScanner;
  let readiness: ClamAvReadinessProbe;

  beforeAll(async () => {
    if (
      process.env.CI !== 'true' ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.TZ !== 'UTC' ||
      !process.env.CLAMD_SOCKET?.startsWith('/') ||
      !process.env.CLAMD_SOCKET.includes('/zaping-clamd-socket/')
    ) {
      throw new Error('B3d5b2 requires isolated UTC GitHub Actions clamd');
    }
    const socket = process.env.CLAMD_SOCKET;
    const reply = await readVersion(socket);
    const match = /^ClamAV (\d+\.\d+\.\d+)\/([1-9]\d*)\/(.+)$/u.exec(reply);
    if (!match) throw new Error('Unexpected laboratory clamd VERSION');
    engineVersion = match[1];
    builtMs = Date.parse(match[3] + ' GMT');
    if (!Number.isFinite(builtMs)) throw new Error('Invalid clamd lab date');

    const policy: ClamAvReadinessPolicy = {
      policyVersion: 'scanner-lab-v1',
      daemonTimeZone: 'UTC',
      allowedEngineVersions: [engineVersion],
      maxDatabaseAgeMs: 48 * 60 * 60_000,
      maxFutureClockSkewMs: 5_000,
    };
    readiness = new ClamAvReadinessProbe(socket, policy);
    clamAv = new ClamAvInstreamScanner(socket, 20_000);
  });

  async function exercise(
    bytes: Buffer,
    expectedVerdict: 'CLEAN_CANDIDATE' | 'MALWARE_DETECTED',
  ) {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const job: ExpectedScanIdentity = {
      companyId,
      documentId,
      attachmentId,
      reservationId: attachmentId,
      requestNonce: randomUUID(),
      contentSizeBytes: bytes.length,
      contentSha256: hash,
    };
    const scanner: VerifiedQuarantineScanner = {
      scan: async (tenant, key, size, sha) => {
        if (
          tenant !== companyId ||
          key !==
            'quarantine/' + companyId + '/' + documentId + '/' + attachmentId ||
          size !== bytes.length ||
          sha !== hash
        ) {
          throw new Error('Synthetic quarantine integrity mismatch');
        }
        return clamAv.scan(bytes);
      },
    };
    // Preloaded offline signatures: a SYNTHETIC clock is anchored to DB time.
    const tick = builtMs + 60 * 60_000;
    const stamps = [tick, tick + 1000, tick + 2000, tick + 3000];
    const worker = new IsolatedScannerEvidenceWorker(
      readiness,
      scanner,
      {
        keyId: 'lab-key-v1',
        privateKey: keys.privateKey,
        workerIdentity: 'scanner-lab-1',
        workerBuildDigest: 'f'.repeat(64),
        policyVersion: 'scanner-lab-v1',
      },
      () => stamps.shift() ?? tick + 3000,
    );
    const signed = await worker.scan(job);
    const verification: EvidenceVerificationPolicy = {
      trustedKeys: new Map([
        [
          'lab-key-v1',
          {
            publicKey: keys.publicKey,
            workerIdentity: 'scanner-lab-1',
            workerBuildDigest: 'f'.repeat(64),
          },
        ],
      ]),
      allowedPolicyVersions: new Set(['scanner-lab-v1']),
      allowedEngineVersions: new Set([engineVersion]),
      maxEvidenceAgeMs: 120_000,
      maxDatabaseAgeMs: 48 * 60 * 60_000,
      maxFutureClockSkewMs: 5_000,
    };
    const claim = verifyScanEvidence(
      signed,
      job,
      verification,
      tick + 4000,
    );
    expect(claim.verdict).toBe(expectedVerdict);
    expect(claim.bytesVerified).toBe(true);
    expect(claim.readinessBeforeAt).not.toBeNull();
    expect(claim.readinessAfterAt).not.toBeNull();
    expect(claim.databaseBuiltAt).toBe(new Date(builtMs).toISOString());
  }

  it('signs a clean synthetic PDF after two real readiness probes', async () => {
    const clean = Buffer.from(
      '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n',
      'ascii',
    );
    await exercise(clean, 'CLEAN_CANDIDATE');
  });

  it('signs a real EICAR detection as malware, not clean', async () => {
    const eicar = Buffer.from(
      'X5O!P%@AP[4' +
        String.fromCharCode(92) +
        'PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      'ascii',
    );
    expect(eicar.length).toBe(68);
    await exercise(eicar, 'MALWARE_DETECTED');
  });

  it('rejects a missing ClamAV daemon without signing', async () => {
    const missing = new ClamAvReadinessProbe(
      '/tmp/zaping-no-daemon-b3d5b2.sock',
      {
        policyVersion: 'scanner-lab-v1',
        daemonTimeZone: 'UTC',
        allowedEngineVersions: [engineVersion],
        maxDatabaseAgeMs: 48 * 60 * 60_000,
        maxFutureClockSkewMs: 5_000,
      },
      1_000,
    );
    const worker = new IsolatedScannerEvidenceWorker(
      missing,
      { scan: () => Promise.resolve('CLAMD_OK_UNATTESTED') },
      {
        keyId: 'lab-key-v1',
        privateKey: keys.privateKey,
        workerIdentity: 'scanner-lab-1',
        workerBuildDigest: 'f'.repeat(64),
        policyVersion: 'scanner-lab-v1',
      },
    );
    const job: ExpectedScanIdentity = {
      companyId,
      documentId,
      attachmentId,
      reservationId: attachmentId,
      requestNonce: randomUUID(),
      contentSizeBytes: 42,
      contentSha256: 'a'.repeat(64),
    };
    await expect(worker.scan(job)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
