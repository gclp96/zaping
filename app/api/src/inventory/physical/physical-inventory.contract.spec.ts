import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import {
  normalizePhysicalRequest,
  physicalRequestHash,
  PhysicalRequest,
  physicalPersistenceError,
} from './physical-inventory.contract';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';

const productId = randomUUID();
const target = {
  productId,
  inventoryBatchId: null,
  state: 'AVAILABLE' as const,
  contextType: null,
  contextId: null,
};
const request: PhysicalRequest = {
  companyId: randomUUID(),
  actorId: randomUUID(),
  origin: { type: 'TEST', id: randomUUID(), operation: 'CREDIT' },
  operation: { kind: 'CREDIT', credits: [{ target, quantity: 3 }] },
};

describe('physical inventory business intent', () => {
  it('aggregates repeated positions and canonicalizes order before hashing', () => {
    const second = { ...target, productId: randomUUID() };
    const a: PhysicalRequest = {
      ...request,
      operation: {
        kind: 'CREDIT',
        credits: [
          { target, quantity: 1 },
          { target: second, quantity: 2 },
          { target, quantity: 2 },
        ],
      },
    };
    const b: PhysicalRequest = {
      ...request,
      operation: {
        kind: 'CREDIT',
        credits: [
          { target: second, quantity: 2 },
          { target, quantity: 3 },
        ],
      },
    };
    expect(physicalRequestHash(a)).toBe(physicalRequestHash(b));
  });
  it('preserves business intent across authorized actor changes and trims reason', () => {
    expect(physicalRequestHash({ ...request, reason: ' receipt ' })).toBe(
      physicalRequestHash({
        ...request,
        actorId: randomUUID(),
        reason: 'receipt',
      }),
    );
  });
  it('excludes observed runtime fields but retains request quantity and revision preconditions', () => {
    const observed = { ...request, quantityBefore: 100, revisionAfter: 8 };
    expect(physicalRequestHash(observed)).toBe(physicalRequestHash(request));
    const out: PhysicalRequest = {
      ...request,
      operation: {
        kind: 'DEFINITIVE_OUT',
        debits: [
          { sourceId: randomUUID(), quantity: 1, expectedSourceRevision: 0 },
        ],
      },
    };
    const changed = structuredClone(out);
    if (changed.operation.kind === 'DEFINITIVE_OUT')
      changed.operation.debits[0].expectedSourceRevision = 1;
    expect(physicalRequestHash(out)).not.toBe(physicalRequestHash(changed));
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])(
    'rejects invalid quantity %s',
    (quantity) => {
      expect(() =>
        normalizePhysicalRequest({
          ...request,
          operation: { kind: 'CREDIT', credits: [{ target, quantity }] },
        }),
      ).toThrow('INVALID_PHYSICAL_REQUEST');
    },
  );
  it.each([
    { ...target, contextType: 'CASE' },
    { ...target, state: 'CUSTODY', contextType: null, contextId: 'x' },
    { ...target, state: 'INSPECTION' },
  ])('rejects invalid context/state for a credit', (bad) => {
    const input = {
      ...request,
      operation: { kind: 'CREDIT', credits: [{ target: bad, quantity: 1 }] },
    };
    expect(() => normalizePhysicalRequest(input as PhysicalRequest)).toThrow(
      'INVALID_PHYSICAL_REQUEST',
    );
  });
  it('rejects aggregate overflow', () => {
    expect(() =>
      normalizePhysicalRequest({
        ...request,
        operation: {
          kind: 'CREDIT',
          credits: [
            { target, quantity: 2147483647 },
            { target, quantity: 1 },
          ],
        },
      }),
    ).toThrow('PHYSICAL_QUANTITY_LIMIT');
  });
  it('sanitizes unexpected persistence errors without raw causes', () => {
    const error = physicalPersistenceError(
      new Error('password secret constraint_name'),
    );
    expect(JSON.stringify(error)).not.toMatch(/secret|constraint_name/);
    expect(error.message).toBe('INVENTORY_PHYSICAL_PERSISTENCE_ERROR');
  });
});

