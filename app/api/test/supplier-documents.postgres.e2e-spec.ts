import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaClient,
  SupplierDocumentTaxArea,
  SupplierDocumentTaxTreatment,
  SupplierDocumentType,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupplierDocumentsService } from '../src/supplier-documents/supplier-documents.service';

const describePg =
  process.env.RUN_SUPPLIER_DOC_PG === '1' ? describe : describe.skip;

describePg('R2A-01 supplier documents on isolated PostgreSQL', () => {
  let db: PrismaClient;
  let service: SupplierDocumentsService;

  async function fixture() {
    const companyId = randomUUID();
    const actorId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'R2A-01 CI fixture', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'QA',
        lastName: 'R2A',
        email: actorId + '@example.invalid',
        passwordHash: 'NOT_A_LOGIN',
        role: 'ADMIN',
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'Proveedor CI R2A' },
    });
    return { companyId, actorId, supplierId: supplier.id };
  }

  function input(supplierId: string) {
    return {
      supplierId,
      type: SupplierDocumentType.FACTURA,
      series: 'FAC',
      number: '000123',
      documentDate: '2026-10-25',
      currency: 'MXN',
      subtotalAmount: '1000.00',
      ivaAmount: '160.00',
      totalAmount: '1160.00',
      goodsNetAmount: '1000.00',
      taxBreakdowns: [
        {
          area: SupplierDocumentTaxArea.GOODS,
          treatment: SupplierDocumentTaxTreatment.TAXABLE_16,
          baseAmount: '1000.00',
          ivaAmount: '160.00',
        },
      ],
    };
  }

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error('R2A-01 tests require isolated GitHub Actions CI');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe R2A-01 PostgreSQL target');
    }
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRawUnsafe<
      { database: string; role: string }[]
    >('SELECT current_database() AS database, current_user AS role');
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });
    service = new SupplierDocumentsService(db as unknown as PrismaService);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('creates a document, breakdown, and append-only audit event', async () => {
    const f = await fixture();
    const doc = await service.create(
      f.companyId,
      f.actorId,
      randomUUID(),
      input(f.supplierId),
    );
    expect(doc.identityOccurrence).toBe(1);
    expect(doc.totalAmount?.toFixed(2)).toBe('1160.00');
    expect(doc.taxBreakdowns).toHaveLength(1);
    expect(doc.basisStatus).toBe('PENDING_REVIEW');
    const detail = await service.detail(f.companyId, doc.id);
    expect(detail.audits).toHaveLength(1);
    expect(detail.audits[0].revisionAfter).toBe(0);
  });

  it('rejects duplicate identity without creating another document', async () => {
    const f = await fixture();
    await service.create(
      f.companyId,
      f.actorId,
      randomUUID(),
      input(f.supplierId),
    );
    await expect(
      service.create(f.companyId, f.actorId, randomUUID(), input(f.supplierId)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await db.supplierDocument.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
  });

  it('replays exact idempotency keys and rejects incompatible reuse', async () => {
    const f = await fixture();
    const key = randomUUID();
    const first = await service.create(
      f.companyId,
      f.actorId,
      key,
      input(f.supplierId),
    );
    const replay = await service.create(f.companyId, f.actorId, key, {
      ...input(f.supplierId),
      subtotalAmount: '1000',
    });
    expect(replay.id).toBe(first.id);
    await expect(
      service.create(f.companyId, f.actorId, key, {
        ...input(f.supplierId),
        subtotalAmount: '999.00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks cross-tenant reads and supplier ownership violations', async () => {
    const first = await fixture();
    const second = await fixture();
    const doc = await service.create(
      first.companyId,
      first.actorId,
      randomUUID(),
      input(first.supplierId),
    );
    await expect(
      service.detail(second.companyId, doc.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.create(
        first.companyId,
        first.actorId,
        randomUUID(),
        input(second.supplierId),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks duplicate UUID with a different commercial folio', async () => {
    const f = await fixture();
    const cfdiUuid = randomUUID();
    await service.create(f.companyId, f.actorId, randomUUID(), {
      ...input(f.supplierId),
      cfdiUuid,
    });
    await expect(
      service.create(f.companyId, f.actorId, randomUUID(), {
        ...input(f.supplierId),
        number: '000124',
        cfdiUuid,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps administrative exceptions independently auditable', async () => {
    const f = await fixture();
    const first = await service.create(
      f.companyId,
      f.actorId,
      randomUUID(),
      input(f.supplierId),
    );
    const next = await service.createException(
      f.companyId,
      f.actorId,
      randomUUID(),
      {
        ...input(f.supplierId),
        duplicateOfDocumentId: first.id,
        reason: 'Emisión legítima independiente confirmada',
        evidenceReference: 'Confirmación escrita del proveedor',
      },
    );
    expect(next.identityOccurrence).toBe(2);
    const detail = await service.detail(f.companyId, next.id);
    expect(detail.audits[0].operation).toBe('DOCUMENT_CREATED_BY_EXCEPTION');
  });

  it('serializes two concurrent duplicate writes for a supplier', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      service.create(f.companyId, f.actorId, randomUUID(), input(f.supplierId)),
      service.create(f.companyId, f.actorId, randomUUID(), input(f.supplierId)),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await db.supplierDocument.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
  });

  it('keeps one document when the same idempotency key is submitted concurrently', async () => {
    const f = await fixture();
    const key = randomUUID();
    const results = await Promise.all([
      service.create(f.companyId, f.actorId, key, input(f.supplierId)),
      service.create(f.companyId, f.actorId, key, input(f.supplierId)),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(
      await db.supplierDocument.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
    expect(
      await db.supplierDocumentAudit.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
  });

  it('rejects exceptions referring to another supplier of the same company', async () => {
    const f = await fixture();
    const other = await db.supplier.create({
      data: { companyId: f.companyId, name: 'Otro proveedor CI R2A' },
    });
    const original = await service.create(
      f.companyId,
      f.actorId,
      randomUUID(),
      input(f.supplierId),
    );
    await expect(
      service.createException(f.companyId, f.actorId, randomUUID(), {
        ...input(other.id),
        duplicateOfDocumentId: original.id,
        reason: 'Intento de excepción asociada a otro proveedor',
        evidenceReference: 'QA cruce de proveedor',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records all original amounts and tax lines in an immutable audit event', async () => {
    const f = await fixture();
    const document = await service.create(
      f.companyId,
      f.actorId,
      randomUUID(),
      {
        ...input(f.supplierId),
        withholdingAmount: '20.00',
        issuerRfc: 'AAA010101AAA',
        receiverRfc: 'BBB010101BBB',
      },
    );
    const detail = await service.detail(f.companyId, document.id);
    const audit = detail.audits[0];
    const change = audit.change as {
      snapshot: {
        withholdingAmount: string | null;
        supplierId: string;
        issuerRfc: string | null;
        receiverRfc: string | null;
        taxBreakdowns: { baseAmount: string; ivaAmount: string }[];
      };
    };
    expect(change.snapshot.withholdingAmount).toBe('20.00');
    expect(change.snapshot.supplierId).toBe(f.supplierId);
    expect(change.snapshot.issuerRfc).toBe('AAA010101AAA');
    expect(change.snapshot.receiverRfc).toBe('BBB010101BBB');
    expect(change.snapshot.taxBreakdowns[0].baseAmount).toBe('1000.00');
    expect(change.snapshot.taxBreakdowns[0].ivaAmount).toBe('160.00');
    await expect(
      db.supplierDocumentAudit.update({
        where: { id: audit.id },
        data: { reason: 'Tampered after creation' },
      }),
    ).rejects.toThrow();
    expect(
      await db.supplierDocumentAudit.count({ where: { id: audit.id } }),
    ).toBe(1);
  });

  it('rejects invalid exempt-tax breakdown before writes', async () => {
    const f = await fixture();
    await expect(
      service.create(f.companyId, f.actorId, randomUUID(), {
        ...input(f.supplierId),
        taxBreakdowns: [
          {
            area: SupplierDocumentTaxArea.GOODS,
            treatment: SupplierDocumentTaxTreatment.EXEMPT,
            baseAmount: '1000.00',
            ivaAmount: '160.00',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await db.supplierDocument.count({ where: { companyId: f.companyId } }),
    ).toBe(0);
  });
});
