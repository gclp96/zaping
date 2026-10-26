import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient, SupplierDocumentType } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierDocumentsService } from '../src/supplier-documents/supplier-documents.service';
import { SupplierDocumentReconciliationService } from '../src/supplier-documents/supplier-document-reconciliation.service';

const describePg = process.env.RUN_R2A02_PG === '1' ? describe : describe.skip;

describePg('R2A-02 supplier-document reconciliation PostgreSQL', () => {
  let db: PrismaClient;
  let documents: SupplierDocumentsService;
  let reconciliation: SupplierDocumentReconciliationService;

  async function fixture() {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'R2A-02 fixture', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Test',
        lastName: 'R2A',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'R2A-02 supplier' },
    });
    return { companyId, actorId, supplierId: supplier.id };
  }

  async function receipt(companyId: string, supplierId: string) {
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
    const entry = await db.purchaseReceipt.create({
      data: {
        companyId,
        purchaseId: purchase.id,
        folio: randomUUID(),
      },
    });
    return { receiptId: entry.id, purchaseId: purchase.id };
  }

  async function invoice(f: Awaited<ReturnType<typeof fixture>>) {
    return documents.create(f.companyId, f.actorId, randomUUID(), {
      supplierId: f.supplierId,
      type: SupplierDocumentType.FACTURA,
      number: randomUUID(),
      documentDate: '2026-10-25',
      goodsNetAmount: '100.00',
      currency: 'MXN',
    });
  }

  async function confirmed(f: Awaited<ReturnType<typeof fixture>>) {
    const document = await invoice(f);
    const event = await reconciliation.confirmBasis(
      f.companyId,
      f.actorId,
      randomUUID(),
      document.id,
      {
        goodsNetAmount: '100.00',
        currency: 'MXN',
        reason: 'Se revisó base neta y moneda del proveedor',
        expectedRevision: 0,
      },
    );
    expect(event.revision).toBe(1);
    return document;
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (
      !url ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error(
        'R2A-02 PostgreSQL tests require isolated GitHub Actions',
      );
    }
    const target = new URL(url);
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe R2A-02 PostgreSQL test target');
    }
    db = new PrismaClient({ datasources: { db: { url } } });
    const [identity] = await db.$queryRawUnsafe<
      { database: string; role: string }[]
    >('SELECT current_database() AS database, current_user AS role');
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });
    documents = new SupplierDocumentsService(db as unknown as PrismaService);
    reconciliation = new SupplierDocumentReconciliationService(
      db as unknown as PrismaService,
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('allocates one invoice to receipts of separate purchase orders', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const a = await receipt(f.companyId, f.supplierId);
    const b = await receipt(f.companyId, f.supplierId);
    const first = await reconciliation.createAllocation(
      f.companyId,
      f.actorId,
      randomUUID(),
      doc.id,
      {
        receiptId: a.receiptId,
        allocatedSubtotal: '60.00',
        expectedRevision: 1,
      },
    );
    expect(first.revision).toBe(2);
    const second = await reconciliation.createAllocation(
      f.companyId,
      f.actorId,
      randomUUID(),
      doc.id,
      { receiptId: b.receiptId, allocatedSubtotal: '40', expectedRevision: 2 },
    );
    expect(second.revision).toBe(3);
    const links = await reconciliation.allocations(f.companyId, doc.id);
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.purchaseId).sort()).toEqual(
      [a.purchaseId, b.purchaseId].sort(),
    );
    expect(
      links.reduce((sum, link) => sum + Number(link.allocatedSubtotal), 0),
    ).toBe(100);
    expect(
      await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
  });

  it('cannot exceed invoice net merchandise base', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const a = await receipt(f.companyId, f.supplierId);
    const b = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId,
      f.actorId,
      randomUUID(),
      doc.id,
      { receiptId: a.receiptId, allocatedSubtotal: '90', expectedRevision: 1 },
    );
    await expect(
      reconciliation.createAllocation(
        f.companyId,
        f.actorId,
        randomUUID(),
        doc.id,
        {
          receiptId: b.receiptId,
          allocatedSubtotal: '11',
          expectedRevision: 2,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await db.purchaseReceiptDocument.count({
        where: { companyId: f.companyId, documentId: doc.id },
      }),
    ).toBe(1);
  });

  it('rejects cross-supplier and cross-company receipt associations', async () => {
    const a = await fixture();
    const b = await fixture();
    const doc = await confirmed(a);
    const otherSupplier = await db.supplier.create({
      data: { companyId: a.companyId, name: 'Different supplier' },
    });
    const wrongSupplier = await receipt(a.companyId, otherSupplier.id);
    const wrongCompany = await receipt(b.companyId, b.supplierId);
    for (const receiptId of [wrongSupplier.receiptId, wrongCompany.receiptId]) {
      await expect(
        reconciliation.createAllocation(
          a.companyId,
          a.actorId,
          randomUUID(),
          doc.id,
          { receiptId, allocatedSubtotal: '10', expectedRevision: 1 },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(
      await db.purchaseReceiptDocument.count({
        where: { companyId: a.companyId },
      }),
    ).toBe(0);
  });

  it('serializes simultaneous invoice allocations without overspending', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const a = await receipt(f.companyId, f.supplierId);
    const b = await receipt(f.companyId, f.supplierId);
    const results = await Promise.allSettled([
      reconciliation.createAllocation(
        f.companyId,
        f.actorId,
        randomUUID(),
        doc.id,
        {
          receiptId: a.receiptId,
          allocatedSubtotal: '70',
          expectedRevision: 1,
        },
      ),
      reconciliation.createAllocation(
        f.companyId,
        f.actorId,
        randomUUID(),
        doc.id,
        {
          receiptId: b.receiptId,
          allocatedSubtotal: '70',
          expectedRevision: 1,
        },
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const links = await reconciliation.allocations(f.companyId, doc.id);
    expect(links).toHaveLength(1);
    expect(links[0].allocatedSubtotal.toFixed(2)).toBe('70.00');
  });

  it('replays an old allocation result even after the document revision changes', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const a = await receipt(f.companyId, f.supplierId);
    const b = await receipt(f.companyId, f.supplierId);
    const key = randomUUID();
    const payload = {
      receiptId: a.receiptId,
      allocatedSubtotal: '25',
      expectedRevision: 1,
    };
    const first = await reconciliation.createAllocation(
      f.companyId,
      f.actorId,
      key,
      doc.id,
      payload,
    );
    await reconciliation.createAllocation(
      f.companyId,
      f.actorId,
      randomUUID(),
      doc.id,
      { receiptId: b.receiptId, allocatedSubtotal: '25', expectedRevision: 2 },
    );
    const replay = await reconciliation.createAllocation(
      f.companyId,
      f.actorId,
      key,
      doc.id,
      payload,
    );
    expect(replay).toEqual(first);
    await expect(
      reconciliation.createAllocation(f.companyId, f.actorId, key, doc.id, {
        ...payload,
        allocatedSubtotal: '26',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
