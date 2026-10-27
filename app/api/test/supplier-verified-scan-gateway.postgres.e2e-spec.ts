import { generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  PrismaClient,
  SupplierAttachmentScanJobStatus,
  SupplierDocumentAttachmentStatus,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierAttachmentUploadReservationsService } from '../src/supplier-documents/supplier-attachment-upload-reservations.service';
import { SupplierAttachmentUploadReconciliationService } from '../src/supplier-documents/supplier-attachment-upload-reconciliation.service';
import { IsolatedVerifiedScanEvidenceGateway } from '../src/supplier-documents/isolated-verified-scan-evidence-gateway';
import {
  signScanEvidence,
  type ScanEvidenceClaims,
  type EvidenceVerificationPolicy,
} from '../src/supplier-documents/supplier-attachment-signed-scan-evidence';

const describePg =
  process.env.RUN_SUPPLIER_VERIFIED_GATEWAY_PG === '1'
    ? describe
    : describe.skip;

type Issued = { jobId: string; requestNonce: string };
type Fixture = {
  companyId: string;
  documentId: string;
  reservationId: string;
};

describePg('B3d5b3c1 isolated verified gateway on PostgreSQL', () => {
  let db: PrismaClient;
  let reserve: SupplierAttachmentUploadReservationsService;
  let reconcile: SupplierAttachmentUploadReconciliationService;
  const keys = generateKeyPairSync('ed25519');
  const policy: EvidenceVerificationPolicy = {
    trustedKeys: new Map([
      [
        'scanner-ci-key',
        {
          publicKey: keys.publicKey,
          workerIdentity: 'scanner-ci-worker',
          workerBuildDigest: 'b'.repeat(64),
        },
      ],
    ]),
    allowedEngineVersions: new Set(['1.4.3']),
    allowedPolicyVersions: new Set(['scanner-ci-policy']),
    maxEvidenceAgeMs: 120000,
    maxDatabaseAgeMs: 172800000,
    maxFutureClockSkewMs: 5000,
  };

  async function fixture(): Promise<Fixture> {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'B3d5b3c gateway lab', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Gateway',
        lastName: 'Lab',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'Gateway supplier' },
    });
    const document = await db.supplierDocument.create({
      data: {
        companyId,
        supplierId: supplier.id,
        type: SupplierDocumentType.REMISION,
        number: randomUUID(),
        normalizedNumber: randomUUID(),
        documentDate: new Date('2026-10-26T00:00:00.000Z'),
        createdById: actorId,
      },
    });
    const reservation = await reserve.reserve({
      companyId,
      documentId: document.id,
      actorId,
      requestKey: randomUUID(),
      metadata: {
        originalName: 'verified-lab.pdf',
        contentType: 'application/pdf',
        sizeBytes: 42,
        sha256: 'a'.repeat(64),
      },
    });
    await reconcile.reconcile({
      companyId,
      documentId: document.id,
      reservationId: reservation.id,
    });
    return {
      companyId,
      documentId: document.id,
      reservationId: reservation.id,
    };
  }

  async function issue(f: Fixture): Promise<Issued> {
    const rows = await db.$queryRawUnsafe<Issued[]>(
      'SELECT * FROM "issue_supplier_attachment_scan_job"($1::text, $2::text, 120)',
      f.companyId,
      f.reservationId,
    );
    if (rows.length !== 1) throw Error('Failed to issue lab job');
    return rows[0];
  }

  function signed(f: Fixture, nonce: string) {
    const now = Date.now();
    const claims: ScanEvidenceClaims = {
      protocol: 'zaping-scan-evidence-v1',
      companyId: f.companyId,
      documentId: f.documentId,
      attachmentId: f.reservationId,
      reservationId: f.reservationId,
      requestNonce: nonce,
      quarantineKey: [
        'quarantine',
        f.companyId,
        f.documentId,
        f.reservationId,
      ].join('/'),
      contentSizeBytes: 42,
      contentSha256: 'a'.repeat(64),
      bytesVerified: true,
      verdict: 'CLEAN_CANDIDATE',
      engineVersion: '1.4.3',
      databaseVersion: 28001,
      databaseBuiltAt: new Date(now - 3600000).toISOString(),
      readinessBeforeAt: new Date(now - 4000).toISOString(),
      startedAt: new Date(now - 3000).toISOString(),
      completedAt: new Date(now - 2000).toISOString(),
      readinessAfterAt: new Date(now - 1000).toISOString(),
      policyVersion: 'scanner-ci-policy',
      workerIdentity: 'scanner-ci-worker',
      workerBuildDigest: 'b'.repeat(64),
      failureCode: null,
    };
    return signScanEvidence(claims, 'scanner-ci-key', keys.privateKey);
  }

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw Error('B3d5b3c1 must run in disposable GitHub Actions');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw Error('Invalid target for B3d5b3c1');
    }
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const rows = await db.$queryRawUnsafe<{ name: string; role: string }[]>(
      'SELECT current_database() AS name, current_user AS role',
    );
    expect(rows).toEqual([{ name: 'zaping_test', role: 'ci' }]);
    reserve = new SupplierAttachmentUploadReservationsService(
      db as unknown as PrismaService,
    );
    reconcile = new SupplierAttachmentUploadReconciliationService(
      db as unknown as PrismaService,
      { verify: jest.fn().mockResolvedValue(undefined) },
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('atomically binds valid Ed25519 evidence to the DB job, not availability', async () => {
    const f = await fixture();
    const job = await issue(f);
    const envelope = signed(f, job.requestNonce);
    const gateway = new IsolatedVerifiedScanEvidenceGateway(db, policy);
    const outcome = await gateway.accept(
      f.companyId,
      job.requestNonce,
      envelope,
    );
    expect(outcome.verdict).toBe('CLEAN_CANDIDATE');
    expect(outcome.releaseAuthorized).toBe(false);
    expect(
      await db.supplierAttachmentVerifiedScanEvidence.count({
        where: { companyId: f.companyId, requestNonce: job.requestNonce },
      }),
    ).toBe(1);
    const recorded = await db.supplierAttachmentScanJob.findUniqueOrThrow({
      where: { id: job.jobId },
    });
    expect(recorded.status).toBe(SupplierAttachmentScanJobStatus.CONSUMED);
    const attachment = await db.supplierDocumentAttachment.findUniqueOrThrow({
      where: { id: f.reservationId },
    });
    expect(attachment.status).toBe(
      SupplierDocumentAttachmentStatus.PENDING_SCAN,
    );
    await expect(
      gateway.accept(f.companyId, job.requestNonce, envelope),
    ).rejects.toThrow();
  });

  it('does not persist or consume a forged or cross-company signature', async () => {
    const f = await fixture();
    const job = await issue(f);
    const gateway = new IsolatedVerifiedScanEvidenceGateway(db, policy);
    const envelope = signed(f, job.requestNonce);
    const altered = {
      ...envelope,
      claims: { ...envelope.claims, contentSha256: 'b'.repeat(64) },
    };
    await expect(
      gateway.accept(f.companyId, job.requestNonce, altered),
    ).rejects.toThrow();
    await expect(
      gateway.accept(randomUUID(), job.requestNonce, envelope),
    ).rejects.toThrow();
    await expect(
      gateway.accept(f.companyId, randomUUID(), envelope),
    ).rejects.toThrow();
    expect(
      await db.supplierAttachmentScanAttempt.count({
        where: { companyId: f.companyId, requestNonce: job.requestNonce },
      }),
    ).toBe(0);
    expect(
      await db.supplierAttachmentVerifiedScanEvidence.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
    const stillIssued = await db.supplierAttachmentScanJob.findUniqueOrThrow({
      where: { id: job.jobId },
    });
    expect(stillIssued.status).toBe(SupplierAttachmentScanJobStatus.ISSUED);
  });

  it('permits one winner under concurrent identical signed submissions', async () => {
    const f = await fixture();
    const job = await issue(f);
    const envelope = signed(f, job.requestNonce);
    const gateway = new IsolatedVerifiedScanEvidenceGateway(db, policy);
    const results = await Promise.allSettled([
      gateway.accept(f.companyId, job.requestNonce, envelope),
      gateway.accept(f.companyId, job.requestNonce, envelope),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect(
      await db.supplierAttachmentVerifiedScanEvidence.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });

  it('never trusts an already consumed challenge with an unsigned fake receipt', async () => {
    const f = await fixture();
    const job = await issue(f);
    const attempt = await db.supplierAttachmentScanAttempt.create({
      data: {
        companyId: f.companyId,
        attachmentId: f.reservationId,
        reservationId: f.reservationId,
        requestNonce: job.requestNonce,
        contentSizeBytes: 42,
        contentSha256: 'a'.repeat(64),
        verdict: 'CLEAN_CANDIDATE',
        engineVersion: '1.4.3',
        databaseVersion: 28001,
        policyVersion: 'scanner-ci-policy',
        workerIdentity: 'scanner-ci-worker',
      },
    });
    await db.supplierAttachmentSignedEvidenceReceipt.create({
      data: {
        companyId: f.companyId,
        attemptId: attempt.id,
        requestNonce: job.requestNonce,
        signingKeyId: 'fake-ci',
        signature: 'A'.repeat(86),
        signedClaims: {
          ...signed(f, job.requestNonce).claims,
        },
      },
    });
    const rows = await db.$queryRawUnsafe<{ ok: boolean }[]>(
      'SELECT "consume_supplier_attachment_scan_job"($1::text, $2::uuid) AS ok',
      f.companyId,
      job.requestNonce,
    );
    expect(rows[0]?.ok).toBe(true);
    const gateway = new IsolatedVerifiedScanEvidenceGateway(db, policy);
    await expect(
      gateway.accept(
        f.companyId,
        job.requestNonce,
        signed(f, job.requestNonce),
      ),
    ).rejects.toThrow();
    expect(await db.supplierAttachmentVerifiedScanEvidence.count({
      where: { companyId: f.companyId },
    })).toBe(0);
  });
});
