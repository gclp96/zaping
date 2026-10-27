import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  SupplierAttachmentScanVerdict,
  SupplierDocumentAttachmentStatus,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierAttachmentUploadReservationsService } from '../src/supplier-documents/supplier-attachment-upload-reservations.service';
import { SupplierAttachmentUploadReconciliationService } from '../src/supplier-documents/supplier-attachment-upload-reconciliation.service';

const describePg =
  process.env.RUN_SUPPLIER_SCAN_LEDGER_PG === '1' ? describe : describe.skip;

/** Untrusted observations never authorize clean-file promotion or downloads. */
describePg('B3d5a immutable scan observation ledger on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let reservations: SupplierAttachmentUploadReservationsService;
  let reconciliation: SupplierAttachmentUploadReconciliationService;
  const verifier = { verify: jest.fn().mockResolvedValue(undefined) };

  async function fixture() {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'B3d5a isolated tenant', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Ledger',
        lastName: 'QA',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'B3d5a test supplier' },
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
        originalName: 'untrusted.pdf',
        contentType: 'application/pdf',
        sizeBytes: 42,
        sha256: 'a'.repeat(64),
      },
    });
    await reconciliation.reconcile({
      companyId,
      documentId: document.id,
      reservationId: reservation.id,
    });
    return { companyId, reservationId: reservation.id };
  }

  function observed(
    f: Awaited<ReturnType<typeof fixture>>,
    verdict = SupplierAttachmentScanVerdict.CLEAN_CANDIDATE,
  ) {
    return {
      companyId: f.companyId,
      attachmentId: f.reservationId,
      reservationId: f.reservationId,
      requestNonce: randomUUID(),
      contentSizeBytes: 42,
      contentSha256: 'a'.repeat(64),
      verdict,
      engineVersion: '1.4.3',
      databaseVersion: 28001,
      policyVersion: 'ci-untrusted-v1',
      workerIdentity: 'UNVERIFIED_CI',
    };
  }

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error('B3d5a requires isolated GitHub Actions PostgreSQL');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe B3d5a PostgreSQL target');
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

  it('records a byte-bound claim but cannot authorize AVAILABLE or REJECTED', async () => {
    const f = await fixture();
    const attempt = await db.supplierAttachmentScanAttempt.create({
      data: observed(f),
    });
    expect(attempt.verdict).toBe(SupplierAttachmentScanVerdict.CLEAN_CANDIDATE);
    expect(attempt.contentSha256).toBe('a'.repeat(64));

    await expect(
      db.supplierDocumentAttachment.update({
        where: { id: f.reservationId },
        data: {
          status: SupplierDocumentAttachmentStatus.AVAILABLE,
          scanEngine: 'untrusted-ci-claim',
          scannedAt: new Date(),
        },
      }),
    ).rejects.toThrow();

    await expect(
      db.supplierDocumentAttachment.update({
        where: { id: f.reservationId },
        data: {
          status: SupplierDocumentAttachmentStatus.REJECTED,
          scanEngine: 'untrusted-ci-claim',
          scannedAt: new Date(),
          rejectionReason: 'untrusted',
        },
      }),
    ).rejects.toThrow();

    const pending = await db.supplierDocumentAttachment.findUniqueOrThrow({
      where: { id: f.reservationId },
    });
    expect(pending.status).toBe(SupplierDocumentAttachmentStatus.PENDING_SCAN);
    expect(pending.scannedAt).toBeNull();
  });

  it('rejects cross-tenant, mismatched identity, wrong bytes and nonce replay', async () => {
    const a = await fixture();
    const b = await fixture();
    const first = await db.supplierAttachmentScanAttempt.create({
      data: observed(a),
    });
    await expect(
      db.supplierAttachmentScanAttempt.create({
        data: { ...observed(a), companyId: b.companyId },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierAttachmentScanAttempt.create({
        data: { ...observed(a), reservationId: b.reservationId },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierAttachmentScanAttempt.create({
        data: { ...observed(a), contentSizeBytes: 43 },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierAttachmentScanAttempt.create({
        data: { ...observed(a), contentSha256: 'b'.repeat(64) },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierAttachmentScanAttempt.create({
        data: { ...observed(a), requestNonce: first.requestNonce },
      }),
    ).rejects.toThrow();
    expect(
      await db.supplierAttachmentScanAttempt.count({
        where: { companyId: a.companyId, attachmentId: a.reservationId },
      }),
    ).toBe(1);
  });

  it('rejects UPDATE/DELETE, enforces failure code and DB-owned recorded time', async () => {
    const f = await fixture();
    await expect(
      db.supplierAttachmentScanAttempt.create({
        data: observed(f, SupplierAttachmentScanVerdict.SCAN_FAILED),
      }),
    ).rejects.toThrow();

    const attempt = await db.supplierAttachmentScanAttempt.create({
      data: {
        ...observed(f, SupplierAttachmentScanVerdict.SCAN_FAILED),
        failureCode: 'SCANNER_UNAVAILABLE',
        createdAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });
    expect(attempt.createdAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00.000Z').getTime(),
    );
    await expect(
      db.supplierAttachmentScanAttempt.update({
        where: { id: attempt.id },
        data: { workerIdentity: 'SPOOFED' },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierAttachmentScanAttempt.delete({
        where: { id: attempt.id },
      }),
    ).rejects.toThrow();
  });
});