describe('physical inventory composition and activation', () => {
  it('rejects a root PrismaClient before touching physical state', async () => {
    const repo = { findEffect: jest.fn() };
    const service = new PhysicalInventoryService(
      repo as unknown as PhysicalInventoryRepository,
    );
    const root = {
      $transaction: jest.fn(),
    } as unknown as Prisma.TransactionClient;
    await expect(service.apply(root, request)).rejects.toMatchObject({
      code: 'INVALID_PHYSICAL_REQUEST',
    });
    expect(repo.findEffect).not.toHaveBeenCalled();
  });
  it.each(['effect', 'position'])(
    'propagates %s uniqueness without same-transaction readback',
    async (kind) => {
      const create = jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('private', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      const findUnique = jest.fn();
      const tx = {
        inventoryPhysicalEffect: { create, findUnique },
        inventoryPosition: { create, findFirst: findUnique },
      } as unknown as Prisma.TransactionClient;
      const repo = new PhysicalInventoryRepository();
      const result =
        kind === 'effect'
          ? repo.claimEffect(tx, request, physicalRequestHash(request), 1)
          : repo.createPosition(tx, request.companyId, target);
      await expect(result).rejects.toMatchObject({
        code:
          kind === 'effect'
            ? 'PHYSICAL_EFFECT_CLAIM_CONFLICT'
            : 'PHYSICAL_POSITION_CONFLICT',
      });
      expect(findUnique).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
  it('replays committed evidence before looking at live position state', async () => {
    const effect = {
      id: randomUUID(),
      requestHash: physicalRequestHash(request),
      lines: [],
    };
    const repo = {
      findEffect: jest.fn().mockResolvedValue(effect),
      lockProducts: jest.fn(),
      findSources: jest.fn(),
    };
    const service = new PhysicalInventoryService(
      repo as unknown as PhysicalInventoryRepository,
    );
    await expect(
      service.apply({} as Prisma.TransactionClient, request),
    ).resolves.toEqual({ replay: true, effect, projectionDeltas: [] });
    expect(repo.lockProducts).not.toHaveBeenCalled();
    expect(repo.findSources).not.toHaveBeenCalled();
  });
  it('rejects replay mismatch without acquiring physical locks', async () => {
    const repo = {
      findEffect: jest.fn().mockResolvedValue({ requestHash: 'other' }),
      lockProducts: jest.fn(),
    };
    const service = new PhysicalInventoryService(
      repo as unknown as PhysicalInventoryRepository,
    );
    await expect(
      service.apply({} as Prisma.TransactionClient, request),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    expect(repo.lockProducts).not.toHaveBeenCalled();
  });
  it('has no productive import, controller, transaction owner or history mutation API', () => {
    const src = join(__dirname, '../..');
    function inspect(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'physical') continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) inspect(path);
        else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts')
        ) {
          expect(readFileSync(path, 'utf8')).not.toMatch(
            /inventory-physical-authority|physical-inventory/,
          );
        }
      }
    }
    inspect(src);
    const implementation = [
      'physical-inventory.service.ts',
      'physical-inventory.repository.ts',
      'physical-inventory-read.service.ts',
      'inventory-physical-authority.module.ts',
    ]
      .map((name) => readFileSync(join(__dirname, name), 'utf8'))
      .join('\n');
    expect(implementation).not.toMatch(
      /\$transaction\s*\(|@Controller|\$\w+RawUnsafe|pg_advisory/,
    );
    expect(implementation).not.toMatch(
      /inventoryPhysicalEffect(?:Line)?\.(?:update|delete)/,
    );
    expect(implementation).not.toMatch(
      /(?:product|inventoryBatch|inventoryMovement)\.(?:update|create|delete)/,
    );
  });
});
