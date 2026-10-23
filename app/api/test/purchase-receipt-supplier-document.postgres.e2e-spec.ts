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

const enabled = process.env.RUN_PURCHASE_RECEIPT_PG_SMOKE === '1';
const describePg = enabled ? describe : describe.skip;

describePg('INSAP-AUTO-01A supplier document PHYSICAL PostgreSQL smoke', () => {
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
