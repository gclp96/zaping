import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CompanySequenceAllocatorService } from '../src/company-sequences/company-sequence-allocator.service';
import { EquipmentAssetCodeService } from '../src/equipment/equipment-asset-code.service';
import { EquipmentProvisioningService } from '../src/equipment/equipment-provisioning.service';
import { InventoryAuthorityTransactionService } from '../src/inventory/physical/inventory-authority-transaction.service';
import { InventoryCompatibilityHistoryService } from '../src/inventory/physical/inventory-compatibility-history.service';
import { InventoryCompatibilityProjectionService } from '../src/inventory/physical/inventory-compatibility-projection.service';
import { PhysicalInventoryRepository } from '../src/inventory/physical/physical-inventory.repository';
import { PhysicalInventoryService } from '../src/inventory/physical/physical-inventory.service';
import { ReceiptPhysicalIntegrationService } from '../src/inventory/physical/receipt-physical-integration.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PurchaseReceiptsService } from '../src/purchases-receipts/purchases-receipts.service';
import { companyLocalDay } from '../src/inventory/physical/physical-expiration-policy';
import { PhysicalResult } from '../src/inventory/physical/physical-inventory.contract';
import { PhysicalInventoryReadService } from '../src/inventory/physical/physical-inventory-read.service';
import { ReceiptHistoryItem } from '../src/inventory/physical/inventory-compatibility-history.service';

const enabled = process.env.RUN_PURCHASE_RECEIPT_PG_SMOKE === '1';
const describePg = enabled ? describe : describe.skip;

