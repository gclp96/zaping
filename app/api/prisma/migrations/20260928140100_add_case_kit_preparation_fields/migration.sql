-- AlterTable
ALTER TABLE "HealthcareCaseKit"
ADD COLUMN "preparedById" TEXT,
ADD COLUMN "preparedAt" TIMESTAMP(3);

-- Audit integrity; existing DRAFT rows remain valid with a NULL audit.
ALTER TABLE "HealthcareCaseKit"
ADD CONSTRAINT "HealthcareCaseKit_preparation_audit_check" CHECK (
  (
    "status" = 'DRAFT'
    AND "preparedById" IS NULL
    AND "preparedAt" IS NULL
  )
  OR
  (
    "status" = 'PREPARED'
    AND "preparedById" IS NOT NULL
    AND "preparedAt" IS NOT NULL
  )
);

CREATE INDEX "HealthcareCaseKit_companyId_preparedById_idx"
ON "HealthcareCaseKit"("companyId", "preparedById");

ALTER TABLE "HealthcareCaseKit"
ADD CONSTRAINT "HealthcareCaseKit_preparedById_companyId_fkey"
FOREIGN KEY ("preparedById", "companyId") REFERENCES "User"("id", "companyId")
ON DELETE RESTRICT ON UPDATE CASCADE;
