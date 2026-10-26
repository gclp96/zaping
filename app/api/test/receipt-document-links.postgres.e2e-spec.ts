import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient, SupplierDocumentType } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReceiptDocumentLinksService } from '../src/supplier-documents/receipt-document-links.service';

const describePg =
  process.env.RUN_RECEIPT_DOCUMENT_LINKS_PG === '1'
    ? describe
    : describe.skip;

describePg('UX-PDOC-01A receipt-document associations PostgreSQL', () => {
  let db: PrismaClient;
  let links: ReceiptDocumentLinksService;

  async function fixture() {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'UX-PDOC-01A fixture', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'QA',
        lastName: 'Receipt',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'Supplier A' },
    });
    const otherSupplier = await db.supplier.create({
      data: { companyId, name: 'Supplier B' },
    });
    return {
      companyId,
      actorId,
      supplierId: supplier.id,
      otherSupplierId: otherSupplier.id,
    };
  }

  async function makeReceipt(companyId: string, supplierId: string) {
    const purchase = await db.purchase.create({
      data: {
        companyId,
        supplierId,
        folio: randomUUID(),
        subtotal: 0,
        iva: 0,
        total: 0,
        status: 'CONFIRMED',
      },
    });
    const receipt = await db.purchaseReceipt.create({
      data: { companyId, purchaseId: purchase.id, folio: randomUUID() },
    });
    return { receiptId: receipt.id, purchaseId: purchase.id };
  }

  async function makeDocument(
    companyId: string,
    supplierId: string,
    occurrence = 1,
  ) {
    return db.supplierDocument.create({
      data: {
        companyId,
        supplierId,
        createdById: (await db.user.findFirstOrThrow({
          where: { companyId },
          select: { id: true },
        })).id,
        type: SupplierDocumentType.REMISION,
        number: 'REM-123',
        normalizedNumber: 'REM-123',
        identityOccurrence: occurrence,
        documentDate: new Date('2026-10-26T00:00:00.000Z'),
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
      throw new Error('UX-PDOC-01A tests require isolated CI PostgreSQL');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe UX-PDOC-01A database target');
    }
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRawUnsafe<
      { database: string; role: string }[]
    >('SELECT current_database() AS database, current_user AS role');
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });
    links = new ReceiptDocumentLinksService(
      db as unknown as PrismaService,
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('links by actual ID despite two documents sharing the same folio', async () => {
    const f = await fixture();
    const receipt = await makeReceipt(f.companyId, f.supplierId);
    const firstDoc = await makeDocument(f.companyId, f.supplierId);
    const secondDoc = await makeDocument(f.companyId, f.supplierId, 2);

    const link = await links.link(
      f.companyId,
      f.actorId,
      receipt.receiptId,
      secondDoc.id,
    );
    expect(link.documentId).toBe(secondDoc.id);
    expect(link.documentId).not.toBe(firstDoc.id);

    const listed = await links.list(f.companyId, receipt.receiptId);
    expect(listed.map((row) => row.document.id)).toEqual([secondDoc.id]);
  });

  it('allows N:M associations but no duplicate active link', async () => {
    const f = await fixture();
    const receiptA = await makeReceipt(f.companyId, f.supplierId);
    const receiptB = await makeReceipt(f.companyId, f.supplierId);
    const doc = await makeDocument(f.companyId, f.supplierId);

    const first = await links.link(
      f.companyId,
      f.actorId,
      receiptA.receiptId,
      doc.id,
    );
    const replay = await links.link(
      f.companyId,
      f.actorId,
      receiptA.receiptId,
      doc.id,
    );
    expect(replay.id).toBe(first.id);
    await links.link(f.companyId, f.actorId, receiptB.receiptId, doc.id);
    expect(
      await db.purchaseReceiptSupplierDocumentLink.count({
        where: { companyId: f.companyId, documentId: doc.id, removedAt: null },
      }),
    ).toBe(2);
  });

  it('serializes concurrent replays without creating duplicate links', async () => {
    const f = await fixture();
    const receipt = await makeReceipt(f.companyId, f.supplierId);
    const doc = await makeDocument(f.companyId, f.supplierId);
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () =>
        links.link(f.companyId, f.actorId, receipt.receiptId, doc.id),
      ),
    );
    expect(new Set(concurrent.map((link) => link.id)).size).toBe(1);
  });

  it('retains the removed event after a later relink', async () => {
    const f = await fixture();
    const receipt = await makeReceipt(f.companyId, f.supplierId);
    const doc = await makeDocument(f.companyId, f.supplierId);
    const first = await links.link(
      f.companyId,
      f.actorId,
      receipt.receiptId,
      doc.id,
    );

    await links.unlink(
      f.companyId,
      f.actorId,
      receipt.receiptId,
      doc.id,
      'Documento capturado por error',
    );
    const second = await links.link(
      f.companyId,
      f.actorId,
      receipt.receiptId,
      doc.id,
    );
    expect(second.id).not.toBe(first.id);

    const all = await db.purchaseReceiptSupplierDocumentLink.findMany({
      where: { companyId: f.companyId, receiptId: receipt.receiptId },
      orderBy: { createdAt: 'asc' },
    });
    expect(all).toHaveLength(2);
    expect(all.filter((row) => row.removedAt === null)).toHaveLength(1);
    expect(all.find((row) => row.id === first.id)?.reason).toBe(
      'Documento capturado por error',
    );
  });

  it('rejects supplier mismatches and cross-tenant identifiers', async () => {
    const f = await fixture();
    const other = await fixture();
    const receipt = await makeReceipt(f.companyId, f.supplierId);
    const wrongSupplier = await makeDocument(
      f.companyId,
      f.otherSupplierId,
    );
    const foreign = await makeDocument(other.companyId, other.supplierId);

    await expect(
      links.link(
        f.companyId,
        f.actorId,
        receipt.receiptId,
        wrongSupplier.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      links.link(f.companyId, f.actorId, receipt.receiptId, foreign.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      links.list(other.companyId, receipt.receiptId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects FK-bypassing supplier mismatches and historical deletions', async () => {
    const f = await fixture();
    const receipt = await makeReceipt(f.companyId, f.supplierId);
    const doc = await makeDocument(f.companyId, f.supplierId);
    const wrongSupplier = await makeDocument(
      f.companyId,
      f.otherSupplierId,
    );
    await expect(
      db.purchaseReceiptSupplierDocumentLink.create({
        data: {
          companyId: f.companyId,
          purchaseId: receipt.purchaseId,
          supplierId: wrongSupplier.supplierId,
          receiptId: receipt.receiptId,
          documentId: wrongSupplier.id,
          createdById: f.actorId,
        },
      }),
    ).rejects.toThrow();

    const link = await links.link(
      f.companyId,
      f.actorId,
      receipt.receiptId,
      doc.id,
    );
    await expect(
      db.purchaseReceiptSupplierDocumentLink.delete({
        where: { id: link.id },
      }),
    ).rejects.toThrow();
  });
});
