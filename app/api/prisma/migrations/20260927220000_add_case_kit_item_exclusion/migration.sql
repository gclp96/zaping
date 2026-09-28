-- AlterEnum
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_KIT_ITEM_EXCLUDE';

-- CreateEnum
CREATE TYPE "HealthcareCaseKitItemLifecycle" AS ENUM ('ACTIVE', 'EXCLUDED');

-- AlterTable
ALTER TABLE "HealthcareCaseKitItem"
ADD COLUMN "lifecycle" "HealthcareCaseKitItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "excludedById" TEXT,
ADD COLUMN "excludedAt" TIMESTAMP(3),
ADD COLUMN "exclusionReason" TEXT;

-- Replace source uniqueness with ACTIVE-only uniqueness
DROP INDEX "HealthcareCaseKitItem_requirement_source_key";
DROP INDEX "HealthcareCaseKitItem_assignment_source_key";

CREATE UNIQUE INDEX "HealthcareCaseKitItem_requirement_source_key"
ON "HealthcareCaseKitItem"("companyId", "caseKitId", "requirementId")
WHERE "requirementId" IS NOT NULL AND "lifecycle" = 'ACTIVE';

CREATE UNIQUE INDEX "HealthcareCaseKitItem_assignment_source_key"
ON "HealthcareCaseKitItem"("companyId", "caseKitId", "equipmentAssignmentId")
WHERE "equipmentAssignmentId" IS NOT NULL AND "lifecycle" = 'ACTIVE';

-- Lookup indexes
CREATE INDEX "HealthcareCaseKitItem_companyId_caseKitId_lifecycle_createdAt_idx"
ON "HealthcareCaseKitItem"("companyId", "caseKitId", "lifecycle", "createdAt");

CREATE INDEX "HealthcareCaseKitItem_companyId_excludedById_idx"
ON "HealthcareCaseKitItem"("companyId", "excludedById");

-- Audit integrity
ALTER TABLE "HealthcareCaseKitItem"
ADD CONSTRAINT "HealthcareCaseKitItem_exclusion_audit_check" CHECK (
  (
    "lifecycle" = 'ACTIVE'
    AND "excludedById" IS NULL
    AND "excludedAt" IS NULL
    AND "exclusionReason" IS NULL
  )
  OR
  (
    "lifecycle" = 'EXCLUDED'
    AND "excludedById" IS NOT NULL
    AND "excludedAt" IS NOT NULL
    AND "exclusionReason" IS NOT NULL
    AND char_length(btrim("exclusionReason")) BETWEEN 1 AND 1000
  )
);

ALTER TABLE "HealthcareCaseKitItem"
ADD CONSTRAINT "HealthcareCaseKitItem_excludedById_companyId_fkey"
FOREIGN KEY ("excludedById", "companyId") REFERENCES "User"("id", "companyId")
ON DELETE RESTRICT ON UPDATE CASCADE;
