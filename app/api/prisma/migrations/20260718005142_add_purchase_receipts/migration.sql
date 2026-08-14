/*
  Warnings:

  - The `status` column on the `Purchase` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "InventoryBatch" ADD COLUMN     "purchaseReceiptId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "status",
ADD COLUMN     "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "unitCost" DOUBLE PRECISION NOT NULL,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_idx" ON "PurchaseReceipt"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_purchaseId_idx" ON "PurchaseReceipt"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_receivedAt_idx" ON "PurchaseReceipt"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_companyId_folio_key" ON "PurchaseReceipt"("companyId", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceiptItem_batchId_key" ON "PurchaseReceiptItem"("batchId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_companyId_idx" ON "PurchaseReceiptItem"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_receiptId_idx" ON "PurchaseReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_purchaseItemId_idx" ON "PurchaseReceiptItem"("purchaseItemId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_productId_idx" ON "PurchaseReceiptItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_lotNumber_idx" ON "PurchaseReceiptItem"("lotNumber");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_expirationDate_idx" ON "PurchaseReceiptItem"("expirationDate");

-- CreateIndex
CREATE INDEX "Purchase_companyId_idx" ON "Purchase"("companyId");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
