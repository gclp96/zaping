-- Dormant control foundation. Schema only; no seeds, opening or activation.
BEGIN;
-- CreateEnum
CREATE TYPE "InventoryCutoverStatus" AS ENUM ('PRECHECK', 'WRITERS_FROZEN', 'DRY_RUN_REVIEWED', 'OPENING_APPLYING', 'OPENING_APPLIED', 'VERIFIED', 'PHYSICAL_ACTIVE', 'RECOVERY_REQUIRED');

-- CreateEnum
CREATE TYPE "InventoryCutoverProductStatus" AS ENUM ('PLANNED', 'APPLIED', 'VERIFIED');

-- CreateTable
CREATE TABLE "InventoryCutover" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "InventoryCutoverStatus" NOT NULL DEFAULT 'PRECHECK',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "manifestDigest" CHAR(64),
    "snapshotFingerprint" CHAR(64),
    "baselineBuild" VARCHAR(128),
    "manifestLockedAt" TIMESTAMP(3),
    "recoveryFromStatus" "InventoryCutoverStatus",
    "initiatedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "activatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCutover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCutoverProduct" (
    "cutoverId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "manifestProductFingerprint" CHAR(64) NOT NULL,
    "status" "InventoryCutoverProductStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedOwned" INTEGER NOT NULL,
    "expectedAvailable" INTEGER NOT NULL,
    "expectedCustody" INTEGER NOT NULL,
    "projectionEvidence" JSONB NOT NULL,
    "openingEffectId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCutoverProduct_pkey" PRIMARY KEY ("cutoverId","productId")
);

