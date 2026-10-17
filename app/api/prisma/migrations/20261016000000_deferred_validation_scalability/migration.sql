BEGIN;

-- HC-RR-PERF-01: forward-only function/trigger replacement; no data writes.
-- Classification: CHECK/FK/unique constraints and immediate identity/history guards
-- remain authoritative for discriminator, tenant and mutation structure.
-- LOCAL deferred root checks validate only the final root. LOCAL item checks read
-- only the current affected item, its parent and (for RR) its source row/family.
-- Every event re-reads FINAL state: partial evidence/snapshot staging is legal.
-- Audit CHECK/FK constraints and append-only guards are unchanged; audit insertion
-- cannot invalidate existing item/root evidence and needs no aggregate callback.
-- TERMINAL predicates (all original snapshots, audit, material/equipment evidence,
-- observation/exclusion, provenance and actor/revision/time rules) remain below.
-- Grouped effect/position totals are computed once per terminal validator call.

CREATE FUNCTION "dispatch_local_state"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d "HealthcareCaseDispatch"%ROWTYPE; i "HealthcareCaseDispatchItem"%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='HealthcareCaseDispatch' THEN
   SELECT * INTO d FROM "HealthcareCaseDispatch" WHERE id=NEW.id AND "companyId"=NEW."companyId";
 ELSE
   SELECT * INTO i FROM "HealthcareCaseDispatchItem" WHERE id=NEW.id AND "companyId"=NEW."companyId";
   IF NOT FOUND THEN RETURN NULL; END IF; -- draft deletion after earlier queued writes
   SELECT * INTO d FROM "HealthcareCaseDispatch" WHERE id=i."dispatchId" AND "companyId"=i."companyId";
   IF d.status<>'CONFIRMED' AND (i.snapshot IS NOT NULL OR i."physicalEffectId" IS NOT NULL OR i."destinationPositionId" IS NOT NULL OR i."equipmentCustodyId" IS NOT NULL OR i."equipmentPhysicalEventId" IS NOT NULL) THEN
     RAISE EXCEPTION 'Dispatch final evidence/snapshot incomplete' USING ERRCODE='23514';
   END IF;
 END IF;
 IF d.status<>'CONFIRMED' AND (d.snapshot IS NOT NULL OR d."snapshotVersion" IS NOT NULL) THEN
   RAISE EXCEPTION 'Dispatch final evidence/snapshot incomplete' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION "rr_local_state"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "HealthcareCaseReconciliation"%ROWTYPE; i "HealthcareCaseReconciliationItem"%ROWTYPE; d "HealthcareCaseDispatchItem"%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='HealthcareCaseReconciliation' THEN
   SELECT * INTO r FROM "HealthcareCaseReconciliation" WHERE id=NEW.id AND "companyId"=NEW."companyId";
 ELSE
   SELECT * INTO i FROM "HealthcareCaseReconciliationItem" WHERE id=NEW.id AND "companyId"=NEW."companyId";
   SELECT * INTO r FROM "HealthcareCaseReconciliation" WHERE id=i."reconciliationId" AND "companyId"=i."companyId";
   SELECT * INTO d FROM "HealthcareCaseDispatchItem" WHERE id=i."sourceDispatchItemId" AND "companyId"=r."companyId" AND "dispatchId"=r."dispatchId" AND lifecycle='ACTIVE' AND type::text=i.type::text;
   IF NOT FOUND OR (i.type='MATERIAL' AND i."sourceCustodyPositionId" IS DISTINCT FROM d."destinationPositionId") OR (i.type='EQUIPMENT' AND ROW(i."equipmentCustodyId",i."assetId",i."assignmentId") IS DISTINCT FROM ROW(d."equipmentCustodyId",d."assetId",d."assignmentId")) THEN
     RAISE EXCEPTION 'Reconciliation source provenance mismatch' USING ERRCODE='23514';
   END IF;
   IF r.status<>'CONFIRMED' AND (i.snapshot IS NOT NULL OR i."returnedPhysicalEffectId" IS NOT NULL OR i."usedPhysicalEffectId" IS NOT NULL OR i."closePhysicalEventId" IS NOT NULL) THEN
     RAISE EXCEPTION 'Nonterminal reconciliation result' USING ERRCODE='23514';
   END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "HealthcareCaseDispatch" WHERE id=r."dispatchId" AND "companyId"=r."companyId" AND status='CONFIRMED') THEN
   RAISE EXCEPTION 'Reconciliation source must be confirmed' USING ERRCODE='23514';
 END IF;
 IF r.status<>'CONFIRMED' AND (r.snapshot IS NOT NULL OR r."snapshotVersion" IS NOT NULL) THEN
   RAISE EXCEPTION 'Nonconfirmed root snapshot' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION "dispatch_final_state"() RETURNS trigger LANGUAGE plpgsql AS $$
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
      WITH totals AS MATERIALIZED (
        SELECT "physicalEffectId", "sourcePositionId", sum(quantity) AS quantity
        FROM "HealthcareCaseDispatchItem" WHERE "companyId"=d."companyId" AND "dispatchId"=d.id AND lifecycle='ACTIVE'
        GROUP BY "physicalEffectId", "sourcePositionId"
      )
      SELECT EXISTS(SELECT 1 FROM "HealthcareCaseDispatchItem" i
        LEFT JOIN totals g ON g."physicalEffectId"=i."physicalEffectId" AND g."sourcePositionId"=i."sourcePositionId"
        WHERE i."companyId"=d."companyId" AND i."dispatchId"=d.id AND (
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
            AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=s.id AND l.delta=-g.quantity AND l."revisionBefore"=i."expectedPositionRevision")
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

CREATE OR REPLACE FUNCTION "rr_final_state"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "HealthcareCaseReconciliation"%ROWTYPE; s "HealthcareCaseDispatch"%ROWTYPE; i record; d "HealthcareCaseDispatchItem"%ROWTYPE; target text; active_count integer:=0; mc integer:=0; ec integer:=0; physical boolean:=false; v jsonb;
BEGIN
 IF TG_TABLE_NAME='HealthcareCaseReconciliation' THEN target:=NEW.id; ELSE target:=NEW."reconciliationId"; END IF;
 SELECT * INTO r FROM "HealthcareCaseReconciliation" WHERE id=target;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM "HealthcareCaseDispatch" WHERE id=r."dispatchId" AND "companyId"=r."companyId" AND status='CONFIRMED';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation source must be confirmed' USING ERRCODE='23514'; END IF;
 FOR i IN
 WITH totals AS MATERIALIZED (
   SELECT "returnedPhysicalEffectId", "returnedDestinationPositionId", sum("returnedQty") AS quantity
   FROM "HealthcareCaseReconciliationItem" WHERE "companyId"=r."companyId" AND "reconciliationId"=r.id AND lifecycle='ACTIVE'
   GROUP BY "returnedPhysicalEffectId", "returnedDestinationPositionId"
 )
 SELECT item.*, g.quantity AS returned_total FROM "HealthcareCaseReconciliationItem" item
 LEFT JOIN totals g ON g."returnedPhysicalEffectId"=item."returnedPhysicalEffectId" AND g."returnedDestinationPositionId"=item."returnedDestinationPositionId"
 WHERE item."companyId"=r."companyId" AND item."reconciliationId"=r.id LOOP
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
 IF NOT EXISTS(SELECT 1 FROM "InventoryPhysicalEffect" e JOIN "InventoryPosition" p ON p.id=i."returnedDestinationPositionId" AND p."companyId"=i."companyId" WHERE e.id=i."returnedPhysicalEffectId" AND e."companyId"=i."companyId" AND e.kind='TRANSFER' AND e."originType"='CASE_RECONCILIATION' AND e."originId"=r.id AND e."originOperation"='CONFIRM_RETURNED' AND e."actorId"=r."confirmedById" AND p.state='AVAILABLE' AND p."contextType" IS NULL AND p."contextId" IS NULL AND p."productId"=d."productId" AND p."inventoryBatchId" IS NOT DISTINCT FROM d."batchId" AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=i."sourceCustodyPositionId" AND l.delta=-i."returnedQty") AND EXISTS(SELECT 1 FROM "InventoryPhysicalEffectLine" l WHERE l."effectId"=e.id AND l."positionId"=p.id AND l.delta=i.returned_total)) THEN RAISE EXCEPTION 'Returned evidence mismatch' USING ERRCODE='23514'; END IF;
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

