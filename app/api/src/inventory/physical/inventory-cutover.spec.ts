import { randomUUID } from 'node:crypto';
import {
  InventoryCutover,
  InventoryCutoverStatus,
  Prisma,
} from '@prisma/client';
import {
  assertCutoverControl,
  CutoverExpected,
  CutoverTransition,
  transitionTarget,
  validateReviewedProduct,
  ReviewedProduct,
} from './inventory-cutover.contract';
import { InventoryCutoverService } from './inventory-cutover.service';
import { InventoryCutoverRepository } from './inventory-cutover.repository';
import { InventoryAuthorityResolver } from './inventory-authority-resolver';

const companyId = randomUUID(),
  id = randomUUID(),
  actorId = randomUUID(),
  hash = 'a'.repeat(64);
function control(
  status: InventoryCutoverStatus = 'PRECHECK',
): InventoryCutover {
  const reviewed = !['PRECHECK', 'WRITERS_FROZEN'].includes(status);
  return {
    id,
    companyId,
    status,
    revision: 0,
    initiatedBy: actorId,
    approvedBy: reviewed ? actorId : null,
    activatedBy: status === 'PHYSICAL_ACTIVE' ? actorId : null,
    activatedAt: status === 'PHYSICAL_ACTIVE' ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    manifestDigest: reviewed ? hash : null,
    snapshotFingerprint: reviewed ? hash : null,
    baselineBuild: reviewed ? 'test-build' : null,
    manifestLockedAt: [
      'OPENING_APPLYING',
      'OPENING_APPLIED',
      'VERIFIED',
      'PHYSICAL_ACTIVE',
    ].includes(status)
      ? new Date()
      : null,
    recoveryFromStatus: null,
  };
}
function product(owned = 0): ReviewedProduct {
  return {
    productId: randomUUID(),
    manifestProductFingerprint: hash,
    expectedOwned: owned,
    expectedAvailable: owned,
    expectedCustody: 0,
    projectionEvidence: {
      version: 1,
      asOf: '2026-10-14T00:00:00.000Z',
      productStockBefore: owned,
      productStockExpected: owned,
      batches: [],
    },
  };
}
function setup(initial = control()) {
  let row = initial;
  const repository = {
    lock: jest.fn(() => Promise.resolve(row)),
    find: jest.fn(() => Promise.resolve(row)),
    cas: jest.fn(
      (
        _tx: unknown,
        _e: unknown,
        _op: unknown,
        data: Partial<InventoryCutover>,
      ) => {
        row = { ...row, ...data, revision: row.revision + 1 };
        return Promise.resolve({ count: 1 });
      },
    ),
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ isolation: 'read committed' }]),
    user: { findFirst: jest.fn().mockResolvedValue({ id: actorId }) },
    inventoryCutover: { create: jest.fn().mockResolvedValue(row) },
    inventoryCutoverProduct: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryCutoverLegacySale: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const client = tx as unknown as Prisma.TransactionClient;
  const service = new InventoryCutoverService(
    repository as unknown as InventoryCutoverRepository,
  );
  const expected: CutoverExpected = {
    companyId,
    cutoverId: id,
    expectedRevision: initial.revision,
    expectedStatus: initial.status,
    manifestDigest: initial.manifestDigest,
  };
  return { repository, tx, client, service, expected, row: () => row };
}
describe('cutover control foundation', () => {
  it('creates tenant-scoped control using a real authorized actor', async () => {
    const f = setup();
    await f.service.create(f.client, { id, companyId, actorId });
    expect(f.tx.inventoryCutover.create).toHaveBeenCalledWith({
      data: { id, companyId, initiatedBy: actorId },
    });
    expect(f.tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: actorId, companyId, isActive: true, role: 'ADMIN' },
      }),
    );
  });
  it('rejects foreign/inactive/unauthorized actor before mutation', async () => {
    const f = setup();
    f.tx.user.findFirst.mockResolvedValue(null);
    await expect(
      f.service.create(f.client, { id, companyId, actorId }),
    ).rejects.toThrow('ACTOR_FORBIDDEN');
    expect(f.tx.inventoryCutover.create).not.toHaveBeenCalled();
  });
  it('propagates unique error without readback in an aborted transaction', async () => {
    const f = setup();
    const error = new Error('unique');
    f.tx.inventoryCutover.create.mockRejectedValue(error);
    await expect(
      f.service.create(f.client, { id, companyId, actorId }),
    ).rejects.toBe(error);
    expect(f.repository.find).not.toHaveBeenCalled();
  });
  it('CAS transitions once; coherent replay performs zero writes', async () => {
    const f = setup();
    expect(
      (
        await f.service.transition(f.client, f.expected, actorId, {
          kind: 'FROZEN',
        })
      ).outcome,
    ).toBe('APPLIED');
    expect(
      (
        await f.service.transition(f.client, f.expected, actorId, {
          kind: 'FROZEN',
        })
      ).outcome,
    ).toBe('ALREADY_TRANSITIONED');
    expect(f.repository.cas).toHaveBeenCalledTimes(1);
    expect(f.row().revision).toBe(1);
  });
  it('fresh readback on zero affected rows rejects a stale transition', async () => {
    const f = setup();
    f.repository.cas.mockResolvedValue({ count: 0 });
    await expect(
      f.service.transition(f.client, f.expected, actorId, { kind: 'FROZEN' }),
    ).rejects.toThrow('STALE_STATE');
    expect(f.repository.find).toHaveBeenCalledTimes(1);
  });
  it('rejects mismatch instead of overwriting manifest identity', async () => {
    const f = setup(control('DRY_RUN_REVIEWED'));
    await expect(
      f.service.transition(
        f.client,
        { ...f.expected, manifestDigest: 'b'.repeat(64) },
        actorId,
        { kind: 'LOCK_MANIFEST' },
      ),
    ).rejects.toThrow('MISMATCH');
    expect(f.repository.cas).not.toHaveBeenCalled();
  });
  it('locks manifest in the same CAS and preserves it across recovery/resume', async () => {
    const f = setup(control('DRY_RUN_REVIEWED'));
    await f.service.transition(f.client, f.expected, actorId, {
      kind: 'LOCK_MANIFEST',
    });
    const locked = f.row().manifestLockedAt;
    await f.service.transition(
      f.client,
      {
        ...f.expected,
        expectedStatus: 'OPENING_APPLYING',
        expectedRevision: 1,
      },
      actorId,
      { kind: 'RECOVERY' },
    );
    expect(f.row()).toMatchObject({
      status: 'RECOVERY_REQUIRED',
      recoveryFromStatus: 'OPENING_APPLYING',
      manifestDigest: hash,
      manifestLockedAt: locked,
      approvedBy: actorId,
    });
    await f.service.transition(
      f.client,
      {
        ...f.expected,
        expectedStatus: 'RECOVERY_REQUIRED',
        expectedRevision: 2,
      },
      actorId,
      { kind: 'RESUME', target: 'OPENING_APPLYING' },
    );
    expect(f.row().manifestLockedAt).toBe(locked);
    await expect(
      f.service.transition(
        f.client,
        {
          ...f.expected,
          expectedStatus: 'OPENING_APPLYING',
          expectedRevision: 3,
        },
        actorId,
        {
          kind: 'REVIEW',
          manifest: {
            manifestDigest: hash,
            snapshotFingerprint: hash,
            baselineBuild: 'new',
            products: [],
            legacySales: [],
          },
        },
      ),
    ).rejects.toThrow('INVALID_TRANSITION');
  });
  it.each(['PHYSICAL_ACTIVE', 'VERIFIED', 'OPENING_APPLIED', 'LEGACY'])(
    'does not expose activation/APPLY/VERIFY/legacy resume (%s)',
    (target) => {
      expect(() =>
        transitionTarget(
          { ...setup().expected, expectedStatus: 'RECOVERY_REQUIRED' },
          { kind: 'RESUME', target } as CutoverTransition,
        ),
      ).toThrow('INVALID_TRANSITION');
    },
  );
  it('rejects arbitrary status setting at repository boundary', () => {
    const repo = new InventoryCutoverRepository();
    expect(() =>
      repo.cas(
        {} as Prisma.TransactionClient,
        setup().expected,
        { kind: 'FROZEN' },
        { status: 'PHYSICAL_ACTIVE' },
      ),
    ).toThrow('INVALID_TRANSITION');
  });
  it('repository rejects manifest edits smuggled into a recovery transition', () => {
    const repo = new InventoryCutoverRepository();
    expect(() =>
      repo.cas(
        {} as Prisma.TransactionClient,
        setup().expected,
        { kind: 'RECOVERY' },
        {
          status: 'RECOVERY_REQUIRED',
          recoveryFromStatus: 'PRECHECK',
          manifestDigest: hash,
        },
      ),
    ).toThrow('INVALID_TRANSITION');
  });
  it('requires caller-owned transaction', async () => {
    const f = setup();
    await expect(
      f.service.create(
        { $transaction: jest.fn() } as unknown as Prisma.TransactionClient,
        { id, companyId, actorId },
      ),
    ).rejects.toThrow('INVALID_CUTOVER');
  });
});
describe('reviewed Product evidence', () => {
  it.each([0, 5, 2147483647])('represents owned=%i', (n) =>
    expect(() => validateReviewedProduct(product(n))).not.toThrow(),
  );
  it('allows owned unavailable due to eligibility', () => {
    const p = product(10);
    p.expectedAvailable = 2;
    p.expectedCustody = 3;
    expect(() => validateReviewedProduct(p)).not.toThrow();
  });
  it.each([-1, 2147483648, 0.5, NaN, Infinity])(
    'rejects invalid quantity %s',
    (n) => {
      const p = product();
      p.expectedOwned = n;
      expect(() => validateReviewedProduct(p)).toThrow();
    },
  );
  it('rejects custody or availability exceeding ownership', () => {
    const p = product(5);
    p.expectedCustody = 6;
    expect(() => validateReviewedProduct(p)).toThrow();
    p.expectedCustody = 1;
    expect(() => validateReviewedProduct(p)).toThrow();
  });
  it('rejects unknown JSON fields, missing before-image and duplicate batches', () => {
    const p = product();
    Object.assign(p.projectionEvidence, { extra: 1 });
    expect(() => validateReviewedProduct(p)).toThrow();
    const q = product(2);
    q.projectionEvidence.productStockBefore = 1;
    expect(() => validateReviewedProduct(q)).toThrow();
    const r = product();
    const b = {
      batchId: randomUUID(),
      availableQuantityBefore: -1,
      availableQuantityExpected: 0,
      initialQuantityBefore: 2,
      initialQuantityExpected: 2,
    };
    r.projectionEvidence.batches = [b, b];
    expect(() => validateReviewedProduct(r)).toThrow();
  });
});
describe('authority resolver is read-only and fails closed', () => {
  const resolver = new InventoryAuthorityResolver();
  function tx(row: InventoryCutover | null) {
    return {
      company: { findUnique: jest.fn().mockResolvedValue({ id: companyId }) },
      inventoryCutover: { findUnique: jest.fn().mockResolvedValue(row) },
      inventoryPhysicalEffect: { findFirst: jest.fn().mockResolvedValue(null) },
      inventoryPosition: { findFirst: jest.fn().mockResolvedValue(null) },
    };
  }
  it('resolves absent valid control to LEGACY', async () => {
    const t = tx(null);
    expect(
      await resolver.resolve(
        t as unknown as Prisma.TransactionClient,
        companyId,
      ),
    ).toBe('LEGACY');
  });
  it.each([
    'PRECHECK',
    'WRITERS_FROZEN',
    'DRY_RUN_REVIEWED',
    'OPENING_APPLYING',
    'OPENING_APPLIED',
    'VERIFIED',
  ] as InventoryCutoverStatus[])('%s is CUTOVER', async (s) => {
    expect(
      await resolver.resolve(
        tx(control(s)) as unknown as Prisma.TransactionClient,
        companyId,
      ),
    ).toBe('CUTOVER');
  });
  it('recovery retains frozen authority', async () => {
    const r = {
      ...control('PHYSICAL_ACTIVE'),
      status: 'RECOVERY_REQUIRED' as const,
      recoveryFromStatus: 'PHYSICAL_ACTIVE' as const,
    };
    assertCutoverControl(r);
    expect(
      await resolver.resolve(
        tx(r) as unknown as Prisma.TransactionClient,
        companyId,
      ),
    ).toBe('CUTOVER');
  });
  it('reads PHYSICAL_ACTIVE fixture without an activation API', async () =>
    expect(
      await resolver.resolve(
        tx(control('PHYSICAL_ACTIVE')) as unknown as Prisma.TransactionClient,
        companyId,
      ),
    ).toBe('PHYSICAL'));
  it('rejects missing Company, orphan physical evidence and malformed control', async () => {
    const t = tx(null);
    t.company.findUnique.mockResolvedValue(null);
    await expect(
      resolver.resolve(t as unknown as Prisma.TransactionClient, companyId),
    ).rejects.toThrow('NOT_FOUND');
    const u = tx(null);
    u.inventoryPhysicalEffect.findFirst.mockResolvedValue({ id: randomUUID() });
    await expect(
      resolver.resolve(u as unknown as Prisma.TransactionClient, companyId),
    ).rejects.toThrow('MISMATCH');
    const bad = control('PHYSICAL_ACTIVE');
    bad.manifestLockedAt = null;
    await expect(
      resolver.resolve(
        tx(bad) as unknown as Prisma.TransactionClient,
        companyId,
      ),
    ).rejects.toThrow('MISMATCH');
  });
});
