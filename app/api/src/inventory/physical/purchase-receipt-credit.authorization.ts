import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { CreatePurchaseReceiptDto } from '../../purchases-receipts/dto/create-purchase-receipt.dto';
import { createPurchaseReceiptRequestHash } from '../../purchases-receipts/purchase-receipt-request-hash';
import { requireTransaction } from './inventory-compatibility-projection.service';
import {
  normalizePhysicalRequest,
  PhysicalRequest,
  requirePhysical,
} from './physical-inventory.contract';
import { storedExpirationDay } from './physical-expiration-policy';

export type PurchaseReceiptCreditInput = {
  companyId: string;
  actorId: string;
  receiptId: string;
  idempotencyKey: string;
};
export type PurchaseReceiptCreditContext = { request: PhysicalRequest };

// Only PhysicalInventoryService consumes this context, never a request-supplied
// flag/hash/date. The receipt orchestration has already acquired Purchase first;
// the following Purchase lock is reentrant there, before any new Physical roots.
export async function authorizePurchaseReceiptCredit(
  tx: Prisma.TransactionClient,
  input: PurchaseReceiptCreditInput,
): Promise<PurchaseReceiptCreditContext> {
  requireTransaction(tx);
  requirePhysical(
    isUUID(input.companyId) &&
      isUUID(input.actorId) &&
      isUUID(input.receiptId) &&
      typeof input.idempotencyKey === 'string' &&
      input.idempotencyKey.trim().length > 0 &&
      input.idempotencyKey.trim().length <= 128,
  );
  const actor = await tx.user.findFirst({
    where: { id: input.actorId, companyId: input.companyId, isActive: true },
  });
  requirePhysical(
    actor && ['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(actor.role),
    'INVENTORY_TENANT_MISMATCH',
  );
  // xmin is a row-version XID. Require current-transaction versions of root,
  // claim and items; committed receipts cannot be reused as new credit permits.
  // Compare using PostgreSQL's xid8 -> xid cast, matching xmin's 32-bit type.
  const [proof] = await tx.$queryRaw<
    { purchaseId: string; current: boolean }[]
  >(Prisma.sql`
    SELECT r."purchaseId", r.xmin=pg_current_xact_id()::xid
      AND c.xmin=pg_current_xact_id()::xid
      AND EXISTS (SELECT 1 FROM "PurchaseReceiptItem" i WHERE i."receiptId"=r.id AND i."companyId"=r."companyId")
      AND NOT EXISTS (SELECT 1 FROM "PurchaseReceiptItem" i WHERE i."receiptId"=r.id AND (i."companyId"<>r."companyId" OR i.xmin<>pg_current_xact_id()::xid)) AS current
    FROM "PurchaseReceipt" r JOIN "IdempotencyRecord" c
      ON c."companyId"=r."companyId" AND c."resourceId"=r.id
      AND c.scope='PURCHASE_RECEIPT_CREATE' AND c.key=${input.idempotencyKey.trim()}
    WHERE r.id=${input.receiptId} AND r."companyId"=${input.companyId}
  `);
  requirePhysical(proof?.current, 'PHYSICAL_EFFECT_MISMATCH');
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Purchase" WHERE id=${proof.purchaseId} AND "companyId"=${input.companyId} FOR UPDATE`,
  );
  const receipt = await tx.purchaseReceipt.findFirst({
    where: { id: input.receiptId, companyId: input.companyId },
    include: {
      items: { include: { product: true, purchaseItem: true, batch: true } },
      purchase: { include: { items: { include: { receiptItems: true } } } },
    },
  });
  requirePhysical(
    receipt &&
      receipt.receivedBy === input.actorId &&
      receipt.purchaseId === proof.purchaseId &&
      receipt.purchase.companyId === input.companyId &&
      ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(receipt.purchase.status),
    'PHYSICAL_EFFECT_MISMATCH',
  );
  requirePhysical(
    receipt.items.length > 0 &&
      new Set(receipt.items.map((i) => i.purchaseItemId)).size ===
        receipt.items.length,
    'PHYSICAL_EFFECT_MISMATCH',
  );
  for (const item of receipt.items) {
    const ordered = receipt.purchase.items.find(
      (i) => i.id === item.purchaseItemId,
    );
    requirePhysical(
      ordered &&
        item.companyId === input.companyId &&
        item.product.companyId === input.companyId &&
        item.productId === ordered.productId &&
        item.purchaseItem.purchaseId === receipt.purchaseId &&
        item.unitCost === ordered.price &&
        Number.isInteger(item.quantityReceived) &&
        item.quantityReceived > 0 &&
        ordered.receiptItems.reduce((sum, i) => sum + i.quantityReceived, 0) <=
          ordered.quantity,
      'PHYSICAL_EFFECT_MISMATCH',
    );
    requirePhysical(
      item.batchId === null
        ? item.lotNumber === null
        : item.batch &&
            item.batch.companyId === input.companyId &&
            item.batch.productId === item.productId &&
            item.batch.lotNumber === item.lotNumber &&
            (!item.expirationDate ||
              item.batch.expirationDate?.getTime() ===
                item.expirationDate.getTime()),
      'PHYSICAL_EFFECT_MISMATCH',
    );
  }
  const documentType = receipt.supplierDocumentType;
  requirePhysical(
    documentType === null ||
      ['FACTURA', 'REMISION', 'NOTA_ENTREGA'].includes(documentType),
    'PHYSICAL_EFFECT_MISMATCH',
  );
  requirePhysical(
    Boolean(documentType) === Boolean(receipt.supplierDocumentNumber?.trim()),
    'PHYSICAL_EFFECT_MISMATCH',
  );
  const dto: CreatePurchaseReceiptDto = {
    purchaseId: receipt.purchaseId,
    notes: receipt.notes ?? undefined,
    supplierDocumentType: (documentType ??
      undefined) as CreatePurchaseReceiptDto['supplierDocumentType'],
    supplierDocumentNumber: receipt.supplierDocumentNumber ?? undefined,
    items: receipt.items.map((i) => ({
      purchaseItemId: i.purchaseItemId,
      quantityReceived: i.quantityReceived,
      lotNumber: i.lotNumber ?? undefined,
      expirationDate: i.expirationDate?.toISOString(),
    })),
  };
  const claim = await tx.idempotencyRecord.findUnique({
    where: {
      companyId_scope_key: {
        companyId: input.companyId,
        scope: 'PURCHASE_RECEIPT_CREATE',
        key: input.idempotencyKey.trim(),
      },
    },
  });
  requirePhysical(
    claim &&
      claim.resourceId === receipt.id &&
      claim.requestHash === createPurchaseReceiptRequestHash(dto),
    'PHYSICAL_EFFECT_MISMATCH',
  );
  requirePhysical(
    (await tx.inventoryMovement.count({
      where: {
        companyId: input.companyId,
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: receipt.id,
      },
    })) === 0,
    'PHYSICAL_EFFECT_MISMATCH',
  );
  const quantityItems = receipt.items.filter(
    (i) => i.product.inventoryTracking === 'QUANTITY',
  );
  requirePhysical(quantityItems.length > 0, 'PHYSICAL_EFFECT_MISMATCH');
  return {
    request: normalizePhysicalRequest({
      companyId: input.companyId,
      actorId: input.actorId,
      origin: {
        type: 'PURCHASE_RECEIPT',
        id: receipt.id,
        operation: 'RECEIVE_QUANTITY',
      },
      operation: {
        kind: 'CREDIT',
        credits: quantityItems.map((i) => ({
          target: {
            productId: i.productId,
            inventoryBatchId: i.batchId,
            state: 'AVAILABLE',
            contextType: null,
            contextId: null,
            ...(i.batchId === null && i.expirationDate
              ? { expirationDate: storedExpirationDay(i.expirationDate) }
              : {}),
          },
          quantity: i.quantityReceived,
        })),
      },
    }),
  };
}
