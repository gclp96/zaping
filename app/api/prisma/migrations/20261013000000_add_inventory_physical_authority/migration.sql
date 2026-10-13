-- Dormant foundation only: no legacy balance writes, backfill or activation.
BEGIN;

-- CreateEnum
CREATE TYPE "InventoryPositionState" AS ENUM ('AVAILABLE', 'CUSTODY');

-- CreateEnum
CREATE TYPE "InventoryPhysicalEffectKind" AS ENUM ('CREDIT', 'TRANSFER', 'DEFINITIVE_OUT');

-- CreateTable
CREATE TABLE "InventoryPosition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inventoryBatchId" TEXT,
    "state" "InventoryPositionState" NOT NULL,
    "contextType" VARCHAR(64),
    "contextId" VARCHAR(128),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPhysicalEffect" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "originType" VARCHAR(64) NOT NULL,
    "originId" VARCHAR(128) NOT NULL,
    "originOperation" VARCHAR(64) NOT NULL,
    "kind" "InventoryPhysicalEffectKind" NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" VARCHAR(1000),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPhysicalEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPhysicalEffectLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "revisionBefore" INTEGER NOT NULL,
    "revisionAfter" INTEGER NOT NULL,

    CONSTRAINT "InventoryPhysicalEffectLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryPosition_companyId_productId_state_idx" ON "InventoryPosition"("companyId", "productId", "state");

-- CreateIndex
CREATE INDEX "InventoryPosition_companyId_inventoryBatchId_state_idx" ON "InventoryPosition"("companyId", "inventoryBatchId", "state");

-- CreateIndex
CREATE INDEX "InventoryPosition_companyId_contextType_contextId_idx" ON "InventoryPosition"("companyId", "contextType", "contextId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPosition_id_companyId_key" ON "InventoryPosition"("id", "companyId");

-- CreateIndex
CREATE INDEX "InventoryPhysicalEffect_companyId_occurredAt_id_idx" ON "InventoryPhysicalEffect"("companyId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPhysicalEffect_id_companyId_key" ON "InventoryPhysicalEffect"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPhysicalEffect_origin_key" ON "InventoryPhysicalEffect"("companyId", "originType", "originId", "originOperation");

-- CreateIndex
CREATE INDEX "InventoryPhysicalEffectLine_companyId_positionId_effectId_idx" ON "InventoryPhysicalEffectLine"("companyId", "positionId", "effectId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPhysicalEffectLine_effectId_sequence_key" ON "InventoryPhysicalEffectLine"("effectId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPhysicalEffectLine_effectId_positionId_key" ON "InventoryPhysicalEffectLine"("effectId", "positionId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_id_companyId_productId_key" ON "InventoryBatch"("id", "companyId", "productId");

-- AddForeignKey
ALTER TABLE "InventoryPosition" ADD CONSTRAINT "InventoryPosition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryPosition" ADD CONSTRAINT "InventoryPosition_productId_companyId_fkey" FOREIGN KEY ("productId", "companyId") REFERENCES "Product"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryPosition" ADD CONSTRAINT "InventoryPosition_inventoryBatchId_companyId_productId_fkey" FOREIGN KEY ("inventoryBatchId", "companyId", "productId") REFERENCES "InventoryBatch"("id", "companyId", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryPhysicalEffect" ADD CONSTRAINT "InventoryPhysicalEffect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryPhysicalEffect" ADD CONSTRAINT "InventoryPhysicalEffect_actorId_companyId_fkey" FOREIGN KEY ("actorId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryPhysicalEffectLine" ADD CONSTRAINT "InventoryPhysicalEffectLine_effectId_companyId_fkey" FOREIGN KEY ("effectId", "companyId") REFERENCES "InventoryPhysicalEffect"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryPhysicalEffectLine" ADD CONSTRAINT "InventoryPhysicalEffectLine_positionId_companyId_fkey" FOREIGN KEY ("positionId", "companyId") REFERENCES "InventoryPosition"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "position_available_unbatched_uq" ON "InventoryPosition" ("companyId","productId")
  WHERE state='AVAILABLE' AND "inventoryBatchId" IS NULL;
CREATE UNIQUE INDEX "position_available_batch_uq" ON "InventoryPosition" ("companyId","productId","inventoryBatchId")
  WHERE state='AVAILABLE' AND "inventoryBatchId" IS NOT NULL;
CREATE UNIQUE INDEX "position_custody_unbatched_uq" ON "InventoryPosition" ("companyId","productId","contextType","contextId")
  WHERE state='CUSTODY' AND "inventoryBatchId" IS NULL;
CREATE UNIQUE INDEX "position_custody_batch_uq" ON "InventoryPosition" ("companyId","productId","inventoryBatchId","contextType","contextId")
  WHERE state='CUSTODY' AND "inventoryBatchId" IS NOT NULL;

ALTER TABLE "InventoryPosition" ADD CONSTRAINT "InventoryPosition_quantity_revision_check"
  CHECK (quantity >= 0 AND revision >= 0);
ALTER TABLE "InventoryPosition" ADD CONSTRAINT "InventoryPosition_context_check" CHECK (
  (state='AVAILABLE' AND "contextType" IS NULL AND "contextId" IS NULL) OR
  (state='CUSTODY' AND "contextType" IS NOT NULL AND "contextId" IS NOT NULL
    AND "contextType" ~ '^[A-Z][A-Z0-9_]*$'
    AND length("contextId") BETWEEN 1 AND 128 AND "contextId"=btrim("contextId"))
);
ALTER TABLE "InventoryPhysicalEffect" ADD CONSTRAINT "InventoryPhysicalEffect_shape_check" CHECK (
  "lineCount">0 AND "requestHash" ~ '^[0-9a-f]{64}$'
  AND length("originType")>0 AND "originType"=btrim("originType")
  AND length("originId")>0 AND "originId"=btrim("originId")
  AND length("originOperation")>0 AND "originOperation"=btrim("originOperation")
  AND (reason IS NULL OR (length(reason) BETWEEN 1 AND 1000 AND reason=btrim(reason)))
);
ALTER TABLE "InventoryPhysicalEffectLine" ADD CONSTRAINT "InventoryPhysicalEffectLine_facts_check" CHECK (
  sequence>0 AND delta<>0 AND "quantityBefore">=0 AND "quantityAfter">=0
  AND "quantityAfter"::bigint="quantityBefore"::bigint+delta::bigint
  AND "revisionBefore">=0 AND "revisionAfter"::bigint="revisionBefore"::bigint+1
);

-- INSERT completeness/shape only. No UPDATE/DELETE immutability triggers.
CREATE FUNCTION public.inventory_physical_effect_complete() RETURNS trigger
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
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "InventoryPhysicalEffect_complete"
  AFTER INSERT ON "InventoryPhysicalEffect" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.inventory_physical_effect_complete();
CREATE CONSTRAINT TRIGGER "InventoryPhysicalEffectLine_complete"
  AFTER INSERT ON "InventoryPhysicalEffectLine" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.inventory_physical_effect_complete();

COMMIT;
