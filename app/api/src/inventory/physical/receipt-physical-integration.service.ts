import { Injectable } from '@nestjs/common';
import { Prisma, PurchaseReceiptItem } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EquipmentProvisioningService } from '../../equipment/equipment-provisioning.service';
import { CreatePurchaseReceiptDto } from '../../purchases-receipts/dto/create-purchase-receipt.dto';
import { createPurchaseReceiptRequestHash } from '../../purchases-receipts/purchase-receipt-request-hash';
import { PhysicalInventoryRepository } from './physical-inventory.repository';
import { PhysicalInventoryService } from './physical-inventory.service';
import {
  InventoryCompatibilityProjectionService,
  requireTransaction,
} from './inventory-compatibility-projection.service';
import { InventoryCompatibilityHistoryService } from './inventory-compatibility-history.service';
import {
  MAX_PHYSICAL_QUANTITY,
  requirePhysical,
} from './physical-inventory.contract';

@Injectable()
export class ReceiptPhysicalIntegrationService {
  constructor(
    private readonly repository: PhysicalInventoryRepository,
    private readonly physical: PhysicalInventoryService,
    private readonly projections: InventoryCompatibilityProjectionService,
    private readonly history: InventoryCompatibilityHistoryService,
    private readonly equipment: EquipmentProvisioningService,
  ) {}