DROP TRIGGER "Dispatch_final_state" ON "HealthcareCaseDispatch";
DROP TRIGGER "Dispatch_item_final_state" ON "HealthcareCaseDispatchItem";
DROP TRIGGER "Dispatch_audit_final_state" ON "HealthcareCaseDispatchAudit";
CREATE CONSTRAINT TRIGGER "Dispatch_local_state" AFTER INSERT OR UPDATE ON "HealthcareCaseDispatch" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dispatch_local_state"();
CREATE CONSTRAINT TRIGGER "Dispatch_item_final_state" AFTER INSERT OR UPDATE ON "HealthcareCaseDispatchItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "dispatch_local_state"();
-- WHEN uses event-time OLD/NEW only to queue the terminal transition once.
-- Validators themselves read final persisted state at deferred evaluation.
CREATE CONSTRAINT TRIGGER "Dispatch_final_state" AFTER UPDATE ON "HealthcareCaseDispatch" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.status='DRAFT' AND NEW.status='CONFIRMED') EXECUTE FUNCTION "dispatch_final_state"();
-- Preserve direct terminal INSERT semantics of the existing persistence model.
CREATE CONSTRAINT TRIGGER "Dispatch_insert_final_state" AFTER INSERT ON "HealthcareCaseDispatch" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status='CONFIRMED') EXECUTE FUNCTION "dispatch_final_state"();
DROP TRIGGER "Reconciliation_final_state" ON "HealthcareCaseReconciliation";
DROP TRIGGER "Reconciliation_item_final_state" ON "HealthcareCaseReconciliationItem";
DROP TRIGGER "Reconciliation_audit_final_state" ON "HealthcareCaseReconciliationAudit";
CREATE CONSTRAINT TRIGGER "Reconciliation_local_state" AFTER INSERT OR UPDATE ON "HealthcareCaseReconciliation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "rr_local_state"();
CREATE CONSTRAINT TRIGGER "Reconciliation_item_final_state" AFTER INSERT OR UPDATE ON "HealthcareCaseReconciliationItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "rr_local_state"();
-- WHEN uses event-time OLD/NEW only to queue the terminal transition once.
-- Validators themselves read final persisted state at deferred evaluation.
CREATE CONSTRAINT TRIGGER "Reconciliation_final_state" AFTER UPDATE ON "HealthcareCaseReconciliation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.status='DRAFT' AND NEW.status='CONFIRMED') EXECUTE FUNCTION "rr_final_state"();
-- Preserve direct terminal INSERT semantics of the existing persistence model.
CREATE CONSTRAINT TRIGGER "Reconciliation_insert_final_state" AFTER INSERT ON "HealthcareCaseReconciliation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status='CONFIRMED') EXECUTE FUNCTION "rr_final_state"();


