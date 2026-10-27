-- UX-PDOC-01B3d5b3c1: verifier-gateway acceptance audit, not download approval.
-- Ed25519 is validated by the isolated gateway BEFORE this insert; SQL only
-- binds the marker to a consumed challenge + matching immutable receipt.
-- No role is granted INSERT. DB OWNER IS NOT A TRUSTED GATEWAY in production.
BEGIN;

CREATE TABLE "SupplierAttachmentVerifiedScanEvidence" (
  "id" TEXT NOT NULL,
  "jobId" UUID NOT NULL,
  "receiptId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requestNonce" UUID NOT NULL,
  "signingKeyId" VARCHAR(64) NOT NULL,
  "signatureSha256" VARCHAR(64) NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAttachmentVerifiedScanEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SAVSE_signature_digest_check" CHECK (
    "signatureSha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "SAVSE_job_key"
  ON "SupplierAttachmentVerifiedScanEvidence" ("jobId");
CREATE UNIQUE INDEX "SAVSE_receipt_key"
  ON "SupplierAttachmentVerifiedScanEvidence" ("receiptId");
CREATE UNIQUE INDEX "SAVSE_nonce_key"
  ON "SupplierAttachmentVerifiedScanEvidence" ("requestNonce");
CREATE INDEX "SAVSE_company_verified_idx"
  ON "SupplierAttachmentVerifiedScanEvidence" ("companyId", "verifiedAt");

ALTER TABLE "SupplierAttachmentVerifiedScanEvidence"
  ADD CONSTRAINT "SAVSE_job_fkey" FOREIGN KEY ("jobId")
  REFERENCES "SupplierAttachmentScanJob" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierAttachmentVerifiedScanEvidence"
  ADD CONSTRAINT "SAVSE_receipt_fkey" FOREIGN KEY ("receiptId")
  REFERENCES "SupplierAttachmentSignedEvidenceReceipt" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "guard_supplier_verified_scan_evidence"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Verified scan audit is append-only';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "SupplierAttachmentScanJob" j
    JOIN "SupplierAttachmentSignedEvidenceReceipt" r
      ON r."companyId" = j."companyId"
      AND r."requestNonce" = j."requestNonce"
    JOIN "SupplierAttachmentScanAttempt" a
      ON a."id" = r."attemptId"
      AND a."companyId" = r."companyId"
      AND a."requestNonce" = r."requestNonce"
    WHERE j."id" = NEW."jobId"
      AND r."id" = NEW."receiptId"
      AND j."companyId" = NEW."companyId"
      AND j."requestNonce" = NEW."requestNonce"
      AND j."status" = 'CONSUMED'
      AND j."consumedAt" IS NOT NULL
      AND a."attachmentId" = j."attachmentId"
      AND a."reservationId" = j."reservationId"
      AND a."contentSha256" = j."contentSha256"
      AND a."contentSizeBytes" = j."contentSizeBytes"
      AND r."signingKeyId" = NEW."signingKeyId"
  ) THEN
    RAISE EXCEPTION 'No matching consumed scan evidence for verifier audit';
  END IF;

  NEW."verifiedAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SAVSE_append_only_scope"
BEFORE INSERT OR UPDATE OR DELETE ON "SupplierAttachmentVerifiedScanEvidence"
FOR EACH ROW EXECUTE FUNCTION "guard_supplier_verified_scan_evidence"();

REVOKE ALL ON TABLE "SupplierAttachmentVerifiedScanEvidence" FROM PUBLIC;
COMMIT;
