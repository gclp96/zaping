-- CreateEnum
CREATE TYPE "EquipmentPhysicalLocation" AS ENUM ('UNVERIFIED', 'WAREHOUSE', 'CUSTODY');

-- CreateEnum
CREATE TYPE "EquipmentPhysicalOperation" AS ENUM ('BASELINE_RECONCILIATION', 'RECEIPT_INITIALIZATION', 'CUSTODY_OPEN', 'CUSTODY_CLOSE', 'CONDITION_CHANGE', 'LIFECYCLE_CHANGE');

-- AlterTable
ALTER TABLE "EquipmentAsset" ADD COLUMN     "activeCustodyId" TEXT,
ADD COLUMN     "physicalLocation" "EquipmentPhysicalLocation" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "physicalRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EquipmentAssetCustody" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentAssetId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "EquipmentAssetCustody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssetPhysicalEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentAssetId" TEXT NOT NULL,
    "custodyId" TEXT,
    "operation" "EquipmentPhysicalOperation" NOT NULL,
    "originType" VARCHAR(64) NOT NULL,
    "originId" VARCHAR(128) NOT NULL,
    "originOperation" VARCHAR(64) NOT NULL,
    "hashVersion" INTEGER NOT NULL DEFAULT 1,
    "requestHash" CHAR(64) NOT NULL,
    "physicalLocationBefore" "EquipmentPhysicalLocation" NOT NULL,
    "physicalLocationAfter" "EquipmentPhysicalLocation" NOT NULL,
    "conditionBefore" "EquipmentCondition" NOT NULL,
    "conditionAfter" "EquipmentCondition" NOT NULL,
    "lifecycleBefore" "EquipmentLifecycle" NOT NULL,
    "lifecycleAfter" "EquipmentLifecycle" NOT NULL,
    "revisionBefore" INTEGER NOT NULL,
    "revisionAfter" INTEGER NOT NULL,
    "actorId" TEXT,
    "reasonCode" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(1000),
    "operatorIdentity" VARCHAR(128),
    "evidenceReference" VARCHAR(1024),
    "evidenceHash" CHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentAssetPhysicalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentAssetCustody_companyId_caseId_openedAt_id_idx" ON "EquipmentAssetCustody"("companyId", "caseId", "openedAt", "id");

-- CreateIndex
CREATE INDEX "EquipmentAssetCustody_companyId_assignmentId_idx" ON "EquipmentAssetCustody"("companyId", "assignmentId");

