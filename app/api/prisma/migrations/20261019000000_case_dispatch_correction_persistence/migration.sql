-- HC-DSP-COR-01B. Forward-only; no data migration, writer, route or cutover.
-- New enum value is compared as text below, so no same-transaction enum use.
BEGIN;

ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF';

CREATE TYPE "HealthcareCaseDispatchCorrectionKind" AS ENUM ('NO_PHYSICAL_HANDOFF');

CREATE TYPE "HealthcareCaseDispatchCorrectionStatus" AS ENUM ('CONFIRMED');

CREATE TABLE "HealthcareCaseDispatchCorrection" (
    "creationTransactionId" xid8 NOT NULL DEFAULT pg_current_xact_id(),
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseKitId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "kind" "HealthcareCaseDispatchCorrectionKind" NOT NULL DEFAULT 'NO_PHYSICAL_HANDOFF',
    "status" "HealthcareCaseDispatchCorrectionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "reason" VARCHAR(1000) NOT NULL,
    "attestedNoHandoff" BOOLEAN NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashVersion" INTEGER NOT NULL DEFAULT 1,
    "requestHash" CHAR(64) NOT NULL,
    "idempotencyRecordId" TEXT NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB,

    CONSTRAINT "HealthcareCaseDispatchCorrection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthcareCaseDispatchCorrectionItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "correctionId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "sourceDispatchItemId" TEXT NOT NULL,
    "type" "HealthcareCaseDispatchItemType" NOT NULL,
    "quantity" INTEGER,
    "originalPhysicalEffectId" TEXT,
    "sourceCustodyPositionId" TEXT,
    "compensatingEffectId" TEXT,
    "destinationPositionId" TEXT,
    "assetId" TEXT,
    "equipmentCustodyId" TEXT,
    "openPhysicalEventId" TEXT,
    "closePhysicalEventId" TEXT,
    "snapshot" JSONB,

    CONSTRAINT "HealthcareCaseDispatchCorrectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_correction_identity_key" ON "IdempotencyRecord"("id", "companyId");

CREATE UNIQUE INDEX "DispatchCorrection_idempotency_key" ON "HealthcareCaseDispatchCorrection"("idempotencyRecordId");

CREATE INDEX "DispatchCorrection_case_idx" ON "HealthcareCaseDispatchCorrection"("companyId", "caseId", "confirmedAt", "id");

CREATE INDEX "DispatchCorrection_creation_transaction_idx" ON "HealthcareCaseDispatchCorrection"("creationTransactionId");

CREATE UNIQUE INDEX "DispatchCorrection_dispatch_key" ON "HealthcareCaseDispatchCorrection"("companyId", "dispatchId");

CREATE UNIQUE INDEX "DispatchCorrection_dispatch_relation_key" ON "HealthcareCaseDispatchCorrection"("dispatchId", "companyId", "caseId", "caseKitId");

CREATE UNIQUE INDEX "DispatchCorrection_idempotency_relation_key" ON "HealthcareCaseDispatchCorrection"("idempotencyRecordId", "companyId");

CREATE UNIQUE INDEX "DispatchCorrection_parent_key" ON "HealthcareCaseDispatchCorrection"("id", "companyId", "dispatchId");

CREATE UNIQUE INDEX "DispatchCorrectionItem_close_key" ON "HealthcareCaseDispatchCorrectionItem"("closePhysicalEventId");

CREATE INDEX "DispatchCorrectionItem_source_idx" ON "HealthcareCaseDispatchCorrectionItem"("companyId", "sourceDispatchItemId");

CREATE UNIQUE INDEX "DispatchCorrectionItem_source_key" ON "HealthcareCaseDispatchCorrectionItem"("companyId", "correctionId", "sourceDispatchItemId");

ALTER TABLE "HealthcareCaseDispatchCorrection" ADD CONSTRAINT "HealthcareCaseDispatchCorrection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrection" ADD CONSTRAINT "HealthcareCaseDispatchCorrection_caseId_companyId_fkey" FOREIGN KEY ("caseId", "companyId") REFERENCES "HealthcareCase"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrection" ADD CONSTRAINT "HealthcareCaseDispatchCorrection_dispatchId_companyId_case_fkey" FOREIGN KEY ("dispatchId", "companyId", "caseId", "caseKitId") REFERENCES "HealthcareCaseDispatch"("id", "companyId", "caseId", "caseKitId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrection" ADD CONSTRAINT "HealthcareCaseDispatchCorrection_confirmedById_companyId_fkey" FOREIGN KEY ("confirmedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrection" ADD CONSTRAINT "HealthcareCaseDispatchCorrection_idempotencyRecordId_compa_fkey" FOREIGN KEY ("idempotencyRecordId", "companyId") REFERENCES "IdempotencyRecord"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_correctionId_companyI_fkey" FOREIGN KEY ("correctionId", "companyId", "dispatchId") REFERENCES "HealthcareCaseDispatchCorrection"("id", "companyId", "dispatchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_sourceDispatchItemId__fkey" FOREIGN KEY ("sourceDispatchItemId", "companyId", "dispatchId") REFERENCES "HealthcareCaseDispatchItem"("id", "companyId", "dispatchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_originalPhysicalEffec_fkey" FOREIGN KEY ("originalPhysicalEffectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_sourceCustodyPosition_fkey" FOREIGN KEY ("sourceCustodyPositionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_compensatingEffectId__fkey" FOREIGN KEY ("compensatingEffectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_destinationPositionId_fkey" FOREIGN KEY ("destinationPositionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_assetId_companyId_fkey" FOREIGN KEY ("assetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_equipmentCustodyId_co_fkey" FOREIGN KEY ("equipmentCustodyId", "companyId", "assetId") REFERENCES "EquipmentAssetCustody"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_openPhysicalEventId_c_fkey" FOREIGN KEY ("openPhysicalEventId", "companyId", "assetId") REFERENCES "EquipmentAssetPhysicalEvent"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "HealthcareCaseDispatchCorrectionItem_closePhysicalEventId__fkey" FOREIGN KEY ("closePhysicalEventId", "companyId", "assetId") REFERENCES "EquipmentAssetPhysicalEvent"("id", "companyId", "equipmentAssetId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HealthcareCaseDispatchCorrection" ADD CONSTRAINT "DispatchCorrection_shape" CHECK (
  kind='NO_PHYSICAL_HANDOFF' AND status='CONFIRMED' AND "attestedNoHandoff"
  AND reason=btrim(reason) AND length(reason) BETWEEN 1 AND 1000
  AND reason !~ '^[[:space:]]|[[:space:]]$'
  AND "hashVersion"=1 AND "requestHash" ~ '^[a-f0-9]{64}$' AND "snapshotVersion"=1
);
-- Nullable evidence permits staging, never a committed provisional witness.
ALTER TABLE "HealthcareCaseDispatchCorrectionItem" ADD CONSTRAINT "DispatchCorrectionItem_shape" CHECK (
  (type='MATERIAL' AND (quantity IS NULL OR quantity>0) AND "assetId" IS NULL
    AND "equipmentCustodyId" IS NULL AND "openPhysicalEventId" IS NULL AND "closePhysicalEventId" IS NULL)
  OR (type='EQUIPMENT' AND quantity IS NULL AND "originalPhysicalEffectId" IS NULL
    AND "sourceCustodyPositionId" IS NULL AND "compensatingEffectId" IS NULL AND "destinationPositionId" IS NULL)
);

-- Seal-time locks cover concurrent changes; NOWAIT fails closed with 55P03
-- instead of introducing a new blocking lock order into existing writers.
-- No data is changed. The creating transaction already owns its new evidence.
CREATE FUNCTION public.dispatch_correction_lock_dependencies(p_id text) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r "HealthcareCaseDispatchCorrection"%ROWTYPE;
BEGIN
  SELECT * INTO r FROM "HealthcareCaseDispatchCorrection" WHERE id=p_id;
  PERFORM 1 FROM "HealthcareCaseDispatch" WHERE id=r."dispatchId" AND "companyId"=r."companyId" FOR UPDATE NOWAIT;
  PERFORM 1 FROM "User" WHERE id=r."confirmedById" AND "companyId"=r."companyId" FOR NO KEY UPDATE NOWAIT;
  PERFORM 1 FROM "InventoryPosition" p WHERE p."companyId"=r."companyId" AND EXISTS(
    SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i JOIN "HealthcareCaseDispatchItem" s ON s.id=i."sourceDispatchItemId"
    WHERE i."correctionId"=r.id AND i."companyId"=r."companyId" AND i.type='MATERIAL'
      AND p.id IN (i."sourceCustodyPositionId",i."destinationPositionId",s."sourcePositionId",s."destinationPositionId"))
    ORDER BY p.id FOR UPDATE OF p NOWAIT;
  PERFORM 1 FROM "InventoryPhysicalEffect" e WHERE e."companyId"=r."companyId" AND EXISTS(
    SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i WHERE i."correctionId"=r.id AND i."companyId"=r."companyId"
      AND e.id IN (i."originalPhysicalEffectId",i."compensatingEffectId")) ORDER BY e.id FOR UPDATE OF e NOWAIT;
  PERFORM 1 FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND EXISTS(
    SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i WHERE i."correctionId"=r.id AND i."companyId"=r."companyId"
      AND l."effectId" IN (i."originalPhysicalEffectId",i."compensatingEffectId")) ORDER BY l.id FOR UPDATE OF l NOWAIT;
  -- Asset FOR UPDATE also fences INSERTs of new Events/Custodies through their
  -- existing immediate tenant-safe FK key-share checks in other transactions.
  PERFORM 1 FROM "EquipmentAsset" a WHERE a."companyId"=r."companyId" AND EXISTS(
    SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i WHERE i."correctionId"=r.id AND i."companyId"=r."companyId"
      AND i."assetId"=a.id) ORDER BY a.id FOR UPDATE OF a NOWAIT;
  PERFORM 1 FROM "EquipmentAssetCustody" c WHERE c."companyId"=r."companyId" AND EXISTS(
    SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i WHERE i."correctionId"=r.id AND i."companyId"=r."companyId"
      AND i."equipmentCustodyId"=c.id) ORDER BY c.id FOR UPDATE OF c NOWAIT;
END $$;

CREATE FUNCTION public.dispatch_correction_root_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN
      RAISE EXCEPTION 'Correction requires READ COMMITTED for terminal dependency visibility'
        USING ERRCODE='23514', CONSTRAINT='DispatchCorrection_isolation';
    END IF;
    IF NEW."creationTransactionId" IS DISTINCT FROM pg_current_xact_id() OR NEW.snapshot IS NOT NULL THEN
      RAISE EXCEPTION 'Correction must start unsealed in its creating transaction' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Correction history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF OLD.snapshot IS NOT NULL OR (to_jsonb(NEW)-'snapshot') IS DISTINCT FROM (to_jsonb(OLD)-'snapshot')
    OR NEW.snapshot IS NULL THEN
    RAISE EXCEPTION 'Correction immutable identity/sealed history' USING ERRCODE='23514';
  END IF;
  PERFORM public.dispatch_correction_lock_dependencies(NEW.id);
  RETURN NEW;
END $$;
CREATE FUNCTION public.dispatch_correction_item_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sealed jsonb;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Correction item history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT snapshot INTO sealed FROM "HealthcareCaseDispatchCorrection"
    WHERE id=NEW."correctionId" AND "companyId"=NEW."companyId" FOR UPDATE;
  IF NOT FOUND OR sealed IS NOT NULL THEN
    RAISE EXCEPTION 'Correction sealed or missing parent' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.id,NEW."companyId",NEW."correctionId",NEW."dispatchId",NEW."sourceDispatchItemId",NEW.type)
    IS DISTINCT FROM ROW(OLD.id,OLD."companyId",OLD."correctionId",OLD."dispatchId",OLD."sourceDispatchItemId",OLD.type) THEN
    RAISE EXCEPTION 'Correction item immutable identity' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DispatchCorrection_root_guard" BEFORE INSERT OR UPDATE OR DELETE ON "HealthcareCaseDispatchCorrection"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_root_guard();
CREATE TRIGGER "DispatchCorrection_item_guard" BEFORE INSERT OR UPDATE OR DELETE ON "HealthcareCaseDispatchCorrectionItem"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_item_guard();
CREATE TRIGGER "DispatchCorrection_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseDispatchCorrection"
  EXECUTE FUNCTION public.dispatch_reject_history_mutation();
CREATE TRIGGER "DispatchCorrectionItem_no_truncate" BEFORE TRUNCATE ON "HealthcareCaseDispatchCorrectionItem"
  EXECUTE FUNCTION public.dispatch_reject_history_mutation();

-- Local seal fence, NOT an Inventory history policy. Only a sealed Correction
-- born in this top-level xid8 can restrict a dependent row. Historical roots
-- never match, including after xid32 wraparound or within SAVEPOINTs. Unsealed
-- staging is unrestricted. No aggregate validator is queued per physical row.
CREATE FUNCTION public.dispatch_correction_sealed_dependency() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE old_row jsonb; new_row jsonb; changed jsonb; blocked boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN old_row:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN new_row:=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='User' AND ROW(old_row->'id',old_row->'companyId',old_row->'role')
    IS NOT DISTINCT FROM ROW(new_row->'id',new_row->'companyId',new_row->'role') THEN RETURN NEW; END IF;
  FOR changed IN SELECT v FROM (VALUES(old_row),(new_row)) changes(v) WHERE v IS NOT NULL LOOP
    WITH cohort AS MATERIALIZED (
      SELECT * FROM "HealthcareCaseDispatchCorrection"
      WHERE "creationTransactionId"=pg_current_xact_id_if_assigned() AND snapshot IS NOT NULL
        AND "companyId"=changed->>'companyId'
    )
    SELECT EXISTS(SELECT 1 FROM cohort r WHERE
      CASE
        WHEN TG_TABLE_NAME='User' THEN r."confirmedById"=changed->>'id'
        WHEN TG_TABLE_NAME IN ('HealthcareCaseReconciliation','HealthcareCaseReconciliationItem')
          THEN r."dispatchId"=changed->>'dispatchId'
        WHEN TG_TABLE_NAME='InventoryPhysicalEffect' AND changed->>'originType'='CASE_DISPATCH_CORRECTION'
          AND r.id=changed->>'originId' THEN true
        ELSE EXISTS(
          SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i
          JOIN "HealthcareCaseDispatchItem" s ON s.id=i."sourceDispatchItemId" AND s."companyId"=i."companyId"
          WHERE i."correctionId"=r.id AND i."companyId"=r."companyId" AND CASE TG_TABLE_NAME
            WHEN 'InventoryPosition' THEN changed->>'id' IN (i."sourceCustodyPositionId",i."destinationPositionId",s."sourcePositionId",s."destinationPositionId")
            WHEN 'InventoryPhysicalEffect' THEN changed->>'id' IN (i."originalPhysicalEffectId",i."compensatingEffectId")
            WHEN 'InventoryPhysicalEffectLine' THEN changed->>'effectId' IN (i."originalPhysicalEffectId",i."compensatingEffectId")
            WHEN 'EquipmentAsset' THEN changed->>'id'=i."assetId"
            WHEN 'EquipmentAssetCustody' THEN changed->>'equipmentAssetId'=i."assetId"
            WHEN 'EquipmentAssetPhysicalEvent' THEN changed->>'equipmentAssetId'=i."assetId"
            ELSE false END)
      END) INTO blocked;
    IF blocked THEN
      RAISE EXCEPTION 'Correction dependencies sealed until creating transaction commits'
        USING ERRCODE='23514', CONSTRAINT='DispatchCorrection_dependencies_sealed';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DispatchCorrection_position_seal" BEFORE INSERT OR UPDATE OR DELETE ON "InventoryPosition"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_effect_seal" BEFORE INSERT OR UPDATE OR DELETE ON "InventoryPhysicalEffect"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_line_seal" BEFORE INSERT OR UPDATE OR DELETE ON "InventoryPhysicalEffectLine"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_asset_seal" BEFORE INSERT OR UPDATE OR DELETE ON "EquipmentAsset"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_custody_seal" BEFORE INSERT OR UPDATE OR DELETE ON "EquipmentAssetCustody"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_event_seal" BEFORE INSERT OR UPDATE OR DELETE ON "EquipmentAssetPhysicalEvent"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_actor_seal" BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_rr_seal" BEFORE INSERT OR UPDATE OR DELETE ON "HealthcareCaseReconciliation"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
CREATE TRIGGER "DispatchCorrection_rr_item_seal" BEFORE INSERT OR UPDATE OR DELETE ON "HealthcareCaseReconciliationItem"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_sealed_dependency();
-- Lines have no incoming witness FK. Other referenced tables already reject
-- TRUNCATE through RESTRICT/CASCADE to the witness no-truncate guards, or their
-- own pre-existing append-only contract. Do not introduce global history guards.
CREATE FUNCTION public.dispatch_correction_lines_sealed_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM "HealthcareCaseDispatchCorrection" r
    WHERE r."creationTransactionId"=pg_current_xact_id_if_assigned() AND r.snapshot IS NOT NULL
      AND EXISTS(SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i WHERE i."correctionId"=r.id AND i.type='MATERIAL')) THEN
    RAISE EXCEPTION 'Correction dependencies sealed until creating transaction commits'
      USING ERRCODE='23514', CONSTRAINT='DispatchCorrection_dependencies_sealed';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER "DispatchCorrection_lines_sealed_truncate" BEFORE TRUNCATE ON "InventoryPhysicalEffectLine"
  EXECUTE FUNCTION public.dispatch_correction_lines_sealed_truncate();

-- Pure historical capture. Typed columns remain authoritative; JSON is not an
-- alternative to FK/evidence validation. No key/token is copied to snapshots.
CREATE FUNCTION public.dispatch_correction_item_snapshot(p_id text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('version',1,'sourceDispatchItemId',d.id,'history',d.snapshot,
    'original', CASE WHEN i.type='MATERIAL' THEN
      jsonb_build_object('effect',to_jsonb(oe),'lines',
        (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sequence) FROM "InventoryPhysicalEffectLine" l
          WHERE l."companyId"=i."companyId" AND l."effectId"=oe.id
            AND l."positionId" IN (d."sourcePositionId",d."destinationPositionId")))
    ELSE jsonb_build_object('custody',to_jsonb(c)-ARRAY['closedAt','closedById'],'openEvent',to_jsonb(op)) END,
    'compensation', CASE WHEN i.type='MATERIAL' THEN
      jsonb_build_object('effect',to_jsonb(ce),'lines',
        (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sequence) FROM "InventoryPhysicalEffectLine" l
          WHERE l."companyId"=i."companyId" AND l."effectId"=ce.id
            AND l."positionId" IN (i."sourceCustodyPositionId",i."destinationPositionId")))
    ELSE jsonb_build_object('closeEvent',to_jsonb(cl),'closedAt',c."closedAt",'closedById',c."closedById") END)
  FROM "HealthcareCaseDispatchCorrectionItem" i
  JOIN "HealthcareCaseDispatchItem" d ON d.id=i."sourceDispatchItemId" AND d."companyId"=i."companyId"
  LEFT JOIN "InventoryPhysicalEffect" oe ON oe.id=i."originalPhysicalEffectId" AND oe."companyId"=i."companyId"
  LEFT JOIN "InventoryPhysicalEffect" ce ON ce.id=i."compensatingEffectId" AND ce."companyId"=i."companyId"
  LEFT JOIN "EquipmentAssetCustody" c ON c.id=i."equipmentCustodyId" AND c."companyId"=i."companyId"
  LEFT JOIN "EquipmentAssetPhysicalEvent" op ON op.id=i."openPhysicalEventId" AND op."companyId"=i."companyId"
  LEFT JOIN "EquipmentAssetPhysicalEvent" cl ON cl.id=i."closePhysicalEventId" AND cl."companyId"=i."companyId"
  WHERE i.id=p_id
$$;

CREATE FUNCTION public.dispatch_correction_assert_complete(p_id text) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r "HealthcareCaseDispatchCorrection"%ROWTYPE; d "HealthcareCaseDispatch"%ROWTYPE;
  v_item record; actor_role text; n bigint;
BEGIN
  SELECT * INTO r FROM "HealthcareCaseDispatchCorrection" WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction missing' USING ERRCODE='23514'; END IF;
  IF r.snapshot IS NULL OR jsonb_typeof(r.snapshot) IS DISTINCT FROM 'object'
    OR NOT public.dispatch_json_date(r.snapshot->'confirmedAt') THEN
    RAISE EXCEPTION 'Correction terminal root snapshot malformed' USING ERRCODE='23514';
  END IF;
  -- Lock the historical source without changing it. RR serialization is a later
  -- slice: no trigger/contract on existing RR writers is added here.
  SELECT * INTO d FROM "HealthcareCaseDispatch" WHERE id=r."dispatchId" AND "companyId"=r."companyId" FOR UPDATE;
  SELECT role::text INTO actor_role FROM "User" WHERE id=r."confirmedById" AND "companyId"=r."companyId";
  IF d.status IS DISTINCT FROM 'CONFIRMED' OR actor_role IS NULL OR actor_role NOT IN ('ADMIN','MANAGER')
    OR r."confirmedAt"<d."confirmedAt" OR r."confirmedAt">clock_timestamp() AT TIME ZONE 'UTC'
    OR NOT EXISTS(SELECT 1 FROM "IdempotencyRecord" k WHERE k.id=r."idempotencyRecordId" AND k."companyId"=r."companyId"
      AND k.scope::text='HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF' AND k."resourceId"=r.id
      AND k."requestHash"=r."requestHash" AND k.key=btrim(k.key) AND length(k.key) BETWEEN 1 AND 128)
    OR NOT public.dispatch_json_date(r.snapshot->'confirmedAt')
    OR ((r.snapshot->>'confirmedAt')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM r."confirmedAt"
    OR r.snapshot-'confirmedAt' IS DISTINCT FROM jsonb_build_object(
      'version',1,'correctionId',r.id,'kind',r.kind,'reason',r.reason,'attestedNoHandoff',true,
      'sourceDispatch',jsonb_build_object('id',d.id,'history',d.snapshot),
      'confirmedBy',jsonb_build_object('id',r."confirmedById",'role',actor_role),'requestHash',r."requestHash") THEN
    RAISE EXCEPTION 'Correction terminal root/attestation/idempotency incomplete' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO n FROM "HealthcareCaseDispatchItem"
    WHERE "companyId"=r."companyId" AND "dispatchId"=d.id AND lifecycle='ACTIVE';
  IF n=0 OR n<>(SELECT count(*) FROM "HealthcareCaseDispatchCorrectionItem" WHERE "companyId"=r."companyId" AND "correctionId"=r.id)
    OR EXISTS(SELECT 1 FROM "HealthcareCaseReconciliation" WHERE "companyId"=r."companyId" AND "dispatchId"=d.id AND status<>'CANCELLED')
    OR EXISTS(SELECT 1 FROM "HealthcareCaseReconciliationItem" x JOIN "HealthcareCaseReconciliation" q ON q.id=x."reconciliationId"
      WHERE q."companyId"=r."companyId" AND q."dispatchId"=d.id AND
        (x."returnedPhysicalEffectId" IS NOT NULL OR x."usedPhysicalEffectId" IS NOT NULL OR x."closePhysicalEventId" IS NOT NULL)) THEN
    RAISE EXCEPTION 'Correction source set/reconciliation incompatible' USING ERRCODE='23514';
  END IF;
  FOR v_item IN
    WITH original_totals AS MATERIALIZED (
      SELECT "physicalEffectId", "sourcePositionId",sum(quantity::bigint) qty
      FROM "HealthcareCaseDispatchItem" WHERE "companyId"=r."companyId" AND "dispatchId"=d.id AND lifecycle='ACTIVE' AND type='MATERIAL'
      GROUP BY "physicalEffectId","sourcePositionId"
    ), compensation_totals AS MATERIALIZED (
      SELECT "compensatingEffectId","destinationPositionId",sum(quantity::bigint) qty
      FROM "HealthcareCaseDispatchCorrectionItem" WHERE "companyId"=r."companyId" AND "correctionId"=r.id AND type='MATERIAL'
      GROUP BY "compensatingEffectId","destinationPositionId"
    ) SELECT x.*,s."productId",s."batchId",s."assignmentId",s.quantity source_qty,s."sourcePositionId" original_source,
      s."physicalEffectId" original_effect,s."destinationPositionId" original_custody,s."equipmentCustodyId" original_episode,
      s."equipmentPhysicalEventId" original_open,s."assetId" original_asset,s."expectedPositionRevision",s."expectedPhysicalRevision",
      s.lifecycle source_lifecycle,s.type source_type,o.qty original_total,c.qty compensation_total
    FROM "HealthcareCaseDispatchCorrectionItem" x
    JOIN "HealthcareCaseDispatchItem" s ON s.id=x."sourceDispatchItemId" AND s."companyId"=x."companyId" AND s."dispatchId"=x."dispatchId"
    LEFT JOIN original_totals o ON o."physicalEffectId"=s."physicalEffectId" AND o."sourcePositionId"=s."sourcePositionId"
    LEFT JOIN compensation_totals c ON c."compensatingEffectId"=x."compensatingEffectId" AND c."destinationPositionId"=x."destinationPositionId"
    WHERE x."companyId"=r."companyId" AND x."correctionId"=r.id
  LOOP
    IF v_item.source_lifecycle<>'ACTIVE' OR v_item.type<>v_item.source_type OR v_item.snapshot IS NULL
      OR jsonb_typeof(v_item.snapshot) IS DISTINCT FROM 'object'
      OR octet_length(v_item.snapshot::text)>262144
      OR v_item.snapshot IS DISTINCT FROM public.dispatch_correction_item_snapshot(v_item.id) THEN
      RAISE EXCEPTION 'Correction item source/snapshot incomplete' USING ERRCODE='23514';
    END IF;
    IF v_item.type='MATERIAL' THEN
      IF ROW(v_item.quantity,v_item."originalPhysicalEffectId",v_item."sourceCustodyPositionId") IS DISTINCT FROM ROW(v_item.source_qty,v_item.original_effect,v_item.original_custody)
        OR NOT EXISTS(
          SELECT 1 FROM "InventoryPhysicalEffect" oe
          JOIN "InventoryPosition" os ON os.id=v_item.original_source AND os."companyId"=r."companyId"
          JOIN "InventoryPosition" cs ON cs.id=v_item."sourceCustodyPositionId" AND cs."companyId"=r."companyId"
          JOIN "InventoryPosition" dst ON dst.id=v_item."destinationPositionId" AND dst."companyId"=r."companyId"
          JOIN "InventoryPhysicalEffect" ce ON ce.id=v_item."compensatingEffectId" AND ce."companyId"=r."companyId"
          WHERE oe.id=v_item.original_effect AND oe."companyId"=r."companyId"
            AND oe.kind='TRANSFER' AND oe."originType"='CASE_DISPATCH' AND oe."originId"=d.id AND oe."originOperation"='CONFIRM_QUANTITY'
            AND oe."actorId"=d."confirmedById" AND oe."occurredAt"<=r."confirmedAt"
            AND os.state='AVAILABLE' AND os."contextType" IS NULL AND os."contextId" IS NULL
            AND os."productId"=v_item."productId" AND os."inventoryBatchId" IS NOT DISTINCT FROM v_item."batchId"
            AND cs.state='CUSTODY' AND cs."contextType"='CASE_DISPATCH_ITEM' AND cs."contextId"=v_item."sourceDispatchItemId"
            AND cs."productId"=v_item."productId" AND cs."inventoryBatchId" IS NOT DISTINCT FROM v_item."batchId"
            AND cs.quantity=0
            AND dst.state='AVAILABLE' AND dst."contextType" IS NULL AND dst."contextId" IS NULL
            AND dst."productId"=v_item."productId" AND dst."inventoryBatchId" IS NOT DISTINCT FROM v_item."batchId"
            AND ce.kind='TRANSFER' AND ce."originType"='CASE_DISPATCH_CORRECTION' AND ce."originId"=r.id
            AND ce."originOperation"='COMPENSATE_NO_HANDOFF_QUANTITY' AND ce."actorId"=r."confirmedById"
            AND ce."requestHash"=r."requestHash" AND ce."occurredAt"=r."confirmedAt"
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND l."effectId"=oe.id
              AND l."positionId"=os.id AND l.delta=-v_item.original_total AND l."revisionBefore"=v_item."expectedPositionRevision")
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND l."effectId"=oe.id
              AND l."positionId"=cs.id AND l.delta=v_item.quantity)
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND l."effectId"=ce.id
              AND l."positionId"=cs.id AND l.delta=-v_item.quantity AND l."quantityBefore"=v_item.quantity AND l."quantityAfter"=0
              AND l."revisionAfter"=cs.revision
              AND l."revisionBefore"=(SELECT ol."revisionAfter" FROM "InventoryPhysicalEffectLine" ol WHERE ol."effectId"=oe.id AND ol."positionId"=cs.id))
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND l."effectId"=ce.id
              AND l."positionId"=dst.id AND l.delta=v_item.compensation_total AND l."quantityAfter"=dst.quantity AND l."revisionAfter"=dst.revision)
        ) THEN RAISE EXCEPTION 'Correction material evidence incompatible' USING ERRCODE='23514'; END IF;
    ELSE
      IF ROW(v_item."assetId",v_item."equipmentCustodyId",v_item."openPhysicalEventId") IS DISTINCT FROM ROW(v_item.original_asset,v_item.original_episode,v_item.original_open)
        OR NOT EXISTS(
          SELECT 1 FROM "EquipmentAssetCustody" c
          JOIN "EquipmentAsset" a ON a.id=v_item."assetId" AND a."companyId"=r."companyId"
          JOIN "EquipmentAssetPhysicalEvent" op ON op.id=v_item."openPhysicalEventId" AND op."companyId"=r."companyId"
          JOIN "EquipmentAssetPhysicalEvent" cl ON cl.id=v_item."closePhysicalEventId" AND cl."companyId"=r."companyId"
          WHERE c.id=v_item."equipmentCustodyId" AND c."companyId"=r."companyId" AND c."equipmentAssetId"=v_item."assetId"
            AND c."caseId"=r."caseId" AND c."assignmentId"=v_item."assignmentId"
            AND c."openedById"=d."confirmedById" AND c."closedById"=r."confirmedById"
            AND c."openedAt"<=c."closedAt" AND c."closedAt"=r."confirmedAt"
            AND op."equipmentAssetId"=v_item."assetId" AND op."custodyId"=c.id AND op.operation='CUSTODY_OPEN'
            AND op."originType"='CASE_DISPATCH_ITEM' AND op."originId"=v_item."sourceDispatchItemId" AND op."originOperation"='CONFIRM_EQUIPMENT'
            AND op."actorId"=d."confirmedById" AND op."revisionBefore"=v_item."expectedPhysicalRevision"
            AND op."physicalLocationBefore"='WAREHOUSE' AND op."physicalLocationAfter"='CUSTODY'
            AND op."createdAt"<=cl."createdAt"
            AND cl."equipmentAssetId"=v_item."assetId" AND cl."custodyId"=c.id AND cl.operation='CUSTODY_CLOSE'
            AND cl."originType"='CASE_DISPATCH_CORRECTION_ITEM' AND cl."originId"=v_item.id AND cl."originOperation"='COMPENSATE_NO_HANDOFF_EQUIPMENT'
            AND cl."actorId"=r."confirmedById" AND cl."requestHash"=r."requestHash" AND cl."createdAt"=r."confirmedAt"
            AND cl."revisionBefore"=op."revisionAfter" AND cl."revisionAfter"::bigint=op."revisionAfter"::bigint+1
            AND cl."physicalLocationBefore"='CUSTODY' AND cl."physicalLocationAfter"='WAREHOUSE'
            AND cl."conditionBefore"=op."conditionAfter" AND cl."conditionAfter"=cl."conditionBefore"
            AND cl."lifecycleBefore"=op."lifecycleAfter" AND cl."lifecycleAfter"=cl."lifecycleBefore"
            AND a."physicalLocation"='WAREHOUSE' AND a."activeCustodyId" IS NULL AND a."physicalRevision"=cl."revisionAfter"
            AND a.condition=cl."conditionAfter" AND a.lifecycle=cl."lifecycleAfter"
            AND NOT EXISTS(SELECT 1 FROM "EquipmentAssetPhysicalEvent" later WHERE later."companyId"=r."companyId"
              AND later."equipmentAssetId"=v_item."assetId" AND later."revisionAfter">op."revisionAfter" AND later.id<>cl.id)
        ) THEN RAISE EXCEPTION 'Correction equipment evidence incompatible' USING ERRCODE='23514'; END IF;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM "InventoryPhysicalEffect" e WHERE e."companyId"=r."companyId"
    AND e."originType"='CASE_DISPATCH_CORRECTION' AND e."originId"=r.id
    AND NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i
      WHERE i."correctionId"=r.id AND i."companyId"=r."companyId" AND i."compensatingEffectId"=e.id)) THEN
    RAISE EXCEPTION 'Correction contains unreferenced compensating Effect' USING ERRCODE='23514';
  END IF;
  -- Check header cardinality/range even for an already committed original Effect.
  -- Each distinct Effect is aggregated once, including grouped source effects.
  IF EXISTS(
    WITH used_effects AS MATERIALIZED (
      SELECT "originalPhysicalEffectId" id FROM "HealthcareCaseDispatchCorrectionItem"
        WHERE "companyId"=r."companyId" AND "correctionId"=r.id AND type='MATERIAL'
      UNION
      SELECT "compensatingEffectId" FROM "HealthcareCaseDispatchCorrectionItem"
        WHERE "companyId"=r."companyId" AND "correctionId"=r.id AND type='MATERIAL'
    )
    SELECT 1 FROM used_effects u JOIN "InventoryPhysicalEffect" e ON e.id=u.id AND e."companyId"=r."companyId"
    LEFT JOIN LATERAL (
      SELECT count(*) n,min(sequence) first_sequence,max(sequence) last_sequence
      FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND l."effectId"=e.id
    ) facts ON true
    WHERE facts.n<>e."lineCount" OR facts.first_sequence IS DISTINCT FROM 1 OR facts.last_sequence IS DISTINCT FROM e."lineCount"
  ) THEN RAISE EXCEPTION 'Correction physical Effect incomplete' USING ERRCODE='23514'; END IF;
  -- Every original and compensating material line must belong to this source set.
  -- This rejects balanced but unrelated extra lines; no Effect-per-item assumption.
  IF EXISTS(
    SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."companyId"=r."companyId" AND (
      (l."effectId" IN (SELECT "originalPhysicalEffectId" FROM "HealthcareCaseDispatchCorrectionItem" WHERE "correctionId"=r.id)
        AND NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchItem" s WHERE s."companyId"=r."companyId" AND s."dispatchId"=d.id
          AND s.lifecycle='ACTIVE' AND s.type='MATERIAL' AND s."physicalEffectId"=l."effectId"
          AND ((l.delta<0 AND s."sourcePositionId"=l."positionId") OR (l.delta>0 AND s."destinationPositionId"=l."positionId"))))
      OR (l."effectId" IN (SELECT "compensatingEffectId" FROM "HealthcareCaseDispatchCorrectionItem" WHERE "correctionId"=r.id)
        AND NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" x WHERE x."companyId"=r."companyId" AND x."correctionId"=r.id
          AND x.type='MATERIAL' AND x."compensatingEffectId"=l."effectId"
          AND ((l.delta<0 AND x."sourceCustodyPositionId"=l."positionId") OR (l.delta>0 AND x."destinationPositionId"=l."positionId"))))
    )
  ) THEN RAISE EXCEPTION 'Correction contains unrelated physical lines' USING ERRCODE='23514'; END IF;
