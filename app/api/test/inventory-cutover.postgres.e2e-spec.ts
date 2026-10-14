import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { InventoryCutoverService } from '../src/inventory/physical/inventory-cutover.service';
import { InventoryCutoverRepository } from '../src/inventory/physical/inventory-cutover.repository';
import { InventoryAuthorityResolver } from '../src/inventory/physical/inventory-authority-resolver';
import { ReviewedManifest } from '../src/inventory/physical/inventory-cutover.contract';
import {
  legacySaleFingerprint,
  legacySaleInclude,
} from '../src/inventory/physical/sales-physical-evidence';
import { SalesLegacyClassifier } from '../src/inventory/physical/sales-legacy-classifier';

const suite =
  process.env.RUN_INVENTORY_CUTOVER_POSTGRES === '1' ? describe : describe.skip;
suite('01D-A isolated PostgreSQL control acceptance', () => {
  let db: PrismaClient, other: PrismaClient;
  let companyId: string,
    foreignId: string,
    actorId: string,
    foreignActor: string,
    productId: string,
    foreignProduct: string,
    saleId: string,
    foreignSale: string,
    quoteId: string,
    foreignQuote: string,
    cutoverId: string;
  const hash = 'a'.repeat(64),
    runId = process.env.INVENTORY_CUTOVER_TEST_RUN!;
  const repo = new InventoryCutoverRepository(),
    service = new InventoryCutoverService(repo),
    resolver = new InventoryAuthorityResolver();
  const owners: string[] = [];
  beforeAll(async () => {
    const url = new URL(process.env.INVENTORY_CUTOVER_TEST_DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/zaping_cutover_test' ||
      url.username !== 'cutover_test' ||
      !runId
    )
      throw new Error('unverified test target');
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$connect();
    await other.$connect();
  });
  async function tenant() {
    const c = randomUUID(),
      u = randomUUID(),
      p = randomUUID(),
      customer = randomUUID(),
      q = randomUUID(),
      s = randomUUID();
    owners.push(c);
    await db.company.create({
      data: { id: c, name: `CUTOVER TEST ${runId}`, rfc: c },
    });
    await db.user.create({
      data: {
        id: u,
        companyId: c,
        firstName: 'Test',
        lastName: 'Only',
        email: `${u}@example.invalid`,
        passwordHash: 'NOT-A-CREDENTIAL',
        role: 'ADMIN',
      },
    });
    await db.product.create({
      data: {
        id: p,
        companyId: c,
        sku: p,
        name: 'Test',
        stock: 0,
        inventoryTracking: 'QUANTITY',
        lotTracking: 'NONE',
      },
    });
    await db.customer.create({
      data: { id: customer, companyId: c, name: 'Test' },
    });
    await db.quote.create({
      data: {
        id: q,
        companyId: c,
        customerId: customer,
        folio: q,
        status: 'CONFIRMED',
        convertedToSale: true,
        subtotal: 1,
        iva: 0,
        total: 1,
        items: { create: { productId: p, quantity: 1, price: 1, subtotal: 1 } },
      },
    });
    await db.sale.create({
      data: {
        id: s,
        companyId: c,
        customerId: customer,
        folio: s,
        status: 'CONFIRMED',
        quoteId: q,
        subtotal: 1,
        iva: 0,
        total: 1,
        items: { create: { productId: p, quantity: 1, price: 1, subtotal: 1 } },
      },
    });
    return { c, u, p, q, s };
  }
  beforeEach(async () => {
    const a = await tenant(),
      b = await tenant();
    companyId = a.c;
    actorId = a.u;
    productId = a.p;
    quoteId = a.q;
    saleId = a.s;
    foreignId = b.c;
    foreignActor = b.u;
    foreignProduct = b.p;
    foreignQuote = b.q;
    foreignSale = b.s;
    cutoverId = randomUUID();
  });
  afterAll(async () => {
    if (!db) return;
    // Delete only fixtures carrying both this run's IDs and ownership marker.
    const where = { companyId: { in: owners } };
    const actual = await db.company.findMany({
      where: { id: { in: owners }, name: `CUTOVER TEST ${runId}` },
      select: { id: true },
    });
    if (actual.length !== owners.length)
      throw new Error('fixture ownership mismatch');
    await db.$transaction(
      async (tx) => {
        await tx.inventoryCutoverLegacySale.deleteMany({ where });
        await tx.inventoryCutoverProduct.deleteMany({ where });
        await tx.inventoryCutover.deleteMany({ where });
        await tx.saleItem.deleteMany({
          where: { sale: { companyId: { in: owners } } },
        });
        await tx.sale.deleteMany({ where });
        await tx.quoteItem.deleteMany({
          where: { quote: { companyId: { in: owners } } },
        });
        await tx.quote.deleteMany({ where });
        await tx.inventoryPhysicalEffectLine.deleteMany({ where });
        await tx.inventoryPhysicalEffect.deleteMany({ where });
        await tx.inventoryPosition.deleteMany({ where });
        await tx.inventoryBatch.deleteMany({ where });
        await tx.product.deleteMany({ where });
        await tx.customer.deleteMany({ where });
        await tx.user.deleteMany({ where });
        await tx.company.deleteMany({
          where: { id: { in: owners }, name: `CUTOVER TEST ${runId}` },
        });
      },
      { timeout: 20000 },
    );
    expect(await db.company.count({ where: { id: { in: owners } } })).toBe(0);
    await db.$disconnect();
    await other.$disconnect();
  });
  const create = () =>
    db.$transaction((tx) =>
      service.create(tx, { id: cutoverId, companyId, actorId }),
    );
  const expected = (
    status:
      | 'PRECHECK'
      | 'WRITERS_FROZEN'
      | 'DRY_RUN_REVIEWED'
      | 'OPENING_APPLYING' = 'PRECHECK',
    revision = 0,
    digest: string | null = null,
  ) => ({
    companyId,
    cutoverId,
    expectedRevision: revision,
    expectedStatus: status,
    manifestDigest: digest,
  });
  const checkpoint = () => ({
    companyId,
    cutoverId,
    productId,
    manifestProductFingerprint: hash,
    expectedOwned: 0,
    expectedAvailable: 0,
    expectedCustody: 0,
    projectionEvidence: {
      version: 1,
      asOf: '2026-10-14T00:00:00.000Z',
      productStockBefore: 0,
      productStockExpected: 0,
      batches: [],
    },
  });
  const membership = () => ({
    companyId,
    cutoverId,
    saleId,
    quoteId,
    saleFingerprint: hash,
    statusAtFreeze: 'CONFIRMED' as const,
  });
  async function race<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    let entered = 0;
    let release!: () => void;
    const barrier = new Promise<void>((r) => {
      release = r;
    });
    const pids: number[] = [];
    const call = (client: PrismaClient) =>
      client.$transaction(
        async (tx) => {
          const [pid] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          pids.push(pid.pid);
          if (++entered === 2) release();
          await barrier;
          return fn(tx);
        },
        { timeout: 15000 },
      );
    const results = await Promise.allSettled([call(db), call(other)]);
    expect(new Set(pids).size).toBe(2);
    return results;
  }
  async function reviewed(): Promise<ReviewedManifest> {
    const sale = await db.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: legacySaleInclude,
    });
    const p = checkpoint();
    return {
      manifestDigest: hash,
      snapshotFingerprint: 'b'.repeat(64),
      baselineBuild: 'isolated-test',
      products: [
        {
          productId,
          manifestProductFingerprint: hash,
          expectedOwned: 0,
          expectedAvailable: 0,
          expectedCustody: 0,
          projectionEvidence: { ...p.projectionEvidence, version: 1 },
        },
      ],
      legacySales: [
        {
          saleId,
          quoteId,
          saleFingerprint: legacySaleFingerprint(companyId, sale),
        },
      ],
    };
  }
  it('creates revision zero; independent concurrent Company claims have exactly one winner', async () => {
    const results = await race((tx) =>
      service.create(tx, { id: randomUUID(), companyId, actorId }),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await db.inventoryCutover.findUnique({ where: { companyId } }),
    ).toMatchObject({ companyId, revision: 0, status: 'PRECHECK' });
  });
  it('independent concurrent CAS has exactly one update winner', async () => {
    await create();
    const results = await race((tx) =>
      repo.cas(
        tx,
        expected(),
        { kind: 'FROZEN' },
        { status: 'WRITERS_FROZEN' },
      ),
    );
    const counts = results
      .map((r) => (r.status === 'fulfilled' ? r.value.count : -1))
      .sort();
    expect(counts).toEqual([0, 1]);
    expect(
      (
        await db.inventoryCutover.findUniqueOrThrow({
          where: { id: cutoverId },
        })
      ).revision,
    ).toBe(1);
  });
  it('duplicate checkpoint arbitration is durable', async () => {
    await create();
    const results = await race((tx) =>
      tx.inventoryCutoverProduct.create({ data: checkpoint() }),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.inventoryCutoverProduct.count({ where: { cutoverId } }),
    ).toBe(1);
  });
  it('duplicate membership arbitration is durable', async () => {
    await create();
    const results = await race((tx) =>
      tx.inventoryCutoverLegacySale.create({ data: membership() }),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.inventoryCutoverLegacySale.count({ where: { cutoverId } }),
    ).toBe(1);
  });
  it('enforces Product, Sale, Quote, actor and parent tenant FKs', async () => {
    await create();
    await expect(
      db.inventoryCutoverProduct.create({
        data: { ...checkpoint(), productId: foreignProduct },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryCutoverLegacySale.create({
        data: { ...membership(), saleId: foreignSale },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryCutoverLegacySale.create({
        data: { ...membership(), quoteId: foreignQuote },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryCutover.create({
        data: { companyId: foreignId, initiatedBy: actorId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryCutoverProduct.create({
        data: {
          ...checkpoint(),
          companyId: foreignId,
          productId: foreignProduct,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryCutover.update({
        where: { id: cutoverId },
        data: { approvedBy: foreignActor },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it.each([-1, 2147483648])(
    'rejects invalid integer quantity %s',
    async (n) => {
      await create();
      await expect(
        db.inventoryCutoverProduct.create({
          data: { ...checkpoint(), expectedOwned: n },
        }),
      ).rejects.toThrow();
    },
  );
  it('enforces quantity, hash, JSON and checkpoint structural CHECKs', async () => {
    await create();
    const cases = [
      { expectedOwned: 1, expectedCustody: 2 },
      { expectedOwned: 2, expectedCustody: 1, expectedAvailable: 2 },
      { manifestProductFingerprint: 'A'.repeat(64) },
      { projectionEvidence: [] },
      { status: 'APPLIED' as const },
      { expectedOwned: 1, status: 'APPLIED' as const, appliedAt: new Date() },
    ];
    for (const patch of cases)
      await expect(
        db.inventoryCutoverProduct.create({
          data: { ...checkpoint(), ...patch },
        }),
      ).rejects.toThrow();
    await db.inventoryCutoverProduct.create({
      data: {
        ...checkpoint(),
        expectedOwned: 10,
        expectedAvailable: 2,
        expectedCustody: 3,
      },
    });
  });
  it('zero checkpoint may be applied without Effect; DRAFT membership is rejected', async () => {
    await create();
    await db.inventoryCutoverProduct.create({
      data: { ...checkpoint(), status: 'APPLIED', appliedAt: new Date() },
    });
    await expect(
      db.inventoryCutoverLegacySale.create({
        data: { ...membership(), statusAtFreeze: 'DRAFT' },
      }),
    ).rejects.toThrow();
    expect(
      await db.inventoryPhysicalEffect.count({ where: { companyId } }),
    ).toBe(0);
  });
  it('control CHECKs require review, lock, recovery source and activation evidence', async () => {
    await create();
    for (const data of [
      { revision: -1 },
      { status: 'DRY_RUN_REVIEWED' as const },
      { status: 'RECOVERY_REQUIRED' as const },
      { manifestDigest: hash },
      {
        manifestDigest: 'A'.repeat(64),
        snapshotFingerprint: hash,
        baselineBuild: 'test',
      },
      { status: 'PHYSICAL_ACTIVE' as const },
    ])
      await expect(
        db.inventoryCutover.update({ where: { id: cutoverId }, data }),
      ).rejects.toThrow();
  });
  async function genericEffect(c: string, u: string, p: string) {
    // Generic existing physical fixture, NOT an opening Effect or opening implementation.
    return db.$transaction(async (tx) => {
      const position = await tx.inventoryPosition.create({
        data: {
          companyId: c,
          productId: p,
          state: 'AVAILABLE',
          quantity: 1,
          revision: 1,
        },
      });
      const effect = await tx.inventoryPhysicalEffect.create({
        data: {
          companyId: c,
          originType: 'CUTOVER_TEST_FIXTURE',
          originId: randomUUID(),
          originOperation: 'TEST',
          kind: 'CREDIT',
          requestHash: hash,
          lineCount: 1,
          actorId: u,
        },
      });
      await tx.inventoryPhysicalEffectLine.create({
        data: {
          companyId: c,
          effectId: effect.id,
          positionId: position.id,
          sequence: 1,
          delta: 1,
          quantityBefore: 0,
          quantityAfter: 1,
          revisionBefore: 0,
          revisionAfter: 1,
        },
      });
      return effect;
    });
  }
  it('Effect link rejects foreign tenant and reuse across checkpoints', async () => {
    await create();
    const foreign = await genericEffect(
      foreignId,
      foreignActor,
      foreignProduct,
    );
    const applied = {
      ...checkpoint(),
      expectedOwned: 1,
      openingEffectId: foreign.id,
      status: 'APPLIED' as const,
      appliedAt: new Date(),
    };
    await expect(
      db.inventoryCutoverProduct.create({ data: applied }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const effect = await genericEffect(companyId, actorId, productId);
    await db.inventoryCutoverProduct.create({
      data: { ...applied, openingEffectId: effect.id },
    });
    const p = await db.product.create({
      data: {
        companyId,
        sku: randomUUID(),
        name: 'Other',
        inventoryTracking: 'QUANTITY',
      },
    });
    await expect(
      db.inventoryCutoverProduct.create({
        data: { ...applied, productId: p.id, openingEffectId: effect.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('review is atomic, replay is zero-write, membership survives historical actor deactivation', async () => {
    await create();
    await db.$transaction((tx) =>
      service.transition(tx, expected(), actorId, { kind: 'FROZEN' }),
    );
    const manifest = await reviewed();
    const e = expected('WRITERS_FROZEN', 1);
    await db.$transaction((tx) =>
      service.transition(tx, e, actorId, { kind: 'REVIEW', manifest }),
    );
    const before = await db.inventoryCutover.findUniqueOrThrow({
      where: { id: cutoverId },
    });
    expect(
      (
        await db.$transaction((tx) =>
          service.transition(tx, e, actorId, { kind: 'REVIEW', manifest }),
        )
      ).outcome,
    ).toBe('ALREADY_TRANSITIONED');
    expect(
      await db.inventoryCutover.findUniqueOrThrow({ where: { id: cutoverId } }),
    ).toEqual(before);
    await db.user.update({ where: { id: actorId }, data: { isActive: false } });
    expect(
      await db.$transaction((tx) =>
        new SalesLegacyClassifier().classify(tx, companyId, saleId),
      ),
    ).toBe('LEGACY');
    await expect(
      db.sale.delete({ where: { id: saleId } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('parent transition and reviewed children roll back together on caller failure', async () => {
    await create();
    await db.$transaction((tx) =>
      service.transition(tx, expected(), actorId, { kind: 'FROZEN' }),
    );
    const manifest = await reviewed();
    await expect(
      db.$transaction(async (tx) => {
        await service.transition(tx, expected('WRITERS_FROZEN', 1), actorId, {
          kind: 'REVIEW',
          manifest,
        });
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');
    expect(
      await db.inventoryCutover.findUniqueOrThrow({ where: { id: cutoverId } }),
    ).toMatchObject({
      status: 'WRITERS_FROZEN',
      revision: 1,
      manifestDigest: null,
    });
    expect(
      await db.inventoryCutoverProduct.count({ where: { cutoverId } }),
    ).toBe(0);
    expect(
      await db.inventoryCutoverLegacySale.count({ where: { cutoverId } }),
    ).toBe(0);
  });
  it('rejects DRAFT capture, incomplete set and fingerprint mismatch before review', async () => {
    await create();
    await db.$transaction((tx) =>
      service.transition(tx, expected(), actorId, { kind: 'FROZEN' }),
    );
    const manifest = await reviewed();
    for (const m of [
      { ...manifest, products: [] },
      {
        ...manifest,
        legacySales: [
          { ...manifest.legacySales[0], saleFingerprint: 'c'.repeat(64) },
        ],
      },
    ])
      await expect(
        db.$transaction((tx) =>
          service.transition(tx, expected('WRITERS_FROZEN', 1), actorId, {
            kind: 'REVIEW',
            manifest: m,
          }),
        ),
      ).rejects.toThrow('MISMATCH');
    await db.sale.update({ where: { id: saleId }, data: { status: 'DRAFT' } });
    await expect(
      db.$transaction((tx) =>
        service.transition(tx, expected('WRITERS_FROZEN', 1), actorId, {
          kind: 'REVIEW',
          manifest,
        }),
      ),
    ).rejects.toThrow('MISMATCH');
  });
  it('lock persists across recovery and cannot be overwritten via review', async () => {
    await create();
    await db.$transaction((tx) =>
      service.transition(tx, expected(), actorId, { kind: 'FROZEN' }),
    );
    const manifest = await reviewed();
    await db.$transaction((tx) =>
      service.transition(tx, expected('WRITERS_FROZEN', 1), actorId, {
        kind: 'REVIEW',
        manifest,
      }),
    );
    await db.$transaction((tx) =>
      service.transition(tx, expected('DRY_RUN_REVIEWED', 2, hash), actorId, {
        kind: 'LOCK_MANIFEST',
      }),
    );
    const before = await db.inventoryCutoverProduct.findMany({
      where: { cutoverId },
    });
    await db.$transaction((tx) =>
      service.transition(tx, expected('OPENING_APPLYING', 3, hash), actorId, {
        kind: 'RECOVERY',
      }),
    );
    expect(
      await db.inventoryCutover.findUniqueOrThrow({ where: { id: cutoverId } }),
    ).toMatchObject({
      status: 'RECOVERY_REQUIRED',
      recoveryFromStatus: 'OPENING_APPLYING',
      manifestDigest: hash,
    });
    await expect(
      db.$transaction((tx) =>
        service.transition(
          tx,
          {
            ...expected('OPENING_APPLYING', 4, hash),
            expectedStatus: 'RECOVERY_REQUIRED',
          },
          actorId,
          { kind: 'REVIEW', manifest },
        ),
      ),
    ).rejects.toThrow('INVALID_TRANSITION');
    expect(
      await db.inventoryCutoverProduct.findMany({ where: { cutoverId } }),
    ).toEqual(before);
  });
  it('resolver reads three authorities; PHYSICAL is fixture-only with no activation service', async () => {
    expect(await db.$transaction((tx) => resolver.resolve(tx, companyId))).toBe(
      'LEGACY',
    );
    await create();
    expect(await db.$transaction((tx) => resolver.resolve(tx, companyId))).toBe(
      'CUTOVER',
    );
    await db.inventoryCutover.update({
      where: { id: cutoverId },
      data: {
        status: 'PHYSICAL_ACTIVE',
        manifestDigest: hash,
        snapshotFingerprint: hash,
        baselineBuild: 'fixture',
        approvedBy: actorId,
        activatedBy: actorId,
        manifestLockedAt: new Date(),
        activatedAt: new Date(),
      },
    });
    expect(await db.$transaction((tx) => resolver.resolve(tx, companyId))).toBe(
      'PHYSICAL',
    );
  });
});