-- Physical history: append-only THROUGH SUPPORTED APPLICATION PATHS, per
-- TD-INV-01A-19 and the binding HC-RR-PERF-01 delta. No new UPDATE/DELETE/TRUNCATE
-- guards. Unsupported reconstruction of committed history is outside this contract.
-- LOCAL: final affected Line + exact Company/Effect lookup, no sibling scan.
-- CHECK/FK/UNIQUE retain arithmetic, tenant, Position and duplicate protections.
-- A valid unchanged committed Effect occupies every ordinal 1..lineCount:
-- UNIQUE rejects reuse, and this upper bound rejects any extra late ordinal.
CREATE FUNCTION public.inventory_physical_effect_line_local() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE line public."InventoryPhysicalEffectLine"%ROWTYPE; declared_count integer;
BEGIN
  SELECT * INTO line FROM public."InventoryPhysicalEffectLine"
    WHERE id=NEW.id AND "companyId"=NEW."companyId";
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT "lineCount" INTO declared_count FROM public."InventoryPhysicalEffect"
    WHERE id=line."effectId" AND "companyId"=line."companyId";
  IF NOT FOUND OR line.sequence<1 OR line.sequence>declared_count THEN
    RAISE EXCEPTION 'Physical effect is incomplete: line outside declared range'
      USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_complete_check';
  END IF;
  RETURN NULL;
END;
$$;

