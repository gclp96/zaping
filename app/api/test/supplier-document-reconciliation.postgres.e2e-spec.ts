import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PrismaClient,
  SupplierDocumentType,
  SupplierDocumentCancellationSource,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierDocumentsService } from '../src/supplier-documents/supplier-documents.service';
import { SupplierDocumentReconciliationService } from '../src/supplier-documents/supplier-document-reconciliation.service';
import { SupplierReceiptVarianceService } from '../src/supplier-documents/supplier-receipt-variance.service';
import { AllocationRevisionAction } from '../src/supplier-documents/dto/supplier-document-reconciliation.dto';

const describePg = process.env.RUN_R2A02_PG === '1' ? describe : describe.skip;

describePg('R2A-02 supplier-document reconciliation PostgreSQL', () => {
  let db: PrismaClient;
  let documents: SupplierDocumentsService;
  let reconciliation: SupplierDocumentReconciliationService;
  let variance: SupplierReceiptVarianceService;

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
    variance = new SupplierReceiptVarianceService(
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


  it('revises an allocation amount while preserving before and after audit', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '60', expectedRevision: 1 },
    );
    const [link] = await reconciliation.allocations(f.companyId, doc.id);
    const event = await reconciliation.reviseAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        allocationId: link.id, action: AllocationRevisionAction.REPLACE_AMOUNT,
        allocatedSubtotal: '75', reason: 'Precio neto actualizado por proveedor',
        expectedRevision: 2, expectedAllocationRevision: 0,
      },
    );
    expect(event.revision).toBe(3);
    const [current] = await reconciliation.allocations(f.companyId, doc.id);
    expect(current.allocatedSubtotal.toFixed(2)).toBe('75.00');
    expect(current.revision).toBe(1);
    const detail = await documents.detail(f.companyId, doc.id);
    expect(detail.audits[3].operation).toBe('ALLOCATION_REVISED');
  });

  it('deactivates an allocation without deleting its historical link', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '60', expectedRevision: 1 },
    );
    const [link] = await reconciliation.allocations(f.companyId, doc.id);
    await reconciliation.reviseAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        allocationId: link.id, action: AllocationRevisionAction.DEACTIVATE,
        reason: 'Vínculo documental asignado por equivocación',
        expectedRevision: 2, expectedAllocationRevision: 0,
      },
    );
    const [saved] = await reconciliation.allocations(f.companyId, doc.id);
    expect(saved.isActive).toBe(false);
    expect(saved.allocatedSubtotal.toFixed(2)).toBe('60.00');
    expect(saved.revision).toBe(1);
  });

  it('rejects a basis correction below active links, then permits an audited correction', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '80', expectedRevision: 1 },
    );
    await expect(reconciliation.correctBasis(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        goodsNetAmount: '70', currency: 'MXN',
        reason: 'Corrección por factura del proveedor', expectedRevision: 2,
      },
    )).rejects.toBeInstanceOf(ConflictException);
    const event = await reconciliation.correctBasis(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        goodsNetAmount: '90', currency: 'MXN',
        reason: 'Corrección por factura del proveedor', expectedRevision: 2,
      },
    );
    expect(event.revision).toBe(3);
    expect((await documents.detail(f.companyId, doc.id)).goodsNetAmount?.toFixed(2))
      .toBe('90.00');
  });

  it('cancels a document, retains links and references a distinct replacement without transferring coverage', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const replacement = await invoice(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '90', expectedRevision: 1 },
    );
    const result = await reconciliation.cancelDocument(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        source: SupplierDocumentCancellationSource.INTERNAL_RECORD_ERROR,
        reason: 'La factura original fue capturada con folio erróneo',
        replacedByDocumentId: replacement.id, expectedRevision: 2,
      },
    );
    expect(result.operation).toBe('DOCUMENT_CANCELLED');
    const old = await documents.detail(f.companyId, doc.id);
    expect(old.status).toBe('CANCELLED');
    expect(old.replacedByDocumentId).toBe(replacement.id);
    const [link] = await reconciliation.allocations(f.companyId, doc.id);
    expect(link.isActive).toBe(false);
    expect(link.allocatedSubtotal.toFixed(2)).toBe('90.00');
    expect(await reconciliation.allocations(f.companyId, replacement.id)).toEqual([]);
    await expect(reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '10', expectedRevision: 3 },
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires evidence for reported external cancellation and blocks other-supplier substitution', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    await expect(reconciliation.cancelDocument(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        source: SupplierDocumentCancellationSource.EXTERNAL_REPORTED,
        reason: 'Cancelación emitida por proveedor externo', expectedRevision: 1,
      },
    )).rejects.toThrow();
    const different = await db.supplier.create({
      data: { companyId: f.companyId, name: 'Proveedor sustituto inválido' },
    });
    const replacement = await documents.create(
      f.companyId, f.actorId, randomUUID(), {
        supplierId: different.id, type: SupplierDocumentType.FACTURA,
        number: randomUUID(), documentDate: '2026-10-25',
      },
    );
    await expect(reconciliation.cancelDocument(
      f.companyId, f.actorId, randomUUID(), doc.id, {
        source: SupplierDocumentCancellationSource.INTERNAL_RECORD_ERROR,
        reason: 'Documento original incorrecto',
        replacedByDocumentId: replacement.id, expectedRevision: 1,
      },
    )).rejects.toBeInstanceOf(NotFoundException);
    expect((await documents.detail(f.companyId, doc.id)).status).toBe('ACTIVE');
  });


  it('approves a documented difference with an immutable, idempotent snapshot', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '60', expectedRevision: 1 },
    );
    const state = await variance.overview(f.companyId, entry.receiptId);
    expect(state.approvalCurrent).toBe(false);
    expect(state.allocatedTotalAmount).toBe('60.00');
    const key = randomUUID();
    const dto = {
      receiptComparableNetAmount: '55.00',
      receiptCurrency: 'MXN',
      reason: 'Diferencia de precio aceptada tras revisión documental',
      evidenceReference: 'Cotización corregida y correo del proveedor',
      expectedSnapshotHash: state.snapshotHash,
    };
    const approved = await variance.approve(
      f.companyId, f.actorId, key, entry.receiptId, dto,
    );
    expect(approved.differenceAmount.toFixed(2)).toBe('5.00');
    expect((await variance.overview(f.companyId, entry.receiptId)).approvalCurrent)
      .toBe(true);
    expect((await variance.approve(f.companyId, f.actorId, key, entry.receiptId, dto)).id)
      .toBe(approved.id);
    await expect(db.purchaseReceiptReconciliationApproval.update({
      where: { id: approved.id }, data: { reason: 'Alterado' },
    })).rejects.toThrow();
  });

  it('automatically invalidates variance approval after changing an allocation', async () => {
    const f = await fixture();
    const doc = await confirmed(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '60', expectedRevision: 1 },
    );
    const before = await variance.overview(f.companyId, entry.receiptId);
    await variance.approve(
      f.companyId, f.actorId, randomUUID(), entry.receiptId,
      {
        receiptComparableNetAmount: '55',
        receiptCurrency: 'MXN',
        reason: 'Diferencia revisada según evidencia original',
        evidenceReference: 'Carta del proveedor con desglose',
        expectedSnapshotHash: before.snapshotHash,
      },
    );
    const [link] = await reconciliation.allocations(f.companyId, doc.id);
    await reconciliation.reviseAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      {
        allocationId: link.id,
        action: AllocationRevisionAction.REPLACE_AMOUNT,
        allocatedSubtotal: '50',
        reason: 'Importe ajustado por corrección documental',
        expectedRevision: 2,
        expectedAllocationRevision: 0,
      },
    );
    const now = await variance.overview(f.companyId, entry.receiptId);
    expect(now.approvalCurrent).toBe(false);
    await expect(variance.approve(
      f.companyId, f.actorId, randomUUID(), entry.receiptId,
      {
        receiptComparableNetAmount: '45',
        receiptCurrency: 'MXN',
        reason: 'Intento con snapshot anterior obsoleto',
        evidenceReference: 'Referencia documental antigua',
        expectedSnapshotHash: before.snapshotHash,
      },
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unverified currency and cross-company receipt approval', async () => {
    const f = await fixture();
    const stranger = await fixture();
    const doc = await confirmed(f);
    const entry = await receipt(f.companyId, f.supplierId);
    await reconciliation.createAllocation(
      f.companyId, f.actorId, randomUUID(), doc.id,
      { receiptId: entry.receiptId, allocatedSubtotal: '60', expectedRevision: 1 },
    );
    await expect(variance.overview(stranger.companyId, entry.receiptId))
      .rejects.toBeInstanceOf(NotFoundException);
    const before = await variance.overview(f.companyId, entry.receiptId);
    await expect(variance.approve(
      f.companyId, f.actorId, randomUUID(), entry.receiptId,
      {
        receiptComparableNetAmount: '55',
        receiptCurrency: 'USD',
        reason: 'Intento con moneda no homogénea',
        evidenceReference: 'Referencia de costo externo',
        expectedSnapshotHash: before.snapshotHash,
      },
    )).rejects.toBeInstanceOf(ConflictException);
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
