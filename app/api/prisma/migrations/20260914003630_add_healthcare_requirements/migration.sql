-- CreateEnum
CREATE TYPE "HealthcareRequirementType" AS ENUM ('REQUIRED', 'BACKUP');

-- CreateEnum
CREATE TYPE "HealthcareRequirementLifecycle" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "HealthcareCaseRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "type" "HealthcareRequirementType" NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "lifecycle" "HealthcareRequirementLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "retiredById" TEXT,
    "retirementReason" TEXT,
    "reactivatedAt" TIMESTAMP(3),
    "reactivatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareCaseRequirement_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "HealthcareCaseRequirement"
ADD CONSTRAINT "HealthcareCaseRequirement_requestedQty_positive_check"
CHECK ("requestedQty" > 0);

-- AddCheckConstraint
ALTER TABLE "HealthcareCaseRequirement"
ADD CONSTRAINT "HealthcareCaseRequirement_retirement_audit_check"
CHECK (
    (
        "retiredAt" IS NULL
        AND "retiredById" IS NULL
        AND "retirementReason" IS NULL
    )
    OR
    (
        "retiredAt" IS NOT NULL
        AND "retiredById" IS NOT NULL
        AND "retirementReason" IS NOT NULL
        AND btrim("retirementReason") <> ''
    )
);

-- AddCheckConstraint
ALTER TABLE "HealthcareCaseRequirement"
ADD CONSTRAINT "HealthcareCaseRequirement_reactivation_audit_check"
CHECK (
    ("reactivatedAt" IS NULL AND "reactivatedById" IS NULL)
    OR
    ("reactivatedAt" IS NOT NULL AND "reactivatedById" IS NOT NULL)
);

-- AddCheckConstraint
ALTER TABLE "HealthcareCaseRequirement"
ADD CONSTRAINT "HealthcareRequirement_reactivation_requires_retirement_check"
CHECK ("reactivatedAt" IS NULL OR "retiredAt" IS NOT NULL);

-- AddCheckConstraint
ALTER TABLE "HealthcareCaseRequirement"
ADD CONSTRAINT "HealthcareCaseRequirement_lifecycle_audit_check"
CHECK (
    (
        "lifecycle" = 'ACTIVE'
        AND (
            (
                "retiredAt" IS NULL
                AND "reactivatedAt" IS NULL
            )
            OR
            (
                "retiredAt" IS NOT NULL
                AND "reactivatedAt" IS NOT NULL
                AND "reactivatedAt" >= "retiredAt"
            )
        )
    )
    OR
    (
        "lifecycle" = 'RETIRED'
        AND "retiredAt" IS NOT NULL
        AND (
            "reactivatedAt" IS NULL
            OR "retiredAt" >= "reactivatedAt"
        )
    )
);

-- CreateIndex
CREATE INDEX "HealthcareCaseRequirement_companyId_caseId_lifecycle_sortOr_idx" ON "HealthcareCaseRequirement"("companyId", "caseId", "lifecycle", "sortOrder");

-- CreateIndex
CREATE INDEX "HealthcareCaseRequirement_companyId_productId_idx" ON "HealthcareCaseRequirement"("companyId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseRequirement_id_companyId_key" ON "HealthcareCaseRequirement"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseRequirement_companyId_caseId_productId_key" ON "HealthcareCaseRequirement"("companyId", "caseId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_companyId_key" ON "User"("id", "companyId");

-- AddForeignKey
ALTER TABLE "HealthcareCaseRequirement" ADD CONSTRAINT "HealthcareCaseRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCaseRequirement" ADD CONSTRAINT "HealthcareCaseRequirement_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCaseRequirement" ADD CONSTRAINT "HealthcareCaseRequirement_productId_companyId_fkey" FOREIGN KEY ("productId", "companyId") REFERENCES "Product"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCaseRequirement" ADD CONSTRAINT "HealthcareCaseRequirement_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCaseRequirement" ADD CONSTRAINT "HealthcareCaseRequirement_retiredById_companyId_fkey" FOREIGN KEY ("retiredById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCaseRequirement" ADD CONSTRAINT "HealthcareCaseRequirement_reactivatedById_companyId_fkey" FOREIGN KEY ("reactivatedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
