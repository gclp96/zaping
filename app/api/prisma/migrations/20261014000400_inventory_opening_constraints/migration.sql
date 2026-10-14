BEGIN;
CREATE OR REPLACE FUNCTION public.inventory_physical_effect_complete() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE effect_id text; effect_kind public."InventoryPhysicalEffectKind";
  expected_count integer; actual_count bigint; first_sequence integer; last_sequence integer;
BEGIN
  IF TG_TABLE_NAME = 'InventoryPhysicalEffect' THEN effect_id := NEW.id;
  ELSE effect_id := NEW."effectId"; END IF;
  SELECT kind, "lineCount" INTO effect_kind, expected_count
    FROM public."InventoryPhysicalEffect" WHERE id=effect_id;
  SELECT count(*), min(sequence), max(sequence) INTO actual_count, first_sequence, last_sequence
    FROM public."InventoryPhysicalEffectLine" WHERE "effectId"=effect_id;
  IF expected_count IS NULL OR actual_count<>expected_count OR first_sequence<>1 OR last_sequence<>expected_count THEN
    RAISE EXCEPTION 'Physical effect is incomplete' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_complete_check';
  END IF;
  IF effect_kind='CREDIT' AND EXISTS (
    SELECT 1 FROM public."InventoryPhysicalEffectLine" l JOIN public."InventoryPosition" p ON p.id=l."positionId"
    WHERE l."effectId"=effect_id AND (l.delta<=0 OR p.state<>'AVAILABLE')
  ) THEN
    RAISE EXCEPTION 'Invalid credit shape' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_kind_check';
  END IF;
  IF effect_kind='DEFINITIVE_OUT' AND EXISTS (
    SELECT 1 FROM public."InventoryPhysicalEffectLine" WHERE "effectId"=effect_id AND delta>=0
  ) THEN
    RAISE EXCEPTION 'Invalid definitive out shape' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_kind_check';
  END IF;
  IF effect_kind='TRANSFER' AND EXISTS (
    SELECT 1 FROM public."InventoryPhysicalEffectLine" l JOIN public."InventoryPosition" p ON p.id=l."positionId"
    WHERE l."effectId"=effect_id GROUP BY p."productId",p."inventoryBatchId"
    HAVING sum(l.delta::bigint)<>0 OR min(l.delta)>=0 OR max(l.delta)<=0
  ) THEN
    RAISE EXCEPTION 'Invalid transfer shape' USING ERRCODE='23514', CONSTRAINT='InventoryPhysicalEffect_kind_check';
  END IF;
  IF effect_kind <> 'COUNT_CORRECTION' AND EXISTS (
    SELECT 1 FROM public."InventoryPhysicalEffectLine" WHERE "effectId"=effect_id AND delta=0
  ) THEN
    RAISE EXCEPTION 'Zero delta requires count correction' USING ERRCODE='23514';
  END IF;
  IF effect_kind='COUNT_CORRECTION' AND (actual_count<>1 OR EXISTS (
    SELECT 1 FROM public."InventoryPhysicalEffectLine" l JOIN public."InventoryPosition" p ON p.id=l."positionId"
    WHERE l."effectId"=effect_id AND p.state<>'AVAILABLE'
  )) THEN
    RAISE EXCEPTION 'Invalid count correction shape' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."InventoryPhysicalEffect" e WHERE e.id=effect_id
      AND ((e.kind='OPENING') IS DISTINCT FROM (e."originType"='INVENTORY_OPENING'))
  ) THEN
    RAISE EXCEPTION 'Invalid opening namespace' USING ERRCODE='23514';
  END IF;
  IF effect_kind='OPENING' AND (
    (SELECT count(DISTINCT p."productId") FROM public."InventoryPhysicalEffectLine" l
      JOIN public."InventoryPosition" p ON p.id=l."positionId" WHERE l."effectId"=effect_id)<>1
    OR EXISTS (
      SELECT 1 FROM public."InventoryPhysicalEffectLine" l
      JOIN public."InventoryPosition" p ON p.id=l."positionId"
      JOIN public."InventoryPhysicalEffect" e ON e.id=l."effectId"
      WHERE l."effectId"=effect_id AND (
        l.delta<=0 OR l."quantityBefore"<>0 OR l."quantityAfter"<>l.delta
        OR l."revisionBefore"<>0 OR l."revisionAfter"<>1
        OR e."originOperation"<>'OPEN_' || p."productId"
        OR e."originId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Invalid opening shape' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
COMMIT;
