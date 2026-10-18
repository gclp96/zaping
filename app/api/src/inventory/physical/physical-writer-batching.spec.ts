import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { InventoryCompatibilityProjectionService } from './inventory-compatibility-projection.service';

describe('bounded physical evidence writers', () => {
  const repo = new PhysicalInventoryRepository();
  function lines(
    count = 251,
  ): Prisma.InventoryPhysicalEffectLineCreateManyInput[] {
    const companyId = randomUUID(),
      effectId = randomUUID();
    return Array.from({ length: count }, (_, i) => ({
      companyId,
      effectId,
      positionId: randomUUID(),
      sequence: i + 1,
      delta: 2,
      quantityBefore: 3,
      quantityAfter: 5,
      revisionBefore: 4,
      revisionAfter: 5,
    }));
  }
  it('returns persisted IDs in canonical sequence across bounded unordered RETURNING chunks', async () => {
    const data = lines();
    const createManyAndReturn = jest.fn(
      ({ data }: { data: ReturnType<typeof lines> }) =>
        Promise.resolve(
          data.map((l) => ({ ...l, id: randomUUID() })).reverse(),
        ),
    );
    const result = await repo.appendLines(
      {
        inventoryPhysicalEffectLine: { createManyAndReturn },
      } as unknown as Prisma.TransactionClient,
      data,
    );
    expect(
      createManyAndReturn.mock.calls.map(([arg]) => arg.data.length),
    ).toEqual([250, 1]);
    expect(result.map((l) => l.sequence)).toEqual(data.map((l) => l.sequence));
    result.forEach((l, i) => expect(l).toMatchObject(data[i]));
    expect(new Set(result.map((l) => l.id)).size).toBe(251);
    expect(
      createManyAndReturn.mock.calls.every(
        ([arg]) => !('skipDuplicates' in arg),
      ),
    ).toBe(true);
  });
  it.each(['missing', 'duplicate', 'wrong-evidence'] as const)(
    'rejects %s RETURNING evidence',
    async (kind) => {
      const data = lines(2);
      const rows = data.map((l) => ({ ...l, id: randomUUID() }));
      if (kind === 'missing') rows.pop();
      if (kind === 'duplicate') rows[1] = rows[0];
      if (kind === 'wrong-evidence') rows[1].quantityBefore = 99;
      const tx = {
        inventoryPhysicalEffectLine: {
          createManyAndReturn: jest.fn().mockResolvedValue(rows),
        },
      };
      await expect(
        repo.appendLines(tx as unknown as Prisma.TransactionClient, data),
      ).rejects.toThrow();
    },
  );
  it.each([
    'position',
    'sequence',
    'company',
    'effect',
    'provided-id',
  ] as const)('rejects incompatible %s input before SQL', async (kind) => {
    const data = lines(2);
    if (kind === 'position') data[1].positionId = data[0].positionId;
    if (kind === 'sequence') data[1].sequence = 1;
    if (kind === 'company') data[1].companyId = randomUUID();
    if (kind === 'effect') data[1].effectId = randomUUID();
    if (kind === 'provided-id') data[1].id = randomUUID();
    const createManyAndReturn = jest.fn();
    await expect(
      repo.appendLines(
        {
          inventoryPhysicalEffectLine: { createManyAndReturn },
        } as unknown as Prisma.TransactionClient,
        data,
      ),
    ).rejects.toThrow();
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });
  it.each(['missing', 'unexpected', 'duplicate'] as const)(
    'rejects %s Batch affected identities',
    async (kind) => {
      const id = randomUUID();
      const rows =
        kind === 'missing'
          ? []
          : kind === 'unexpected'
            ? [{ id: randomUUID() }]
            : [{ id }, { id }];
      await expect(
        new InventoryCompatibilityProjectionService().applyBatchDeltas(
          {
            $queryRaw: jest.fn().mockResolvedValue(rows),
          } as unknown as Prisma.TransactionClient,
          randomUUID(),
          [{ id, productId: randomUUID(), delta: -1 }],
        ),
      ).rejects.toThrow();
    },
  );
  it('rejects duplicate Batch inputs before any SQL', async () => {
    const row = { id: randomUUID(), productId: randomUUID(), delta: 1 };
    const query = jest.fn();
    await expect(
      new InventoryCompatibilityProjectionService().applyBatchDeltas(
        { $queryRaw: query } as unknown as Prisma.TransactionClient,
        randomUUID(),
        [row, row],
      ),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