describePg('INSAP receipt PHYSICAL documents and ADR-015 W1 PostgreSQL', () => {
  let db: PrismaClient;

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.CI !== 'true'
    ) {
      throw new Error('Smoke is restricted to GitHub Actions ephemeral CI');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe PostgreSQL smoke database target');
    }
    db = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await db.$queryRaw<
      { database: string; role: string }[]
    >`SELECT current_database() AS database, current_user AS role`;
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function fixture(
    lotTracking: 'NONE' | 'OPTIONAL' | 'REQUIRED' = 'REQUIRED',
  ) {
    const companyId = randomUUID();
    const actorId = randomUUID();
    const productId = randomUUID();
    await db.company.create({
      data: {
        id: companyId,
        name: 'W1 isolated fixture',
        rfc: companyId,
        timezone: 'Pacific/Kiritimati',
      },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'W1',
        lastName: 'CI',
        email: `${actorId}@example.invalid`,
        passwordHash: 'NOT-A-LOGIN',
        role: 'WAREHOUSE',
      },
    });
    await db.product.create({
      data: {
        id: productId,
        companyId,
        sku: productId,
        name: 'W1 QUANTITY',
        inventoryTracking: 'QUANTITY',
        lotTracking,
        stock: 0,
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'W1 supplier' },
    });
    const purchase = await db.purchase.create({
      data: {
        companyId,
        supplierId: supplier.id,
        folio: randomUUID(),
        status: 'CONFIRMED',
        subtotal: 400,
        iva: 0,
        total: 400,
        items: {
          create: [{ productId, quantity: 20, price: 20, subtotal: 400 }],
        },
      },
      include: { items: true },
    });
    return {
      companyId,
      actorId,
      productId,
      purchase,
      purchaseItemId: purchase.items[0].id,
    };
  }

  function services(
    client = db,
    history = new InventoryCompatibilityHistoryService(),
    physical = new PhysicalInventoryService(new PhysicalInventoryRepository()),
  ) {
    const equipment = new EquipmentProvisioningService(
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
    );
    const integration = new ReceiptPhysicalIntegrationService(
      new PhysicalInventoryRepository(),
      physical,
      new InventoryCompatibilityProjectionService(),
      history,
      equipment,
    );
    // Same selector isolation as the historical smoke; no Prisma/SQL mocks.
    const authority = {
      run: <T>(
        _company: string,
        action: (
          tx: Prisma.TransactionClient,
          mode: 'LEGACY' | 'PHYSICAL',
        ) => Promise<T>,
      ) =>
        client.$transaction((tx) => action(tx, 'PHYSICAL'), {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 15000,
        }),
    } as InventoryAuthorityTransactionService;
    return {
      physical,
      integration,
      receipts: new PurchaseReceiptsService(
        client as PrismaService,
        equipment,
        authority,
        integration,
      ),
    };
  }

  const day = (offset: number) => {
    const today = companyLocalDay('Pacific/Kiritimati', new Date());
    return new Date(
      new Date(`${today}T00:00:00.000Z`).getTime() + offset * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  };

  async function assertEmpty(f: Awaited<ReturnType<typeof fixture>>) {
    const where = { companyId: f.companyId };
    expect(await db.purchaseReceipt.count({ where })).toBe(0);
    expect(await db.purchaseReceiptItem.count({ where })).toBe(0);
    expect(await db.idempotencyRecord.count({ where })).toBe(0);
    expect(await db.inventoryPhysicalEffect.count({ where })).toBe(0);
    expect(await db.inventoryPhysicalEffectLine.count({ where })).toBe(0);
    expect(await db.inventoryMovement.count({ where })).toBe(0);
    expect(await db.inventoryPosition.count({ where })).toBe(0);
    expect(await db.inventoryBatch.count({ where })).toBe(0);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(0);
    expect(
      (await db.purchase.findUniqueOrThrow({ where: { id: f.purchase.id } }))
        .status,
    ).toBe('CONFIRMED');
  }

  it.each(['NONE', 'OPTIONAL', 'REQUIRED'] as const)(
    'receives three calendar identities plus unknown with %s, partials and replay',
    async (tracking) => {
      const f = await fixture(tracking);
      const { receipts } = services();
      for (const expirationDate of [undefined, day(0), day(1), day(2)]) {
        const dto = {
          purchaseId: f.purchase.id,
          supplierDocumentType: 'FACTURA' as const,
          supplierDocumentNumber: 'F-W1',
          items: [
            {
              purchaseItemId: f.purchaseItemId,
              quantityReceived: 2,
              expirationDate,
            },
          ],
        };
        const key = randomUUID();
        const receipt = await receipts.create(f.companyId, f.actorId, key, dto);
        expect(
          (await receipts.create(f.companyId, f.actorId, key, dto)).id,
        ).toBe(receipt.id);
        const item = await db.purchaseReceiptItem.findFirstOrThrow({
          where: { receiptId: receipt.id },
        });
        expect(item.batchId).toBeNull();
        expect(item.lotNumber).toBeNull();
        expect(item.expirationDate?.toISOString().slice(0, 10)).toBe(
          expirationDate,
        );
        await expect(
          receipts.create(f.companyId, f.actorId, key, {
            ...dto,
            items: [{ ...dto.items[0], quantityReceived: 3 }],
          }),
        ).rejects.toBeInstanceOf(ConflictException);
      }
      const positions = await db.inventoryPosition.findMany({
        where: { companyId: f.companyId },
      });
      expect(positions).toHaveLength(4);
      expect(
        new Set(
          positions.map(
            (p) => p.expirationDate?.toISOString().slice(0, 10) ?? null,
          ),
        ),
      ).toEqual(new Set([null, day(0), day(1), day(2)]));
      expect(
        positions.every(
          (p) =>
            p.quantity === 2 &&
            p.revision === 1 &&
            p.inventoryBatchId === null &&
            p.state === 'AVAILABLE',
        ),
      ).toBe(true);
      expect(
        await db.inventoryBatch.count({ where: { companyId: f.companyId } }),
      ).toBe(0);
      expect(
        await db.inventoryPhysicalEffect.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(4);
      expect(
        await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
      ).toBe(4);
      expect(
        (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
          .stock,
      ).toBe(8);
      expect(
        (await db.purchase.findUniqueOrThrow({ where: { id: f.purchase.id } }))
          .status,
      ).toBe('PARTIALLY_RECEIVED');
    },
    20000,
  );

  it('keeps a real Batch, its timestamp, documents and stock without double credit', async () => {
    const f = await fixture();
    const { receipts } = services();
    const expirationDate = `${day(2)}T13:45:00.000Z`;
    const dto = {
      purchaseId: f.purchase.id,
      supplierDocumentType: 'REMISION' as const,
      supplierDocumentNumber: 'R-W1',
      items: [
        {
          purchaseItemId: f.purchaseItemId,
          quantityReceived: 2,
          lotNumber: 'REAL-LOT',
          expirationDate,
        },
      ],
    };
    for (let i = 0; i < 2; i++) {
      const key = randomUUID();
      const receipt = await receipts.create(f.companyId, f.actorId, key, dto);
      expect((await receipts.create(f.companyId, f.actorId, key, dto)).id).toBe(
        receipt.id,
      );
    }
    const batches = await db.inventoryBatch.findMany({
      where: { companyId: f.companyId },
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      lotNumber: 'REAL-LOT',
      expirationDate: new Date(expirationDate),
      availableQuantity: 4,
      initialQuantity: 4,
    });
    const positions = await db.inventoryPosition.findMany({
      where: { companyId: f.companyId },
    });
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      inventoryBatchId: batches[0].id,
      expirationDate: null,
      quantity: 4,
      revision: 2,
    });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(4);
  });

  it.each([false, true])(
    'rejects expired incoming material atomically (real Batch=%s)',
    async (batch) => {
      const f = await fixture();
      await expect(
        services().receipts.create(f.companyId, f.actorId, randomUUID(), {
          purchaseId: f.purchase.id,
          items: [
            {
              purchaseItemId: f.purchaseItemId,
              quantityReceived: 2,
              expirationDate: day(-1),
              ...(batch ? { lotNumber: 'EXPIRED' } : {}),
            },
          ],
        }),
      ).rejects.toThrow();
      await assertEmpty(f);
    },
  );

  it('rolls back receipt, claim, date, Batch, projections and audit after actual history writes', async () => {
    const f = await fixture();
    const second = await db.purchaseItem.create({
      data: {
        purchaseId: f.purchase.id,
        productId: f.productId,
        quantity: 3,
        price: 20,
        subtotal: 60,
      },
    });
    let reached = false;
    class FailingHistory extends InventoryCompatibilityHistoryService {
      override async write(
        tx: Prisma.TransactionClient,
        result: PhysicalResult,
        items: ReceiptHistoryItem[],
      ) {
        await super.write(tx, result, items);
        expect(
          await tx.inventoryPhysicalEffectLine.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(2);
        expect(
          await tx.inventoryMovement.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(2);
        reached = true;
        throw new Error('W1_POST_HISTORY_FAULT');
      }
    }
    await expect(
      services(db, new FailingHistory()).receipts.create(
        f.companyId,
        f.actorId,
        randomUUID(),
        {
          purchaseId: f.purchase.id,
          supplierDocumentType: 'FACTURA',
          supplierDocumentNumber: 'ROLLBACK',
          items: [
            {
              purchaseItemId: f.purchaseItemId,
              quantityReceived: 2,
              expirationDate: day(1),
            },
            {
              purchaseItemId: second.id,
              quantityReceived: 1,
              lotNumber: 'REAL',
              expirationDate: day(2),
            },
          ],
        },
      ),
    ).rejects.toThrow('W1_POST_HISTORY_FAULT');
    expect(reached).toBe(true);
    await assertEmpty(f);
  });

  it('rejects over-receipt, foreign actor, inactive actor and SALES before credit', async () => {
    const f = await fixture();
    const dto = {
      purchaseId: f.purchase.id,
      items: [{ purchaseItemId: f.purchaseItemId, quantityReceived: 21 }],
    };
    const { receipts } = services();
    await expect(
      receipts.create(f.companyId, f.actorId, randomUUID(), dto),
    ).rejects.toThrow();
    for (const actor of [randomUUID(), f.actorId]) {
      if (actor === f.actorId)
        await db.user.update({ where: { id: actor }, data: { role: 'SALES' } });
      await expect(
        receipts.create(f.companyId, actor, randomUUID(), {
          ...dto,
          items: [{ ...dto.items[0], quantityReceived: 1 }],
        }),
      ).rejects.toThrow();
    }
    await db.user.update({
      where: { id: f.actorId },
      data: { role: 'WAREHOUSE', isActive: false },
    });
    await expect(
      receipts.create(f.companyId, f.actorId, randomUUID(), {
        ...dto,
        items: [{ ...dto.items[0], quantityReceived: 1 }],
      }),
    ).rejects.toThrow();
    await assertEmpty(f);
  });

  it('replays historical dated receipt after its local day expires without changing stock', async () => {
    const f = await fixture();
    await db.company.update({
      where: { id: f.companyId },
      data: { timezone: 'Etc/GMT+12' },
    });
    const expirationDate = companyLocalDay('Etc/GMT+12', new Date());
    const dto = {
      purchaseId: f.purchase.id,
      items: [
        {
          purchaseItemId: f.purchaseItemId,
          quantityReceived: 2,
          expirationDate,
        },
      ],
    };
    const key = randomUUID();
    const { receipts, physical } = services();
    const receipt = await receipts.create(f.companyId, f.actorId, key, dto);
    await db.company.update({
      where: { id: f.companyId },
      data: { timezone: 'Pacific/Kiritimati' },
    });
    const read = await db.$transaction((tx) =>
      new PhysicalInventoryReadService().product(tx, f.companyId, f.productId),
    );
    expect(read).toMatchObject({ owned: 2, available: 0, inCustody: 0 });
    expect((await receipts.create(f.companyId, f.actorId, key, dto)).id).toBe(
      receipt.id,
    );
    const position = await db.inventoryPosition.findFirstOrThrow({
      where: { companyId: f.companyId },
    });
    // A valid receipt permit never authorizes later generic dated consumption.
    await expect(
      db.$transaction((tx) =>
        physical.definitiveOut(
          tx,
          {
            companyId: f.companyId,
            actorId: f.actorId,
            origin: { type: 'W1_GATE', id: randomUUID(), operation: 'OUT' },
          },
          [
            {
              sourceId: position.id,
              quantity: 1,
              expectedSourceRevision: position.revision,
            },
          ],
        ),
      ),
    ).rejects.toMatchObject({ code: 'PHYSICAL_SOURCE_NOT_ELIGIBLE' });
    expect(
      await db.inventoryPhysicalEffect.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(2);
    expect(
      await db.inventoryPosition.findUniqueOrThrow({
        where: { id: position.id },
      }),
    ).toMatchObject({ quantity: 2, revision: 1 });
  });

  it.each(['ASSET', 'SERIALIZED'] as const)(
    'does not exempt %s from its REQUIRED lot rules',
    async (inventoryTracking) => {
      const f = await fixture();
      await db.product.update({
        where: { id: f.productId },
        data: { inventoryTracking },
      });
      await expect(
        services().receipts.create(f.companyId, f.actorId, randomUUID(), {
          purchaseId: f.purchase.id,
          items: [{ purchaseItemId: f.purchaseItemId, quantityReceived: 1 }],
        }),
      ).rejects.toThrow();
      await assertEmpty(f);
      expect(
        await db.equipmentAsset.count({ where: { companyId: f.companyId } }),
      ).toBe(0);
    },
  );

  it('rejects a forged origin and a committed receipt reused as a new permit', async () => {
    const f = await fixture();
    const { receipts, physical } = services();
    const key = randomUUID();
    const dto = {
      purchaseId: f.purchase.id,
      items: [{ purchaseItemId: f.purchaseItemId, quantityReceived: 1 }],
    };
    const receipt = await receipts.create(f.companyId, f.actorId, key, dto);
    await expect(
      db.$transaction((tx) =>
        physical.creditAvailable(
          tx,
          {
            companyId: f.companyId,
            actorId: f.actorId,
            origin: {
              type: 'PURCHASE_RECEIPT',
              id: receipt.id,
              operation: 'RECEIVE_QUANTITY',
            },
          },
          [
            {
              target: {
                productId: f.productId,
                inventoryBatchId: null,
                state: 'AVAILABLE',
                contextType: null,
                contextId: null,
                expirationDate: day(2),
              },
              quantity: 5,
            },
          ],
        ),
      ),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    await expect(
      db.$transaction((tx) =>
        physical.creditPurchaseReceipt(tx, {
          companyId: f.companyId,
          actorId: f.actorId,
          receiptId: receipt.id,
          idempotencyKey: key,
        }),
      ),
    ).rejects.toMatchObject({ code: 'PHYSICAL_EFFECT_MISMATCH' });
    expect((await receipts.create(f.companyId, f.actorId, key, dto)).id).toBe(
      receipt.id,
    );
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(1);
    expect(
      await db.inventoryMovement.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
  });

  it.each([false, true])(
    'serializes two physical connections on one purchase (same key=%s)',
    async (sameKey) => {
      const f = await fixture();
      const url = new URL(process.env.DATABASE_URL!);
      url.searchParams.set('connection_limit', '1');
      const first = new PrismaClient({
        datasources: { db: { url: url.toString() } },
      });
      const second = new PrismaClient({
        datasources: { db: { url: url.toString() } },
      });
      const gate = () => {
        let release!: () => void;
        let reject!: (error: unknown) => void;
        const wait = new Promise<void>((resolve, fail) => {
          release = resolve;
          reject = fail;
        });
        return { wait, release, reject };
      };
      const ready = gate();
      const release = gate();
      const [{ pid: ownerPid }] = await first.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      const [{ pid: contenderPid }] = await second.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      expect(ownerPid).not.toBe(contenderPid);
      class HoldingPhysical extends PhysicalInventoryService {
        override async creditPurchaseReceipt(
          ...args: Parameters<PhysicalInventoryService['creditPurchaseReceipt']>
        ) {
          const result = await super.creditPurchaseReceipt(...args);
          ready.release();
          await release.wait;
          return result;
        }
      }
      const key = randomUUID();
      const dto = {
        purchaseId: f.purchase.id,
        items: [
          {
            purchaseItemId: f.purchaseItemId,
            quantityReceived: 2,
            expirationDate: day(2),
          },
        ],
      };
      const owner = services(
        first,
        new InventoryCompatibilityHistoryService(),
        new HoldingPhysical(new PhysicalInventoryRepository()),
      ).receipts.create(f.companyId, f.actorId, key, dto);
      void owner.catch(ready.reject);
      let contender: ReturnType<PurchaseReceiptsService['create']> | undefined;
      try {
        await ready.wait;
        contender = services(second).receipts.create(
          f.companyId,
          f.actorId,
          sameKey ? key : randomUUID(),
          dto,
        );
        // Attach immediately so an early database error is not an unhandled rejection.
        void contender.catch(() => undefined);
        let blocked = false;
        const deadline = Date.now() + 5000;
        while (!blocked && Date.now() < deadline) {
          const [row] = await db.$queryRaw<
            { blocked: boolean }[]
          >`SELECT ${ownerPid}::integer = ANY(pg_blocking_pids(${contenderPid}::integer)) AS blocked`;
          blocked = row.blocked;
        }
        expect(blocked).toBe(true);
        release.release();
        const [one, two] = await Promise.all([owner, contender]);
        expect(one.id === two.id).toBe(sameKey);
        const count = sameKey ? 1 : 2;
        expect(
          await db.purchaseReceipt.count({ where: { companyId: f.companyId } }),
        ).toBe(count);
        expect(
          await db.idempotencyRecord.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(count);
        expect(
          await db.inventoryPhysicalEffect.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(count);
        expect(
          await db.inventoryPhysicalEffectLine.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(count);
        expect(
          await db.inventoryMovement.count({
            where: { companyId: f.companyId },
          }),
        ).toBe(count);
        const positions = await db.inventoryPosition.findMany({
          where: { companyId: f.companyId },
        });
        expect(positions).toHaveLength(1);
        expect(positions[0]).toMatchObject({
          quantity: count * 2,
          revision: count,
          expirationDate: new Date(day(2)),
        });
        expect(
          (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
            .stock,
        ).toBe(count * 2);
      } finally {
        release.release();
        await Promise.allSettled([owner, ...(contender ? [contender] : [])]);
        await Promise.all([first.$disconnect(), second.$disconnect()]);
      }
    },
    25000,
  );

  it('persists remittance once across PHYSICAL creation and idempotent retry', async () => {
    const companyId = randomUUID();
    const actorId = randomUUID();
    const productId = randomUUID();
    await db.company.create({
      data: { id: companyId, name: 'INSAP receipt CI fixture', rfc: companyId },
    });
    await db.user.create({
      data: {
        id: actorId,
        companyId,
        firstName: 'Receipt',
        lastName: 'CI',
        email: `${actorId}@example.invalid`,
        passwordHash: 'NOT-A-LOGIN',
        role: 'WAREHOUSE',
        isActive: true,
      },
    });
    await db.product.create({
      data: {
        id: productId,
        companyId,
        sku: productId,
        name: 'INSAP quantity fixture',
        inventoryTracking: 'QUANTITY',
        lotTracking: 'OPTIONAL',
        stock: 0,
      },
    });
    const supplier = await db.supplier.create({
      data: { companyId, name: 'CI supplier' },
    });
    const purchase = await db.purchase.create({
      data: {
        companyId,
        supplierId: supplier.id,
        folio: `OC-${randomUUID()}`,
        status: 'CONFIRMED',
        subtotal: 80,
        iva: 0,
        total: 80,
        items: {
          create: [{ productId, quantity: 4, price: 20, subtotal: 80 }],
        },
      },
      include: { items: true },
    });

    const repository = new PhysicalInventoryRepository();
    const physical = new PhysicalInventoryService(repository);
    const equipment = new EquipmentProvisioningService(
      new EquipmentAssetCodeService(new CompanySequenceAllocatorService()),
    );
    const integration = new ReceiptPhysicalIntegrationService(
      repository,
      physical,
      new InventoryCompatibilityProjectionService(),
      new InventoryCompatibilityHistoryService(),
      equipment,
    );

    // Only the authority selector is replaced: all receipt, physical inventory,
    // compatibility projections and audit writes run against actual PostgreSQL.
    const authority = {
      run: <T>(
        _companyId: string,
        action: (
          tx: Prisma.TransactionClient,
          mode: 'LEGACY' | 'PHYSICAL',
        ) => Promise<T>,
      ): Promise<T> =>
        db.$transaction((tx) => action(tx, 'PHYSICAL'), {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 15000,
        }),
    } as InventoryAuthorityTransactionService;
    const receipts = new PurchaseReceiptsService(
      db as PrismaService,
      equipment,
      authority,
      integration,
    );
    const dto = {
      purchaseId: purchase.id,
      supplierDocumentType: 'REMISION' as const,
      supplierDocumentNumber: '  REM-CI-0001  ',
      items: [{ purchaseItemId: purchase.items[0].id, quantityReceived: 2 }],
    };
    const requestKey = randomUUID();
    const created = await receipts.create(companyId, actorId, requestKey, dto);
    const persisted = await db.purchaseReceipt.findFirstOrThrow({
      where: { companyId, id: created.id },
      include: { items: true },
    });
    expect(persisted).toMatchObject({
      purchaseId: purchase.id,
      supplierDocumentType: 'REMISION',
      supplierDocumentNumber: 'REM-CI-0001',
    });
    expect(persisted.items).toHaveLength(1);
    expect(persisted.items[0].quantityReceived).toBe(2);

    const replay = await receipts.create(companyId, actorId, requestKey, {
      ...dto,
      supplierDocumentNumber: 'REM-CI-0001',
    });
    expect(replay.id).toBe(created.id);
    await expect(
      receipts.create(companyId, actorId, requestKey, {
        ...dto,
        supplierDocumentNumber: 'REM-CI-OTHER',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      await db.purchaseReceipt.count({
        where: { companyId, purchaseId: purchase.id },
      }),
    ).toBe(1);
    expect(
      await db.purchaseReceiptItem.count({
        where: { companyId, receiptId: created.id },
      }),
    ).toBe(1);
    expect(
      await db.inventoryPhysicalEffect.count({
        where: {
          companyId,
          originType: 'PURCHASE_RECEIPT',
          originId: created.id,
          originOperation: 'RECEIVE_QUANTITY',
        },
      }),
    ).toBe(1);
    expect(
      await db.inventoryPhysicalEffectLine.count({
        where: { companyId, effect: { originId: created.id } },
      }),
    ).toBe(1);
    expect(
      await db.inventoryMovement.count({
        where: {
          companyId,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: created.id,
        },
      }),
    ).toBe(1);
    expect(
      await db.inventoryPosition.aggregate({
        where: { companyId, productId, state: 'AVAILABLE' },
        _sum: { quantity: true },
      }),
    ).toMatchObject({ _sum: { quantity: 2 } });
    const updatedProduct = await db.product.findFirstOrThrow({
      where: { id: productId, companyId },
    });
    expect(updatedProduct.stock).toBe(2);
    expect(
      (
        await db.purchase.findFirstOrThrow({
          where: { id: purchase.id, companyId },
        })
      ).status,
    ).toBe('PARTIALLY_RECEIVED');
  }, 20000);
});
