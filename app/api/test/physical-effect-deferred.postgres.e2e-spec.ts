import { randomUUID } from 'node:crypto';
import {
  InventoryPhysicalEffectKind,
  InventoryPosition,
  InventoryPositionState,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const suite =
  process.env.RUN_INVENTORY_PHYSICAL_POSTGRES === '1'
    ? describe
    : describe.skip;
suite(
  'HC-RR-PERF-01 physical Effect local/aggregate PostgreSQL acceptance',
  () => {
    let db: PrismaClient;
    beforeAll(async () => {
      const url = new URL(process.env.INVENTORY_PHYSICAL_TEST_DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.pathname !== '/zaping_spike_test' ||
        !/^zaping_inv01a_[0-9a-f]{12}$/.test(url.username) ||
        !process.env.INVENTORY_PHYSICAL_TEST_RUN
      )
        throw Error('Fresh runner required');
      db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
      const [r] = await db.$queryRaw<
        { rolsuper: boolean }[]
      >`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`;
      expect(r.rolsuper).toBe(false);
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function fixture(
      states: InventoryPositionState[] = ['CUSTODY', 'CUSTODY', 'CUSTODY'],
    ) {
      const company = await db.company.create({
        data: { name: 'PERF-01 disposable', rfc: randomUUID() },
      });
      const actor = await db.user.create({
        data: {
          companyId: company.id,
          firstName: 'Test',
          lastName: 'Actor',
          email: randomUUID() + '@example.invalid',
          passwordHash: 'NOT-A-CREDENTIAL',
          role: 'ADMIN',
        },
      });
      const product = await db.product.create({
        data: {
          companyId: company.id,
          sku: randomUUID(),
          name: 'Physical fixture',
          lotTracking: 'OPTIONAL',
        },
      });
      const positions: InventoryPosition[] = [];
      for (const state of states) {
        const batch =
          state === 'AVAILABLE' &&
          positions.some((p) => p.state === 'AVAILABLE')
            ? await db.inventoryBatch.create({
                data: {
                  companyId: company.id,
                  productId: product.id,
                  lotNumber: randomUUID(),
                },
              })
            : null;
        positions.push(
          await db.inventoryPosition.create({
            data: {
              companyId: company.id,
              productId: product.id,
              inventoryBatchId: batch?.id,
              state,
              contextType: state === 'CUSTODY' ? 'PERF_TEST' : null,
              contextId: state === 'CUSTODY' ? randomUUID() : null,
            },
          }),
        );
      }
      return { companyId: company.id, actor, product, positions };
    }
    type F = Awaited<ReturnType<typeof fixture>>;
    type Options = {
      count?: number;
      sequences?: number[];
      id?: string;
      header?: Partial<Prisma.InventoryPhysicalEffectUncheckedCreateInput>;
      lines?: Partial<Prisma.InventoryPhysicalEffectLineUncheckedCreateInput>[];
      explicit?: boolean;
    };
    async function write(
      f: F,
      kind: InventoryPhysicalEffectKind,
      deltas: number[],
      options: Options = {},
    ) {
      return db.$transaction(async (tx) => {
        const effect = await tx.inventoryPhysicalEffect.create({
          data: {
            id: options.id ?? randomUUID(),
            companyId: f.companyId,
            actorId: f.actor.id,
            kind,
            originType: kind === 'OPENING' ? 'INVENTORY_OPENING' : 'PERF_TEST',
            originId: randomUUID(),
            originOperation:
              kind === 'OPENING' ? 'OPEN_' + f.product.id : 'TEST',
            requestHash: 'a'.repeat(64),
            lineCount: options.count ?? deltas.length,
            ...options.header,
          },
        });
        for (const [k, delta] of deltas.entries()) {
          const before = Math.max(0, -delta);
          await tx.inventoryPhysicalEffectLine.create({
            data: {
              companyId: f.companyId,
              effectId: effect.id,
              positionId: f.positions[k].id,
              sequence: options.sequences?.[k] ?? k + 1,
              delta,
              quantityBefore: before,
              quantityAfter: before + delta,
              revisionBefore: 0,
              revisionAfter: delta === 0 ? 0 : 1,
              ...options.lines?.[k],
            },
          });
        }
        if (options.explicit !== false) {
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "InventoryPhysicalEffectLine_complete" IMMEDIATE',
          );
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS "InventoryPhysicalEffect_complete" IMMEDIATE',
          );
        }
        return effect;
      });
    }
    it.each([
      ['CREDIT', [2], ['AVAILABLE']],
      ['TRANSFER', [-2, 2], ['CUSTODY', 'CUSTODY']],
      ['DEFINITIVE_OUT', [-2], ['CUSTODY']],
      ['COUNT_CORRECTION', [2], ['AVAILABLE']],
      ['COUNT_CORRECTION', [-2], ['AVAILABLE']],
      ['COUNT_CORRECTION', [0], ['AVAILABLE']],
      ['OPENING', [2], ['AVAILABLE']],
      ['OPENING', [2, 3], ['CUSTODY', 'CUSTODY']],
    ] as [InventoryPhysicalEffectKind, number[], InventoryPositionState[]][])(
      'valid %s deltas %j states %j commits',
      async (kind, deltas, states) => {
        const f = await fixture(states),
          e = await write(f, kind, deltas);
        expect(
          await db.inventoryPhysicalEffectLine.count({
            where: { effectId: e.id },
          }),
        ).toBe(deltas.length);
      },
    );
    it.each([
      [
        'incomplete count',
        'CREDIT',
        [1],
        ['AVAILABLE'],
        { count: 2 },
        /incomplete/,
      ],
      [
        'ordinal gap',
        'TRANSFER',
        [-1, 1],
        ['CUSTODY', 'CUSTODY'],
        { count: 3, sequences: [1, 3] },
        /incomplete/,
      ],
      ['missing debit', 'TRANSFER', [1], ['CUSTODY'], {}, /transfer shape/],
      ['missing credit', 'TRANSFER', [-1], ['CUSTODY'], {}, /transfer shape/],
      [
        'quantity imbalance',
        'TRANSFER',
        [-1, 2],
        ['CUSTODY', 'CUSTODY'],
        {},
        /transfer shape/,
      ],
      ['CREDIT direction', 'CREDIT', [-1], ['AVAILABLE'], {}, /credit shape/],
      ['CREDIT state', 'CREDIT', [1], ['CUSTODY'], {}, /credit shape/],
      [
        'OUT direction',
        'DEFINITIVE_OUT',
        [1],
        ['AVAILABLE'],
        {},
        /definitive out shape/,
      ],
      [
        'COUNT cardinality',
        'COUNT_CORRECTION',
        [1, 1],
        ['AVAILABLE', 'AVAILABLE'],
        {},
        /count correction shape/,
      ],
      [
        'COUNT state',
        'COUNT_CORRECTION',
        [0],
        ['CUSTODY'],
        {},
        /count correction shape/,
      ],
      [
        'zero outside COUNT',
        'DEFINITIVE_OUT',
        [0],
        ['AVAILABLE'],
        {},
        /definitive out shape|Zero delta/,
      ],
      [
        'OPENING namespace',
        'OPENING',
        [1],
        ['AVAILABLE'],
        { header: { originType: 'WRONG' } },
        /opening namespace/,
      ],
      [
        'reverse namespace',
        'CREDIT',
        [1],
        ['AVAILABLE'],
        { header: { originType: 'INVENTORY_OPENING' } },
        /opening namespace/,
      ],
      [
        'OPENING direction',
        'OPENING',
        [-1],
        ['AVAILABLE'],
        {},
        /opening shape/,
      ],
      [
        'OPENING before',
        'OPENING',
        [1],
        ['AVAILABLE'],
        { lines: [{ quantityBefore: 1, quantityAfter: 2 }] },
        /opening shape/,
      ],
      [
        'OPENING revision',
        'OPENING',
        [1],
        ['AVAILABLE'],
        { lines: [{ revisionBefore: 1, revisionAfter: 2 }] },
        /opening shape/,
      ],
      [
        'OPENING operation',
        'OPENING',
        [1],
        ['AVAILABLE'],
        { header: { originOperation: 'WRONG' } },
        /opening shape/,
      ],
      [
        'OPENING identity',
        'OPENING',
        [1],
        ['AVAILABLE'],
        { header: { originId: 'not-a-uuid' } },
        /opening shape/,
      ],
      [
        'quantity arithmetic',
        'CREDIT',
        [1],
        ['AVAILABLE'],
        { lines: [{ quantityAfter: 2 }] },
        /facts_check/,
      ],
      [
        'revision arithmetic',
        'CREDIT',
        [1],
        ['AVAILABLE'],
        { lines: [{ revisionAfter: 2 }] },
        /facts_check/,
      ],
      [
        'duplicate ordinal',
        'TRANSFER',
        [-1, 1],
        ['CUSTODY', 'CUSTODY'],
        { sequences: [1, 1] },
        /Unique constraint/,
      ],
    ] as [
      string,
      InventoryPhysicalEffectKind,
      number[],
      InventoryPositionState[],
      Options,
      RegExp,
    ][])(
      '%s rejects and explicit failure rolls back',
      async (_label, kind, deltas, states, options, pattern) => {
        const f = await fixture(states),
          id = randomUUID();
        await expect(
          write(f, kind, deltas, { ...options, id }),
        ).rejects.toThrow(pattern);
        expect(await db.inventoryPhysicalEffect.count({ where: { id } })).toBe(
          0,
        );
        expect(
          await db.inventoryPhysicalEffectLine.count({
            where: { effectId: id },
          }),
        ).toBe(0);
      },
    );
    it('deferred commit also rejects incomplete Effect without explicit evaluation', async () => {
      const f = await fixture(['AVAILABLE']);
      await expect(
        write(f, 'CREDIT', [1], { count: 2, explicit: false }),
      ).rejects.toThrow(/incomplete/);
    });
    it('unchanged committed Effect rejects late new and occupied ordinals', async () => {
      const f = await fixture(),
        e = await write(f, 'DEFINITIVE_OUT', [-1]);
      const line = {
        companyId: f.companyId,
        effectId: e.id,
        positionId: f.positions[1].id,
        sequence: 2,
        delta: -1,
        quantityBefore: 1,
        quantityAfter: 0,
        revisionBefore: 0,
        revisionAfter: 1,
      };
      await expect(
        db.inventoryPhysicalEffectLine.create({ data: line }),
      ).rejects.toThrow(/incomplete/);
      await expect(
        db.inventoryPhysicalEffectLine.create({
          data: { ...line, sequence: 1 },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      expect(
        await db.inventoryPhysicalEffectLine.count({
          where: { effectId: e.id },
        }),
      ).toBe(1);
    });
    it('duplicate Position rejects', async () => {
      const f = await fixture();
      await expect(
        write(f, 'TRANSFER', [-1, 1], {
          lines: [{}, { positionId: f.positions[0].id }],
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
    it('Company/Effect and Company/Position mismatch reject', async () => {
      const f = await fixture(),
        other = await fixture();
      await expect(
        write(f, 'TRANSFER', [-1, 1], {
          lines: [{ companyId: other.companyId }],
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(
        write(f, 'TRANSFER', [-1, 1], {
          lines: [{ positionId: other.positions[0].id }],
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
    it.each(['product', 'batch'] as const)(
      'TRANSFER balances each %s independently',
      async (dimension) => {
        const f = await fixture();
        const product =
          dimension === 'product'
            ? await db.product.create({
                data: {
                  companyId: f.companyId,
                  sku: randomUUID(),
                  name: 'Other',
                },
              })
            : f.product;
        const batch =
          dimension === 'batch'
            ? await db.inventoryBatch.create({
                data: {
                  companyId: f.companyId,
                  productId: product.id,
                  lotNumber: randomUUID(),
                },
              })
            : null;
        const p = await db.inventoryPosition.create({
          data: {
            companyId: f.companyId,
            productId: product.id,
            inventoryBatchId: batch?.id,
            state: 'CUSTODY',
            contextType: 'PERF_TEST',
            contextId: randomUUID(),
          },
        });
        await expect(
          write(f, 'TRANSFER', [-1, 1], { lines: [{}, { positionId: p.id }] }),
        ).rejects.toThrow(/transfer shape/);
      },
    );
    it('OPENING rejects multiple Products', async () => {
      const f = await fixture();
      const p = await db.product.create({
        data: { companyId: f.companyId, sku: randomUUID(), name: 'Other' },
      });
      const pos = await db.inventoryPosition.create({
        data: { companyId: f.companyId, productId: p.id, state: 'AVAILABLE' },
      });
      await expect(
        write(f, 'OPENING', [1, 1], { lines: [{}, { positionId: pos.id }] }),
      ).rejects.toThrow(/opening shape/);
    });
    it('shared destination TRANSFER commits one grouped credit', async () => {
      const f = await fixture();
      const e = await write(f, 'TRANSFER', [-2, -3, 5]);
      expect(
        await db.inventoryPhysicalEffectLine.count({
          where: { effectId: e.id },
        }),
      ).toBe(3);
    });
  },
);
