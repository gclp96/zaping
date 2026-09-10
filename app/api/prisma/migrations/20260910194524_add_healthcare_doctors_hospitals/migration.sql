-- AlterTable
ALTER TABLE "HealthcareCase" ADD COLUMN     "doctorId" TEXT,
ADD COLUMN     "hospitalId" TEXT;

-- CreateTable
CREATE TABLE "HealthcareDoctor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "searchKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareDoctor_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "HealthcareDoctor"
ADD CONSTRAINT "HealthcareDoctor_firstName_not_blank_check"
CHECK (btrim("firstName") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareDoctor"
ADD CONSTRAINT "HealthcareDoctor_lastName_not_blank_check"
CHECK (btrim("lastName") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareDoctor"
ADD CONSTRAINT "HealthcareDoctor_specialty_not_blank_check"
CHECK (btrim("specialty") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareDoctor"
ADD CONSTRAINT "HealthcareDoctor_searchKey_not_blank_check"
CHECK (btrim("searchKey") <> '');

-- CreateTable
CREATE TABLE "HealthcareHospital" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "searchKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareHospital_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "HealthcareHospital"
ADD CONSTRAINT "HealthcareHospital_name_not_blank_check"
CHECK (btrim("name") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareHospital"
ADD CONSTRAINT "HealthcareHospital_city_not_blank_check"
CHECK (btrim("city") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareHospital"
ADD CONSTRAINT "HealthcareHospital_state_not_blank_check"
CHECK (btrim("state") <> '');

-- AddCheckConstraint
ALTER TABLE "HealthcareHospital"
ADD CONSTRAINT "HealthcareHospital_searchKey_not_blank_check"
CHECK (btrim("searchKey") <> '');

-- CreateTable
CREATE TABLE "HealthcareDoctorHospitalAffiliation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareDoctorHospitalAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthcareDoctor_companyId_isActive_lastName_firstName_idx" ON "HealthcareDoctor"("companyId", "isActive", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "HealthcareDoctor_companyId_searchKey_idx" ON "HealthcareDoctor"("companyId", "searchKey");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareDoctor_id_companyId_key" ON "HealthcareDoctor"("id", "companyId");

-- CreateIndex
CREATE INDEX "HealthcareHospital_companyId_isActive_name_idx" ON "HealthcareHospital"("companyId", "isActive", "name");

-- CreateIndex
CREATE INDEX "HealthcareHospital_companyId_state_city_idx" ON "HealthcareHospital"("companyId", "state", "city");

-- CreateIndex
CREATE INDEX "HealthcareHospital_companyId_searchKey_idx" ON "HealthcareHospital"("companyId", "searchKey");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareHospital_id_companyId_key" ON "HealthcareHospital"("id", "companyId");

-- CreateIndex
CREATE INDEX "HealthcareDoctorHospitalAffiliation_companyId_doctorId_isAc_idx" ON "HealthcareDoctorHospitalAffiliation"("companyId", "doctorId", "isActive");

-- CreateIndex
CREATE INDEX "HealthcareDoctorHospitalAffiliation_companyId_hospitalId_is_idx" ON "HealthcareDoctorHospitalAffiliation"("companyId", "hospitalId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareDoctorHospitalAffiliation_companyId_doctorId_hosp_key" ON "HealthcareDoctorHospitalAffiliation"("companyId", "doctorId", "hospitalId");

-- CreateIndex
CREATE INDEX "HealthcareCase_companyId_doctorId_scheduledStart_idx" ON "HealthcareCase"("companyId", "doctorId", "scheduledStart");

-- CreateIndex
CREATE INDEX "HealthcareCase_companyId_hospitalId_scheduledStart_idx" ON "HealthcareCase"("companyId", "hospitalId", "scheduledStart");

-- AddForeignKey
ALTER TABLE "HealthcareDoctor" ADD CONSTRAINT "HealthcareDoctor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareHospital" ADD CONSTRAINT "HealthcareHospital_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareDoctorHospitalAffiliation" ADD CONSTRAINT "HealthcareDoctorHospitalAffiliation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareDoctorHospitalAffiliation" ADD CONSTRAINT "HealthcareDoctorHospitalAffiliation_doctorId_companyId_fkey" FOREIGN KEY ("doctorId", "companyId") REFERENCES "HealthcareDoctor"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareDoctorHospitalAffiliation" ADD CONSTRAINT "HealthcareDoctorHospitalAffiliation_hospitalId_companyId_fkey" FOREIGN KEY ("hospitalId", "companyId") REFERENCES "HealthcareHospital"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCase" ADD CONSTRAINT "HealthcareCase_doctorId_companyId_fkey" FOREIGN KEY ("doctorId", "companyId") REFERENCES "HealthcareDoctor"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareCase" ADD CONSTRAINT "HealthcareCase_hospitalId_companyId_fkey" FOREIGN KEY ("hospitalId", "companyId") REFERENCES "HealthcareHospital"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
