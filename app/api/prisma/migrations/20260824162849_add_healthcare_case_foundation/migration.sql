-- CreateEnum
CREATE TYPE "HealthcareCaseStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "HealthcareCase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "procedureDescription" TEXT,
    "status" "HealthcareCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "responsibleUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthcareCase_companyId_status_idx" ON "HealthcareCase"("companyId", "status");

-- CreateIndex
CREATE INDEX "HealthcareCase_companyId_scheduledStart_idx" ON "HealthcareCase"("companyId", "scheduledStart");

-- CreateIndex
CREATE INDEX "HealthcareCase_companyId_responsibleUserId_idx" ON "HealthcareCase"("companyId", "responsibleUserId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCase_companyId_folio_key" ON "HealthcareCase"("companyId", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCase_id_companyId_key" ON "HealthcareCase"("id", "companyId");

-- AddForeignKey
ALTER TABLE "HealthcareCase" ADD CONSTRAINT "HealthcareCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCase" ADD CONSTRAINT "HealthcareCase_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCase" ADD CONSTRAINT "HealthcareCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCase" ADD CONSTRAINT "HealthcareCase_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
