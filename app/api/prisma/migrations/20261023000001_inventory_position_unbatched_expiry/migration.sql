-- INSAP-AUTO-01B-PHY: preserve unbatched physical stock by calendar expiry.
-- PostgreSQL 16 null-aware UNIQUE indexes keep legacy NULL identities unique.
-- Existing position IDs, quantities, revisions and effect references are untouched.
-- Batches remain the authoritative expiry source for batched stock.
BEGIN;

ALTER TABLE "InventoryPosition"
  ADD COLUMN "expirationDate" DATE;

ALTER TABLE "InventoryPosition"
  ADD CONSTRAINT "InventoryPosition_expiry_single_source_check"
  CHECK ("inventoryBatchId" IS NULL OR "expirationDate" IS NULL);

-- Replace ONLY the two unbatched partial indexes; batched indexes stay as-is.
DROP INDEX "position_available_unbatched_uq";
DROP INDEX "position_custody_unbatched_uq";

CREATE UNIQUE INDEX "position_available_unbatched_expiry_uq"
  ON "InventoryPosition" ("companyId", "productId", "expirationDate")
  NULLS NOT DISTINCT
  WHERE state = 'AVAILABLE' AND "inventoryBatchId" IS NULL;

CREATE UNIQUE INDEX "position_custody_unbatched_expiry_uq"
  ON "InventoryPosition"
  ("companyId", "productId", "contextType", "contextId", "expirationDate")
  NULLS NOT DISTINCT
  WHERE state = 'CUSTODY' AND "inventoryBatchId" IS NULL;

COMMIT;