-- AGGREGATE: one header INSERT event checks final count/range, all operation
-- shapes, TRANSFER Product/batch balance, COUNT_CORRECTION and OPENING semantics.
-- Materialize Company/Effect-scoped Lines/Position facts once. Group TRANSFER
-- totals once. No mutable totals, counters, staging state or transaction registry.
CREATE OR REPLACE FUNCTION public.inventory_physical_effect_complete() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE e public."InventoryPhysicalEffect"%ROWTYPE; facts record;
BEGIN
  SELECT * INTO e FROM public."InventoryPhysicalEffect"
    WHERE id=NEW.id AND "companyId"=NEW."companyId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Physical effect is incomplete' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_complete_check';
  END IF;
  WITH lines AS MATERIALIZED (
    SELECT l.*, p."productId", p."inventoryBatchId", p.state
    FROM public."InventoryPhysicalEffectLine" l
    JOIN public."InventoryPosition" p ON p.id=l."positionId" AND p."companyId"=l."companyId"
    WHERE l."companyId"=e."companyId" AND l."effectId"=e.id
  ), transfer_totals AS MATERIALIZED (
    SELECT "productId", "inventoryBatchId", sum(delta::bigint) AS total,
      min(delta) AS minimum, max(delta) AS maximum
    FROM lines WHERE e.kind='TRANSFER' GROUP BY "productId", "inventoryBatchId"
  )
  SELECT count(*) AS actual_count, min(sequence) AS first_sequence, max(sequence) AS last_sequence,
    COALESCE(bool_or(delta<=0 OR state<>'AVAILABLE'),false) AS bad_credit,
    COALESCE(bool_or(delta>=0),false) AS bad_out,
    COALESCE(bool_or(delta=0),false) AS zero_delta,
    COALESCE(bool_or(state<>'AVAILABLE'),false) AS nonavailable,
    count(DISTINCT "productId") FILTER (WHERE e.kind='OPENING') AS opening_products,
    COALESCE(bool_or(delta<=0 OR "quantityBefore"<>0 OR "quantityAfter"<>delta
      OR "revisionBefore"<>0 OR "revisionAfter"<>1
      OR e."originOperation"<>'OPEN_' || "productId"
      OR e."originId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),false) AS bad_opening,
    EXISTS(SELECT 1 FROM transfer_totals WHERE total<>0 OR minimum>=0 OR maximum<=0) AS bad_transfer
  INTO facts FROM lines;
  IF facts.actual_count<>e."lineCount" OR facts.first_sequence<>1 OR facts.last_sequence<>e."lineCount" THEN
    RAISE EXCEPTION 'Physical effect is incomplete' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_complete_check';
  END IF;
  IF e.kind='CREDIT' AND facts.bad_credit THEN
    RAISE EXCEPTION 'Invalid credit shape' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_kind_check';
  END IF;
  IF e.kind='DEFINITIVE_OUT' AND facts.bad_out THEN
    RAISE EXCEPTION 'Invalid definitive out shape' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_kind_check';
  END IF;
  IF e.kind='TRANSFER' AND facts.bad_transfer THEN
    RAISE EXCEPTION 'Invalid transfer shape' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_kind_check';
  END IF;
  IF e.kind<>'COUNT_CORRECTION' AND facts.zero_delta THEN
    RAISE EXCEPTION 'Zero delta requires count correction' USING ERRCODE='23514';
  END IF;
  IF e.kind='COUNT_CORRECTION' AND (facts.actual_count<>1 OR facts.nonavailable) THEN
    RAISE EXCEPTION 'Invalid count correction shape' USING ERRCODE='23514';
  END IF;
  IF (e.kind='OPENING') IS DISTINCT FROM (e."originType"='INVENTORY_OPENING') THEN
    RAISE EXCEPTION 'Invalid opening namespace' USING ERRCODE='23514';
  END IF;
  IF e.kind='OPENING' AND (facts.opening_products<>1 OR facts.bad_opening) THEN
    RAISE EXCEPTION 'Invalid opening shape' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
-- Keep both constraint names stable for callers; the Line event is now local.
DROP TRIGGER "InventoryPhysicalEffectLine_complete" ON public."InventoryPhysicalEffectLine";
CREATE CONSTRAINT TRIGGER "InventoryPhysicalEffectLine_complete"
  AFTER INSERT ON public."InventoryPhysicalEffectLine" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.inventory_physical_effect_line_local();

COMMIT;
