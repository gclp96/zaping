-- AlterEnum
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_KIT_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_KIT_ITEM_ADD';

-- CreateEnum
CREATE TYPE "HealthcareCaseKitStatus" AS ENUM ('DRAFT');

-- CreateTable
CREATE TABLE "HealthcareCaseKit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "HealthcareCaseKitStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthcareCaseKit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthcareCaseKitItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseKitId" TEXT NOT NULL,
    "requirementId" TEXT,
    "equipmentAssignmentId" TEXT,
    "preparedQuantity" INTEGER,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthcareCaseKitItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthcareEquipmentAssignment_id_companyId_caseId_key" ON "HealthcareEquipmentAssignment"("id", "companyId", "caseId");
CREATE UNIQUE INDEX "HealthcareCaseKit_id_companyId_key" ON "HealthcareCaseKit"("id", "companyId");
CREATE UNIQUE INDEX "HealthcareCaseKit_id_companyId_caseId_key" ON "HealthcareCaseKit"("id", "companyId", "caseId");
CREATE UNIQUE INDEX "HealthcareCaseKit_companyId_caseId_key" ON "HealthcareCaseKit"("companyId", "caseId");
CREATE INDEX "HealthcareCaseKit_companyId_status_updatedAt_idx" ON "HealthcareCaseKit"("companyId", "status", "updatedAt");
CREATE UNIQUE INDEX "HealthcareCaseKitItem_id_companyId_key" ON "HealthcareCaseKitItem"("id", "companyId");
CREATE INDEX "HealthcareCaseKitItem_companyId_caseKitId_idx" ON "HealthcareCaseKitItem"("companyId", "caseKitId");
CREATE INDEX "HealthcareCaseKitItem_companyId_caseId_idx" ON "HealthcareCaseKitItem"("companyId", "caseId");
CREATE UNIQUE INDEX "HealthcareCaseKitItem_requirement_source_key" ON "HealthcareCaseKitItem"("companyId", "caseKitId", "requirementId") WHERE "requirementId" IS NOT NULL;
CREATE UNIQUE INDEX "HealthcareCaseKitItem_assignment_source_key" ON "HealthcareCaseKitItem"("companyId", "caseKitId", "equipmentAssignmentId") WHERE "equipmentAssignmentId" IS NOT NULL;

ALTER TABLE "HealthcareCaseKitItem" ADD CONSTRAINT "HealthcareCaseKitItem_source_shape_check" CHECK (
  ("requirementId" IS NOT NULL AND "equipmentAssignmentId" IS NULL AND "preparedQuantity" > 0)
  OR
  ("requirementId" IS NULL AND "equipmentAssignmentId" IS NOT NULL AND "preparedQuantity" IS NULL)
);

ALTER TABLE "HealthcareCaseKit" ADD CONSTRAINT "HealthcareCaseKit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthcareCaseKit" ADD CONSTRAINT "HealthcareCaseKit_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthcareCaseKit" ADD CONSTRAINT "HealthcareCaseKit_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthcareCaseKitItem" ADD CONSTRAINT "HealthcareCaseKitItem_caseKitId_companyId_caseId_fkey" FOREIGN KEY ("caseKitId", "companyId", "caseId") REFERENCES "HealthcareCaseKit"("id", "companyId", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthcareCaseKitItem" ADD CONSTRAINT "HealthcareCaseKitItem_requirementId_companyId_caseId_fkey" FOREIGN KEY ("requirementId", "companyId", "caseId") REFERENCES "HealthcareCaseRequirement"("id", "companyId", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthcareCaseKitItem" ADD CONSTRAINT "HealthcareCaseKitItem_equipmentAssignment_case_fkey" FOREIGN KEY ("equipmentAssignmentId", "companyId", "caseId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthcareCaseKitItem" ADD CONSTRAINT "HealthcareCaseKitItem_addedById_companyId_fkey" FOREIGN KEY ("addedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
