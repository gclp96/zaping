import { Prisma } from '@prisma/client';
import {
  normalizePhysicalRequest,
  physicalRequestHash,
  positionIdentity,
  PhysicalRequest,
  PositionKey,
} from './physical-inventory.contract';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';

const command = {
  companyId: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  origin: { type: 'S2_COMPAT', id: 'historical', operation: 'APPLY' },
};
const target: PositionKey = {
  productId: '33333333-3333-4333-8333-333333333333',
  inventoryBatchId: null,
  state: 'AVAILABLE',
  contextType: null,
  contextId: null,
};
const sourceId = '44444444-4444-4444-8444-444444444444';
const legacy: PhysicalRequest[] = [
  {
    ...command,
    operation: { kind: 'CREDIT', credits: [{ target, quantity: 3 }] },
  },
  {
    ...command,
    operation: {
      kind: 'TRANSFER',
      transfers: [
        {
          sourceId,
          quantity: 2,
          expectedSourceRevision: 4,
          target: {
            ...target,
            state: 'CUSTODY',
            contextType: 'CASE',
            contextId: 'case',
          },
        },
      ],
    },
  },
  {
    ...command,
    operation: {
      kind: 'DEFINITIVE_OUT',
      debits: [{ sourceId, quantity: 2, expectedSourceRevision: 4 }],
    },
  },
  {
    ...command,
    reason: 'count',
    operation: {
      kind: 'COUNT_CORRECTION',
      sourceId,
      countedQuantity: 2,
      expectedRevision: 4,
    },
  },
];
// Captured from S1 HEAD 4e6da4a, before any S2 changes. Never derive these via
// the implementation under test: these literals protect persisted replay hashes.
const hashes = [
  'e5b4e36f86b37e317666f4e5a0ab0638ad6457893feb128b018cec7ab01d2450',
  '7682d33398c2810a181af478f4421c9cd14823d3b38c5ddd162dce056891d21a',
  '0c88d0f8445f69b18aa847af1808b1b9da27301ecc8d312cc27e51173b8491a9',
  '843f79d2cc85aadca88dc8231ad74d4e2f0e2babf7f4cbcc603079d6252dd2be',
];
const credit = (keys: PositionKey[]): PhysicalRequest => ({
  ...command,
  operation: {
    kind: 'CREDIT',
    credits: keys.map((key) => ({ target: key, quantity: 1 })),
  },
});

