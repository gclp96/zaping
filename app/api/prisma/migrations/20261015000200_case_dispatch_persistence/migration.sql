-- CreateEnum
CREATE TYPE "HealthcareCaseDispatchStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HealthcareCaseDispatchItemType" AS ENUM ('MATERIAL', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "HealthcareCaseDispatchItemLifecycle" AS ENUM ('ACTIVE', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "HealthcareCaseDispatchCustodianType" AS ENUM ('INTERNAL_USER', 'EXTERNAL_PERSON');

-- CreateEnum
CREATE TYPE "HealthcareCaseDispatchAuditOperation" AS ENUM ('CREATE', 'CUSTODIAN_SET', 'ITEM_ADD', 'ITEM_EXCLUDE', 'CONFIRM', 'CANCEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_CUSTODIAN_SET';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_ITEM_ADD';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_ITEM_EXCLUDE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_CONFIRM';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_CANCEL';

-- CreateTable
CREATE TABLE "HealthcareCaseDispatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseKitId" TEXT NOT NULL,
    "status" "HealthcareCaseDispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "custodianType" "HealthcareCaseDispatchCustodianType" NOT NULL,
    "custodianUserId" TEXT,
    "custodianDisplayName" VARCHAR(256) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedFromRevision" INTEGER,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" VARCHAR(1000),
    "snapshotVersion" INTEGER,
    "snapshot" JSONB,

    CONSTRAINT "HealthcareCaseDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareCaseDispatchItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseKitId" TEXT NOT NULL,
    "sourceCaseKitItemId" TEXT NOT NULL,
    "type" "HealthcareCaseDispatchItemType" NOT NULL,
    "lifecycle" "HealthcareCaseDispatchItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "productId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excludedById" TEXT,
    "excludedAt" TIMESTAMP(3),
    "exclusionReason" VARCHAR(1000),
    "snapshot" JSONB,
    "quantity" INTEGER,
    "batchId" TEXT,
    "sourcePositionId" TEXT,
    "expectedPositionRevision" INTEGER,
    "destinationPositionId" TEXT,
    "physicalEffectId" TEXT,
    "assignmentId" TEXT,
    "assetId" TEXT,
    "expectedPhysicalRevision" INTEGER,
    "equipmentCustodyId" TEXT,
    "equipmentPhysicalEventId" TEXT,

    CONSTRAINT "HealthcareCaseDispatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareCaseDispatchAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "dispatchItemId" TEXT,
    "operation" "HealthcareCaseDispatchAuditOperation" NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionBefore" INTEGER,
    "revisionAfter" INTEGER NOT NULL,
    "change" JSONB NOT NULL,

    CONSTRAINT "HealthcareCaseDispatchAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthcareCaseDispatch_companyId_caseId_createdAt_id_idx" ON "HealthcareCaseDispatch"("companyId", "caseId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "HealthcareCaseDispatch_companyId_caseId_status_createdAt_id_idx" ON "HealthcareCaseDispatch"("companyId", "caseId", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatch_id_companyId_key" ON "HealthcareCaseDispatch"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatch_parent_key" ON "HealthcareCaseDispatch"("id", "companyId", "caseId", "caseKitId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatchItem_equipmentCustodyId_key" ON "HealthcareCaseDispatchItem"("equipmentCustodyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatchItem_equipmentPhysicalEventId_key" ON "HealthcareCaseDispatchItem"("equipmentPhysicalEventId");

-- CreateIndex
CREATE INDEX "HealthcareCaseDispatchItem_companyId_dispatchId_createdAt_i_idx" ON "HealthcareCaseDispatchItem"("companyId", "dispatchId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "HealthcareCaseDispatchItem_companyId_sourceCaseKitItemId_li_idx" ON "HealthcareCaseDispatchItem"("companyId", "sourceCaseKitItemId", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatchItem_id_companyId_key" ON "HealthcareCaseDispatchItem"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatchItem_audit_parent_key" ON "HealthcareCaseDispatchItem"("id", "companyId", "dispatchId");

-- CreateIndex
CREATE INDEX "HealthcareCaseDispatchAudit_companyId_dispatchId_createdAt__idx" ON "HealthcareCaseDispatchAudit"("companyId", "dispatchId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseDispatchAudit_companyId_dispatchId_revisionAf_key" ON "HealthcareCaseDispatchAudit"("companyId", "dispatchId", "revisionAfter");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareCaseKitItem_dispatch_source_key" ON "HealthcareCaseKitItem"("id", "companyId", "caseId", "caseKitId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAssetPhysicalEvent_dispatch_identity_key" ON "EquipmentAssetPhysicalEvent"("id", "companyId", "equipmentAssetId");

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_caseKitId_companyId_caseId_fkey" FOREIGN KEY ("caseKitId", "companyId", "caseId") REFERENCES "HealthcareCaseKit"("id", "companyId", "caseId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_custodianUserId_companyId_fkey" FOREIGN KEY ("custodianUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_confirmedById_companyId_fkey" FOREIGN KEY ("confirmedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "HealthcareCaseDispatch_cancelledById_companyId_fkey" FOREIGN KEY ("cancelledById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_dispatchId_companyId_caseId_cas_fkey" FOREIGN KEY ("dispatchId", "companyId", "caseId", "caseKitId") REFERENCES "HealthcareCaseDispatch"("id", "companyId", "caseId", "caseKitId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_sourceCaseKitItemId_companyId_c_fkey" FOREIGN KEY ("sourceCaseKitItemId", "companyId", "caseId", "caseKitId") REFERENCES "HealthcareCaseKitItem"("id", "companyId", "caseId", "caseKitId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_productId_companyId_fkey" FOREIGN KEY ("productId", "companyId") REFERENCES "Product"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_batchId_companyId_productId_fkey" FOREIGN KEY ("batchId", "companyId", "productId") REFERENCES "InventoryBatch"("id", "companyId", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_sourcePositionId_companyId_fkey" FOREIGN KEY ("sourcePositionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_destinationPositionId_companyId_fkey" FOREIGN KEY ("destinationPositionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_physicalEffectId_companyId_fkey" FOREIGN KEY ("physicalEffectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_assignmentId_companyId_caseId_a_fkey" FOREIGN KEY ("assignmentId", "companyId", "caseId", "assetId") REFERENCES "HealthcareEquipmentAssignment"("id", "companyId", "caseId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_assetId_companyId_fkey" FOREIGN KEY ("assetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_equipmentCustodyId_companyId_as_fkey" FOREIGN KEY ("equipmentCustodyId", "companyId", "assetId") REFERENCES "EquipmentAssetCustody"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_equipmentPhysicalEventId_compan_fkey" FOREIGN KEY ("equipmentPhysicalEventId", "companyId", "assetId") REFERENCES "EquipmentAssetPhysicalEvent"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_addedById_companyId_fkey" FOREIGN KEY ("addedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "HealthcareCaseDispatchItem_excludedById_companyId_fkey" FOREIGN KEY ("excludedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchAudit" ADD CONSTRAINT "HealthcareCaseDispatchAudit_dispatchId_companyId_fkey" FOREIGN KEY ("dispatchId", "companyId") REFERENCES "HealthcareCaseDispatch"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchAudit" ADD CONSTRAINT "HealthcareCaseDispatchAudit_dispatchItemId_companyId_dispa_fkey" FOREIGN KEY ("dispatchItemId", "companyId", "dispatchId") REFERENCES "HealthcareCaseDispatchItem"("id", "companyId", "dispatchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "HealthcareCaseDispatchAudit" ADD CONSTRAINT "HealthcareCaseDispatchAudit_actorId_companyId_fkey" FOREIGN KEY ("actorId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Dispatch structural guarantees. No business commands or physical execution.
ALTER TABLE "HealthcareCaseDispatch" ADD CONSTRAINT "Dispatch_root_shape" CHECK (
  revision >= 0 AND length(btrim("custodianDisplayName")) BETWEEN 1 AND 256
  AND "custodianDisplayName" = btrim("custodianDisplayName")
  AND ("custodianType" <> 'EXTERNAL_PERSON' OR "custodianUserId" IS NULL)
  AND (
    (status = 'DRAFT' AND "confirmedFromRevision" IS NULL AND "confirmedById" IS NULL AND "confirmedAt" IS NULL
      AND "cancelledById" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
    OR (status = 'CONFIRMED' AND "confirmedFromRevision" IS NOT NULL AND "confirmedFromRevision" >= 0
      AND revision = "confirmedFromRevision" + 1 AND "confirmedById" IS NOT NULL AND "confirmedAt" IS NOT NULL
      AND "cancelledById" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL
      AND "snapshotVersion" IS NOT NULL AND "snapshotVersion" = 1 AND snapshot IS NOT NULL AND jsonb_typeof(snapshot) = 'object')
    OR (status = 'CANCELLED' AND "confirmedFromRevision" IS NULL AND "confirmedById" IS NULL AND "confirmedAt" IS NULL
      AND "cancelledById" IS NOT NULL AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL
      AND length(btrim("cancellationReason")) BETWEEN 1 AND 1000 AND "snapshotVersion" IS NULL AND snapshot IS NULL)
  )
);
ALTER TABLE "HealthcareCaseDispatchItem" ADD CONSTRAINT "Dispatch_item_shape" CHECK (
  ((type = 'MATERIAL' AND quantity IS NOT NULL AND quantity > 0 AND "sourcePositionId" IS NOT NULL
      AND "expectedPositionRevision" IS NOT NULL AND "expectedPositionRevision" >= 0
      AND "assignmentId" IS NULL AND "assetId" IS NULL AND "expectedPhysicalRevision" IS NULL
      AND "equipmentCustodyId" IS NULL AND "equipmentPhysicalEventId" IS NULL)
   OR (type = 'EQUIPMENT' AND quantity IS NULL AND "batchId" IS NULL AND "sourcePositionId" IS NULL AND "expectedPositionRevision" IS NULL
      AND "destinationPositionId" IS NULL AND "physicalEffectId" IS NULL AND "assignmentId" IS NOT NULL AND "assetId" IS NOT NULL
      AND "expectedPhysicalRevision" IS NOT NULL AND "expectedPhysicalRevision" >= 0))
  AND ((lifecycle = 'ACTIVE' AND "excludedById" IS NULL AND "excludedAt" IS NULL AND "exclusionReason" IS NULL)
    OR (lifecycle = 'EXCLUDED' AND "excludedById" IS NOT NULL AND "excludedAt" IS NOT NULL AND "exclusionReason" IS NOT NULL
      AND length(btrim("exclusionReason")) BETWEEN 1 AND 1000 AND "destinationPositionId" IS NULL AND "physicalEffectId" IS NULL
      AND "equipmentCustodyId" IS NULL AND "equipmentPhysicalEventId" IS NULL))
  AND (("destinationPositionId" IS NULL) = ("physicalEffectId" IS NULL))
  AND (("equipmentCustodyId" IS NULL) = ("equipmentPhysicalEventId" IS NULL))
  AND (snapshot IS NULL OR jsonb_typeof(snapshot) = 'object')
);
ALTER TABLE "HealthcareCaseDispatchAudit" ADD CONSTRAINT "Dispatch_audit_shape" CHECK (
  ((operation = 'CREATE' AND "revisionBefore" IS NULL AND "revisionAfter" = 0)
    OR (operation <> 'CREATE' AND "revisionBefore" IS NOT NULL AND "revisionBefore" >= 0 AND "revisionAfter" = "revisionBefore" + 1))
  AND ((operation IN ('ITEM_ADD','ITEM_EXCLUDE')) = ("dispatchItemId" IS NOT NULL))
  AND COALESCE(jsonb_typeof(change) = 'object' AND change->'version' = '1'::jsonb
    AND change->>'operation' = operation::text AND change ? 'reason'
    AND (change->'reason' = 'null'::jsonb OR (jsonb_typeof(change->'reason')='string' AND length(change->>'reason') BETWEEN 1 AND 1000))
    AND change - ARRAY['version','operation','reason'] = '{}'::jsonb, false)
  AND octet_length(change::text) <= 8192
);
CREATE UNIQUE INDEX "Dispatch_material_active_source_key" ON "HealthcareCaseDispatchItem" ("companyId","dispatchId","sourceCaseKitItemId","sourcePositionId") WHERE type = 'MATERIAL' AND lifecycle = 'ACTIVE';
CREATE UNIQUE INDEX "Dispatch_equipment_active_source_key" ON "HealthcareCaseDispatchItem" ("companyId","dispatchId","sourceCaseKitItemId") WHERE type = 'EQUIPMENT' AND lifecycle = 'ACTIVE';
CREATE UNIQUE INDEX "Dispatch_equipment_active_asset_key" ON "HealthcareCaseDispatchItem" ("companyId","dispatchId","assetId") WHERE type = 'EQUIPMENT' AND lifecycle = 'ACTIVE';
CREATE UNIQUE INDEX "Dispatch_equipment_historical_source_key" ON "HealthcareCaseDispatchItem" ("companyId","sourceCaseKitItemId") WHERE "equipmentCustodyId" IS NOT NULL;

CREATE FUNCTION "dispatch_reject_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Dispatch history is append-only' USING ERRCODE = '23514'; END $$;
CREATE FUNCTION "dispatch_root_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Dispatch terminal/history mutation rejected' USING ERRCODE = '23514';
  END IF;
  IF (NEW.id,NEW."companyId",NEW."caseId",NEW."caseKitId",NEW."createdById",NEW."createdAt")
    IS DISTINCT FROM (OLD.id,OLD."companyId",OLD."caseId",OLD."caseKitId",OLD."createdById",OLD."createdAt") THEN
    RAISE EXCEPTION 'Dispatch identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Dispatch_root_guard" BEFORE UPDATE OR DELETE ON "HealthcareCaseDispatch" FOR EACH ROW EXECUTE FUNCTION "dispatch_root_guard"();
CREATE FUNCTION "dispatch_item_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "HealthcareCaseDispatchStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id,NEW."companyId",NEW."dispatchId",NEW."caseId",NEW."caseKitId")
    IS DISTINCT FROM (OLD.id,OLD."companyId",OLD."dispatchId",OLD."caseId",OLD."caseKitId") THEN
    RAISE EXCEPTION 'Dispatch item identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status FROM "HealthcareCaseDispatch" WHERE id=OLD."dispatchId" AND "companyId"=OLD."companyId" FOR UPDATE;
  ELSE
    SELECT status INTO parent_status FROM "HealthcareCaseDispatch" WHERE id=NEW."dispatchId" AND "companyId"=NEW."companyId" FOR UPDATE;
  END IF;
  IF parent_status <> 'DRAFT' THEN RAISE EXCEPTION 'Terminal Dispatch items are immutable' USING ERRCODE = '23514'; END IF;
  IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM "IdempotencyRecord" WHERE "companyId"=OLD."companyId" AND "resourceId"=OLD.id
    AND scope::text IN ('HEALTHCARE_CASE_DISPATCH_ITEM_ADD','HEALTHCARE_CASE_DISPATCH_ITEM_EXCLUDE')) THEN
    RAISE EXCEPTION 'Dispatch idempotency resource cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Dispatch_item_guard" BEFORE INSERT OR UPDATE OR DELETE ON "HealthcareCaseDispatchItem" FOR EACH ROW EXECUTE FUNCTION "dispatch_item_guard"();
CREATE TRIGGER "Dispatch_audit_append_only" BEFORE UPDATE OR DELETE ON "HealthcareCaseDispatchAudit" FOR EACH ROW EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE TRIGGER "Dispatch_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseDispatch" EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE TRIGGER "Dispatch_item_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseDispatchItem" EXECUTE FUNCTION "dispatch_reject_history_mutation"();
CREATE TRIGGER "Dispatch_audit_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseDispatchAudit" EXECUTE FUNCTION "dispatch_reject_history_mutation"();

-- Descriptive JSON is versioned and bounded. Typed parsers additionally whitelist
-- public fields; normalized IDs/physical evidence remain the durable authority.
CREATE FUNCTION "dispatch_json_text"(v jsonb, maximum integer, nullable boolean DEFAULT false) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE((nullable AND v='null'::jsonb) OR (jsonb_typeof(v)='string' AND length(btrim(v #>> '{}')) BETWEEN 1 AND maximum),false)
$$;
CREATE FUNCTION "dispatch_json_date"(v jsonb, nullable boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF nullable AND v='null'::jsonb THEN RETURN true; END IF;
 IF NOT "dispatch_json_text"(v,40) OR (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' THEN RETURN false; END IF;
 PERFORM (v #>> '{}')::timestamptz; RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE FUNCTION "dispatch_snapshot_v1"(value jsonb, kind text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_typeof(value)='object' AND value->'version'='1'::jsonb AND octet_length(value::text)<=32768 AND
 CASE WHEN kind='ROOT' THEN
   jsonb_typeof(value->'case')='object' AND "dispatch_json_text"(value->'case'->'id',128)
   AND "dispatch_json_text"(value->'case'->'folio',256)
   AND "dispatch_json_date"(value->'case'->'scheduledStart',true) AND "dispatch_json_date"(value->'case'->'scheduledEnd',true)
   AND jsonb_typeof(value->'custodian')='object' AND value->'custodian'->>'type' IN ('INTERNAL_USER','EXTERNAL_PERSON')
   AND "dispatch_json_text"(value->'custodian'->'displayName',256) AND "dispatch_json_text"(value->'custodian'->'userId',128,true)
   AND jsonb_typeof(value->'dispatchedBy')='object' AND "dispatch_json_text"(value->'dispatchedBy'->'id',128)
   AND "dispatch_json_text"(value->'dispatchedBy'->'firstName',256) AND "dispatch_json_text"(value->'dispatchedBy'->'lastName',256)
   AND "dispatch_json_date"(value->'dispatchedAt')
 ELSE
   jsonb_typeof(value->'product')='object' AND "dispatch_json_text"(value->'product'->'id',128)
   AND "dispatch_json_text"(value->'product'->'sku',256) AND "dispatch_json_text"(value->'product'->'name',1000)
   AND value->'product'->>'inventoryTracking' IN ('QUANTITY','ASSET')
   AND value->'product'->>'lotTracking' IN ('NONE','OPTIONAL','REQUIRED')
   AND jsonb_typeof(value->'preparation')='object' AND "dispatch_json_text"(value->'preparation'->'sourceCaseKitItemId',128)
   AND "dispatch_json_text"(value->'preparation'->'requirementId',128,true)
   AND "dispatch_json_text"(value->'preparation'->'assignmentId',128,true)
   AND (value->'preparation'->'preparedQuantity'='null'::jsonb OR (jsonb_typeof(value->'preparation'->'preparedQuantity')='number'
     AND value->'preparation'->>'preparedQuantity' ~ '^[1-9][0-9]*$'))
   AND (value->'batch'='null'::jsonb OR (jsonb_typeof(value->'batch')='object' AND "dispatch_json_text"(value->'batch'->'id',128)
      AND "dispatch_json_text"(value->'batch'->'lotNumber',256) AND "dispatch_json_date"(value->'batch'->'expirationDate',true)))
   AND (value->'equipment'='null'::jsonb OR (jsonb_typeof(value->'equipment')='object' AND "dispatch_json_text"(value->'equipment'->'id',128)
      AND "dispatch_json_text"(value->'equipment'->'assetCode',256) AND "dispatch_json_text"(value->'equipment'->'serialNumber',256,true)))
 END, false)
$$;
CREATE FUNCTION "dispatch_final_state"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "HealthcareCaseDispatch"%ROWTYPE; target text; bad boolean;
BEGIN
  IF TG_TABLE_NAME='HealthcareCaseDispatch' THEN target:=NEW.id;
  ELSIF TG_OP='DELETE' THEN target:=OLD."dispatchId"; ELSE target:=NEW."dispatchId"; END IF;
  SELECT * INTO d FROM "HealthcareCaseDispatch" WHERE id=target;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF d.status <> 'CONFIRMED' THEN
    SELECT d.snapshot IS NOT NULL OR d."snapshotVersion" IS NOT NULL OR EXISTS(SELECT 1 FROM "HealthcareCaseDispatchItem" i WHERE i."dispatchId"=d.id AND
      (i.snapshot IS NOT NULL OR i."physicalEffectId" IS NOT NULL OR i."destinationPositionId" IS NOT NULL
        OR i."equipmentCustodyId" IS NOT NULL OR i."equipmentPhysicalEventId" IS NOT NULL)) INTO bad;
  ELSE
    bad := NOT "dispatch_snapshot_v1"(d.snapshot,'ROOT')
      OR d.snapshot->'case'->>'id' IS DISTINCT FROM d."caseId"
      OR d.snapshot->'custodian'->>'type' IS DISTINCT FROM d."custodianType"::text
      OR d.snapshot->'custodian'->>'userId' IS DISTINCT FROM d."custodianUserId"
      OR d.snapshot->'custodian'->>'displayName' IS DISTINCT FROM d."custodianDisplayName"
      OR d.snapshot->'dispatchedBy'->>'id' IS DISTINCT FROM d."confirmedById"
      OR (d.snapshot->>'dispatchedAt')::timestamptz IS DISTINCT FROM d."confirmedAt"
      OR NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchItem" WHERE "dispatchId"=d.id AND lifecycle='ACTIVE')
      OR NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchAudit" WHERE "dispatchId"=d.id AND operation='CONFIRM'
         AND "actorId"=d."confirmedById" AND "revisionBefore"=d."confirmedFromRevision" AND "revisionAfter"=d.revision);
    IF NOT bad THEN
      SELECT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchItem" i WHERE i."dispatchId"=d.id AND (
        NOT "dispatch_snapshot_v1"(i.snapshot,'ITEM') OR i.snapshot->'product'->>'id' IS DISTINCT FROM i."productId"
        OR i.snapshot->'preparation'->>'sourceCaseKitItemId' IS DISTINCT FROM i."sourceCaseKitItemId"
        OR i.snapshot->'preparation'->>'assignmentId' IS DISTINCT FROM i."assignmentId"
        OR (i.type='MATERIAL' AND (i.snapshot->'batch'->>'id' IS DISTINCT FROM i."batchId" OR i.snapshot->'equipment' <> 'null'::jsonb))
        OR (i.type='EQUIPMENT' AND (i.snapshot->'equipment'->>'id' IS DISTINCT FROM i."assetId" OR i.snapshot->'batch' <> 'null'::jsonb))
        OR (i.lifecycle='ACTIVE' AND i.type='MATERIAL' AND NOT EXISTS(
          SELECT 1 FROM "InventoryPosition" s JOIN "InventoryPosition" t ON t.id=i."destinationPositionId" AND t."companyId"=i."companyId"
          JOIN "InventoryPhysicalEffect" e ON e.id=i."physicalEffectId" AND e."companyId"=i."companyId"
          WHERE s.id=i."sourcePositionId" AND s."companyId"=i."companyId" AND s."productId"=i."productId"
            AND s."inventoryBatchId" IS NOT DISTINCT FROM i."batchId" AND s.state='AVAILABLE' AND s."contextType" IS NULL AND s."contextId" IS NULL
            AND t."productId"=i."productId" AND t."inventoryBatchId" IS NOT DISTINCT FROM i."batchId" AND t.state='CUSTODY'
            AND t."contextType"='CASE_DISPATCH_ITEM' AND t."contextId"=i.id
            AND e.kind='TRANSFER' AND e."originType"='CASE_DISPATCH' AND e."originId"=d.id AND e."originOperation"='CONFIRM_QUANTITY'
            AND e."actorId"=d."confirmedById"
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=s.id AND l.delta=-(SELECT sum(x.quantity) FROM "HealthcareCaseDispatchItem" x WHERE x."dispatchId"=d.id AND x.lifecycle='ACTIVE' AND x."sourcePositionId"=s.id AND x."physicalEffectId"=e.id) AND l."revisionBefore"=i."expectedPositionRevision")
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=t.id AND l.delta=i.quantity)))
        OR (i.lifecycle='ACTIVE' AND i.type='EQUIPMENT' AND NOT EXISTS(
          SELECT 1 FROM "EquipmentAssetCustody" c JOIN "EquipmentAssetPhysicalEvent" e ON e.id=i."equipmentPhysicalEventId" AND e."companyId"=i."companyId"
          WHERE c.id=i."equipmentCustodyId" AND c."companyId"=i."companyId" AND c."equipmentAssetId"=i."assetId"
            AND c."caseId"=d."caseId" AND c."assignmentId"=i."assignmentId" AND c."openedById"=d."confirmedById"
            AND e."equipmentAssetId"=i."assetId" AND e."custodyId"=c.id AND e.operation='CUSTODY_OPEN'
            AND e."originType"='CASE_DISPATCH_ITEM' AND e."originId"=i.id AND e."originOperation"='CONFIRM_EQUIPMENT'
            AND e."revisionBefore"=i."expectedPhysicalRevision" AND e."actorId"=d."confirmedById"))
      )) INTO bad;
    END IF;
  END IF;
  IF bad THEN RAISE EXCEPTION 'Dispatch final evidence/snapshot incomplete' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Dispatch_final_state" AFTER INSERT OR UPDATE ON "HealthcareCaseDispatch" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dispatch_final_state"();
CREATE CONSTRAINT TRIGGER "Dispatch_item_final_state" AFTER INSERT OR UPDATE OR DELETE ON "HealthcareCaseDispatchItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dispatch_final_state"();
CREATE CONSTRAINT TRIGGER "Dispatch_audit_final_state" AFTER INSERT ON "HealthcareCaseDispatchAudit" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dispatch_final_state"();

CREATE FUNCTION "dispatch_idempotency_resource"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "IdempotencyRecord"%ROWTYPE; valid boolean;
BEGIN
  SELECT * INTO r FROM "IdempotencyRecord" WHERE id=NEW.id;
  IF NOT FOUND OR r.scope::text NOT IN ('HEALTHCARE_CASE_DISPATCH_CREATE','HEALTHCARE_CASE_DISPATCH_CUSTODIAN_SET',
    'HEALTHCARE_CASE_DISPATCH_ITEM_ADD','HEALTHCARE_CASE_DISPATCH_ITEM_EXCLUDE','HEALTHCARE_CASE_DISPATCH_CONFIRM','HEALTHCARE_CASE_DISPATCH_CANCEL') THEN RETURN NULL; END IF;
  IF r.scope::text IN ('HEALTHCARE_CASE_DISPATCH_ITEM_ADD','HEALTHCARE_CASE_DISPATCH_ITEM_EXCLUDE') THEN
    SELECT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchItem" WHERE id=r."resourceId" AND "companyId"=r."companyId") INTO valid;
  ELSE SELECT EXISTS(SELECT 1 FROM "HealthcareCaseDispatch" WHERE id=r."resourceId" AND "companyId"=r."companyId") INTO valid; END IF;
  IF NOT valid OR length(btrim(r.key)) NOT BETWEEN 1 AND 128 OR r.key <> btrim(r.key) OR r."requestHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid Dispatch idempotency resource' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Dispatch_idempotency_resource" AFTER INSERT OR UPDATE ON "IdempotencyRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dispatch_idempotency_resource"();
