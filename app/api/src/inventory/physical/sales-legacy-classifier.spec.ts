import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { SalesLegacyClassifier } from './sales-legacy-classifier';
import {
  LegacySaleEvidence,
  legacySaleFingerprint,
  SaleEffectEvidence,
} from './sales-physical-evidence';
const companyId = randomUUID(),
  saleId = randomUUID(),
  productId = randomUUID(),
  actorId = randomUUID(),
  cutoverId = randomUUID();
function sale(): LegacySaleEvidence {
  return {
    id: saleId,
    companyId,
    customerId: randomUUID(),
    folio: 'TEST',
    status: 'CONFIRMED',
    quoteId: null,
    quote: null,
    subtotal: 3,
    iva: 0,
    total: 3,
    items: [
      {
        id: randomUUID(),
        saleId,
        productId,
        quantity: 3,
        price: 1,
        subtotal: 3,
        returnedQuantity: 0,
        product: { companyId },
      },
    ],
  } as LegacySaleEvidence;
}
function effect(): SaleEffectEvidence {
  const id = randomUUID();
  return {
    id,
    companyId,
    originType: 'SALE',
    originId: saleId,
    originOperation: 'CONFIRM',
    kind: 'DEFINITIVE_OUT',
    actorId,
    lineCount: 1,
    lines: [
      {
        companyId,
        effectId: id,
        sequence: 1,
        delta: -3,
        quantityBefore: 3,
        quantityAfter: 0,
        revisionBefore: 0,
        revisionAfter: 1,
        position: {
          id: randomUUID(),
          companyId,
          productId,
          state: 'AVAILABLE',
          inventoryBatchId: null,
          contextType: null,
          contextId: null,
        },
      },
    ],
  } as SaleEffectEvidence;
}
function setup() {
  const s = sale();
  const cutover = {
    id: cutoverId,
    companyId,
    status: 'DRY_RUN_REVIEWED',
    revision: 2,
    manifestDigest: 'a'.repeat(64),
    snapshotFingerprint: 'b'.repeat(64),
    baselineBuild: 'test',
    manifestLockedAt: null,
    recoveryFromStatus: null,
    initiatedBy: actorId,
    approvedBy: actorId,
    activatedBy: null,
    activatedAt: null,
  };
  const member = {
    companyId,
    cutoverId,
    saleId,
    quoteId: null,
    statusAtFreeze: 'CONFIRMED',
    saleFingerprint: legacySaleFingerprint(companyId, s),
    cutover,
  };
  const tx = {
    inventoryCutoverLegacySale: {
      findFirst: jest.fn().mockResolvedValue(member),
    },
    sale: { findFirst: jest.fn().mockResolvedValue(s) },
    inventoryPhysicalEffect: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const classifier = new SalesLegacyClassifier();
  return {
    s,
    member,
    tx,
    run: () =>
      classifier.classify(
        tx as unknown as Prisma.TransactionClient,
        companyId,
        saleId,
      ),
  };
}
describe('legacy Sale fingerprint', () => {
  it('canonicalizes items and excludes returned quantities/timestamps/catalog metadata', () => {
    const s = sale();
    s.items.push({ ...s.items[0], id: randomUUID(), productId: randomUUID() });
    const hash = legacySaleFingerprint(companyId, s);
    s.items.reverse();
    s.items[0].returnedQuantity = 2;
    s.updatedAt = new Date();
    expect(legacySaleFingerprint(companyId, s)).toBe(hash);
    s.items[0].quantity++;
    expect(legacySaleFingerprint(companyId, s)).not.toBe(hash);
  });
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite money %s', (n) => {
    const s = sale();
    s.total = n;
    expect(() => legacySaleFingerprint(companyId, s)).toThrow();
  });
  it('normalizes negative zero without rounding', () => {
    const s = sale();
    s.iva = -0;
    const hash = legacySaleFingerprint(companyId, s);
    s.iva = 0;
    expect(legacySaleFingerprint(companyId, s)).toBe(hash);
    s.total = 3.00000000001;
    expect(legacySaleFingerprint(companyId, s)).not.toBe(hash);
  });
  it('rejects DRAFT and foreign Product', () => {
    const s = sale();
    s.status = 'DRAFT';
    expect(() => legacySaleFingerprint(companyId, s)).toThrow();
    s.status = 'CONFIRMED';
    s.items[0].product.companyId = randomUUID();
    expect(() => legacySaleFingerprint(companyId, s)).toThrow();
  });
  it('includes Quote items and rejects contradictory Quote', () => {
    const s = sale();
    s.quoteId = randomUUID();
    s.quote = {
      id: s.quoteId,
      companyId,
      customerId: s.customerId,
      folio: 'Q',
      status: 'CONFIRMED',
      convertedToSale: true,
      subtotal: 3,
      iva: 0,
      total: 3,
      items: [
        {
          id: randomUUID(),
          quoteId: s.quoteId,
          productId,
          quantity: 3,
          price: 1,
          subtotal: 3,
          product: { companyId },
        },
      ],
    } as NonNullable<LegacySaleEvidence['quote']>;
    const hash = legacySaleFingerprint(companyId, s);
    s.quote.items[0].price = 2;
    expect(legacySaleFingerprint(companyId, s)).not.toBe(hash);
    s.quote.convertedToSale = false;
    expect(() => legacySaleFingerprint(companyId, s)).toThrow();
  });
});
describe('durable classifier', () => {
  it('certifies exact membership without writes', async () => {
    const f = setup();
    expect(await f.run()).toBe('LEGACY');
    expect(f.tx.inventoryCutoverLegacySale.findFirst).toHaveBeenCalledWith({
      where: { companyId, saleId },
      include: { cutover: true },
    });
  });
  it('coherent Effect without membership is PHYSICAL', async () => {
    const f = setup();
    f.tx.inventoryCutoverLegacySale.findFirst.mockResolvedValue(null);
    f.tx.inventoryPhysicalEffect.findUnique.mockResolvedValue(effect());
    expect(await f.run()).toBe('PHYSICAL');
  });
  it('membership plus Effect blocks even when Effect is coherent', async () => {
    const f = setup();
    f.tx.inventoryPhysicalEffect.findUnique.mockResolvedValue(effect());
    await expect(f.run()).rejects.toThrow('SALE_PHYSICAL_STATE_INCONSISTENT');
  });
  it('missing membership and Effect is UNKNOWN, including DRAFT', async () => {
    const f = setup();
    f.tx.inventoryCutoverLegacySale.findFirst.mockResolvedValue(null);
    expect(await f.run()).toBe('UNKNOWN');
    f.s.status = 'DRAFT';
    expect(await f.run()).toBe('UNKNOWN');
  });
  it('fingerprint mutation and tenant mismatch fail closed', async () => {
    const f = setup();
    f.s.total++;
    await expect(f.run()).rejects.toThrow();
    const g = setup();
    g.member.companyId = randomUUID();
    await expect(g.run()).rejects.toThrow();
  });
  it('certified returnedQuantity changes do not invalidate confirmation', async () => {
    const f = setup();
    f.s.items[0].returnedQuantity = 2;
    expect(await f.run()).toBe('LEGACY');
  });
  it('Quote contradiction fails closed', async () => {
    const f = setup();
    f.s.quoteId = randomUUID();
    await expect(f.run()).rejects.toThrow();
  });
  it('malformed Effect uses shared 01C coherence checks', async () => {
    const f = setup();
    f.tx.inventoryCutoverLegacySale.findFirst.mockResolvedValue(null);
    const e = effect();
    e.lines[0].delta = -2;
    f.tx.inventoryPhysicalEffect.findUnique.mockResolvedValue(e);
    await expect(f.run()).rejects.toThrow('SALE_PHYSICAL_EFFECT_MISMATCH');
  });
  it('re-reads Sale when a concurrent confirmation appears', async () => {
    const f = setup();
    f.tx.inventoryCutoverLegacySale.findFirst.mockResolvedValue(null);
    f.tx.sale.findFirst.mockResolvedValueOnce({ ...f.s, status: 'DRAFT' });
    f.tx.inventoryPhysicalEffect.findUnique.mockResolvedValue(effect());
    expect(await f.run()).toBe('PHYSICAL');
    expect(f.tx.sale.findFirst).toHaveBeenCalledTimes(2);
  });
});
