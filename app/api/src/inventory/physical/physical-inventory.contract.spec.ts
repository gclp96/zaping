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
  it.each(['valid', 'insufficient-sum', 'contradictory-revisions'] as const)(
    'generic repeated-source Transfer: %s (independent of Dispatch uniqueness)',
    async (scenario) => {
      const source = {
        ...target,
        id: randomUUID(),
        quantity: scenario === 'insufficient-sum' ? 6 : 10,
        revision: 0,
      };
      const destinations = [1, 2].map(() => ({
        ...target,
        id: randomUUID(),
        state: 'CUSTODY' as const,
        contextType: 'PRIMITIVE_TEST',
        contextId: randomUUID(),
        quantity: 0,
        revision: 0,
      }));
      const repo = {
        findEffect: jest.fn().mockResolvedValue(null),
        findSources: jest.fn().mockResolvedValue([source]),
        lockProducts: jest.fn().mockResolvedValue([
          {
            id: productId,
            isActive: true,
            inventoryTracking: 'QUANTITY',
            lotTracking: 'NONE',
          },
        ]),
        lockBatches: jest.fn().mockResolvedValue([]),
        lockPositions: jest.fn().mockResolvedValue([source, ...destinations]),
        claimEffect: jest
          .fn()
          .mockResolvedValue({ id: randomUUID(), kind: 'TRANSFER' }),
        mutatePosition: jest
          .fn<
            Promise<{ count: number }>,
            Parameters<PhysicalInventoryRepository['mutatePosition']>
          >()
          .mockResolvedValue({ count: 1 }),
        appendLine: jest.fn((_tx: unknown, line: object) =>
          Promise.resolve(line),
        ),
      };
      const tx = {
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: request.actorId }),
        },
        inventoryPosition: {
          groupBy: jest
            .fn()
            .mockResolvedValue([{ productId, _sum: { quantity: 10 } }]),
        },
      };
      const service = new PhysicalInventoryService(
        repo as unknown as PhysicalInventoryRepository,
      );
      const result = service.transfer(
        tx as unknown as Prisma.TransactionClient,
        request,
        destinations.map((destination, index) => ({
          sourceId: source.id,
          quantity: index === 0 ? 3 : 4,
          expectedSourceRevision:
            scenario === 'contradictory-revisions' && index === 1 ? 1 : 0,
          target: destination,
        })),
      );
      if (scenario === 'valid') {
        const applied = await result;
        expect(applied.effect.lines).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              positionId: source.id,
              delta: -7,
              quantityBefore: 10,
              quantityAfter: 3,
              revisionBefore: 0,
              revisionAfter: 1,
            }),
          ]),
        );
        expect(
          repo.mutatePosition.mock.calls.filter(
            (call) => call[1].id === source.id,
          ),
        ).toHaveLength(1);
        expect(
          applied.effect.lines
            .filter((line) => line.delta > 0)
            .map((line) => line.delta)
            .sort(),
        ).toEqual([3, 4]);
        expect(applied.projectionDeltas).toEqual([
          { productId, ownedDelta: 0 },
        ]);
      } else {
        await expect(result).rejects.toMatchObject({
          code:
            scenario === 'insufficient-sum'
              ? 'INSUFFICIENT_PHYSICAL_AVAILABILITY'
              : 'INVALID_PHYSICAL_REQUEST',
        });
        expect(repo.claimEffect).not.toHaveBeenCalled();
        expect(repo.mutatePosition).not.toHaveBeenCalled();
      }
    },
  );
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
  it('restricts physical integration to the approved productive writer boundaries', () => {
    const src = join(__dirname, '../..');
    const dispatchWriters = [
      'healthcare-case-dispatch-confirm.repository.ts',
      'healthcare-case-dispatch-confirm.service.ts',
      'healthcare-case-dispatches.module.ts',
    ].map((name) => join(src, 'healthcare', 'case-dispatches', name));
    function inspect(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'physical') continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) inspect(path);
        else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts') &&
          !dispatchWriters.includes(path) &&
          ![
            'create-physical-movement.dto.ts',
            'inventory.service.ts',
            'inventory.module.ts',
            'purchases-receipts.service.ts',
            'purchases-receipts.module.ts',
            'sales.service.ts',
            'sales.module.ts',
          ].includes(entry.name)
        ) {
          expect(readFileSync(path, 'utf8')).not.toMatch(
            /inventory-cutover|inventory-authority-resolver|inventory-physical-authority|physical-inventory|receipt-physical-integration|sales-physical|sales-legacy-classifier|inventory-compatibility-(?:projection|history)/,
          );
        }
      }
    }
    inspect(src);
    const confirm = readFileSync(dispatchWriters[1], 'utf8');
    expect(confirm).toMatch(/this\.physical\.transfer\(/);
    expect(confirm).toMatch(/this\.projections\.apply\(/);
    expect(confirm).not.toMatch(
      /authority\.run\(|InventoryCompatibilityHistory|inventoryMovement\.(?:create|update|delete)|\$transaction\s*\(/,
    );
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
