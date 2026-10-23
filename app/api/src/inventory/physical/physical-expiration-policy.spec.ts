import { Prisma } from '@prisma/client';
import {
  physicalExpirationEligibility,
  storedExpirationDay,
} from './physical-expiration-policy';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';
import {
  PhysicalRequest,
  physicalRequestHash,
} from './physical-inventory.contract';

describe('ADR-015 Company calendar-day policy', () => {
  it.each([
    ['America/Hermosillo', '2028-08-16T06:59:59.999Z', 'NOT_EXPIRED'],
    ['America/Hermosillo', '2028-08-16T07:00:00.000Z', 'EXPIRED'],
    ['America/Hermosillo', '2028-08-15T07:00:00.000Z', 'NOT_EXPIRED'],
    ['Asia/Tokyo', '2028-08-15T15:00:00.000Z', 'EXPIRED'],
    ['America/Los_Angeles', '2028-08-16T06:59:59.999Z', 'NOT_EXPIRED'],
    ['UTC', '2028-08-16T00:00:00.000Z', 'EXPIRED'],
    ['Pacific/Kiritimati', '2028-08-15T10:00:00.000Z', 'EXPIRED'],
  ])(
    'evaluates D through local end of day in %s at %s',
    (zone, instant, expected) => {
      expect(
        physicalExpirationEligibility('2028-08-15', zone, new Date(instant)),
      ).toBe(expected);
    },
  );
  it.each([
    '2028-03-12T09:59:59Z',
    '2028-03-12T10:00:00Z',
    '2028-03-13T06:59:59Z',
  ])('keeps the whole DST transition day eligible at %s', (instant) => {
    expect(
      physicalExpirationEligibility(
        '2028-03-12',
        'America/Los_Angeles',
        new Date(instant),
      ),
    ).toBe('NOT_EXPIRED');
  });
  it('distinguishes unknown from expired and future days', () => {
    const now = new Date('2028-08-16T06:00:00Z');
    expect(physicalExpirationEligibility(null, 'America/Hermosillo', now)).toBe(
      'UNKNOWN',
    );
    expect(
      physicalExpirationEligibility('2028-08-14', 'America/Hermosillo', now),
    ).toBe('EXPIRED');
    expect(
      physicalExpirationEligibility('2028-08-16', 'America/Hermosillo', now),
    ).toBe('NOT_EXPIRED');
    expect(storedExpirationDay(new Date('2028-08-15T00:00:00Z'))).toBe(
      '2028-08-15',
    );
    expect(storedExpirationDay(null)).toBeNull();
  });
  it.each(['', 'Invalid/Timezone'])(
    'fails closed for invalid Company zone %s',
    (zone) => {
      expect(() =>
        physicalExpirationEligibility('2028-08-15', zone, new Date()),
      ).toThrow('PHYSICAL_SOURCE_NOT_ELIGIBLE');
    },
  );
  it('rejects invalid dates and invalid clocks instead of defaulting to server/UTC', () => {
    expect(() =>
      physicalExpirationEligibility('2028-02-30', 'UTC', new Date()),
    ).toThrow('INVALID_PHYSICAL_REQUEST');
    expect(() =>
      physicalExpirationEligibility('2028-08-15', 'UTC', new Date(NaN)),
    ).toThrow('PHYSICAL_SOURCE_NOT_ELIGIBLE');
    expect(() => storedExpirationDay(new Date(NaN))).toThrow(
      'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    );
  });
});

describe('temporal validation inside the existing Physical lock boundary', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const batchId = '33333333-3333-4333-8333-333333333333';
  const sourceId = '44444444-4444-4444-8444-444444444444';
  const request: PhysicalRequest = {
    companyId,
    actorId: '55555555-5555-4555-8555-555555555555',
    origin: { type: 'INV01A_TEST', id: 'local-day', operation: 'OUT' },
    operation: {
      kind: 'DEFINITIVE_OUT',
      debits: [{ sourceId, quantity: 1, expectedSourceRevision: 0 }],
    },
  };
  function arrange() {
    const order: string[] = [];
    const source = {
      id: sourceId,
      companyId,
      productId,
      inventoryBatchId: batchId,
      state: 'AVAILABLE' as 'AVAILABLE' | 'CUSTODY',
      contextType: null as string | null,
      contextId: null as string | null,
      expirationDate: null,
      quantity: 3,
      revision: 0,
    };
    const batch = {
      id: batchId,
      companyId,
      productId,
      isActive: true,
      expirationDate: new Date('2028-08-15T00:00:00Z') as Date | null,
    };
    const repo = {
      findEffect: jest.fn().mockResolvedValue(null),
      findSources: jest.fn().mockResolvedValue([source]),
      lockProducts: jest.fn(() => {
        order.push('Product');
        return Promise.resolve([
          {
            id: productId,
            companyId,
            inventoryTracking: 'QUANTITY',
            lotTracking: 'OPTIONAL',
            isActive: true,
          },
        ]);
      }),
      lockBatches: jest.fn(() => {
        order.push('Batch');
        return Promise.resolve([batch]);
      }),
      lockPositions: jest.fn(() => {
        order.push('Position');
        return Promise.resolve([source]);
      }),
      claimEffect: jest.fn(() => {
        order.push('claim');
        return Promise.resolve({ id: 'effect' });
      }),
      mutatePosition: jest.fn().mockResolvedValue({ count: 1 }),
      appendLines: jest.fn((_tx: unknown, lines: object[]) =>
        Promise.resolve(lines),
      ),
    };
    const company = {
      findUnique: jest.fn((): Promise<{ timezone: string } | null> => {
        order.push('Company-read');
        return Promise.resolve({ timezone: 'America/Hermosillo' });
      }),
    };
    const tx = {
      company,
      user: { findFirst: jest.fn().mockResolvedValue({ id: request.actorId }) },
      inventoryPosition: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ productId, _sum: { quantity: 3 } }]),
      },
    } as unknown as Prisma.TransactionClient;
    const service = new PhysicalInventoryService(
      repo as unknown as PhysicalInventoryRepository,
    );
    return { order, source, batch, repo, company, tx, service };
  }
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2028-08-16T06:59:59.999Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('uses persisted Company timezone despite caller fields and preserves lock order', async () => {
    const f = arrange();
    await f.service.apply(f.tx, {
      ...request,
      timezone: 'UTC',
      asOf: '2099-01-01',
    } as PhysicalRequest);
    expect(f.order).toEqual([
      'Product',
      'Batch',
      'Position',
      'Company-read',
      'claim',
    ]);
    expect(f.company.findUnique).toHaveBeenCalledWith({
      where: { id: companyId },
      select: { timezone: true },
    });
    expect(f.repo.mutatePosition).toHaveBeenCalledWith(f.tx, f.source, -1);
  });
  it('samples time after waiting for locks across Company midnight; no claim/writes', async () => {
    const f = arrange();
    f.repo.lockPositions.mockImplementation(() => {
      f.order.push('Position');
      jest.setSystemTime(new Date('2028-08-16T07:00:00Z'));
      return Promise.resolve([f.source]);
    });
    await expect(f.service.apply(f.tx, request)).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    expect(f.company.findUnique).toHaveBeenCalled();
    expect(f.repo.claimEffect).not.toHaveBeenCalled();
    expect(f.repo.mutatePosition).not.toHaveBeenCalled();
  });
  it('validates the Batch returned under lock, not a pre-lock expiration', async () => {
    const f = arrange();
    f.batch.expirationDate = new Date('2028-08-14');
    await expect(f.service.apply(f.tx, request)).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    expect(f.repo.claimEffect).not.toHaveBeenCalled();
  });
  it.each(['AVAILABLE', 'CUSTODY'] as const)(
    'rejects an expired Batch source in %s',
    async (state) => {
      const f = arrange();
      f.source.state = state;
      f.source.contextType = state === 'CUSTODY' ? 'CASE' : null;
      f.source.contextId = state === 'CUSTODY' ? 'case' : null;
      jest.setSystemTime(new Date('2028-08-16T07:00:00Z'));
      await expect(f.service.apply(f.tx, request)).rejects.toMatchObject({
        code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      });
      expect(f.repo.claimEffect).not.toHaveBeenCalled();
    },
  );
  it('keeps null expiry valid without inventing a date or requiring a timezone lookup', async () => {
    const f = arrange();
    f.batch.expirationDate = null;
    await f.service.apply(f.tx, request);
    expect(f.company.findUnique).not.toHaveBeenCalled();
    expect(f.repo.mutatePosition).toHaveBeenCalled();
  });
  it('replays historical evidence after expiration without consulting current Company or locks', async () => {
    const f = arrange();
    jest.setSystemTime(new Date('2028-08-17T07:00:00Z'));
    const effect = {
      id: 'effect',
      requestHash: physicalRequestHash(request),
      lines: [],
    };
    f.repo.findEffect.mockResolvedValue(effect);
    await expect(f.service.apply(f.tx, request)).resolves.toEqual({
      replay: true,
      effect,
      projectionDeltas: [],
    });
    expect(f.company.findUnique).not.toHaveBeenCalled();
    expect(f.repo.lockProducts).not.toHaveBeenCalled();
    expect(f.repo.claimEffect).not.toHaveBeenCalled();
  });
  it('fails closed if persisted configuration is missing or invalid', async () => {
    const f = arrange();
    f.company.findUnique.mockResolvedValue({ timezone: 'Invalid/Timezone' });
    await expect(f.service.apply(f.tx, request)).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    expect(f.repo.claimEffect).not.toHaveBeenCalled();
    f.company.findUnique.mockResolvedValue(null);
    await expect(f.service.apply(f.tx, request)).rejects.toMatchObject({
      code: 'INVENTORY_TENANT_MISMATCH',
    });
  });
});
