-- CreateEnum
CREATE TYPE "ProductInventoryTracking" AS ENUM ('QUANTITY', 'SERIALIZED', 'ASSET');

-- CreateEnum
CREATE TYPE "ProductLotTracking" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "EquipmentLifecycle" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('GOOD', 'INSPECTION_PENDING', 'DAMAGED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "EquipmentOrigin" AS ENUM ('MANUAL', 'PURCHASE_RECEIPT', 'IMPORT', 'INITIAL_MIGRATION');

-- CreateEnum
CREATE TYPE "EquipmentRetirementReason" AS ENUM ('SOLD', 'LOST', 'DESTROYED', 'END_OF_LIFE', 'REPLACED', 'OTHER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "inventoryTracking" "ProductInventoryTracking" NOT NULL DEFAULT 'QUANTITY',
ADD COLUMN     "lotTracking" "ProductLotTracking" NOT NULL DEFAULT 'OPTIONAL';

-- CreateTable
CREATE TABLE "CompanySequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "serialNumberKey" TEXT,
    "lifecycle" "EquipmentLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "condition" "EquipmentCondition" NOT NULL,
    "origin" "EquipmentOrigin" NOT NULL DEFAULT 'MANUAL',
    "batchId" TEXT,
    "purchaseReceiptItemId" TEXT,
    "retiredAt" TIMESTAMP(3),
    "retiredById" TEXT,
    "retiredReason" "EquipmentRetirementReason",
    "retirementNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentAssetId" TEXT NOT NULL,
    "conditionBefore" "EquipmentCondition" NOT NULL,
    "conditionAfter" "EquipmentCondition" NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySequence_companyId_key_key" ON "CompanySequence"("companyId", "key");

-- CreateIndex
CREATE INDEX "EquipmentAsset_companyId_productId_idx" ON "EquipmentAsset"("companyId", "productId");

-- CreateIndex
CREATE INDEX "EquipmentAsset_companyId_serialNumberKey_idx" ON "EquipmentAsset"("companyId", "serialNumberKey");

-- CreateIndex
CREATE INDEX "EquipmentAsset_companyId_lifecycle_idx" ON "EquipmentAsset"("companyId", "lifecycle");

-- CreateIndex
CREATE INDEX "EquipmentAsset_companyId_condition_idx" ON "EquipmentAsset"("companyId", "condition");

-- CreateIndex
CREATE INDEX "EquipmentAsset_batchId_idx" ON "EquipmentAsset"("batchId");

-- CreateIndex
CREATE INDEX "EquipmentAsset_purchaseReceiptItemId_idx" ON "EquipmentAsset"("purchaseReceiptItemId");

-- CreateIndex
CREATE INDEX "EquipmentAsset_retiredById_idx" ON "EquipmentAsset"("retiredById");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_id_companyId_key" ON "EquipmentAsset"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_companyId_assetCode_key" ON "EquipmentAsset"("companyId", "assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_companyId_productId_serialNumberKey_key" ON "EquipmentAsset"("companyId", "productId", "serialNumberKey");

-- CreateIndex
CREATE INDEX "EquipmentInspection_companyId_equipmentAssetId_idx" ON "EquipmentInspection"("companyId", "equipmentAssetId");

-- CreateIndex
CREATE INDEX "EquipmentInspection_equipmentAssetId_inspectedAt_idx" ON "EquipmentInspection"("equipmentAssetId", "inspectedAt");

-- CreateIndex
CREATE INDEX "EquipmentInspection_companyId_conditionAfter_idx" ON "EquipmentInspection"("companyId", "conditionAfter");

-- CreateIndex
CREATE INDEX "EquipmentInspection_inspectedById_idx" ON "EquipmentInspection"("inspectedById");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentInspection_id_companyId_key" ON "EquipmentInspection"("id", "companyId");

-- AddForeignKey
ALTER TABLE "CompanySequence" ADD CONSTRAINT "CompanySequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_purchaseReceiptItemId_fkey" FOREIGN KEY ("purchaseReceiptItemId") REFERENCES "PurchaseReceiptItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_retiredById_fkey" FOREIGN KEY ("retiredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspection" ADD CONSTRAINT "EquipmentInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspection" ADD CONSTRAINT "EquipmentInspection_equipmentAssetId_fkey" FOREIGN KEY ("equipmentAssetId") REFERENCES "EquipmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspection" ADD CONSTRAINT "EquipmentInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
