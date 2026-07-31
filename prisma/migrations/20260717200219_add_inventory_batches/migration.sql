/*
  Warnings:

  - You are about to drop the column `type` on the `InventoryMovement` table. All the data in the column will be lost.
  - The `status` column on the `Purchase` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[companyId,folio]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `movementType` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" DROP COLUMN "type",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "movementType" "InventoryMovementType" NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT;

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseId" TEXT,
    "lotNumber" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "initialQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBatch_companyId_idx" ON "InventoryBatch"("companyId");

-- CreateIndex
CREATE INDEX "InventoryBatch_productId_idx" ON "InventoryBatch"("productId");

-- CreateIndex
CREATE INDEX "InventoryBatch_supplierId_idx" ON "InventoryBatch"("supplierId");

-- CreateIndex
CREATE INDEX "InventoryBatch_purchaseId_idx" ON "InventoryBatch"("purchaseId");

-- CreateIndex
CREATE INDEX "InventoryBatch_companyId_productId_lotNumber_idx" ON "InventoryBatch"("companyId", "productId", "lotNumber");

-- CreateIndex
CREATE INDEX "InventoryBatch_expirationDate_idx" ON "InventoryBatch"("expirationDate");

-- CreateIndex
CREATE INDEX "InventoryBatch_isActive_idx" ON "InventoryBatch"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_id_companyId_key" ON "InventoryBatch"("id", "companyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_companyId_idx" ON "InventoryMovement"("companyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_batchId_idx" ON "InventoryMovement"("batchId");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_companyId_folio_key" ON "Sale"("companyId", "folio");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
