-- UX-PDOC-01B3d5a: untrusted append-only scan attempt ledger.
-- Security hold: no byte promotion, scanner authority or download enabled.
-- This migration is intentionally additive and blocks all legacy direct
-- PENDING_SCAN -> AVAILABLE/REJECTED transitions until a later, separately
-- reviewed privileged promotion protocol is installed.
BEGIN;

ALTER TABLE "SupplierDocumentAttachment"
  ADD CONSTRAINT "SDATT_id_company_key" UNIQUE ("id", "companyId");

CREATE TYPE "SupplierAttachmentScanVerdict" AS ENUM (
  'CLEAN_CANDIDATE', 'MALWARE_DETECTED', 'SCAN_FAILED'
);

CREATE TABLE "SupplierAttachmentScanAttempt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "requestNonce" UUID NOT NULL,
  "contentSizeBytes" INTEGER NOT NULL,
  "contentSha256" VARCHAR(64) NOT NULL,
  "verdict" "SupplierAttachmentScanVerdict" NOT NULL,
  "engineVersion" VARCHAR(80),
  "databaseVersion" INTEGER,
  "databaseBuiltAt" TIMESTAMP(3),
  "policyVersion" VARCHAR(80),
  "workerIdentity" VARCHAR(128),
  "failureCode" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAttachmentScanAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SASA_size_check" CHECK ("contentSizeBytes" BETWEEN 1 AND 10485760),
  CONSTRAINT "SASA_sha256_check" CHECK ("contentSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "SASA_engine_db_version_check" CHECK ("databaseVersion" IS NULL OR "databaseVersion" > 0),
  CONSTRAINT "SASA_failure_code_check" CHECK (
    ("verdict" = 'SCAN_FAILED' AND "failureCode" IS NOT NULL
      AND length(btrim("failureCode")) > 0)
    OR ("verdict" <> 'SCAN_FAILED' AND "failureCode" IS NULL)
  )
);

CREATE UNIQUE INDEX "SASA_company_nonce_key"
  ON "SupplierAttachmentScanAttempt" ("companyId", "requestNonce");
CREATE INDEX "SASA_company_attachment_created_idx"
  ON "SupplierAttachmentScanAttempt" ("companyId", "attachmentId", "createdAt");

ALTER TABLE "SupplierAttachmentScanAttempt"
  ADD CONSTRAINT "SASA_attachment_tenant_fkey"
    FOREIGN KEY ("attachmentId", "companyId")
    REFERENCES "SupplierDocumentAttachment" ("id", "companyId")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "SupplierAttachmentScanAttempt"
  ADD CONSTRAINT "SASA_reservation_tenant_fkey"
    FOREIGN KEY ("reservationId", "companyId")
    REFERENCES "SupplierAttachmentUploadReservation" ("id", "companyId")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Record insertion is constrained to the exact registered, tenant-scoped,
-- immutable reservation/attachment metadata and PENDING_SCAN status.
-- Worker claims in this table are UNSIGNED and UNTRUSTED until B3d5b.
CREATE FUNCTION "guard_supplier_attachment_scan_attempt"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Scan attempt evidence is append-only';
  END IF;

  IF NEW."attachmentId" IS DISTINCT FROM NEW."reservationId"
    OR NOT EXISTS (
      SELECT 1
      FROM "SupplierDocumentAttachment" a
      JOIN "SupplierAttachmentUploadReservation" r
        ON r."id" = NEW."reservationId"
        AND r."companyId" = a."companyId"
      WHERE a."id" = NEW."attachmentId"
        AND a."companyId" = NEW."companyId"
        AND a."documentId" = r."documentId"
        AND a."uploadedById" = r."createdById"
        AND a."originalName" = r."originalName"
        AND a."contentType" = r."contentType"
        AND a."sizeBytes" = NEW."contentSizeBytes"
        AND r."sizeBytes" = NEW."contentSizeBytes"
        AND a."sha256" = NEW."contentSha256"
        AND r."sha256" = NEW."contentSha256"
        AND a."storageKey" = replace(r."quarantineKey", 'quarantine/', 'private/')
        AND a."status" = 'PENDING_SCAN'
        AND r."status" = 'REGISTERED'
    )
  THEN
    RAISE EXCEPTION 'Scan attempt does not match registered quarantined bytes';
  END IF;

  -- The DB timestamp is authoritative for when evidence was recorded.
  -- No scan verdict or worker claim created here is an authorization.
  NEW."createdAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SASA_append_only_and_scope"
BEFORE INSERT OR UPDATE OR DELETE ON "SupplierAttachmentScanAttempt"
FOR EACH ROW EXECUTE FUNCTION "guard_supplier_attachment_scan_attempt"();

-- The B3d1 trigger permits direct AVAILABLE if scanEngine/scannedAt are set.
-- Block this legacy route unconditionally until the privileged transition
-- protocol of B3d5c has been audited and separately installed.
CREATE FUNCTION "deny_unattested_supplier_attachment_transition"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'PENDING_SCAN' AND NEW."status" <> 'PENDING_SCAN' THEN
    RAISE EXCEPTION 'Trusted scan and object promotion not implemented';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SDATT_B3d5a_block_unattested_transition"
BEFORE UPDATE ON "SupplierDocumentAttachment"
FOR EACH ROW EXECUTE FUNCTION "deny_unattested_supplier_attachment_transition"();

-- PUBLIC grants do not affect table owners; future deployment MUST
-- isolate the API and scanner DB roles before accepting user uploads.
REVOKE ALL ON TABLE "SupplierAttachmentScanAttempt" FROM PUBLIC;

COMMIT;
