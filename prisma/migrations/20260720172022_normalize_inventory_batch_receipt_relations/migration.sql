/*
  Warnings:

  - You are about to drop the column `purchaseId` on the `InventoryBatch` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseReceiptId` on the `InventoryBatch` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `InventoryBatch` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,productId,lotNumber]` on the table `InventoryBatch` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "InventoryBatch" DROP CONSTRAINT "InventoryBatch_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBatch" DROP CONSTRAINT "InventoryBatch_purchaseReceiptId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBatch" DROP CONSTRAINT "InventoryBatch_supplierId_fkey";

-- DropIndex
DROP INDEX "InventoryBatch_companyId_productId_lotNumber_idx";

-- DropIndex
DROP INDEX "InventoryBatch_purchaseId_idx";

-- DropIndex
DROP INDEX "InventoryBatch_supplierId_idx";

-- DropIndex
DROP INDEX "PurchaseReceiptItem_batchId_key";

-- AlterTable
ALTER TABLE "InventoryBatch" DROP COLUMN "purchaseId",
DROP COLUMN "purchaseReceiptId",
DROP COLUMN "supplierId";

-- AlterTable
ALTER TABLE "PurchaseReceiptItem" ALTER COLUMN "lotNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_companyId_productId_lotNumber_key" ON "InventoryBatch"("companyId", "productId", "lotNumber");
