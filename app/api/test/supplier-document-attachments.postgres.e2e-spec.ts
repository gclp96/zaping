import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import {
  PrismaClient,
  SupplierDocumentAttachmentStatus,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierDocumentAttachmentsService } from '../src/supplier-documents/supplier-document-attachments.service';

const describePg =
  process.env.RUN_SUPPLIER_ATTACHMENTS_PG === '1' ? describe : describe.skip;

describePg('Private supplier attachments on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let service: SupplierDocumentAttachmentsService;

  async function fixture() {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: {
        id: companyId,
        name: 'PDOC-01B isolated fixture',
        rfc: companyId,
      },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Attachment',
        lastName: 'QA',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'Proveedor adjunto QA' },
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
    return { companyId, actorId, documentId: document.id };
  }

  function attachment(f: Awaited<ReturnType<typeof fixture>>) {
    return {
      companyId: f.companyId,
      documentId: f.documentId,
      uploadedById: f.actorId,
      storageKey: 'company/' + randomUUID() + '/private/' + randomUUID(),
      originalName: 'evidencia.pdf',
      contentType: 'application/pdf',
      sizeBytes: 12,
      sha256: 'a'.repeat(64),
    };
  }

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error('UX-PDOC-01B tests require isolated GitHub Actions');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe UX-PDOC-01B PostgreSQL target');
    }
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRawUnsafe<
      { database: string; role: string }[]
    >('SELECT current_database() AS database, current_user AS role');
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });
    service = new SupplierDocumentAttachmentsService(
      db as unknown as PrismaService,
      {
        openReadOnly: () =>
          Promise.reject(
            new Error('Storage reads must not occur in metadata E2E'),
          ),
      },
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('only lists attachments after a clean scan', async () => {
    const f = await fixture();
    const metadata = await db.supplierDocumentAttachment.create({
      data: attachment(f),
    });
    expect(metadata.status).toBe(SupplierDocumentAttachmentStatus.PENDING_SCAN);
    expect(await service.listAvailable(f.companyId, f.documentId)).toEqual([]);

    await db.supplierDocumentAttachment.update({
      where: { id: metadata.id },
      data: {
        status: SupplierDocumentAttachmentStatus.AVAILABLE,
        scanEngine: 'ci-fake-scan-only',
        scannedAt: new Date(),
      },
    });

    const listed = await service.listAvailable(f.companyId, f.documentId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: metadata.id,
      originalName: 'evidencia.pdf',
      contentType: 'application/pdf',
      sizeBytes: 12,
    });
    expect(Object.keys(listed[0]).sort()).toEqual([
      'contentType',
      'createdAt',
      'id',
      'originalName',
      'sizeBytes',
    ]);
  });

  it('blocks attachments from other tenants', async () => {
    const a = await fixture();
    const b = await fixture();
    await db.supplierDocumentAttachment.create({ data: attachment(a) });

    await expect(
      service.listAvailable(b.companyId, a.documentId),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      db.supplierDocumentAttachment.create({
        data: {
          ...attachment(a),
          documentId: b.documentId,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects spoofed MIME, size, digest and scan state', async () => {
    const f = await fixture();
    await expect(
      db.supplierDocumentAttachment.create({
        data: {
          ...attachment(f),
          status: SupplierDocumentAttachmentStatus.AVAILABLE,
          scanEngine: 'spoof',
          scannedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierDocumentAttachment.create({
        data: { ...attachment(f), contentType: 'image/svg+xml' },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierDocumentAttachment.create({
        data: { ...attachment(f), sizeBytes: 10 * 1024 * 1024 + 1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierDocumentAttachment.create({
        data: { ...attachment(f), sha256: 'INVALID' },
      }),
    ).rejects.toThrow();
  });

  it('rejects mutation of object key and physical deletion', async () => {
    const f = await fixture();
    const row = await db.supplierDocumentAttachment.create({
      data: attachment(f),
    });
    await expect(
      db.supplierDocumentAttachment.update({
        where: { id: row.id },
        data: { storageKey: 'different-object' },
      }),
    ).rejects.toThrow();
    await expect(
      db.supplierDocumentAttachment.delete({ where: { id: row.id } }),
    ).rejects.toThrow();
  });

  it('requires scan evidence for an available transition', async () => {
    const f = await fixture();
    const row = await db.supplierDocumentAttachment.create({
      data: attachment(f),
    });
    await expect(
      db.supplierDocumentAttachment.update({
        where: { id: row.id },
        data: { status: SupplierDocumentAttachmentStatus.AVAILABLE },
      }),
    ).rejects.toThrow();
  });
});
