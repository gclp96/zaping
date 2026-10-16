-- CreateEnum
CREATE TYPE "HealthcareCaseReconciliationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HealthcareCaseReconciliationItemType" AS ENUM ('MATERIAL', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "HealthcareCaseReconciliationItemLifecycle" AS ENUM ('ACTIVE', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "HealthcareCaseReconciliationEquipmentOutcome" AS ENUM ('RETURNED', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "HealthcareCaseReconciliationAuditOperation" AS ENUM ('CREATE', 'ITEM_ADD', 'OUTCOME_SET', 'ITEM_EXCLUDE', 'CONFIRM', 'CANCEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_RECONCILIATION_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_RECONCILIATION_ITEM_ADD';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_RECONCILIATION_OUTCOME_SET';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_RECONCILIATION_ITEM_EXCLUDE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_RECONCILIATION_CONFIRM';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_RECONCILIATION_CANCEL';

-- CreateTable
CREATE TABLE "HealthcareCaseReconciliation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "caseKitId" TEXT NOT NULL,
    "status" "HealthcareCaseReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedFromRevision" INTEGER,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" VARCHAR(1000),
    "observation" VARCHAR(1000),
    "snapshotVersion" INTEGER,
    "snapshot" JSONB,

    CONSTRAINT "HealthcareCaseReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareCaseReconciliationItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "sourceDispatchItemId" TEXT NOT NULL,
    "type" "HealthcareCaseReconciliationItemType" NOT NULL,
    "lifecycle" "HealthcareCaseReconciliationItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excludedById" TEXT,
    "excludedAt" TIMESTAMP(3),
    "exclusionReason" VARCHAR(1000),
    "snapshot" JSONB,
    "sourceCustodyPositionId" TEXT,
    "expectedSourceRevision" INTEGER,
    "returnedQty" INTEGER,
    "usedQty" INTEGER,
    "returnedDestinationPositionId" TEXT,
    "returnedPhysicalEffectId" TEXT,
    "usedPhysicalEffectId" TEXT,
    "equipmentCustodyId" TEXT,
    "assetId" TEXT,
    "assignmentId" TEXT,
    "expectedPhysicalRevision" INTEGER,
    "outcome" "HealthcareCaseReconciliationEquipmentOutcome",
    "reportedCondition" "EquipmentCondition",
    "closePhysicalEventId" TEXT,

    CONSTRAINT "HealthcareCaseReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareCaseReconciliationAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "reconciliationItemId" TEXT,
    "operation" "HealthcareCaseReconciliationAuditOperation" NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionBefore" INTEGER,
    "revisionAfter" INTEGER NOT NULL,
    "change" JSONB NOT NULL,

    CONSTRAINT "HealthcareCaseReconciliationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reconciliation_case_list_idx" ON "HealthcareCaseReconciliation"("companyId", "caseId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Reconciliation_status_list_idx" ON "HealthcareCaseReconciliation"("companyId", "caseId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Reconciliation_dispatch_list_idx" ON "HealthcareCaseReconciliation"("companyId", "caseId", "dispatchId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_identity_key" ON "HealthcareCaseReconciliation"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_parent_key" ON "HealthcareCaseReconciliation"("id", "companyId", "caseId", "dispatchId");

-- CreateIndex
CREATE INDEX "Reconciliation_item_list_idx" ON "HealthcareCaseReconciliationItem"("companyId", "reconciliationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_item_audit_key" ON "HealthcareCaseReconciliationItem"("id", "companyId", "reconciliationId");

-- CreateIndex
CREATE INDEX "Reconciliation_audit_list_idx" ON "HealthcareCaseReconciliationAudit"("companyId", "reconciliationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_audit_revision_key" ON "HealthcareCaseReconciliationAudit"("companyId", "reconciliationId", "revisionAfter");

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_dispatchId_companyId_caseId_c_fkey" FOREIGN KEY ("dispatchId", "companyId", "caseId", "caseKitId") REFERENCES "HealthcareCaseDispatch"("id", "companyId", "caseId", "caseKitId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_caseKitId_companyId_caseId_fkey" FOREIGN KEY ("caseKitId", "companyId", "caseId") REFERENCES "HealthcareCaseKit"("id", "companyId", "caseId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_confirmedById_companyId_fkey" FOREIGN KEY ("confirmedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "HealthcareCaseReconciliation_cancelledById_companyId_fkey" FOREIGN KEY ("cancelledById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_reconciliationId_companyI_fkey" FOREIGN KEY ("reconciliationId", "companyId", "caseId", "dispatchId") REFERENCES "HealthcareCaseReconciliation"("id", "companyId", "caseId", "dispatchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_sourceDispatchItemId_comp_fkey" FOREIGN KEY ("sourceDispatchItemId", "companyId", "dispatchId") REFERENCES "HealthcareCaseDispatchItem"("id", "companyId", "dispatchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_sourceCustodyPositionId_c_fkey" FOREIGN KEY ("sourceCustodyPositionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_returnedDestinationPositi_fkey" FOREIGN KEY ("returnedDestinationPositionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_returnedPhysicalEffectId__fkey" FOREIGN KEY ("returnedPhysicalEffectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_usedPhysicalEffectId_comp_fkey" FOREIGN KEY ("usedPhysicalEffectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_equipmentCustodyId_compan_fkey" FOREIGN KEY ("equipmentCustodyId", "companyId", "assetId") REFERENCES "EquipmentAssetCustody"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_assetId_companyId_fkey" FOREIGN KEY ("assetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_assignmentId_companyId_ca_fkey" FOREIGN KEY ("assignmentId", "companyId", "caseId", "assetId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId", "caseId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_closePhysicalEventId_comp_fkey" FOREIGN KEY ("closePhysicalEventId", "companyId", "assetId") REFERENCES "EquipmentAssetPhysicalEvent"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "HealthcareCaseReconciliationItem_excludedById_companyId_fkey" FOREIGN KEY ("excludedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationAudit" ADD CONSTRAINT "HealthcareCaseReconciliationAudit_reconciliationId_company_fkey" FOREIGN KEY ("reconciliationId", "companyId") REFERENCES "HealthcareCaseReconciliation"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationAudit" ADD CONSTRAINT "HealthcareCaseReconciliationAudit_reconciliationItemId_com_fkey" FOREIGN KEY ("reconciliationItemId", "companyId", "reconciliationId") REFERENCES "HealthcareCaseReconciliationItem"("id", "companyId", "reconciliationId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseReconciliationAudit" ADD CONSTRAINT "HealthcareCaseReconciliationAudit_actorId_companyId_fkey" FOREIGN KEY ("actorId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Reconciliation-only invariants. No operational eligibility/capacity enforcement.
CREATE UNIQUE INDEX "Reconciliation_active_source_key" ON "HealthcareCaseReconciliationItem"("companyId","reconciliationId","sourceDispatchItemId") WHERE lifecycle='ACTIVE';
CREATE UNIQUE INDEX "Reconciliation_close_event_key" ON "HealthcareCaseReconciliationItem"("closePhysicalEventId") WHERE "closePhysicalEventId" IS NOT NULL;
CREATE UNIQUE INDEX "Reconciliation_closed_custody_key" ON "HealthcareCaseReconciliationItem"("companyId","equipmentCustodyId") WHERE "closePhysicalEventId" IS NOT NULL;
CREATE INDEX "Reconciliation_material_capacity_idx" ON "HealthcareCaseReconciliationItem"("companyId","sourceDispatchItemId","reconciliationId") INCLUDE ("returnedQty","usedQty") WHERE type='MATERIAL' AND lifecycle='ACTIVE';
ALTER TABLE "HealthcareCaseReconciliation" ADD CONSTRAINT "Reconciliation_root_shape" CHECK (
 revision>=0 AND (observation IS NULL OR (observation=btrim(observation) AND length(observation) BETWEEN 1 AND 1000)) AND
 (snapshot IS NULL OR (jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=32768)) AND
 ((status='DRAFT' AND "confirmedFromRevision" IS NULL AND "confirmedById" IS NULL AND "confirmedAt" IS NULL AND "cancelledById" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
 OR (status='CONFIRMED' AND "confirmedFromRevision">=0 AND revision::bigint="confirmedFromRevision"::bigint+1 AND "confirmedById" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "snapshotVersion"=1 AND snapshot IS NOT NULL AND "cancelledById" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
 OR (status='CANCELLED' AND "confirmedFromRevision" IS NULL AND "confirmedById" IS NULL AND "confirmedAt" IS NULL AND "cancelledById" IS NOT NULL AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL AND "cancellationReason"=btrim("cancellationReason") AND length("cancellationReason") BETWEEN 1 AND 1000 AND snapshot IS NULL AND "snapshotVersion" IS NULL)) IS TRUE);
ALTER TABLE "HealthcareCaseReconciliationItem" ADD CONSTRAINT "Reconciliation_item_shape" CHECK (
 ((type='MATERIAL' AND "sourceCustodyPositionId" IS NOT NULL AND "expectedSourceRevision">=0 AND "returnedQty">=0 AND "usedQty">=0 AND "equipmentCustodyId" IS NULL AND "assetId" IS NULL AND "assignmentId" IS NULL AND "expectedPhysicalRevision" IS NULL AND outcome IS NULL AND "reportedCondition" IS NULL AND "closePhysicalEventId" IS NULL)
 OR (type='EQUIPMENT' AND "equipmentCustodyId" IS NOT NULL AND "assetId" IS NOT NULL AND "assignmentId" IS NOT NULL AND "expectedPhysicalRevision">=0 AND outcome IS NOT NULL AND "sourceCustodyPositionId" IS NULL AND "expectedSourceRevision" IS NULL AND "returnedQty" IS NULL AND "usedQty" IS NULL AND "returnedDestinationPositionId" IS NULL AND "returnedPhysicalEffectId" IS NULL AND "usedPhysicalEffectId" IS NULL AND ((outcome='RETURNED' AND "reportedCondition" IS NOT NULL) OR (outcome='UNRESOLVED' AND "reportedCondition" IS NULL AND "closePhysicalEventId" IS NULL)))) IS TRUE
 AND ((lifecycle='ACTIVE' AND "excludedById" IS NULL AND "excludedAt" IS NULL AND "exclusionReason" IS NULL) OR (lifecycle='EXCLUDED' AND "excludedById" IS NOT NULL AND "excludedAt" IS NOT NULL AND "exclusionReason" IS NOT NULL AND "exclusionReason"=btrim("exclusionReason") AND length("exclusionReason") BETWEEN 1 AND 1000))
 AND (("returnedDestinationPositionId" IS NULL)=("returnedPhysicalEffectId" IS NULL))
 AND ("returnedQty" IS DISTINCT FROM 0 OR "returnedPhysicalEffectId" IS NULL)
 AND ("usedQty" IS DISTINCT FROM 0 OR "usedPhysicalEffectId" IS NULL)
 AND (lifecycle<>'EXCLUDED' OR ("returnedPhysicalEffectId" IS NULL AND "returnedDestinationPositionId" IS NULL AND "usedPhysicalEffectId" IS NULL AND "closePhysicalEventId" IS NULL))
 AND (snapshot IS NULL OR (jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=32768)));

CREATE FUNCTION "rr_json_integer"(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(v)='number' AND v::text ~ '^(0|[1-9][0-9]*)$' AND length(v::text)<=10 THEN v::text::numeric<=2147483647 ELSE false END
$$;
CREATE FUNCTION "rr_audit_change_v1"(v jsonb, op text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE b jsonb; a jsonb;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'object' OR octet_length(v::text)>8192 OR v->'version' IS DISTINCT FROM '1'::jsonb OR v->>'operation' IS DISTINCT FROM op THEN RETURN false; END IF;
 IF op IN ('CREATE','ITEM_ADD','CONFIRM') THEN RETURN v - ARRAY['version','operation']='{}'::jsonb; END IF;
 IF op IN ('ITEM_EXCLUDE','CANCEL') THEN RETURN v - ARRAY['version','operation','reason']='{}'::jsonb AND "dispatch_json_text"(v->'reason',1000) AND v->>'reason'=btrim(v->>'reason'); END IF;
 b:=v->'before'; a:=v->'after';
 IF v - ARRAY['version','operation','type','before','after']<>'{}'::jsonb OR jsonb_typeof(b)<>'object' OR jsonb_typeof(a)<>'object' THEN RETURN false; END IF;
 IF v->>'type'='MATERIAL' THEN RETURN COALESCE(b-ARRAY['returnedQty','usedQty']='{}'::jsonb AND a-ARRAY['returnedQty','usedQty']='{}'::jsonb AND "rr_json_integer"(b->'returnedQty') AND "rr_json_integer"(b->'usedQty') AND "rr_json_integer"(a->'returnedQty') AND "rr_json_integer"(a->'usedQty'),false); END IF;
 IF v->>'type'='EQUIPMENT' THEN RETURN COALESCE(b-ARRAY['outcome','reportedCondition']='{}'::jsonb AND a-ARRAY['outcome','reportedCondition']='{}'::jsonb AND b->>'outcome' IN ('RETURNED','UNRESOLVED') AND a->>'outcome' IN ('RETURNED','UNRESOLVED') AND ((b->>'outcome'='UNRESOLVED' AND b->'reportedCondition'='null'::jsonb) OR (b->>'outcome'='RETURNED' AND b->>'reportedCondition' IN ('GOOD','INSPECTION_PENDING','DAMAGED','OUT_OF_SERVICE'))) AND ((a->>'outcome'='UNRESOLVED' AND a->'reportedCondition'='null'::jsonb) OR (a->>'outcome'='RETURNED' AND a->>'reportedCondition' IN ('GOOD','INSPECTION_PENDING','DAMAGED','OUT_OF_SERVICE'))),false); END IF;
 RETURN false;
END $$;
ALTER TABLE "HealthcareCaseReconciliationAudit" ADD CONSTRAINT "Reconciliation_audit_shape" CHECK (
 ((operation='CREATE' AND "revisionBefore" IS NULL AND "revisionAfter"=0) OR (operation<>'CREATE' AND "revisionBefore">=0 AND "revisionAfter"::bigint="revisionBefore"::bigint+1)) IS TRUE
 AND ((operation IN ('ITEM_ADD','OUTCOME_SET','ITEM_EXCLUDE'))=("reconciliationItemId" IS NOT NULL))
 AND "rr_audit_change_v1"(change,operation::text) IS TRUE);
CREATE FUNCTION "rr_root_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reconciliation history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF OLD.status<>'DRAFT' OR ROW(NEW.id,NEW."companyId",NEW."caseId",NEW."dispatchId",NEW."caseKitId",NEW."createdById",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."companyId",OLD."caseId",OLD."dispatchId",OLD."caseKitId",OLD."createdById",OLD."createdAt") THEN RAISE EXCEPTION 'Reconciliation immutable history' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION "rr_item_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid text; state text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reconciliation item history cannot be deleted' USING ERRCODE='23514'; END IF;
 rid:=NEW."reconciliationId";
 SELECT status::text INTO state FROM "HealthcareCaseReconciliation" WHERE id=rid FOR UPDATE;
 IF state<>'DRAFT' THEN RAISE EXCEPTION 'Reconciliation terminal item immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (ROW(NEW.id,NEW."companyId",NEW."reconciliationId",NEW."caseId",NEW."dispatchId",NEW."sourceDispatchItemId",NEW.type,NEW."createdById",NEW."createdAt",NEW."sourceCustodyPositionId",NEW."equipmentCustodyId",NEW."assetId",NEW."assignmentId") IS DISTINCT FROM ROW(OLD.id,OLD."companyId",OLD."reconciliationId",OLD."caseId",OLD."dispatchId",OLD."sourceDispatchItemId",OLD.type,OLD."createdById",OLD."createdAt",OLD."sourceCustodyPositionId",OLD."equipmentCustodyId",OLD."assetId",OLD."assignmentId") OR (OLD.lifecycle='EXCLUDED' AND (to_jsonb(NEW)-'snapshot') IS DISTINCT FROM (to_jsonb(OLD)-'snapshot'))) THEN RAISE EXCEPTION 'Reconciliation immutable item identity/history' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Reconciliation_root_guard" BEFORE UPDATE OR DELETE ON "HealthcareCaseReconciliation" FOR EACH ROW EXECUTE FUNCTION "rr_root_guard"();
CREATE TRIGGER "Reconciliation_item_guard" BEFORE INSERT OR UPDATE OR DELETE ON "HealthcareCaseReconciliationItem" FOR EACH ROW EXECUTE FUNCTION "rr_item_guard"();
CREATE TRIGGER "Reconciliation_audit_append_only" BEFORE UPDATE OR DELETE ON "HealthcareCaseReconciliationAudit" FOR EACH ROW EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE TRIGGER "Reconciliation_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseReconciliation" EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE TRIGGER "Reconciliation_item_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseReconciliationItem" EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE TRIGGER "Reconciliation_audit_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseReconciliationAudit" EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE FUNCTION "rr_equipment_observation"(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(v->>'condition' IN ('GOOD','INSPECTION_PENDING','DAMAGED','OUT_OF_SERVICE') AND v->>'lifecycle' IN ('ACTIVE','RETIRED') AND v->>'location' IN ('WAREHOUSE','CUSTODY') AND "rr_json_integer"(v->'revision'),false)
$$;
CREATE FUNCTION "rr_snapshot_v1"(v jsonb, kind text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r jsonb; s jsonb;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'object' OR v->'version' IS DISTINCT FROM '1'::jsonb OR octet_length(v::text)>32768 THEN RETURN false; END IF;
 IF kind='ROOT' THEN RETURN COALESCE("dispatch_json_text"(v->'reconciliationId',128) AND "dispatch_json_text"(v->'sourceDispatch'->'id',128) AND "dispatch_json_text"(v->'sourceDispatch'->'caseId',128) AND "dispatch_json_text"(v->'sourceDispatch'->'caseKitId',128) AND "dispatch_snapshot_v1"(v->'sourceDispatch'->'history','ROOT') AND "dispatch_json_text"(v->'confirmedBy'->'id',128) AND "dispatch_json_text"(v->'confirmedBy'->'firstName',256) AND "dispatch_json_text"(v->'confirmedBy'->'lastName',256) AND "dispatch_json_date"(v->'confirmedAt') AND "dispatch_json_text"(v->'observation',1000,true) AND "rr_json_integer"(v->'episodeFacts'->'materialItemCount') AND "rr_json_integer"(v->'episodeFacts'->'equipmentItemCount') AND jsonb_typeof(v->'episodeFacts'->'hasPhysicalMutation')='boolean',false); END IF;
 IF NOT COALESCE(("dispatch_json_text"(v->'sourceDispatchItemId',128) AND "dispatch_snapshot_v1"(v->'history','ITEM') AND "dispatch_json_date"(v->'capturedAt') AND (v->'dispatchedQty'='null'::jsonb OR "rr_json_integer"(v->'dispatchedQty'))),false) THEN RETURN false; END IF;
 r:=v->'result'; IF r='null'::jsonb THEN RETURN true; END IF;
 IF r->>'type'='MATERIAL' THEN
 s:=r->'source';
 RETURN COALESCE("rr_json_integer"(v->'dispatchedQty') AND v->'history'->'equipment'='null'::jsonb AND v->'history'->'product'->>'inventoryTracking'='QUANTITY' AND "rr_json_integer"(r->'returnedQty') AND "rr_json_integer"(r->'usedQty') AND "rr_json_integer"(r->'unresolvedBefore') AND "rr_json_integer"(r->'unresolvedAfter') AND (r->>'unresolvedBefore')::bigint-(r->>'returnedQty')::bigint-(r->>'usedQty')::bigint=(r->>'unresolvedAfter')::bigint AND "dispatch_json_text"(s->'positionId',128) AND "rr_json_integer"(s->'revision') AND "rr_json_integer"(s->'quantity') AND s->'quantity'=r->'unresolvedBefore' AND "dispatch_json_text"(r->'returnedDestinationPositionId',128,true) AND "dispatch_json_text"(r->'returnedPhysicalEffectId',128,true) AND "dispatch_json_text"(r->'usedPhysicalEffectId',128,true) AND (((r->>'returnedQty')::bigint>0)=(r->'returnedPhysicalEffectId'<>'null'::jsonb)) AND ((r->'returnedPhysicalEffectId'='null'::jsonb)=(r->'returnedDestinationPositionId'='null'::jsonb)) AND (((r->>'usedQty')::bigint>0)=(r->'usedPhysicalEffectId'<>'null'::jsonb)),false);
 END IF;
 RETURN COALESCE(r->>'type'='EQUIPMENT' AND v->'dispatchedQty'='null'::jsonb AND jsonb_typeof(v->'history'->'equipment')='object' AND "dispatch_json_text"(r->'custodyId',128) AND "dispatch_json_text"(r->'assignmentId',128) AND "dispatch_json_text"(r->'openPhysicalEventId',128) AND "rr_equipment_observation"(r->'before') AND "rr_equipment_observation"(r->'after') AND r->'before'->>'location'='CUSTODY' AND ((r->>'outcome'='UNRESOLVED' AND r->'reportedCondition'='null'::jsonb AND r->'closePhysicalEventId'='null'::jsonb AND r->'custodyClosedAt'='null'::jsonb AND r->'before'=r->'after') OR (r->>'outcome'='RETURNED' AND "dispatch_json_text"(r->'closePhysicalEventId',128) AND "dispatch_json_date"(r->'custodyClosedAt') AND r->>'reportedCondition' IN ('GOOD','INSPECTION_PENDING','DAMAGED','OUT_OF_SERVICE') AND r->'after'->>'location'='WAREHOUSE' AND r->'after'->'condition'=r->'reportedCondition' AND r->'after'->'lifecycle'=r->'before'->'lifecycle' AND (r->'after'->>'revision')::bigint=(r->'before'->>'revision')::bigint+1)),false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE FUNCTION "rr_final_state"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "HealthcareCaseReconciliation"%ROWTYPE; s "HealthcareCaseDispatch"%ROWTYPE; i "HealthcareCaseReconciliationItem"%ROWTYPE; d "HealthcareCaseDispatchItem"%ROWTYPE; target text; active_count integer:=0; mc integer:=0; ec integer:=0; physical boolean:=false; v jsonb;
BEGIN
 IF TG_TABLE_NAME='HealthcareCaseReconciliation' THEN target:=NEW.id; ELSE target:=NEW."reconciliationId"; END IF;
 SELECT * INTO r FROM "HealthcareCaseReconciliation" WHERE id=target;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM "HealthcareCaseDispatch" WHERE id=r."dispatchId" AND "companyId"=r."companyId" AND status='CONFIRMED';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation source must be confirmed' USING ERRCODE='23514'; END IF;
 FOR i IN SELECT * FROM "HealthcareCaseReconciliationItem" WHERE "reconciliationId"=r.id LOOP
 SELECT * INTO d FROM "HealthcareCaseDispatchItem" WHERE id=i."sourceDispatchItemId" AND "companyId"=r."companyId" AND "dispatchId"=r."dispatchId" AND lifecycle='ACTIVE' AND type::text=i.type::text;
 IF NOT FOUND OR (i.type='MATERIAL' AND i."sourceCustodyPositionId" IS DISTINCT FROM d."destinationPositionId") OR (i.type='EQUIPMENT' AND ROW(i."equipmentCustodyId",i."assetId",i."assignmentId") IS DISTINCT FROM ROW(d."equipmentCustodyId",d."assetId",d."assignmentId")) THEN RAISE EXCEPTION 'Reconciliation source provenance mismatch' USING ERRCODE='23514'; END IF;
 IF r.status<>'CONFIRMED' THEN
 IF i.snapshot IS NOT NULL OR i."returnedPhysicalEffectId" IS NOT NULL OR i."usedPhysicalEffectId" IS NOT NULL OR i."closePhysicalEventId" IS NOT NULL THEN RAISE EXCEPTION 'Nonterminal reconciliation result' USING ERRCODE='23514'; END IF;
 CONTINUE;
 END IF;
 IF NOT "rr_snapshot_v1"(i.snapshot,'ITEM') OR i.snapshot->>'sourceDispatchItemId' IS DISTINCT FROM d.id OR i.snapshot->'history'->'product' IS DISTINCT FROM d.snapshot->'product' OR i.snapshot->'history'->'batch' IS DISTINCT FROM d.snapshot->'batch' OR i.snapshot->'history'->'equipment' IS DISTINCT FROM d.snapshot->'equipment' OR (i.snapshot->>'capturedAt')::timestamptz IS DISTINCT FROM r."confirmedAt" OR (i.snapshot->>'dispatchedQty')::integer IS DISTINCT FROM d.quantity THEN RAISE EXCEPTION 'Reconciliation item snapshot mismatch' USING ERRCODE='23514'; END IF;
 v:=i.snapshot->'result';
 IF i.lifecycle='EXCLUDED' THEN
 IF v IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Excluded result' USING ERRCODE='23514'; END IF;
 CONTINUE;
 END IF;
 active_count:=active_count+1;
 IF i.type='MATERIAL' THEN
 mc:=mc+1;
 IF v->>'type' IS DISTINCT FROM 'MATERIAL' OR (v->>'returnedQty')::integer IS DISTINCT FROM i."returnedQty" OR (v->>'usedQty')::integer IS DISTINCT FROM i."usedQty" OR v->'source'->>'positionId' IS DISTINCT FROM i."sourceCustodyPositionId" OR (v->'source'->>'revision')::integer IS DISTINCT FROM i."expectedSourceRevision" OR v->>'returnedDestinationPositionId' IS DISTINCT FROM i."returnedDestinationPositionId" OR v->>'returnedPhysicalEffectId' IS DISTINCT FROM i."returnedPhysicalEffectId" OR v->>'usedPhysicalEffectId' IS DISTINCT FROM i."usedPhysicalEffectId" THEN RAISE EXCEPTION 'Material snapshot result mismatch' USING ERRCODE='23514'; END IF;
 IF i."returnedQty">0 THEN
 physical:=true;
 IF NOT EXISTS(SELECT 1 FROM "InventoryPhysicalEffect" e JOIN "InventoryPosition" p ON p.id=i."returnedDestinationPositionId" AND p."companyId"=i."companyId" WHERE e.id=i."returnedPhysicalEffectId" AND e."companyId"=i."companyId" AND e.kind='TRANSFER' AND e."originType"='CASE_RECONCILIATION' AND e."originId"=r.id AND e."originOperation"='CONFIRM_RETURNED' AND e."actorId"=r."confirmedById" AND p.state='AVAILABLE' AND p."contextType" IS NULL AND p."contextId" IS NULL AND p."productId"=d."productId" AND p."inventoryBatchId" IS NOT DISTINCT FROM d."batchId" AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=i."sourceCustodyPositionId" AND l.delta=-i."returnedQty") AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=p.id AND l.delta=(SELECT sum(x."returnedQty") FROM "HealthcareCaseReconciliationItem" x WHERE x."reconciliationId"=r.id AND x.lifecycle='ACTIVE' AND x."returnedDestinationPositionId"=p.id AND x."returnedPhysicalEffectId"=e.id))) THEN RAISE EXCEPTION 'Returned evidence mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 IF i."usedQty">0 THEN
 physical:=true;
 IF NOT EXISTS(SELECT 1 FROM "InventoryPhysicalEffect" e JOIN "InventoryPhysicalEffectLine" l ON l."effectId"=e.id WHERE e.id=i."usedPhysicalEffectId" AND e."companyId"=i."companyId" AND e.kind='DEFINITIVE_OUT' AND e."originType"='CASE_RECONCILIATION' AND e."originId"=r.id AND e."originOperation"='CONFIRM_USED' AND e."actorId"=r."confirmedById" AND l."positionId"=i."sourceCustodyPositionId" AND l.delta=-i."usedQty") THEN RAISE EXCEPTION 'Used evidence mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 ELSE
 ec:=ec+1;
 IF v->>'type' IS DISTINCT FROM 'EQUIPMENT' OR v->>'custodyId' IS DISTINCT FROM i."equipmentCustodyId" OR v->>'assignmentId' IS DISTINCT FROM i."assignmentId" OR v->>'openPhysicalEventId' IS DISTINCT FROM d."equipmentPhysicalEventId" OR v->>'outcome' IS DISTINCT FROM i.outcome::text OR v->>'reportedCondition' IS DISTINCT FROM i."reportedCondition"::text OR (v->'before'->>'revision')::integer IS DISTINCT FROM i."expectedPhysicalRevision" OR v->>'closePhysicalEventId' IS DISTINCT FROM i."closePhysicalEventId" THEN RAISE EXCEPTION 'Equipment snapshot result mismatch' USING ERRCODE='23514'; END IF;
 IF i.outcome='RETURNED' THEN
 physical:=true;
 IF NOT EXISTS(SELECT 1 FROM "EquipmentAssetPhysicalEvent" e JOIN "EquipmentAssetCustody" c ON c.id=e."custodyId" WHERE e.id=i."closePhysicalEventId" AND e."companyId"=i."companyId" AND e."equipmentAssetId"=i."assetId" AND e."custodyId"=i."equipmentCustodyId" AND c."assignmentId"=i."assignmentId" AND c."caseId"=r."caseId" AND c."closedAt" IS NOT NULL AND c."closedById"=r."confirmedById" AND e.operation='CUSTODY_CLOSE' AND e."originType"='CASE_RECONCILIATION_ITEM' AND e."originId"=i.id AND e."originOperation"='CONFIRM_EQUIPMENT_RETURN' AND e."actorId"=r."confirmedById" AND e."revisionBefore"=i."expectedPhysicalRevision" AND e."conditionAfter"=i."reportedCondition" AND (v->>'custodyClosedAt')::timestamptz=c."closedAt" AND e."physicalLocationBefore"::text=v->'before'->>'location' AND e."physicalLocationAfter"::text=v->'after'->>'location' AND e."conditionBefore"::text=v->'before'->>'condition' AND e."lifecycleBefore"::text=v->'before'->>'lifecycle' AND e."lifecycleAfter"::text=v->'after'->>'lifecycle') THEN RAISE EXCEPTION 'Equipment close evidence mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 END IF;
 END LOOP;
 IF r.status<>'CONFIRMED' THEN
 IF r.snapshot IS NOT NULL OR r."snapshotVersion" IS NOT NULL THEN RAISE EXCEPTION 'Nonconfirmed root snapshot' USING ERRCODE='23514'; END IF;
 ELSE
 IF active_count=0 OR (NOT physical AND r.observation IS NULL) OR NOT "rr_snapshot_v1"(r.snapshot,'ROOT') OR r.snapshot->>'reconciliationId' IS DISTINCT FROM r.id OR r.snapshot->'sourceDispatch'->>'id' IS DISTINCT FROM s.id OR r.snapshot->'sourceDispatch'->>'caseId' IS DISTINCT FROM r."caseId" OR r.snapshot->'sourceDispatch'->>'caseKitId' IS DISTINCT FROM r."caseKitId" OR r.snapshot->'sourceDispatch'->'history' IS DISTINCT FROM s.snapshot OR r.snapshot->'confirmedBy'->>'id' IS DISTINCT FROM r."confirmedById" OR (r.snapshot->>'confirmedAt')::timestamptz IS DISTINCT FROM r."confirmedAt" OR r.snapshot->>'observation' IS DISTINCT FROM r.observation OR (r.snapshot->'episodeFacts'->>'materialItemCount')::integer IS DISTINCT FROM mc OR (r.snapshot->'episodeFacts'->>'equipmentItemCount')::integer IS DISTINCT FROM ec OR (r.snapshot->'episodeFacts'->>'hasPhysicalMutation')::boolean IS DISTINCT FROM physical OR NOT EXISTS(SELECT 1 FROM "HealthcareCaseReconciliationAudit" a WHERE a."reconciliationId"=r.id AND a.operation='CONFIRM' AND a."actorId"=r."confirmedById" AND a."revisionBefore"=r."confirmedFromRevision" AND a."revisionAfter"=r.revision) THEN RAISE EXCEPTION 'Reconciliation final structure incomplete' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Reconciliation_final_state" AFTER INSERT OR UPDATE ON "HealthcareCaseReconciliation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "rr_final_state"();
CREATE CONSTRAINT TRIGGER "Reconciliation_item_final_state" AFTER INSERT OR UPDATE ON "HealthcareCaseReconciliationItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "rr_final_state"();
CREATE CONSTRAINT TRIGGER "Reconciliation_audit_final_state" AFTER INSERT ON "HealthcareCaseReconciliationAudit" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "rr_final_state"();
CREATE FUNCTION "rr_idempotency_resource"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "IdempotencyRecord"%ROWTYPE; valid boolean;
BEGIN
 SELECT * INTO r FROM "IdempotencyRecord" WHERE id=NEW.id;
 IF NOT FOUND OR r.scope::text NOT IN ('HEALTHCARE_CASE_RECONCILIATION_CREATE','HEALTHCARE_CASE_RECONCILIATION_ITEM_ADD','HEALTHCARE_CASE_RECONCILIATION_OUTCOME_SET','HEALTHCARE_CASE_RECONCILIATION_ITEM_EXCLUDE','HEALTHCARE_CASE_RECONCILIATION_CONFIRM','HEALTHCARE_CASE_RECONCILIATION_CANCEL') THEN RETURN NULL; END IF;
 IF r.scope::text IN ('HEALTHCARE_CASE_RECONCILIATION_ITEM_ADD','HEALTHCARE_CASE_RECONCILIATION_OUTCOME_SET','HEALTHCARE_CASE_RECONCILIATION_ITEM_EXCLUDE') THEN
 SELECT EXISTS(SELECT 1 FROM "HealthcareCaseReconciliationItem" i JOIN "HealthcareCaseReconciliation" p ON p.id=i."reconciliationId" AND p."companyId"=i."companyId" WHERE i.id=r."resourceId" AND i."companyId"=r."companyId") INTO valid;
 ELSE SELECT EXISTS(SELECT 1 FROM "HealthcareCaseReconciliation" WHERE id=r."resourceId" AND "companyId"=r."companyId") INTO valid; END IF;
 IF NOT valid OR r."resourceId" IS NULL OR length(btrim(r.key)) NOT BETWEEN 1 AND 128 OR r.key<>btrim(r.key) OR r."requestHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid Reconciliation idempotency resource' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Reconciliation_idempotency_resource" AFTER INSERT OR UPDATE ON "IdempotencyRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "rr_idempotency_resource"();