  // Internal only. DTO has passed the business boundary; tenant, pending quantity,
  // tracking and physical invariants are still revalidated inside this caller tx.
  async execute(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
    key: string,
    dto: CreatePurchaseReceiptDto,
  ) {
    requireTransaction(tx);
    requirePhysical(
      typeof key === 'string' &&
        key.trim().length > 0 &&
        key.trim().length <= 128,
    );
    key = key.trim();
    const actor = await tx.user.findFirst({
      where: { id: actorId, companyId, isActive: true },
    });
    requirePhysical(
      actor && ['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(actor.role),
      'INVENTORY_TENANT_MISMATCH',
    );
    const requestHash = createPurchaseReceiptRequestHash(dto);
    const scope = 'PURCHASE_RECEIPT_CREATE' as const;
    const old = await tx.idempotencyRecord.findUnique({
      where: { companyId_scope_key: { companyId, scope, key } },
    });
    if (old) {
      requirePhysical(
        old.requestHash === requestHash,
        'PHYSICAL_EFFECT_MISMATCH',
      );
      requirePhysical(old.resourceId, 'PHYSICAL_EFFECT_CLAIM_CONFLICT');
      return tx.purchaseReceipt.findFirstOrThrow({
        where: { id: old.resourceId, companyId },
        include: { items: true },
      });
    }
    const claim = await tx.idempotencyRecord.create({
      data: { companyId, scope, key, requestHash },
    });
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Purchase" WHERE id=${dto.purchaseId} AND "companyId"=${companyId} FOR UPDATE`,
    );
    const purchase = await tx.purchase.findFirst({
      where: { id: dto.purchaseId, companyId },
      include: { items: { include: { receiptItems: true, product: true } } },
    });
    requirePhysical(
      purchase && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(purchase.status),
    );
    requirePhysical(
      dto.items.length > 0 &&
        dto.items.length <= 1000 &&
        new Set(dto.items.map((i) => i.purchaseItemId)).size ===
          dto.items.length,
    );
    const now = new Date();
    const inputs = [...dto.items]
      .sort((a, b) => a.purchaseItemId.localeCompare(b.purchaseItemId))
      .map((input) => {
        const item = purchase.items.find((p) => p.id === input.purchaseItemId);
        requirePhysical(
          item && item.product.companyId === companyId,
          'INVENTORY_TENANT_MISMATCH',
        );
        requirePhysical(
          Number.isInteger(input.quantityReceived) &&
            input.quantityReceived > 0 &&
            input.quantityReceived <= MAX_PHYSICAL_QUANTITY,
        );
        requirePhysical(
          input.quantityReceived <=
            item.quantity -
              item.receiptItems.reduce((s, i) => s + i.quantityReceived, 0),
        );
        const lotNumber = input.lotNumber?.trim() || null;
        const expirationDate = input.expirationDate
          ? new Date(input.expirationDate)
          : null;
        requirePhysical(
          !expirationDate ||
            (lotNumber &&
              Number.isFinite(expirationDate.getTime()) &&
              expirationDate.toISOString().slice(0, 10) >=
                now.toISOString().slice(0, 10)),
        );
        return {
          item,
          quantity: input.quantityReceived,
          lotNumber,
          expirationDate,
        };
      });
    const prepared = new Map<string, string[]>();
    for (const input of inputs)
      if (input.item.product.inventoryTracking === 'ASSET') {
        prepared.set(
          input.item.id,
          await this.equipment.prepareReceiptCodes(
            tx,
            companyId,
            input.quantity,
          ),
        );
      }
    const productIds = [...new Set(inputs.map((i) => i.item.productId))].sort();
    const products = await this.repository.lockProducts(
      tx,
      companyId,
      productIds,
    );
    requirePhysical(products.length === productIds.length);
    for (const i of inputs) {
      const p = products.find((p) => p.id === i.item.productId)!;
      requirePhysical(p.inventoryTracking === i.item.product.inventoryTracking);
      requirePhysical(
        p.lotTracking !== 'NONE' || (!i.lotNumber && !i.expirationDate),
      );
      requirePhysical(p.lotTracking !== 'REQUIRED' || i.lotNumber);
    }
    const batchKeys = inputs
      .filter((i) => i.lotNumber)
      .map((i) => ({
        companyId,
        productId: i.item.productId,
        lotNumber: i.lotNumber!,
      }));
    const existing = batchKeys.length
      ? await tx.inventoryBatch.findMany({ where: { OR: batchKeys } })
      : [];
    await this.repository.lockBatches(
      tx,
      companyId,
      existing.map((b) => b.id).sort(),
    );
    const batches = new Map(
      existing.map((b) => [JSON.stringify([b.productId, b.lotNumber]), b]),
    );
    // Stable business item order; all existing Batch locks are already held.
    for (const i of inputs) {
      if (!i.lotNumber) continue;
      const identity = JSON.stringify([i.item.productId, i.lotNumber]);
      const oldBatch = batches.get(identity);
      if (oldBatch?.expirationDate && i.expirationDate)
        requirePhysical(
          oldBatch.expirationDate.getTime() === i.expirationDate.getTime(),
        );
      const total = (oldBatch?.initialQuantity ?? 0) + i.quantity;
      requirePhysical(
        total <= MAX_PHYSICAL_QUANTITY,
        'PHYSICAL_QUANTITY_LIMIT',
      );
      const cost =
        ((oldBatch?.initialQuantity ?? 0) * (oldBatch?.unitCost ?? 0) +
          i.quantity * i.item.price) /
        total;
      const quantityTracking = i.item.product.inventoryTracking === 'QUANTITY';
      const batch = oldBatch
        ? await tx.inventoryBatch.update({
            where: { id: oldBatch.id },
            data: {
              initialQuantity: total,
              unitCost: cost,
              expirationDate: oldBatch.expirationDate ?? i.expirationDate,
              isActive: true,
              ...(quantityTracking
                ? {}
                : { availableQuantity: { increment: i.quantity } }),
            },
          })
        : await tx.inventoryBatch.create({
            data: {
              companyId,
              productId: i.item.productId,
              lotNumber: i.lotNumber,
              initialQuantity: i.quantity,
              availableQuantity: quantityTracking ? 0 : i.quantity,
              unitCost: cost,
              expirationDate: i.expirationDate,
              receivedAt: now,
            },
          });
      batches.set(identity, batch);
    }
    const receipt = await tx.purchaseReceipt.create({
      data: {
        companyId,
        purchaseId: purchase.id,
        folio: `REC-${randomUUID()}`,
        receivedBy: actorId,
        receivedAt: now,
        notes: dto.notes?.trim() || null,
      },
    });
    const receiptItems: PurchaseReceiptItem[] = [];
    for (const i of inputs) {
      const batch = i.lotNumber
        ? batches.get(JSON.stringify([i.item.productId, i.lotNumber]))
        : undefined;
      receiptItems.push(
        await tx.purchaseReceiptItem.create({
          data: {
            companyId,
            receiptId: receipt.id,
            purchaseItemId: i.item.id,
            productId: i.item.productId,
            quantityReceived: i.quantity,
            unitCost: i.item.price,
            batchId: batch?.id,
            lotNumber: i.lotNumber,
            expirationDate: i.expirationDate,
          },
        }),
      );
    }
    const quantityItems = receiptItems.filter(
      (i) =>
        products.find((p) => p.id === i.productId)!.inventoryTracking ===
        'QUANTITY',
    );
    if (quantityItems.length) {
      const result = await this.physical.creditAvailable(
        tx,
        {
          companyId,
          actorId,
          origin: {
            type: 'PURCHASE_RECEIPT',
            id: receipt.id,
            operation: 'RECEIVE_QUANTITY',
          },
        },
        quantityItems.map((i) => ({
          target: {
            productId: i.productId,
            inventoryBatchId: i.batchId,
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
          },
          quantity: i.quantityReceived,
        })),
      );
      requirePhysical(!result.replay);
      await this.projections.apply(tx, companyId, result);
      await this.history.write(tx, result, quantityItems);
    }
    for (const i of receiptItems) {
      const tracking = products.find(
        (p) => p.id === i.productId,
      )!.inventoryTracking;
      if (tracking === 'QUANTITY') continue;
      if (tracking === 'ASSET')
        await this.equipment.provisionFromPurchaseReceiptItem(
          tx,
          companyId,
          i.id,
          actorId,
          prepared.get(i.purchaseItemId),
        );
      const update = await tx.product.updateMany({
        where: {
          id: i.productId,
          companyId,
          stock: { lte: MAX_PHYSICAL_QUANTITY - i.quantityReceived },
        },
        data: { stock: { increment: i.quantityReceived } },
      });
      requirePhysical(update.count === 1, 'PHYSICAL_QUANTITY_LIMIT');
      const product = await tx.product.findUniqueOrThrow({
        where: { id: i.productId },
      });
      await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: i.productId,
          batchId: i.batchId,
          movementType: 'IN',
          quantity: i.quantityReceived,
          balance: product.stock,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receipt.id,
          createdBy: actorId,
          unitCost: i.unitCost,
        },
      });
    }
    const full = purchase.items.every(
      (i) =>
        i.receiptItems.reduce((s, r) => s + r.quantityReceived, 0) +
          (inputs.find((r) => r.item.id === i.id)?.quantity ?? 0) >=
        i.quantity,
    );
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: full ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
    });
    await tx.idempotencyRecord.update({
      where: { id: claim.id },
      data: { resourceId: receipt.id },
    });
    return { ...receipt, items: receiptItems };
  }
}
