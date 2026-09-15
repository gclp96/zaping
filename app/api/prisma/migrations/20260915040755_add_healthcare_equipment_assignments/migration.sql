-- AlterEnum
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_REPLACE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_RELEASE';

-- CreateEnum
CREATE TYPE "HealthcareEquipmentAssignmentOrigin" AS ENUM ('REQUIREMENT', 'DIRECT');

-- CreateEnum
CREATE TYPE "HealthcareEquipmentAssignmentLifecycle" AS ENUM ('RESERVED', 'RELEASED', 'REPLACED');

-- CreateEnum
CREATE TYPE "HealthcareEquipmentAssignmentReleaseCause" AS ENUM ('MANUAL', 'CASE_CANCELLED', 'REQUIREMENT_WITHDRAWN');

-- CreateEnum
CREATE TYPE "HealthcareEquipmentRequirementCoverageNoteKind" AS ENUM ('UNAVAILABLE', 'PARTIAL_CONTEXT');

-- CreateTable
CREATE TABLE "HealthcareEquipmentAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "equipmentAssetId" TEXT NOT NULL,
    "requirementId" TEXT,
    "origin" "HealthcareEquipmentAssignmentOrigin" NOT NULL,
    "lifecycle" "HealthcareEquipmentAssignmentLifecycle" NOT NULL DEFAULT 'RESERVED',
    "replacesAssignmentId" TEXT,
    "directAssignmentReason" TEXT,
    "createdById" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releaseCause" "HealthcareEquipmentAssignmentReleaseCause",
    "releaseReason" TEXT,
    "replacedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "replacementReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareEquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareEquipmentAssignmentConflictOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "conflictingAssignmentId" TEXT NOT NULL,
    "assignmentWindowStart" TIMESTAMP(3) NOT NULL,
    "assignmentWindowEnd" TIMESTAMP(3) NOT NULL,
    "conflictingWindowStart" TIMESTAMP(3) NOT NULL,
    "conflictingWindowEnd" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareEquipmentRequirementCoverageNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "kind" "HealthcareEquipmentRequirementCoverageNoteKind" NOT NULL,
    "comment" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareEquipmentAssignmentSettings" (
    "companyId" TEXT NOT NULL,
    "preCaseBufferMinutes" INTEGER NOT NULL,
    "postCaseBufferMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareEquipmentAssignmentSettings_pkey" PRIMARY KEY ("companyId")
);

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignment"
ADD CONSTRAINT "HealthcareEquipmentAssignment_origin_check"
CHECK (
    (
        "origin" = 'REQUIREMENT'
        AND "requirementId" IS NOT NULL
        AND "directAssignmentReason" IS NULL
    )
    OR
    (
        "origin" = 'DIRECT'
        AND "requirementId" IS NULL
        AND "directAssignmentReason" IS NOT NULL
        AND btrim("directAssignmentReason") <> ''
    )
);

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignment"
ADD CONSTRAINT "HealthcareEquipmentAssignment_lifecycle_audit_check"
CHECK (
    (
        "lifecycle" = 'RESERVED'
        AND "releasedAt" IS NULL
        AND "releasedById" IS NULL
        AND "releaseCause" IS NULL
        AND "releaseReason" IS NULL
        AND "replacedAt" IS NULL
        AND "replacedById" IS NULL
        AND "replacementReason" IS NULL
    )
    OR
    (
        "lifecycle" = 'RELEASED'
        AND "releasedAt" IS NOT NULL
        AND "releasedById" IS NOT NULL
        AND "releaseCause" IS NOT NULL
        AND ("releaseReason" IS NULL OR btrim("releaseReason") <> '')
        AND (
            "releaseCause" <> 'MANUAL'
            OR (
                "releaseReason" IS NOT NULL
                AND btrim("releaseReason") <> ''
            )
        )
        AND "replacedAt" IS NULL
        AND "replacedById" IS NULL
        AND "replacementReason" IS NULL
    )
    OR
    (
        "lifecycle" = 'REPLACED'
        AND "releasedAt" IS NULL
        AND "releasedById" IS NULL
        AND "releaseCause" IS NULL
        AND "releaseReason" IS NULL
        AND "replacedAt" IS NOT NULL
        AND "replacedById" IS NOT NULL
        AND "replacementReason" IS NOT NULL
        AND btrim("replacementReason") <> ''
    )
);

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignment"
ADD CONSTRAINT "HealthcareEquipmentAssignment_replaces_not_self_check"
CHECK ("replacesAssignmentId" IS NULL OR "replacesAssignmentId" <> "id");

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride"
ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_distinct_check"
CHECK ("assignmentId" <> "conflictingAssignmentId");

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride"
ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_windows_check"
CHECK (
    "assignmentWindowStart" < "assignmentWindowEnd"
    AND "conflictingWindowStart" < "conflictingWindowEnd"
);

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride"
ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_reason_check"
CHECK (btrim("reason") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentRequirementCoverageNote"
ADD CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_comment_check"
CHECK (btrim("comment") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentRequirementCoverageNote"
ADD CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_resolution_check"
CHECK (
    ("resolvedAt" IS NULL AND "resolvedById" IS NULL)
    OR
    ("resolvedAt" IS NOT NULL AND "resolvedById" IS NOT NULL)
);

-- AddCheckConstraint
ALTER TABLE "HealthcareEquipmentAssignmentSettings"
ADD CONSTRAINT "HealthcareEquipmentAssignmentSettings_buffers_nonnegative_check"
CHECK ("preCaseBufferMinutes" >= 0 AND "postCaseBufferMinutes" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseRequirement_id_companyId_caseId_key" ON "HealthcareCaseRequirement"("id", "companyId", "caseId");

-- CreateIndex
CREATE INDEX "HealthcareEquipmentAssignment_companyId_caseId_lifecycle_idx" ON "HealthcareEquipmentAssignment"("companyId", "caseId", "lifecycle");

-- CreateIndex
CREATE INDEX "HealthcareEquipmentAssignment_companyId_equipmentAssetId_li_idx" ON "HealthcareEquipmentAssignment"("companyId", "equipmentAssetId", "lifecycle");

-- CreateIndex
CREATE INDEX "HealthcareEquipmentAssignment_companyId_requirementId_lifec_idx" ON "HealthcareEquipmentAssignment"("companyId", "requirementId", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentAssignment_id_companyId_key" ON "HealthcareEquipmentAssignment"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentAssignment_companyId_replacesAssignmentI_key" ON "HealthcareEquipmentAssignment"("companyId", "replacesAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentAssignment_reserved_case_asset_key" ON "HealthcareEquipmentAssignment"("companyId", "caseId", "equipmentAssetId") WHERE "lifecycle" = 'RESERVED';

-- CreateIndex
CREATE INDEX "HealthcareEquipmentAssignmentConflictOverride_companyId_ass_idx" ON "HealthcareEquipmentAssignmentConflictOverride"("companyId", "assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "HealthcareEquipmentAssignmentConflictOverride_companyId_con_idx" ON "HealthcareEquipmentAssignmentConflictOverride"("companyId", "conflictingAssignmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentAssignmentConflictOverride_id_companyId_key" ON "HealthcareEquipmentAssignmentConflictOverride"("id", "companyId");

-- CreateIndex
CREATE INDEX "HealthcareEquipmentRequirementCoverageNote_companyId_requir_idx" ON "HealthcareEquipmentRequirementCoverageNote"("companyId", "requirementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentRequirementCoverageNote_id_companyId_key" ON "HealthcareEquipmentRequirementCoverageNote"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentRequirementCoverageNote_open_kind_key" ON "HealthcareEquipmentRequirementCoverageNote"("companyId", "requirementId", "kind") WHERE "resolvedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_equipmentAssetId_companyId_fkey" FOREIGN KEY ("equipmentAssetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_requirementId_companyId_case_fkey" FOREIGN KEY ("requirementId", "companyId", "caseId") REFERENCES "HealthcareCaseRequirement"("id", "companyId", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_releasedById_companyId_fkey" FOREIGN KEY ("releasedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_replacedById_companyId_fkey" FOREIGN KEY ("replacedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignment" ADD CONSTRAINT "HealthcareEquipmentAssignment_replacesAssignmentId_company_fkey" FOREIGN KEY ("replacesAssignmentId", "companyId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride" ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride" ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId", "companyId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride" ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_conflictingA_fkey" FOREIGN KEY ("conflictingAssignmentId", "companyId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignmentConflictOverride" ADD CONSTRAINT "HealthcareEquipmentAssignmentConflictOverride_approvedById_fkey" FOREIGN KEY ("approvedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentRequirementCoverageNote" ADD CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentRequirementCoverageNote" ADD CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_requirementId_c_fkey" FOREIGN KEY ("requirementId", "companyId") REFERENCES "HealthcareCaseRequirement"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentRequirementCoverageNote" ADD CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_recordedById_co_fkey" FOREIGN KEY ("recordedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentRequirementCoverageNote" ADD CONSTRAINT "HealthcareEquipmentRequirementCoverageNote_resolvedById_co_fkey" FOREIGN KEY ("resolvedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareEquipmentAssignmentSettings" ADD CONSTRAINT "HealthcareEquipmentAssignmentSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