-- CreateIndex
CREATE INDEX "EquipmentAssetCustody_companyId_equipmentAssetId_openedAt_i_idx" ON "EquipmentAssetCustody"("companyId", "equipmentAssetId", "openedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAssetCustody_identity_key" ON "EquipmentAssetCustody"("id", "companyId", "equipmentAssetId");

-- CreateIndex
CREATE INDEX "EquipmentAssetPhysicalEvent_companyId_equipmentAssetId_crea_idx" ON "EquipmentAssetPhysicalEvent"("companyId", "equipmentAssetId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EquipmentAssetPhysicalEvent_companyId_custodyId_idx" ON "EquipmentAssetPhysicalEvent"("companyId", "custodyId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAssetPhysicalEvent_origin_key" ON "EquipmentAssetPhysicalEvent"("companyId", "equipmentAssetId", "originType", "originId", "originOperation");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAssetPhysicalEvent_revision_key" ON "EquipmentAssetPhysicalEvent"("companyId", "equipmentAssetId", "revisionAfter");

-- CreateIndex
CREATE INDEX "EquipmentAsset_companyId_physicalLocation_idx" ON "EquipmentAsset"("companyId", "physicalLocation");

-- CreateIndex
CREATE INDEX "EquipmentAsset_activeCustodyId_idx" ON "EquipmentAsset"("activeCustodyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareEquipmentAssignment_custody_identity_key" ON "HealthcareEquipmentAssignment"("id", "companyId", "caseId", "equipmentAssetId");

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_activeCustodyId_companyId_id_fkey" FOREIGN KEY ("activeCustodyId", "companyId", "id") REFERENCES "EquipmentAssetCustody"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_equipmentAssetId_companyId_fkey" FOREIGN KEY ("equipmentAssetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_assignmentId_companyId_caseId_equipm_fkey" FOREIGN KEY ("assignmentId", "companyId", "caseId", "equipmentAssetId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId", "caseId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_openedById_companyId_fkey" FOREIGN KEY ("openedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_closedById_companyId_fkey" FOREIGN KEY ("closedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetPhysicalEvent" ADD CONSTRAINT "EquipmentAssetPhysicalEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetPhysicalEvent" ADD CONSTRAINT "EquipmentAssetPhysicalEvent_equipmentAssetId_companyId_fkey" FOREIGN KEY ("equipmentAssetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetPhysicalEvent" ADD CONSTRAINT "EquipmentAssetPhysicalEvent_custodyId_companyId_equipmentA_fkey" FOREIGN KEY ("custodyId", "companyId", "equipmentAssetId") REFERENCES "EquipmentAssetCustody"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentAssetPhysicalEvent" ADD CONSTRAINT "EquipmentAssetPhysicalEvent_actorId_companyId_fkey" FOREIGN KEY ("actorId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Structural checks only; existing lifecycle/condition workflows are integrated in 01E-B.
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_physical_revision_check" CHECK ("physicalRevision" >= 0),
 ADD CONSTRAINT "EquipmentAsset_physical_pointer_check" CHECK (("physicalLocation" = 'CUSTODY') = ("activeCustodyId" IS NOT NULL));
ALTER TABLE "EquipmentAssetCustody" ADD CONSTRAINT "EquipmentAssetCustody_close_check" CHECK (
 ("closedAt" IS NULL AND "closedById" IS NULL) OR
 ("closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "closedAt" >= "openedAt"));
CREATE UNIQUE INDEX "EquipmentAssetCustody_open_asset_key" ON "EquipmentAssetCustody" ("companyId", "equipmentAssetId") WHERE "closedAt" IS NULL;
ALTER TABLE "EquipmentAssetPhysicalEvent"
 ADD CONSTRAINT "EquipmentAssetPhysicalEvent_revision_check" CHECK ("revisionBefore" >= 0 AND "revisionAfter"::bigint = "revisionBefore"::bigint + 1),
 ADD CONSTRAINT "EquipmentAssetPhysicalEvent_hash_check" CHECK ("hashVersion" = 1 AND "requestHash" ~ '^[0-9a-f]{64}$' AND ("evidenceHash" IS NULL OR "evidenceHash" ~ '^[0-9a-f]{64}$')),
 ADD CONSTRAINT "EquipmentAssetPhysicalEvent_origin_check" CHECK (
 length("originType") > 0 AND "originType" = btrim("originType") AND
 length("originId") > 0 AND "originId" = btrim("originId") AND
 length("originOperation") > 0 AND "originOperation" = btrim("originOperation") AND
 length("reasonCode") > 0 AND "reasonCode" = btrim("reasonCode")),
 ADD CONSTRAINT "EquipmentAssetPhysicalEvent_actor_check" CHECK ("actorId" IS NOT NULL OR "operation" = 'BASELINE_RECONCILIATION'),
 ADD CONSTRAINT "EquipmentAssetPhysicalEvent_baseline_evidence_check" CHECK ("operation" <> 'BASELINE_RECONCILIATION' OR (
 "operatorIdentity" IS NOT NULL AND length(btrim("operatorIdentity")) > 0 AND "operatorIdentity" = btrim("operatorIdentity") AND
 "evidenceReference" IS NOT NULL AND length(btrim("evidenceReference")) > 0 AND "evidenceReference" = btrim("evidenceReference") AND "evidenceHash" IS NOT NULL));

CREATE FUNCTION public.equipment_physical_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Equipment physical history is append-only';
END;
$body$;
CREATE TRIGGER "EquipmentAssetPhysicalEvent_immutable" BEFORE UPDATE OR DELETE ON "EquipmentAssetPhysicalEvent"
 FOR EACH ROW EXECUTE FUNCTION public.equipment_physical_event_immutable();
-- No role names/ACL assumptions. TRUNCATE is also a forbidden history mutation.
CREATE TRIGGER "EquipmentAssetPhysicalEvent_no_truncate" BEFORE TRUNCATE ON "EquipmentAssetPhysicalEvent"
 FOR EACH STATEMENT EXECUTE FUNCTION public.equipment_physical_event_immutable();
