
-- R2A-01 / Supplier Documents. Additive migration only; run against isolated PostgreSQL first.
CREATE TYPE "SupplierDocumentType" AS ENUM ('FACTURA', 'REMISION', 'NOTA_ENTREGA');
CREATE TYPE "SupplierDocumentStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "SupplierDocumentBasisStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED');
CREATE TYPE "SupplierDocumentTaxTreatment" AS ENUM ('TAXABLE_16', 'TAXABLE_0', 'EXEMPT');
CREATE TYPE "SupplierDocumentTaxArea" AS ENUM ('GOODS', 'SHIPPING', 'UNSPECIFIED');
CREATE TYPE "SupplierDocumentAuditOperation" AS ENUM ('DOCUMENT_CREATED', 'DOCUMENT_CREATED_BY_EXCEPTION');
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_EXCEPTION_CREATE';

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_id_companyId_key" UNIQUE ("id", "companyId");

CREATE TABLE "SupplierDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "type" "SupplierDocumentType" NOT NULL,
  "series" VARCHAR(80),
  "number" VARCHAR(160) NOT NULL,
  "normalizedSeries" VARCHAR(80) NOT NULL DEFAULT '',
  "normalizedNumber" VARCHAR(160) NOT NULL,
  "identityOccurrence" INTEGER NOT NULL DEFAULT 1,
  "documentDate" DATE NOT NULL,
  "cfdiUuid" UUID,
  "issuerRfc" VARCHAR(13),
  "receiverRfc" VARCHAR(13),
  "currency" VARCHAR(3),
  "subtotalAmount" DECIMAL(18,2),
  "discountAmount" DECIMAL(18,2),
  "freightAmount" DECIMAL(18,2),
  "ivaAmount" DECIMAL(18,2),
  "withholdingAmount" DECIMAL(18,2),
  "totalAmount" DECIMAL(18,2),
  "goodsNetAmount" DECIMAL(18,2),
  "basisStatus" "SupplierDocumentBasisStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "status" "SupplierDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "exceptionBasedOnDocumentId" TEXT,
  "exceptionReason" VARCHAR(1000),
  "exceptionEvidenceReference" VARCHAR(1000),
  "exceptionReviewedById" TEXT,
  "exceptionReviewedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierDocument_occurrence_check" CHECK ("identityOccurrence" >= 1),
  CONSTRAINT "SupplierDocument_normalized_number_check" CHECK (length(btrim("normalizedNumber")) > 0),
  CONSTRAINT "SupplierDocument_exception_check" CHECK (
    ("identityOccurrence" = 1 AND "exceptionBasedOnDocumentId" IS NULL AND "exceptionReason" IS NULL
      AND "exceptionEvidenceReference" IS NULL AND "exceptionReviewedById" IS NULL AND "exceptionReviewedAt" IS NULL)
    OR ("identityOccurrence" > 1 AND "exceptionBasedOnDocumentId" IS NOT NULL AND "exceptionReason" IS NOT NULL
      AND length(btrim("exceptionReason")) > 0 AND "exceptionEvidenceReference" IS NOT NULL
      AND length(btrim("exceptionEvidenceReference")) > 0 AND "exceptionReviewedById" IS NOT NULL
      AND "exceptionReviewedAt" IS NOT NULL)
  ),
  CONSTRAINT "SupplierDocument_uuid_type_check" CHECK ("cfdiUuid" IS NULL OR "type" = 'FACTURA'),
  CONSTRAINT "SupplierDocument_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "SupplierDocument_basis_check" CHECK ("basisStatus" = 'PENDING_REVIEW' OR ("currency" IS NOT NULL AND "goodsNetAmount" IS NOT NULL)),
  CONSTRAINT "SupplierDocument_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "SupplierDocument_subtotal_nonnegative" CHECK ("subtotalAmount" IS NULL OR "subtotalAmount" >= 0),
  CONSTRAINT "SupplierDocument_discount_nonnegative" CHECK ("discountAmount" IS NULL OR "discountAmount" >= 0),
  CONSTRAINT "SupplierDocument_freight_nonnegative" CHECK ("freightAmount" IS NULL OR "freightAmount" >= 0),
  CONSTRAINT "SupplierDocument_iva_nonnegative" CHECK ("ivaAmount" IS NULL OR "ivaAmount" >= 0),
  CONSTRAINT "SupplierDocument_withholding_nonnegative" CHECK ("withholdingAmount" IS NULL OR "withholdingAmount" >= 0),
  CONSTRAINT "SupplierDocument_total_nonnegative" CHECK ("totalAmount" IS NULL OR "totalAmount" >= 0),
  CONSTRAINT "SupplierDocument_goodsnet_nonnegative" CHECK ("goodsNetAmount" IS NULL OR "goodsNetAmount" >= 0)
);
CREATE UNIQUE INDEX "SupplierDocument_id_companyId_key" ON "SupplierDocument" ("id", "companyId");
CREATE UNIQUE INDEX "SupplierDocument_id_companyId_supplierId_key" ON "SupplierDocument" ("id", "companyId", "supplierId");
CREATE UNIQUE INDEX "SupplierDocument_company_cfdi_uuid_key" ON "SupplierDocument" ("companyId", "cfdiUuid");
CREATE UNIQUE INDEX "SupplierDocument_commercial_occurrence_key" ON "SupplierDocument"
  ("companyId", "supplierId", "type", "normalizedSeries", "normalizedNumber", "identityOccurrence");