END $$;

CREATE FUNCTION public.dispatch_correction_final_state() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.dispatch_correction_assert_complete(NEW.id);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DispatchCorrection_complete" AFTER INSERT OR UPDATE ON "HealthcareCaseDispatchCorrection"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_final_state();

CREATE FUNCTION public.dispatch_correction_item_final_state() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchCorrectionItem" i JOIN "HealthcareCaseDispatchCorrection" r
    ON r.id=i."correctionId" AND r."companyId"=i."companyId"
    WHERE i.id=NEW.id AND i.snapshot IS NOT NULL AND r.snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'Correction unsealed item' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DispatchCorrectionItem_complete" AFTER INSERT OR UPDATE ON "HealthcareCaseDispatchCorrectionItem"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_item_final_state();

CREATE FUNCTION public.dispatch_correction_idempotency() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE k "IdempotencyRecord"%ROWTYPE;
BEGIN
  SELECT * INTO k FROM "IdempotencyRecord" WHERE id=NEW.id;
  IF k.scope::text='HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF' AND NOT EXISTS(
    SELECT 1 FROM "HealthcareCaseDispatchCorrection" r WHERE r."idempotencyRecordId"=k.id AND r."companyId"=k."companyId"
      AND r.id=k."resourceId" AND r."requestHash"=k."requestHash" AND r.snapshot IS NOT NULL
      AND k.key=btrim(k.key) AND length(k.key) BETWEEN 1 AND 128) THEN
    RAISE EXCEPTION 'Correction idempotency resource incomplete' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DispatchCorrection_idempotency_complete" AFTER INSERT OR UPDATE ON "IdempotencyRecord"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_idempotency();
CREATE FUNCTION public.dispatch_correction_idempotency_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.scope::text='HEALTHCARE_CASE_DISPATCH_CORRECTION_NO_HANDOFF' THEN
    RAISE EXCEPTION 'Correction idempotency history immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DispatchCorrection_idempotency_guard" BEFORE UPDATE OR DELETE ON "IdempotencyRecord"
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_correction_idempotency_guard();

COMMIT;
