/*
  Warnings:

  - A unique constraint covering the columns `[id,companyId]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,saleId]` on the table `SaleItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnItemCondition" AS ENUM ('SELLABLE', 'DAMAGED', 'EXPIRED', 'OPENED', 'OTHER');

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "returnedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AddCheckConstraint
ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_returnedQuantity_check"
CHECK (
  "returnedQuantity" >= 0
  AND "returnedQuantity" <= "quantity"
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "cancelledById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" "ReturnItemCondition" NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleReturn_companyId_saleId_idx" ON "SaleReturn"("companyId", "saleId");

-- CreateIndex
CREATE INDEX "SaleReturn_companyId_status_idx" ON "SaleReturn"("companyId", "status");

-- CreateIndex
CREATE INDEX "SaleReturn_companyId_createdAt_idx" ON "SaleReturn"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleReturn_createdById_idx" ON "SaleReturn"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_companyId_folio_key" ON "SaleReturn"("companyId", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_id_companyId_saleId_key" ON "SaleReturn"("id", "companyId", "saleId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_companyId_saleReturnId_idx" ON "SaleReturnItem"("companyId", "saleReturnId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleId_idx" ON "SaleReturnItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_condition_idx" ON "SaleReturnItem"("condition");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturnItem_saleReturnId_saleItemId_key" ON "SaleReturnItem"("saleReturnId", "saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_id_companyId_key" ON "Sale"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_id_saleId_key" ON "SaleItem"("id", "saleId");

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_companyId_fkey" FOREIGN KEY ("saleId", "companyId") REFERENCES "Sale"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleReturnId_companyId_saleId_fkey" FOREIGN KEY ("saleReturnId", "companyId", "saleId") REFERENCES "SaleReturn"("id", "companyId", "saleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_saleId_fkey" FOREIGN KEY ("saleItemId", "saleId") REFERENCES "SaleItem"("id", "saleId") ON DELETE RESTRICT ON UPDATE CASCADE;
