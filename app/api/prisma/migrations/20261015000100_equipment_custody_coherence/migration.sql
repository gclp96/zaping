-- Commit-time structural invariant only. No Assignment/Case business-policy lookup.
CREATE FUNCTION public.equipment_custody_assert_asset(p_company text, p_asset text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE a record; open_count integer; open_id text;
BEGIN
 SELECT "physicalLocation", "activeCustodyId" INTO a FROM "EquipmentAsset"
 WHERE "companyId" = p_company AND "id" = p_asset FOR NO KEY UPDATE;
 IF NOT FOUND THEN RETURN; END IF; -- RESTRICT FKs independently prohibit orphan episodes.
 SELECT count(*), min("id") INTO open_count, open_id FROM "EquipmentAssetCustody"
 WHERE "companyId" = p_company AND "equipmentAssetId" = p_asset AND "closedAt" IS NULL;
 IF (a."physicalLocation" = 'CUSTODY' AND (open_count <> 1 OR a."activeCustodyId" IS DISTINCT FROM open_id)) OR
    (a."physicalLocation" <> 'CUSTODY' AND (open_count <> 0 OR a."activeCustodyId" IS NOT NULL)) THEN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Equipment active custody is structurally inconsistent';
 END IF;
END;
$body$;
CREATE FUNCTION public.equipment_custody_coherence() RETURNS trigger LANGUAGE plpgsql AS $body$
DECLARE old_company text; old_asset text; new_company text; new_asset text; affected record;
BEGIN
 IF TG_TABLE_NAME = 'EquipmentAsset' THEN
  IF TG_OP <> 'INSERT' THEN old_company := OLD."companyId"; old_asset := OLD."id"; END IF;
  IF TG_OP <> 'DELETE' THEN new_company := NEW."companyId"; new_asset := NEW."id"; END IF;
  IF TG_OP = 'UPDATE' AND OLD."companyId" = NEW."companyId" AND OLD."id" = NEW."id" AND
     OLD."physicalLocation" = NEW."physicalLocation" AND OLD."activeCustodyId" IS NOT DISTINCT FROM NEW."activeCustodyId" THEN RETURN NULL; END IF;
 ELSE
  IF TG_OP <> 'INSERT' THEN old_company := OLD."companyId"; old_asset := OLD."equipmentAssetId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_company := NEW."companyId"; new_asset := NEW."equipmentAssetId"; END IF;
 END IF;
 FOR affected IN SELECT DISTINCT c, a FROM (VALUES (old_company, old_asset), (new_company, new_asset)) AS ids(c,a)
  WHERE c IS NOT NULL AND a IS NOT NULL ORDER BY c, a LOOP
  PERFORM public.equipment_custody_assert_asset(affected.c, affected.a);
 END LOOP;
 RETURN NULL;
END;
$body$;
CREATE CONSTRAINT TRIGGER "EquipmentAsset_custody_coherence" AFTER INSERT OR UPDATE OR DELETE ON "EquipmentAsset"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.equipment_custody_coherence();
CREATE CONSTRAINT TRIGGER "EquipmentAssetCustody_coherence" AFTER INSERT OR UPDATE OR DELETE ON "EquipmentAssetCustody"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.equipment_custody_coherence();