CREATE INDEX "SupplierDocument_identity_search_idx" ON "SupplierDocument" ("companyId", "supplierId", "type", "normalizedSeries", "normalizedNumber");
CREATE INDEX "SupplierDocument_companyId_supplierId_documentDate_idx" ON "SupplierDocument" ("companyId", "supplierId", "documentDate");
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_companyId_fkey"
  FOREIGN KEY ("supplierId", "companyId") REFERENCES "Supplier"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_createdById_companyId_fkey"
  FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_exceptionReviewedById_companyId_fkey"
  FOREIGN KEY ("exceptionReviewedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_exceptionBasedOnDocumentId_fkey"
  FOREIGN KEY ("exceptionBasedOnDocumentId", "companyId", "supplierId")
  REFERENCES "SupplierDocument"("id", "companyId", "supplierId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "SupplierDocumentTaxBreakdown" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "area" "SupplierDocumentTaxArea" NOT NULL,
  "treatment" "SupplierDocumentTaxTreatment" NOT NULL,
  "baseAmount" DECIMAL(18,2) NOT NULL,
  "ivaAmount" DECIMAL(18,2) NOT NULL,
  CONSTRAINT "SupplierDocumentTaxBreakdown_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierDocumentTaxBreakdown_nonnegative" CHECK ("baseAmount" >= 0 AND "ivaAmount" >= 0),
  CONSTRAINT "SupplierDocumentTaxBreakdown_tax_exempt_zero" CHECK ("treatment" = 'TAXABLE_16' OR "ivaAmount" = 0)
);
CREATE UNIQUE INDEX "SupplierDocumentTaxBreakdown_identity_key" ON "SupplierDocumentTaxBreakdown" ("companyId", "documentId", "area", "treatment");
CREATE INDEX "SupplierDocumentTaxBreakdown_companyId_documentId_idx" ON "SupplierDocumentTaxBreakdown" ("companyId", "documentId");
ALTER TABLE "SupplierDocumentTaxBreakdown" ADD CONSTRAINT "SupplierDocumentTaxBreakdown_document_fkey"
  FOREIGN KEY ("documentId", "companyId") REFERENCES "SupplierDocument"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "SupplierDocumentAudit" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "operation" "SupplierDocumentAuditOperation" NOT NULL,
  "actorId" TEXT NOT NULL,
  "revisionBefore" INTEGER,
  "revisionAfter" INTEGER NOT NULL,
  "reason" VARCHAR(1000),
  "change" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierDocumentAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierDocumentAudit_revision_key" ON "SupplierDocumentAudit" ("companyId", "documentId", "revisionAfter");
CREATE INDEX "SupplierDocumentAudit_companyId_documentId_createdAt_id_idx" ON "SupplierDocumentAudit" ("companyId", "documentId", "createdAt", "id");
ALTER TABLE "SupplierDocumentAudit" ADD CONSTRAINT "SupplierDocumentAudit_document_fkey"
  FOREIGN KEY ("documentId", "companyId") REFERENCES "SupplierDocument"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierDocumentAudit" ADD CONSTRAINT "SupplierDocumentAudit_actor_fkey"
  FOREIGN KEY ("actorId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Additional defense-in-depth: audit history may only be appended by application role.
CREATE FUNCTION "reject_supplier_document_audit_mutation"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SupplierDocumentAudit is append-only'; END;
$$;
CREATE TRIGGER "SupplierDocumentAudit_append_only" BEFORE UPDATE OR DELETE ON "SupplierDocumentAudit"
FOR EACH ROW EXECUTE FUNCTION "reject_supplier_document_audit_mutation"();
