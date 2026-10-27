-- UX-PDOC-01B3d5b3a: append-only receipt of UNTRUSTED signed scanner claims.
-- Postgres cannot authenticate Ed25519 signatures natively in this schema:
-- this table is evidence storage ONLY and must NEVER authorize AVAILABLE.
-- Active B3d5a PENDING_SCAN -> AVAILABLE/REJECTED denial remains unchanged.
BEGIN;

ALTER TABLE "SupplierAttachmentScanAttempt"
  ADD CONSTRAINT "SASA_id_company_nonce_key"
  UNIQUE ("id", "companyId", "requestNonce");

CREATE TABLE "SupplierAttachmentSignedEvidenceReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "requestNonce" UUID NOT NULL,
  "signingKeyId" VARCHAR(64) NOT NULL,
  "signature" VARCHAR(86) NOT NULL,
  "signedClaims" JSONB NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAttachmentSignedEvidenceReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SASER_key_id_format" CHECK (
    "signingKeyId" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  ),
  CONSTRAINT "SASER_signature_format" CHECK (
    "signature" ~ '^[A-Za-z0-9_-]{86}$'
  ),
  CONSTRAINT "SASER_claims_object" CHECK (
    jsonb_typeof("signedClaims") = 'object'
  )
);

CREATE UNIQUE INDEX "SASER_attempt_key"
  ON "SupplierAttachmentSignedEvidenceReceipt" ("attemptId");
CREATE UNIQUE INDEX "SASER_company_nonce_key"
  ON "SupplierAttachmentSignedEvidenceReceipt" ("companyId", "requestNonce");
CREATE INDEX "SASER_company_recorded_idx"
  ON "SupplierAttachmentSignedEvidenceReceipt" ("companyId", "recordedAt");

ALTER TABLE "SupplierAttachmentSignedEvidenceReceipt"
  ADD CONSTRAINT "SASER_attempt_company_nonce_fkey"
  FOREIGN KEY ("attemptId", "companyId", "requestNonce")
  REFERENCES "SupplierAttachmentScanAttempt"
    ("id", "companyId", "requestNonce")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- The submitted claims must agree with the immutable B3d5a ledger and
-- registered reservation metadata. The signature is NOT verified here.
CREATE FUNCTION "guard_supplier_signed_evidence_receipt"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  linked BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Signed evidence receipt is append-only';
  END IF;

  SELECT TRUE INTO linked
  FROM "SupplierAttachmentScanAttempt" a
  JOIN "SupplierAttachmentUploadReservation" r
    ON r."id" = a."reservationId"
   AND r."companyId" = a."companyId"
  JOIN "SupplierDocumentAttachment" d
    ON d."id" = a."attachmentId"
   AND d."companyId" = a."companyId"
  WHERE a."id" = NEW."attemptId"
    AND a."companyId" = NEW."companyId"
    AND a."requestNonce" = NEW."requestNonce"
    AND d."status" = 'PENDING_SCAN'
    AND r."status" = 'REGISTERED'
    AND NEW."signedClaims" ->> 'protocol' = 'zaping-scan-evidence-v1'
    AND NEW."signedClaims" ->> 'companyId' = a."companyId"
    AND NEW."signedClaims" ->> 'documentId' = r."documentId"
    AND NEW."signedClaims" ->> 'attachmentId' = a."attachmentId"
    AND NEW."signedClaims" ->> 'reservationId' = a."reservationId"
    AND NEW."signedClaims" ->> 'requestNonce' = a."requestNonce"::text
    AND NEW."signedClaims" ->> 'quarantineKey' = r."quarantineKey"
    AND NEW."signedClaims" ->> 'contentSha256' = a."contentSha256"
    AND NEW."signedClaims" ->> 'contentSizeBytes' = a."contentSizeBytes"::text
    AND NEW."signedClaims" ->> 'verdict' = a."verdict"::text
    AND (NEW."signedClaims" ->> 'engineVersion') IS NOT DISTINCT FROM a."engineVersion"
    AND (NEW."signedClaims" ->> 'databaseVersion') IS NOT DISTINCT FROM a."databaseVersion"::text
    AND (NEW."signedClaims" ->> 'policyVersion') IS NOT DISTINCT FROM a."policyVersion"
    AND (NEW."signedClaims" ->> 'workerIdentity') IS NOT DISTINCT FROM a."workerIdentity"
    AND (NEW."signedClaims" ->> 'failureCode') IS NOT DISTINCT FROM a."failureCode";

  IF linked IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Signed evidence receipt does not match scan attempt';
  END IF;

  -- Caller cannot forge the database insertion clock.
  NEW."recordedAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SASER_append_only_and_scope"
BEFORE INSERT OR UPDATE OR DELETE
ON "SupplierAttachmentSignedEvidenceReceipt"
FOR EACH ROW EXECUTE FUNCTION "guard_supplier_signed_evidence_receipt"();

-- An owner/superuser bypasses these grants. Dedicated non-owner API/worker
-- roles and a signature-verifying trusted gateway are mandatory in B3d5b3b.
REVOKE ALL ON TABLE "SupplierAttachmentSignedEvidenceReceipt" FROM PUBLIC;

COMMIT;
