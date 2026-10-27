import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  SupplierAttachmentScanJobStatus,
  SupplierAttachmentScanVerdict,
  SupplierDocumentAttachmentStatus,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierAttachmentUploadReservationsService } from '../src/supplier-documents/supplier-attachment-upload-reservations.service';
import { SupplierAttachmentUploadReconciliationService } from '../src/supplier-documents/supplier-attachment-upload-reconciliation.service';

const describePg =
  process.env.RUN_SUPPLIER_SCAN_JOBS_PG === '1' ? describe : describe.skip;

type ScanJob = {
  jobId: string;
  requestNonce: string;
  issuedAt: Date;
  expiresAt: Date;
};

/** Lab-only: synthetic identities, scanner receipts and disposable database. */
describePg('B3d5b3b DB-issued scanner jobs', () => {
  let db: PrismaClient;
  let reservations: SupplierAttachmentUploadReservationsService;
  let reconciliation: SupplierAttachmentUploadReconciliationService;
  const verifier = { verify: jest.fn().mockResolvedValue(undefined) };

  async function fixture(registered = true) {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'B3d5b3b job lab', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Job',
        lastName: 'Lab',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'B3d5b3b supplier' },
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
    const reservation = await reservations.reserve({
      companyId,
      documentId: document.id,
      actorId,
      requestKey: randomUUID(),
      metadata: {
        originalName: 'challenge.pdf',
        contentType: 'application/pdf',
        sizeBytes: 42,
        sha256: 'a'.repeat(64),
      },
    });
    if (registered) {
      await reconciliation.reconcile({
        companyId,
        documentId: document.id,
        reservationId: reservation.id,
      });
    }
    return {
      companyId,
      documentId: document.id,
      reservationId: reservation.id,
    };
  }

  async function issue(
    companyId: string,
    reservationId: string,
    ttlSeconds = 120,
  ): Promise<ScanJob> {
    const rows = await db.$queryRawUnsafe<ScanJob[]>(
      'SELECT * FROM "issue_supplier_attachment_scan_job"($1::text, $2::text, $3::integer)',
      companyId,
      reservationId,
      ttlSeconds,
    );
    if (rows.length !== 1) throw new Error('Missing issued scanner job');
    return rows[0];
  }

  async function consume(companyId: string, nonce: string): Promise<boolean> {
    const rows = await db.$queryRawUnsafe<{ consumed: boolean }[]>(
      'SELECT "consume_supplier_attachment_scan_job"($1::text, $2::uuid) AS consumed',
      companyId,
      nonce,
    );
    return rows[0]?.consumed === true;
  }

  async function appendUntrustedReceipt(
    f: Awaited<ReturnType<typeof fixture>>,
    issued: ScanJob,
  ) {
    const attempt = await db.supplierAttachmentScanAttempt.create({
      data: {
        companyId: f.companyId,
        attachmentId: f.reservationId,
        reservationId: f.reservationId,
        requestNonce: issued.requestNonce,
        contentSizeBytes: 42,
        contentSha256: 'a'.repeat(64),
        verdict: SupplierAttachmentScanVerdict.CLEAN_CANDIDATE,
        engineVersion: '1.4.3',
        databaseVersion: 28001,
        policyVersion: 'ci-untrusted-v1',
        workerIdentity: 'UNVERIFIED_CI',
      },
    });
    await db.supplierAttachmentSignedEvidenceReceipt.create({
      data: {
        companyId: f.companyId,
        attemptId: attempt.id,
        requestNonce: issued.requestNonce,
        signingKeyId: 'untrusted-lab-only',
        signature: 'A'.repeat(86),
        signedClaims: {
          protocol: 'zaping-scan-evidence-v1',
          companyId: f.companyId,
          documentId: f.documentId,
          attachmentId: f.reservationId,
          reservationId: f.reservationId,
          requestNonce: issued.requestNonce,
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
          policyVersion: 'ci-untrusted-v1',
          workerIdentity: 'UNVERIFIED_CI',
          workerBuildDigest: 'f'.repeat(64),
          failureCode: null,
        },
      },
    });
  }

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error('B3d5b3b requires isolated GitHub Actions PostgreSQL');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe B3d5b3b PostgreSQL target');
    }
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRawUnsafe<
      { database: string; role: string }[]
    >('SELECT current_database() AS database, current_user AS role');
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });
    reservations = new SupplierAttachmentUploadReservationsService(
      db as unknown as PrismaService,
    );
    reconciliation = new SupplierAttachmentUploadReconciliationService(
      db as unknown as PrismaService,
      verifier,
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('issues DB-generated nonce bound to registered bytes and TTL', async () => {
    const f = await fixture();
    const issued = await issue(f.companyId, f.reservationId);
    expect(issued.requestNonce).toMatch(/^[0-9a-f-]{36}$/u);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(
      issued.issuedAt.getTime(),
    );
    expect(issued.expiresAt.getTime() - issued.issuedAt.getTime()).toBeLessThan(
      301_000,
    );
    const job = await db.supplierAttachmentScanJob.findUniqueOrThrow({
      where: { id: issued.jobId },
    });
    expect(job.requestNonce).toBe(issued.requestNonce);
    expect(job.status).toBe(SupplierAttachmentScanJobStatus.ISSUED);
    expect(job.contentSha256).toBe('a'.repeat(64));
    expect(job.contentSizeBytes).toBe(42);
    expect(job.attachmentId).toBe(f.reservationId);
    expect(job.quarantineKey).toBe(
      ['quarantine', f.companyId, f.documentId, f.reservationId].join('/'),
    );
  });

  it('rejects unregistered, cross-tenant and invalid TTL requests', async () => {
    const unregistered = await fixture(false);
    const other = await fixture();
    await expect(
      issue(unregistered.companyId, unregistered.reservationId),
    ).rejects.toThrow();
    await expect(
      issue(other.companyId, unregistered.reservationId),
    ).rejects.toThrow();
    await expect(
      issue(other.companyId, other.reservationId, 59),
    ).rejects.toThrow();
    await expect(
      issue(other.companyId, other.reservationId, 301),
    ).rejects.toThrow();
  });

  it('serializes competing issuers without duplicate active jobs', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      issue(f.companyId, f.reservationId),
      issue(f.companyId, f.reservationId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await db.supplierAttachmentScanJob.count({
        where: { companyId: f.companyId, attachmentId: f.reservationId },
      }),
    ).toBe(1);
  });

  it('rejects missing evidence, wrong tenants and illegal mutations', async () => {
    const f = await fixture();
    const issued = await issue(f.companyId, f.reservationId);
    await expect(consume(f.companyId, issued.requestNonce)).rejects.toThrow();
    expect(await consume(randomUUID(), issued.requestNonce)).toBe(false);
    expect(await consume(f.companyId, randomUUID())).toBe(false);
    const current = await db.supplierAttachmentScanJob.findUniqueOrThrow({
      where: { id: issued.jobId },
    });
    expect(current.status).toBe(SupplierAttachmentScanJobStatus.ISSUED);
    await expect(
      db.supplierAttachmentScanJob.update({
        where: { id: issued.jobId },
        data: { contentSha256: 'b'.repeat(64) },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierAttachmentScanJob.delete({
        where: { id: issued.jobId },
      }),
    ).rejects.toThrow();
  });

  it('consumes once, reissues a new nonce, and never releases files', async () => {
    const f = await fixture();
    const issued = await issue(f.companyId, f.reservationId);
    await appendUntrustedReceipt(f, issued);
    expect(await consume(f.companyId, issued.requestNonce)).toBe(true);
    expect(await consume(f.companyId, issued.requestNonce)).toBe(false);
    const consumed = await db.supplierAttachmentScanJob.findUniqueOrThrow({
      where: { id: issued.jobId },
    });
    expect(consumed.status).toBe(SupplierAttachmentScanJobStatus.CONSUMED);
    expect(consumed.consumedAt).not.toBeNull();
    const second = await issue(f.companyId, f.reservationId);
    expect(second.requestNonce).not.toBe(issued.requestNonce);
    await expect(
      db.supplierAttachmentScanJob.update({
        where: { id: issued.jobId },
        data: { status: SupplierAttachmentScanJobStatus.ISSUED },
      }),
    ).rejects.toThrow();
    const attachment = await db.supplierDocumentAttachment.findUniqueOrThrow({
      where: { id: f.reservationId },
    });
    expect(attachment.status).toBe(
      SupplierDocumentAttachmentStatus.PENDING_SCAN,
    );
    await expect(
      db.supplierDocumentAttachment.update({
        where: { id: f.reservationId },
        data: {
          status: SupplierDocumentAttachmentStatus.AVAILABLE,
          scannedAt: new Date(),
          scanEngine: 'forge-from-consumed-job',
        },
      }),
    ).rejects.toThrow();
  });

  it('denies SQL function/table privileges to ordinary CI roles', async () => {
    await db.$executeRawUnsafe('CREATE ROLE zaping_scan_job_api_lab NOLOGIN');
    try {
      const rights = await db.$queryRawUnsafe<
        { can_issue: boolean; can_consume: boolean; can_insert: boolean }[]
      >(
        'SELECT ' +
          "has_function_privilege('zaping_scan_job_api_lab'," +
          ' \'"issue_supplier_attachment_scan_job"(text,text,integer)\',' +
          " 'EXECUTE') AS can_issue, " +
          "has_function_privilege('zaping_scan_job_api_lab'," +
          ' \'"consume_supplier_attachment_scan_job"(text,uuid)\',' +
          " 'EXECUTE') AS can_consume, " +
          "has_table_privilege('zaping_scan_job_api_lab'," +
          " '\"SupplierAttachmentScanJob\"', 'INSERT') AS can_insert",
      );
      expect(rights).toEqual([
        { can_issue: false, can_consume: false, can_insert: false },
      ]);
    } finally {
      await db.$executeRawUnsafe('DROP ROLE zaping_scan_job_api_lab');
    }
  });
});