-- CreateTable
CREATE TABLE "InventoryCutoverLegacySale" (
    "cutoverId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleFingerprint" CHAR(64) NOT NULL,
    "quoteId" TEXT,
    "statusAtFreeze" "DocumentStatus" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCutoverLegacySale_pkey" PRIMARY KEY ("cutoverId","saleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCutover_companyId_key" ON "InventoryCutover"("companyId");

-- CreateIndex
CREATE INDEX "InventoryCutover_initiatedBy_companyId_idx" ON "InventoryCutover"("initiatedBy", "companyId");

-- CreateIndex
CREATE INDEX "InventoryCutover_approvedBy_companyId_idx" ON "InventoryCutover"("approvedBy", "companyId");

-- CreateIndex
CREATE INDEX "InventoryCutover_activatedBy_companyId_idx" ON "InventoryCutover"("activatedBy", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCutover_id_companyId_key" ON "InventoryCutover"("id", "companyId");

-- CreateIndex
CREATE INDEX "InventoryCutoverProduct_companyId_productId_idx" ON "InventoryCutoverProduct"("companyId", "productId");

-- CreateIndex
CREATE INDEX "InventoryCutoverProduct_companyId_cutoverId_status_idx" ON "InventoryCutoverProduct"("companyId", "cutoverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCutoverProduct_openingEffectId_companyId_key" ON "InventoryCutoverProduct"("openingEffectId", "companyId");

-- CreateIndex
CREATE INDEX "InventoryCutoverLegacySale_companyId_saleId_idx" ON "InventoryCutoverLegacySale"("companyId", "saleId");

-- CreateIndex
CREATE INDEX "InventoryCutoverLegacySale_quoteId_companyId_idx" ON "InventoryCutoverLegacySale"("quoteId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_id_companyId_key" ON "Quote"("id", "companyId");

-- AddForeignKey
ALTER TABLE "InventoryCutover" ADD CONSTRAINT "InventoryCutover_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutover" ADD CONSTRAINT "InventoryCutover_initiatedBy_companyId_fkey" FOREIGN KEY ("initiatedBy", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutover" ADD CONSTRAINT "InventoryCutover_approvedBy_companyId_fkey" FOREIGN KEY ("approvedBy", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutover" ADD CONSTRAINT "InventoryCutover_activatedBy_companyId_fkey" FOREIGN KEY ("activatedBy", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutoverProduct" ADD CONSTRAINT "InventoryCutoverProduct_cutoverId_companyId_fkey" FOREIGN KEY ("cutoverId", "companyId") REFERENCES "InventoryCutover"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutoverProduct" ADD CONSTRAINT "InventoryCutoverProduct_productId_companyId_fkey" FOREIGN KEY ("productId", "companyId") REFERENCES "Product"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutoverProduct" ADD CONSTRAINT "InventoryCutoverProduct_openingEffectId_companyId_fkey" FOREIGN KEY ("openingEffectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutoverLegacySale" ADD CONSTRAINT "InventoryCutoverLegacySale_cutoverId_companyId_fkey" FOREIGN KEY ("cutoverId", "companyId") REFERENCES "InventoryCutover"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutoverLegacySale" ADD CONSTRAINT "InventoryCutoverLegacySale_saleId_companyId_fkey" FOREIGN KEY ("saleId", "companyId") REFERENCES "Sale"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryCutoverLegacySale" ADD CONSTRAINT "InventoryCutoverLegacySale_quoteId_companyId_fkey" FOREIGN KEY ("quoteId", "companyId") REFERENCES "Quote"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Structural invariants only. Lifecycle/immutability belongs to narrow caller-owned transactions.
ALTER TABLE "InventoryCutover" ADD CONSTRAINT "cutover_control_check" CHECK (
 revision >= 0
 AND (("manifestDigest" IS NULL AND "snapshotFingerprint" IS NULL AND "baselineBuild" IS NULL)
   OR ("manifestDigest" IS NOT NULL AND "manifestDigest" ~ '^[0-9a-f]{64}$'
    AND "snapshotFingerprint" IS NOT NULL AND "snapshotFingerprint" ~ '^[0-9a-f]{64}$'
    AND "baselineBuild" IS NOT NULL AND length(btrim("baselineBuild")) > 0))
 AND ((status='RECOVERY_REQUIRED' AND "recoveryFromStatus" IS NOT NULL AND "recoveryFromStatus" <> 'RECOVERY_REQUIRED')
   OR (status<>'RECOVERY_REQUIRED' AND "recoveryFromStatus" IS NULL))
 AND (("activatedBy" IS NULL) = ("activatedAt" IS NULL))
 AND (COALESCE("recoveryFromStatus", status) NOT IN ('DRY_RUN_REVIEWED','OPENING_APPLYING','OPENING_APPLIED','VERIFIED','PHYSICAL_ACTIVE')
   OR ("manifestDigest" IS NOT NULL AND "approvedBy" IS NOT NULL))
 AND (COALESCE("recoveryFromStatus", status) NOT IN ('OPENING_APPLYING','OPENING_APPLIED','VERIFIED','PHYSICAL_ACTIVE')
   OR "manifestLockedAt" IS NOT NULL)
 AND (COALESCE("recoveryFromStatus", status) <> 'PHYSICAL_ACTIVE' OR "activatedBy" IS NOT NULL)
 AND ("manifestLockedAt" IS NULL OR ("manifestDigest" IS NOT NULL AND "approvedBy" IS NOT NULL))
 AND (COALESCE("recoveryFromStatus", status) IN ('OPENING_APPLYING','OPENING_APPLIED','VERIFIED','PHYSICAL_ACTIVE') OR "manifestLockedAt" IS NULL)
 AND (COALESCE("recoveryFromStatus", status)='PHYSICAL_ACTIVE' OR "activatedBy" IS NULL)
);
ALTER TABLE "InventoryCutoverProduct" ADD CONSTRAINT "cutover_product_check" CHECK (
 "manifestProductFingerprint" ~ '^[0-9a-f]{64}$'
 AND "expectedOwned" >= 0 AND "expectedAvailable" >= 0 AND "expectedCustody" >= 0
 AND "expectedCustody" <= "expectedOwned"
 AND "expectedAvailable" <= "expectedOwned" - "expectedCustody"
 AND jsonb_typeof("projectionEvidence")='object'
 AND ((status='PLANNED' AND "openingEffectId" IS NULL AND "appliedAt" IS NULL AND "verifiedAt" IS NULL)
   OR (status IN ('APPLIED','VERIFIED') AND "appliedAt" IS NOT NULL
     AND (("expectedOwned"=0 AND "openingEffectId" IS NULL) OR ("expectedOwned">0 AND "openingEffectId" IS NOT NULL))
     AND ((status='APPLIED' AND "verifiedAt" IS NULL) OR (status='VERIFIED' AND "verifiedAt" IS NOT NULL))))
);
ALTER TABLE "InventoryCutoverLegacySale" ADD CONSTRAINT "cutover_legacy_sale_check" CHECK (
 "saleFingerprint" ~ '^[0-9a-f]{64}$' AND "statusAtFreeze"='CONFIRMED'
);
COMMIT;