describe('ADR-015 S2 calendar identity and historical hashes', () => {
  it.each(
    legacy.map(
      (request, i) => [request.operation.kind, request, hashes[i]] as const,
    ),
  )('preserves the historical %s SHA256', (_kind, request, hash) => {
    expect(physicalRequestHash(request)).toBe(hash);
  });

  it('omission and explicit null retain the exact old key, hash and serialization', () => {
    expect(positionIdentity(target)).toBe(
      JSON.stringify([target.productId, null, 'AVAILABLE', null, null]),
    );
    expect(positionIdentity({ ...target, expirationDate: null })).toBe(
      positionIdentity(target),
    );
    expect(
      normalizePhysicalRequest(credit([{ ...target, expirationDate: null }])),
    ).toEqual(normalizePhysicalRequest(credit([target])));
    expect(
      physicalRequestHash(credit([{ ...target, expirationDate: null }])),
    ).toBe(physicalRequestHash(credit([target])));
    const transfer = legacy[1];
    if (transfer.operation.kind !== 'TRANSFER') throw new Error('fixture');
    expect(
      physicalRequestHash({
        ...transfer,
        operation: {
          ...transfer.operation,
          transfers: transfer.operation.transfers.map((item) => ({
            ...item,
            target: { ...item.target, expirationDate: null },
          })),
        },
      }),
    ).toBe(hashes[1]);
  });

  it('separates unknown/A/B, aggregates only identical dates and canonicalizes order', () => {
    const a = { ...target, expirationDate: '2028-08-15' };
    const b = { ...target, expirationDate: '2028-11-20' };
    expect(new Set([target, a, b].map(positionIdentity)).size).toBe(3);
    const request = credit([target, a, b, a]);
    const normalized = normalizePhysicalRequest(request);
    if (normalized.operation.kind !== 'CREDIT') throw new Error('fixture');
    expect(normalized.operation.credits).toHaveLength(3);
    expect(
      normalized.operation.credits.find(
        (item) => item.target.expirationDate === a.expirationDate,
      )?.quantity,
    ).toBe(2);
    expect(physicalRequestHash(request)).toBe(
      physicalRequestHash(credit([b, a, target, a])),
    );
    expect(physicalRequestHash(credit([a]))).not.toBe(
      physicalRequestHash(credit([b])),
    );
    expect(physicalRequestHash(credit([a]))).not.toBe(
      physicalRequestHash(credit([target])),
    );
  });

  it.each([
    '2028-02-30',
    '2027-02-29',
    '2028-13-01',
    '2028-00-01',
    '0000-01-01',
    '2028-8-15',
    '2028-08-15T00:00:00.000Z',
    '2028-08-15T23:00:00-07:00',
    ' 2028-08-15',
    '',
    new Date('2028-08-15'),
    42,
  ])(
    'rejects non-calendar/invalid input %s without coercing the day',
    (expirationDate) => {
      expect(() =>
        normalizePhysicalRequest(
          credit([{ ...target, expirationDate } as PositionKey]),
        ),
      ).toThrow('INVALID_PHYSICAL_REQUEST');
    },
  );

  it('accepts a leap day but forbids a second expiry source for a real batch', () => {
    expect(() =>
      normalizePhysicalRequest(
        credit([{ ...target, expirationDate: '2028-02-29' }]),
      ),
    ).not.toThrow();
    expect(() =>
      normalizePhysicalRequest(
        credit([
          {
            ...target,
            inventoryBatchId: sourceId,
            expirationDate: '2028-02-29',
          },
        ]),
      ),
    ).toThrow('INVALID_PHYSICAL_REQUEST');
    expect(
      physicalRequestHash(
        credit([
          { ...target, inventoryBatchId: sourceId, expirationDate: null },
        ]),
      ),
    ).toBe(
      physicalRequestHash(credit([{ ...target, inventoryBatchId: sourceId }])),
    );
  });

  it.each([undefined, null, '2028-08-15'] as const)(
    'uses an explicit Prisma expiry predicate and insert value for %s',
    async (expirationDate) => {
      const findMany = jest.fn().mockResolvedValue([]);
      const create = jest.fn().mockResolvedValue({ id: sourceId });
      const tx = {
        inventoryPosition: { findMany, create },
      } as unknown as Prisma.TransactionClient;
      const repository = new PhysicalInventoryRepository();
      const key = { ...target, expirationDate };
      const expected = {
        ...target,
        expirationDate: expirationDate
          ? new Date(`${expirationDate}T00:00:00.000Z`)
          : null,
      };
      await repository.lockPositions(tx, command.companyId, [], [key]);
      expect(findMany).toHaveBeenCalledWith({
        where: {
          companyId: command.companyId,
          OR: [{ id: { in: [] } }, expected],
        },
        select: { id: true },
      });
      await repository.createPosition(tx, command.companyId, key);
      expect(create).toHaveBeenCalledWith({
        data: { companyId: command.companyId, ...expected },
      });
    },
  );
});

