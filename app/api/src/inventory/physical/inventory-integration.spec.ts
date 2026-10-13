import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  PhysicalRequest,
  PhysicalResult,
  normalizePhysicalRequest,
  physicalRequestHash,
} from './physical-inventory.contract';
import { InventoryCompatibilityProjectionService } from './inventory-compatibility-projection.service';

describe('Dormant inventory integration contract', () => {
  const request: PhysicalRequest = {
    companyId: randomUUID(),
    actorId: randomUUID(),
    reason: 'count',
    origin: { type: 'TEST', id: randomUUID(), operation: 'COUNT' },
    operation: {
      kind: 'COUNT_CORRECTION',
      sourceId: randomUUID(),
      countedQuantity: 0,
      expectedRevision: 1,
    },
  };
  it('hashes stable count intent and distinguishes expected revision', () => {
    expect(physicalRequestHash(request)).toBe(
      physicalRequestHash({ ...request, actorId: randomUUID() }),
    );
    expect(physicalRequestHash(request)).not.toBe(
      physicalRequestHash({
        ...request,
        operation: {
          ...request.operation,
          kind: 'COUNT_CORRECTION',
          sourceId: randomUUID(),
          countedQuantity: 0,
          expectedRevision: 2,
        },
      }),
    );
  });
  it.each([-1, 1.5, NaN, 2147483648])(
    'rejects invalid count %s',
    (countedQuantity) => {
      expect(() =>
        normalizePhysicalRequest({
          ...request,
          operation: {
            kind: 'COUNT_CORRECTION',
            sourceId: randomUUID(),
            countedQuantity,
            expectedRevision: 1,
          },
        }),
      ).toThrow();
    },
  );
  it('requires reason for count, including zero', () => {
    expect(() =>
      normalizePhysicalRequest({ ...request, reason: '' }),
    ).toThrow();
  });
  it('projection replay performs no reads or writes', async () => {
    await expect(
      new InventoryCompatibilityProjectionService().apply(
        {} as Prisma.TransactionClient,
        request.companyId,
        { replay: true } as PhysicalResult,
      ),
    ).resolves.toBeUndefined();
  });
  it('projection rejects root client before access', async () => {
    await expect(
      new InventoryCompatibilityProjectionService().apply(
        { $transaction: jest.fn() } as unknown as Prisma.TransactionClient,
        request.companyId,
        { replay: true } as PhysicalResult,
      ),
    ).rejects.toThrow();
  });
});
