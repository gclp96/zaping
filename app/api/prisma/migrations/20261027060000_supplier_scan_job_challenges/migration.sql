-- UX-PDOC-01B3d5b3b: database-issued, single-use scan challenges.
-- NO promotion/availability, verified signature gateway or runtime grants.
-- All issuing/consumption functions are SECURITY INVOKER and not executable
-- by PUBLIC. Production privileges require separate security review.
BEGIN;

CREATE TYPE "SupplierAttachmentScanJobStatus" AS ENUM
  ('ISSUED', 'CONSUMED', 'EXPIRED');

CREATE TABLE "SupplierAttachmentScanJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "requestNonce" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quarantineKey" VARCHAR(300) NOT NULL,
  "contentSizeBytes" INTEGER NOT NULL,
  "contentSha256" VARCHAR(64) NOT NULL,
  "status" "SupplierAttachmentScanJobStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "SupplierAttachmentScanJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SASJ_size_check" CHECK
    ("contentSizeBytes" BETWEEN 1 AND 10485760),
  CONSTRAINT "SASJ_hash_check" CHECK
    ("contentSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "SASJ_ttl_check" CHECK (
    "expiresAt" > "issuedAt"
    AND "expiresAt" <= "issuedAt" + INTERVAL '5 minutes'
  ),
  CONSTRAINT "SASJ_consumed_check" CHECK (
    ("status" = 'CONSUMED' AND "consumedAt" IS NOT NULL)
    OR ("status" <> 'CONSUMED' AND "consumedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "SASJ_nonce_key"
  ON "SupplierAttachmentScanJob" ("requestNonce");
CREATE UNIQUE INDEX "SASJ_one_issued_attachment"
  ON "SupplierAttachmentScanJob" ("companyId", "attachmentId")
  WHERE "status" = 'ISSUED';
CREATE INDEX "SASJ_company_attachment_status_idx"
  ON "SupplierAttachmentScanJob"
    ("companyId", "attachmentId", "status", "expiresAt");

ALTER TABLE "SupplierAttachmentScanJob"
  ADD CONSTRAINT "SASJ_attachment_tenant_fkey"
  FOREIGN KEY ("attachmentId", "companyId")
  REFERENCES "SupplierDocumentAttachment" ("id", "companyId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierAttachmentScanJob"
  ADD CONSTRAINT "SASJ_reservation_tenant_fkey"
  FOREIGN KEY ("reservationId", "companyId")
  REFERENCES "SupplierAttachmentUploadReservation" ("id", "companyId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "guard_supplier_attachment_scan_job"()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Scan jobs cannot be deleted';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'ISSUED' OR NEW."consumedAt" IS NOT NULL
      OR NEW."attachmentId" IS DISTINCT FROM NEW."reservationId"
      OR NOT EXISTS (
        SELECT 1
        FROM "SupplierAttachmentUploadReservation" r
        JOIN "SupplierDocumentAttachment" a
          ON a."id" = r."id" AND a."companyId" = r."companyId"
        JOIN "SupplierDocument" d
          ON d."id" = r."documentId" AND d."companyId" = r."companyId"
        WHERE r."id" = NEW."reservationId"
          AND r."companyId" = NEW."companyId"
          AND r."documentId" = NEW."documentId"
          AND r."quarantineKey" = NEW."quarantineKey"
          AND r."sizeBytes" = NEW."contentSizeBytes"
          AND r."sha256" = NEW."contentSha256"
          AND r."status" = 'REGISTERED'
          AND a."id" = NEW."attachmentId"
          AND a."documentId" = r."documentId"
          AND a."status" = 'PENDING_SCAN'
          AND a."sizeBytes" = r."sizeBytes"
          AND a."sha256" = r."sha256"
          AND a."storageKey" =
            replace(r."quarantineKey", 'quarantine/', 'private/')
          AND d."status" = 'ACTIVE'
      )
    THEN
      RAISE EXCEPTION 'Scan job requires a registered pending object';
    END IF;
    -- The database, never the caller, owns the job issuance timestamp.
    NEW."issuedAt" := clock_timestamp();
    RETURN NEW;
  END IF;

  IF OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."requestNonce" IS DISTINCT FROM NEW."requestNonce"
    OR OLD."companyId" IS DISTINCT FROM NEW."companyId"
    OR OLD."documentId" IS DISTINCT FROM NEW."documentId"
    OR OLD."attachmentId" IS DISTINCT FROM NEW."attachmentId"
    OR OLD."reservationId" IS DISTINCT FROM NEW."reservationId"
    OR OLD."quarantineKey" IS DISTINCT FROM NEW."quarantineKey"
    OR OLD."contentSizeBytes" IS DISTINCT FROM NEW."contentSizeBytes"
    OR OLD."contentSha256" IS DISTINCT FROM NEW."contentSha256"
    OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt"
    OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
    OR OLD."status" <> 'ISSUED'
  THEN
    RAISE EXCEPTION 'Scan job identity and terminal state are immutable';
  END IF;

  IF NEW."status" = 'EXPIRED'
    AND clock_timestamp() >= OLD."expiresAt"
  THEN
    NEW."consumedAt" := NULL;
    RETURN NEW;
  END IF;

  -- This is only an accounting transition. A matching receipt is UNTRUSTED
  -- and cannot authorize AVAILABLE or REJECTED until B3d5b3c verifies it.
  IF NEW."status" = 'CONSUMED'
    AND clock_timestamp() < OLD."expiresAt"
    AND EXISTS (
      SELECT 1
      FROM "SupplierAttachmentScanAttempt" a
      JOIN "SupplierAttachmentSignedEvidenceReceipt" e
        ON e."attemptId" = a."id"
        AND e."companyId" = a."companyId"
        AND e."requestNonce" = a."requestNonce"
      WHERE a."requestNonce" = OLD."requestNonce"
        AND a."companyId" = OLD."companyId"
        AND a."attachmentId" = OLD."attachmentId"
        AND a."reservationId" = OLD."reservationId"
        AND a."contentSizeBytes" = OLD."contentSizeBytes"
        AND a."contentSha256" = OLD."contentSha256"
    )
  THEN
    NEW."consumedAt" := clock_timestamp();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Illegal scan job transition';
END;
$$;

CREATE TRIGGER "SASJ_guard_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "SupplierAttachmentScanJob"
FOR EACH ROW EXECUTE FUNCTION "guard_supplier_attachment_scan_job"();

-- Issuer only runs under an explicit DB identity; the current migration
-- grants NO EXECUTE privilege to API or scanner runtime identities.
CREATE FUNCTION "issue_supplier_attachment_scan_job"(
  p_company_id TEXT,
  p_reservation_id TEXT,
  p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
  "jobId" UUID, "requestNonce" UUID, "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3)
)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE
  item RECORD;
  issued RECORD;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 60 AND 300 THEN
    RAISE EXCEPTION 'Invalid scan job lifetime';
  END IF;

  -- Serialize issuing/reissuing against the same registered reservation.
  SELECT r."id", r."companyId", r."documentId", r."quarantineKey",
    r."sizeBytes", r."sha256"
  INTO item
  FROM "SupplierAttachmentUploadReservation" r
  JOIN "SupplierDocumentAttachment" a
    ON a."id" = r."id" AND a."companyId" = r."companyId"
  JOIN "SupplierDocument" d
    ON d."id" = r."documentId" AND d."companyId" = r."companyId"
  WHERE r."id" = p_reservation_id AND r."companyId" = p_company_id
    AND r."status" = 'REGISTERED'
    AND a."status" = 'PENDING_SCAN'
    AND d."status" = 'ACTIVE'
    AND a."documentId" = r."documentId"
    AND a."sizeBytes" = r."sizeBytes"
    AND a."sha256" = r."sha256"
    AND a."storageKey" =
      replace(r."quarantineKey", 'quarantine/', 'private/')
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registered pending scan object not found';
  END IF;

  -- Stale challenges can never be consumed. Reissuance does not reuse nonce.
  UPDATE "SupplierAttachmentScanJob" j
  SET "status" = 'EXPIRED'
  WHERE j."companyId" = item."companyId"
    AND j."attachmentId" = item."id"
    AND j."status" = 'ISSUED'
    AND j."expiresAt" <= clock_timestamp();

  IF EXISTS (
    SELECT 1 FROM "SupplierAttachmentScanJob" j
    WHERE j."companyId" = item."companyId"
      AND j."attachmentId" = item."id"
      AND j."status" = 'ISSUED'
  ) THEN
    RAISE EXCEPTION 'An active scan challenge already exists';
  END IF;

  INSERT INTO "SupplierAttachmentScanJob" AS new_job (
    "companyId", "documentId", "attachmentId", "reservationId",
    "quarantineKey", "contentSizeBytes", "contentSha256", "expiresAt"
  )
  VALUES (
    item."companyId", item."documentId", item."id", item."id",
    item."quarantineKey", item."sizeBytes", item."sha256",
    clock_timestamp() + make_interval(secs => p_ttl_seconds)
  )
  RETURNING new_job."id", new_job."requestNonce",
    new_job."issuedAt", new_job."expiresAt" INTO issued;

  RETURN QUERY SELECT issued."id", issued."requestNonce",
    issued."issuedAt", issued."expiresAt";
END;
$$;

-- A future verified gateway must invoke this in the SAME transaction as
-- accepted signed-evidence persistence, *after* external Ed25519 verification.
-- For now, matching a receipt proves only that data was recorded, NOT trusted.
CREATE FUNCTION "consume_supplier_attachment_scan_job"(
  p_company_id TEXT,
  p_request_nonce UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE
  item RECORD;
BEGIN
  SELECT j."id", j."status", j."expiresAt"
    INTO item
  FROM "SupplierAttachmentScanJob" j
  WHERE j."companyId" = p_company_id
    AND j."requestNonce" = p_request_nonce
  FOR UPDATE;

  IF NOT FOUND OR item."status" <> 'ISSUED'
    OR clock_timestamp() >= item."expiresAt"
  THEN
    RETURN FALSE;
  END IF;

  -- Trigger independently proves a matching append-only receipt exists.
  UPDATE "SupplierAttachmentScanJob"
  SET "status" = 'CONSUMED'
  WHERE "id" = item."id";
  RETURN TRUE;
END;
$$;

REVOKE ALL ON TABLE "SupplierAttachmentScanJob" FROM PUBLIC;
REVOKE ALL ON FUNCTION "issue_supplier_attachment_scan_job"(TEXT, TEXT, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION "consume_supplier_attachment_scan_job"(TEXT, UUID)
  FROM PUBLIC;

COMMIT;