describe('ADR-015 S2 motor safety gate', () => {
  function arrange(expirationDate: Date | null) {
    const source = {
      ...target,
      id: sourceId,
      expirationDate,
      quantity: 10,
      revision: 4,
    };
    const repository = {
      findEffect: jest.fn().mockResolvedValue(null),
      findSources: jest.fn().mockResolvedValue([source]),
      lockProducts: jest.fn().mockResolvedValue([
        {
          id: target.productId,
          inventoryTracking: 'QUANTITY',
          lotTracking: 'OPTIONAL',
          isActive: true,
        },
      ]),
      lockBatches: jest.fn().mockResolvedValue([]),
      lockPositions: jest.fn().mockResolvedValue([source]),
      claimEffect: jest.fn().mockResolvedValue({ id: 'effect' }),
      mutatePosition: jest.fn().mockResolvedValue({ count: 1 }),
      createPosition: jest.fn(),
      appendLines: jest.fn().mockResolvedValue([]),
    };
    const tx = {
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ timezone: 'America/Hermosillo' }),
      },
      inventoryPosition: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { productId: target.productId, _sum: { quantity: 10 } },
          ]),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: command.actorId }) },
    } as unknown as Prisma.TransactionClient;
    const service = new PhysicalInventoryService(
      repository as unknown as PhysicalInventoryRepository,
    );
    return { source, repository, tx, service };
  }

  it.each([
    'CREDIT',
    'TRANSFER',
    'DEFINITIVE_OUT',
    'COUNT_CORRECTION',
  ] as const)(
    'blocks %s of known-date stock after locking and before any write',
    async (kind) => {
      const { repository, tx, service } = arrange(new Date('2028-08-15'));
      if (kind === 'CREDIT') repository.findSources.mockResolvedValue([]);
      const operations: PhysicalRequest['operation'][] = [
        {
          kind: 'CREDIT',
          credits: [
            {
              target: { ...target, expirationDate: '2028-08-15' },
              quantity: 1,
            },
          ],
        },
        { kind: 'TRANSFER', transfers: [{ sourceId, quantity: 1, target }] },
        { kind: 'DEFINITIVE_OUT', debits: [{ sourceId, quantity: 1 }] },
        {
          kind: 'COUNT_CORRECTION',
          sourceId,
          countedQuantity: 9,
          expectedRevision: 4,
        },
      ];
      const operation = operations.find((op) => op.kind === kind)!;
      await expect(
        service.apply(tx, { ...command, reason: 'gate', operation }),
      ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
      expect(repository.lockPositions).toHaveBeenCalled();
      expect(repository.claimEffect).not.toHaveBeenCalled();
      expect(repository.createPosition).not.toHaveBeenCalled();
      expect(repository.mutatePosition).not.toHaveBeenCalled();
      expect(repository.appendLines).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['CASE_DISPATCH', 'CONFIRM_QUANTITY'],
    ['CASE_RECONCILIATION', 'CONFIRM_RETURNED'],
    ['CASE_RECONCILIATION', 'CONFIRM_USED'],
  ])(
    'keeps the dated Healthcare gate closed for %s/%s',
    async (type, operation) => {
      const { source, repository, tx, service } = arrange(
        new Date('2099-08-15'),
      );
      if (operation !== 'CONFIRM_QUANTITY') {
        Object.assign(source, {
          state: 'CUSTODY',
          contextType: 'CASE_DISPATCH_ITEM',
          contextId: 'item',
        });
      }
      const context = {
        ...command,
        origin: { type, id: 'hc-gate', operation },
      };
      const run =
        operation === 'CONFIRM_USED'
          ? service.definitiveOut(tx, context, [
              { sourceId, quantity: 1, expectedSourceRevision: 4 },
            ])
          : service.transfer(tx, context, [
              {
                sourceId,
                quantity: 1,
                expectedSourceRevision: 4,
                // Matching dates isolate the authorization gate from identity mismatch.
                target:
                  operation === 'CONFIRM_RETURNED'
                    ? { ...target, expirationDate: '2099-08-15' }
                    : {
                        ...target,
                        expirationDate: '2099-08-15',
                        state: 'CUSTODY',
                        contextType: 'CASE_DISPATCH_ITEM',
                        contextId: 'item',
                      },
              },
            ]);
      await expect(run).rejects.toMatchObject({
        code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
      });
      expect(repository.lockPositions).toHaveBeenCalled();
      expect(repository.claimEffect).not.toHaveBeenCalled();
      expect(repository.mutatePosition).not.toHaveBeenCalled();
      expect(repository.appendLines).not.toHaveBeenCalled();
      expect(source.quantity).toBe(10);
    },
  );

  it('does not mistake a dated position for the legacy target even if returned by a broad caller', async () => {
    const { source, repository, tx, service } = arrange(null);
    repository.findSources.mockResolvedValue([]);
    repository.lockPositions.mockResolvedValue([
      source,
      {
        ...source,
        id: 'dated-position',
        expirationDate: new Date('2028-08-15'),
      },
    ]);
    await service.apply(tx, credit([target]));
    expect(repository.mutatePosition).toHaveBeenCalledWith(tx, source, 1);
    expect(repository.mutatePosition).toHaveBeenCalledTimes(1);
    expect(repository.createPosition).not.toHaveBeenCalled();
  });

  it('checks the locked source date rather than an earlier discovery snapshot', async () => {
    const { source, repository, tx, service } = arrange(null);
    repository.lockPositions.mockResolvedValue([
      { ...source, expirationDate: new Date('2028-08-15') },
    ]);
    await expect(service.apply(tx, legacy[2])).rejects.toMatchObject({
      code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE',
    });
    expect(repository.claimEffect).not.toHaveBeenCalled();
    expect(repository.mutatePosition).not.toHaveBeenCalled();
  });

  it('rejects a transfer that would replace an unknown day with a known day', async () => {
    const { repository, tx, service } = arrange(null);
    await expect(
      service.transfer(tx, command, [
        {
          sourceId,
          quantity: 1,
          target: {
            ...target,
            expirationDate: '2028-08-15',
            state: 'CUSTODY',
            contextType: 'CASE',
            contextId: 'case',
          },
        },
      ]),
    ).rejects.toMatchObject({ code: 'INVENTORY_BATCH_PRODUCT_MISMATCH' });
    expect(repository.claimEffect).not.toHaveBeenCalled();
    expect(repository.mutatePosition).not.toHaveBeenCalled();
  });

  it('replays a historical golden hash before consulting current state', async () => {
    const { repository, tx, service } = arrange(null);
    const effect = {
      id: 'historical-effect',
      requestHash: hashes[0],
      lines: [],
    };
    repository.findEffect.mockResolvedValue(effect);
    await expect(service.apply(tx, legacy[0])).resolves.toEqual({
      replay: true,
      effect,
      projectionDeltas: [],
    });
    expect(repository.findSources).not.toHaveBeenCalled();
    expect(repository.claimEffect).not.toHaveBeenCalled();
    expect(repository.mutatePosition).not.toHaveBeenCalled();
    await expect(
      service.apply(tx, credit([{ ...target, expirationDate: '2028-08-15' }])),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
  });
});
