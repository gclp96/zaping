import { PrismaService } from '../../prisma/prisma.service';
import { HealthcareCaseDispatchReadService } from './healthcare-case-dispatch-read.service';
import {
  HealthcareCaseDispatchesRepository,
  DispatchDetailRow,
} from './healthcare-case-dispatches.repository';
import { mapDispatchDetail } from './healthcare-case-dispatch.mapper';
import {
  parseDispatchItemSnapshot,
  parseDispatchRootSnapshot,
  parseDispatchAuditChange,
} from './healthcare-case-dispatch.snapshot';
const actor = { id: 'actor', firstName: 'Original', lastName: 'Actor' };
const now = new Date('2026-10-15T12:00:00.000Z');
function fixture(): DispatchDetailRow {
  return {
    id: 'dispatch',
    caseId: 'case',
    caseKitId: 'kit',
    status: 'DRAFT',
    revision: 0,
    custodianType: 'EXTERNAL_PERSON',
    custodianUserId: null,
    custodianDisplayName: 'Custodian',
    createdAt: now,
    confirmedAt: null,
    cancelledAt: null,
    snapshotVersion: null,
    snapshot: null,
    createdBy: actor,
    confirmedBy: null,
    cancelledBy: null,
    confirmedFromRevision: null,
    cancellationReason: null,
    healthcareCase: {
      id: 'case',
      folio: 'CURRENT',
      scheduledStart: now,
      scheduledEnd: now,
    },
    items: [
      {
        id: 'item',
        sourceCaseKitItemId: 'source',
        type: 'MATERIAL',
        lifecycle: 'ACTIVE',
        productId: 'product',
        quantity: 2,
        batchId: null,
        sourcePositionId: 'sourcePosition',
        expectedPositionRevision: 0,
        destinationPositionId: null,
        physicalEffectId: null,
        assignmentId: null,
        assetId: null,
        expectedPhysicalRevision: null,
        equipmentCustodyId: null,
        equipmentPhysicalEventId: null,
        createdAt: now,
        excludedAt: null,
        exclusionReason: null,
        snapshot: null,
        addedBy: actor,
        excludedBy: null,
        product: {
          id: 'product',
          sku: 'LIVE',
          name: 'Live product',
          inventoryTracking: 'QUANTITY',
          lotTracking: 'NONE',
        },
        batch: null,
        asset: null,
        sourceCaseKitItem: {
          id: 'source',
          requirementId: 'requirement',
          equipmentAssignmentId: null,
          preparedQuantity: 5,
        },
      },
    ],
    audit: [
      {
        id: 'audit',
        dispatchItemId: null,
        operation: 'CREATE',
        createdAt: now,
        revisionBefore: null,
        revisionAfter: 0,
        change: { version: 1, operation: 'CREATE', reason: null },
        actor,
      },
    ],
  };
}
const rootSnapshot = {
  version: 1,
  case: {
    id: 'case',
    folio: 'HISTORICAL',
    scheduledStart: now.toISOString(),
    scheduledEnd: now.toISOString(),
  },
  custodian: {
    type: 'EXTERNAL_PERSON',
    userId: null,
    displayName: 'Custodian',
  },
  dispatchedBy: actor,
  dispatchedAt: now.toISOString(),
};
const itemSnapshot = {
  version: 1,
  product: {
    id: 'product',
    sku: 'OLD',
    name: 'Historical product',
    inventoryTracking: 'QUANTITY',
    lotTracking: 'NONE',
  },
  preparation: {
    sourceCaseKitItemId: 'source',
    requirementId: 'requirement',
    assignmentId: null,
    preparedQuantity: 5,
  },
  batch: null,
  equipment: null,
};
function confirmed() {
  const r = fixture();
  Object.assign(r, {
    status: 'CONFIRMED',
    revision: 1,
    confirmedFromRevision: 0,
    confirmedAt: now,
    confirmedBy: actor,
    snapshotVersion: 1,
    snapshot: rootSnapshot,
  });
  r.items[0].snapshot = itemSnapshot;
  return r;
}
describe('Dispatch historical public mapping', () => {
  it('maps unbatched DRAFT without physical diagnostics/internal fields', () => {
    const r = mapDispatchDetail(fixture());
    expect(r.items[0]).toMatchObject({
      quantity: 2,
      batch: null,
      product: { sku: 'LIVE' },
    });
    expect(JSON.stringify(r)).not.toMatch(
      /companyId|requestHash|passwordHash|availableQuantity/,
    );
  });
  it('maps explicit batched DRAFT', () => {
    const r = fixture();
    r.items[0].batchId = 'batch';
    r.items[0].batch = { id: 'batch', lotNumber: 'LOT', expirationDate: now };
    expect(mapDispatchDetail(r).items[0].batch).toEqual({
      id: 'batch',
      lotNumber: 'LOT',
      expirationDate: now.toISOString(),
    });
  });
  it('maps Equipment and preparation reference', () => {
    const r = fixture(),
      i = r.items[0];
    Object.assign(i, {
      type: 'EQUIPMENT',
      quantity: null,
      sourcePositionId: null,
      expectedPositionRevision: null,
      assignmentId: 'assignment',
      assetId: 'asset',
      expectedPhysicalRevision: 3,
      asset: { id: 'asset', assetCode: 'EQ', serialNumber: null },
    });
    i.sourceCaseKitItem.equipmentAssignmentId = 'assignment';
    expect(mapDispatchDetail(r).items[0]).toMatchObject({
      equipment: { assetCode: 'EQ' },
      preparation: { assignmentId: 'assignment' },
    });
  });
  it('maps CANCELLED and typed audit', () => {
    const r = fixture();
    Object.assign(r, {
      status: 'CANCELLED',
      cancelledBy: actor,
      cancelledAt: now,
      cancellationReason: 'Reason',
    });
    expect(mapDispatchDetail(r)).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Reason',
      dispatchedBy: null,
      audit: [{ change: { version: 1, operation: 'CREATE', reason: null } }],
    });
  });
  it('uses historical facts after live presentation changes', () => {
    const r = confirmed();
    r.healthcareCase.folio = 'CHANGED';
    r.items[0].product.name = 'CHANGED';
    r.confirmedBy = { ...actor, firstName: 'CURRENT' };
    expect(mapDispatchDetail(r)).toMatchObject({
      case: { folio: 'HISTORICAL' },
      dispatchedBy: { firstName: 'Original' },
      items: [{ product: { sku: 'OLD', name: 'Historical product' } }],
    });
  });
  it('requires descriptive snapshots even for EXCLUDED', () => {
    const r = confirmed();
    r.items[0].lifecycle = 'EXCLUDED';
    r.items[0].snapshot = null;
    expect(() => mapDispatchDetail(r)).toThrow(
      'No fue posible completar la operación',
    );
  });
  it.each([
    null,
    {},
    [],
    { version: 2 },
    { ...rootSnapshot, dispatchedAt: 'bad' },
  ])('fails closed for invalid root %j', (snapshot) => {
    const r = confirmed();
    r.snapshot = snapshot;
    expect(() => mapDispatchDetail(r)).toThrow(
      'No fue posible completar la operación',
    );
  });
  it('never falls back when item snapshot missing', () => {
    const r = confirmed();
    r.items[0].snapshot = null;
    expect(() => mapDispatchDetail(r)).toThrow();
  });
  it('rejects a snapshot identity mismatch', () => {
    const r = confirmed();
    r.items[0].snapshot = {
      ...itemSnapshot,
      product: { ...itemSnapshot.product, id: 'foreign' },
    };
    expect(() => mapDispatchDetail(r)).toThrow();
  });
  it('whitelists snapshot fields', () => {
    expect(
      parseDispatchRootSnapshot({ ...rootSnapshot, passwordHash: 'secret' }),
    ).not.toHaveProperty('passwordHash');
    expect(
      parseDispatchItemSnapshot({ ...itemSnapshot, requestHash: 'secret' }),
    ).not.toHaveProperty('requestHash');
  });
  it.each([
    { ...itemSnapshot, version: 2 },
    { ...itemSnapshot, batch: {} },
    {
      ...itemSnapshot,
      preparation: { ...itemSnapshot.preparation, preparedQuantity: -1 },
    },
  ])('rejects malformed item %j', (v) =>
    expect(() => parseDispatchItemSnapshot(v)).toThrow(),
  );
  it('rejects invalid/oversized audit', () => {
    expect(() =>
      parseDispatchAuditChange(
        { version: 1, operation: 'CANCEL', reason: null },
        'CREATE',
      ),
    ).toThrow();
    expect(() =>
      parseDispatchAuditChange(
        { version: 1, operation: 'CREATE', reason: 'x'.repeat(9000) },
        'CREATE',
      ),
    ).toThrow();
  });
});
describe('Dispatch tenant-scoped bounded reads', () => {
  const tx = {};
  const repo = {
    runInReadSnapshot: jest.fn(),
    findCase: jest.fn(),
    list: jest.fn(),
    detail: jest.fn(),
  };
  const service = new HealthcareCaseDispatchReadService(
    repo as unknown as HealthcareCaseDispatchesRepository,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    repo.runInReadSnapshot.mockImplementation((f: (tx: object) => unknown) =>
      f(tx),
    );
    repo.findCase.mockResolvedValue({ id: 'case' });
    repo.list.mockResolvedValue({ items: [fixture()], totalItems: 26 });
    repo.detail.mockResolvedValue(fixture());
  });
  it('returns pagination and exactly one bounded page call', async () => {
    expect(
      (
        await service.list('tenant', 'case', {
          page: 2,
          pageSize: 25,
          status: 'DRAFT',
        })
      ).pagination,
    ).toEqual({ page: 2, pageSize: 25, totalItems: 26, totalPages: 2 });
    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.list).toHaveBeenCalledWith(
      'tenant',
      'case',
      { page: 2, pageSize: 25, status: 'DRAFT' },
      tx,
    );
  });
  it('missing/foreign Case is 404 without Dispatch read', async () => {
    repo.findCase.mockResolvedValue(null);
    await expect(
      service.list('foreign', 'case', { page: 1, pageSize: 25 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.list).not.toHaveBeenCalled();
  });
  it('wrong Case/foreign Dispatch is 404', async () => {
    repo.detail.mockResolvedValue(null);
    await expect(
      service.detail('tenant', 'other-case', 'dispatch'),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.detail).toHaveBeenCalledWith(
      'tenant',
      'other-case',
      'dispatch',
      tx,
    );
  });
  it('detail invokes no extra read per item', async () => {
    await service.detail('tenant', 'case', 'dispatch');
    expect(repo.detail).toHaveBeenCalledTimes(1);
    expect(repo.findCase).toHaveBeenCalledTimes(1);
  });
  it('sanitizes persistence errors', async () => {
    repo.detail.mockRejectedValue(new Error('database secret'));
    await expect(
      service.detail('tenant', 'case', 'dispatch'),
    ).rejects.toMatchObject({
      response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
    });
  });
});
describe('Dispatch repository read contract', () => {
  it('uses RepeatableRead, identical tenant/status filters and deterministic ordering', async () => {
    const tx = {
      healthcareCaseDispatch: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const db = {
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: object) => unknown) => fn(tx)),
    };
    const repo = new HealthcareCaseDispatchesRepository(
      db as unknown as PrismaService,
    );
    await repo.runInReadSnapshot((t) =>
      repo.list(
        'tenant',
        'case',
        { page: 2, pageSize: 10, status: 'DRAFT' },
        t,
      ),
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(tx.healthcareCaseDispatch.count).toHaveBeenCalledWith({
      where: { companyId: 'tenant', caseId: 'case', status: 'DRAFT' },
    });
    expect(tx.healthcareCaseDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'tenant', caseId: 'case', status: 'DRAFT' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      }),
    );
  });
});
