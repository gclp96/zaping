-- R2A-02: additive documentary reconciliation; test against ephemeral PostgreSQL before merge.
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_BASIS_CONFIRM';
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_ALLOCATION_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_ALLOCATION_REVISE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_CORRECT';
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_CANCEL';
ALTER TYPE "IdempotencyScope" ADD VALUE 'SUPPLIER_DOCUMENT_VARIANCE_APPROVE';

ALTER TYPE "SupplierDocumentAuditOperation" ADD VALUE 'BASIS_CONFIRMED';
ALTER TYPE "SupplierDocumentAuditOperation" ADD VALUE 'ALLOCATION_CREATED';
ALTER TYPE "SupplierDocumentAuditOperation" ADD VALUE 'ALLOCATION_REVISED';
ALTER TYPE "SupplierDocumentAuditOperation" ADD VALUE 'DOCUMENT_CORRECTED';
ALTER TYPE "SupplierDocumentAuditOperation" ADD VALUE 'DOCUMENT_CANCELLED';
ALTER TYPE "SupplierDocumentAuditOperation" ADD VALUE 'VARIANCE_APPROVED';

CREATE TYPE "SupplierDocumentCancellationSource" AS ENUM ('INTERNAL_RECORD_ERROR', 'EXTERNAL_REPORTED');
CREATE UNIQUE INDEX "Purchase_id_companyId_supplierId_key" ON "Purchase" ("id", "companyId", "supplierId");
CREATE UNIQUE INDEX "PurchaseReceipt_id_companyId_purchaseId_key" ON "PurchaseReceipt" ("id", "companyId", "purchaseId");

ALTER TABLE "SupplierDocument"
  ADD COLUMN "cancellationSource" "SupplierDocumentCancellationSource",
  ADD COLUMN "cancellationReason" VARCHAR(1000),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "replacedByDocumentId" TEXT;

CREATE INDEX "SupplierDocument_companyId_replacedByDocumentId_idx" ON "SupplierDocument" ("companyId", "replacedByDocumentId");
ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_cancellation_state_check" CHECK (
    ("status" = 'ACTIVE'
      AND "cancellationSource" IS NULL AND "cancellationReason" IS NULL
      AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "replacedByDocumentId" IS NULL)
    OR
    ("status" = 'CANCELLED'
      AND "cancellationSource" IS NOT NULL AND "cancellationReason" IS NOT NULL
      AND length(btrim("cancellationReason")) > 0
      AND "cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL)
  );
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_cancelledById_fkey"
  FOREIGN KEY ("cancelledById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_replacedByDocumentId_fkey"
  FOREIGN KEY ("replacedByDocumentId", "companyId", "supplierId")
  REFERENCES "SupplierDocument"("id", "companyId", "supplierId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "PurchaseReceiptDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "allocatedSubtotal" DECIMAL(18,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseReceiptDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseReceiptDocument_amount_check" CHECK ("allocatedSubtotal" > 0),
  CONSTRAINT "PurchaseReceiptDocument_revision_check" CHECK ("revision" >= 0)
);
CREATE UNIQUE INDEX "PurchaseReceiptDocument_pair_key"
  ON "PurchaseReceiptDocument" ("companyId", "documentId", "receiptId");
CREATE INDEX "PurchaseReceiptDocument_companyId_receiptId_isActive_idx"
  ON "PurchaseReceiptDocument" ("companyId", "receiptId", "isActive");
CREATE INDEX "PurchaseReceiptDocument_companyId_documentId_isActive_idx"
  ON "PurchaseReceiptDocument" ("companyId", "documentId", "isActive");

ALTER TABLE "PurchaseReceiptDocument" ADD CONSTRAINT "PurchaseReceiptDocument_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptDocument" ADD CONSTRAINT "PurchaseReceiptDocument_supplierId_companyId_fkey"
  FOREIGN KEY ("supplierId", "companyId") REFERENCES "Supplier"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptDocument" ADD CONSTRAINT "PurchaseReceiptDocument_purchase_fkey"
  FOREIGN KEY ("purchaseId", "companyId", "supplierId") REFERENCES "Purchase"("id", "companyId", "supplierId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptDocument" ADD CONSTRAINT "PurchaseReceiptDocument_receipt_fkey"
  FOREIGN KEY ("receiptId", "companyId", "purchaseId") REFERENCES "PurchaseReceipt"("id", "companyId", "purchaseId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptDocument" ADD CONSTRAINT "PurchaseReceiptDocument_document_fkey"
  FOREIGN KEY ("documentId", "companyId", "supplierId") REFERENCES "SupplierDocument"("id", "companyId", "supplierId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptDocument" ADD CONSTRAINT "PurchaseReceiptDocument_createdBy_fkey"
  FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "PurchaseReceiptReconciliationApproval" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "receiptNetAmount" DECIMAL(18,2) NOT NULL,
  "allocatedTotalAmount" DECIMAL(18,2) NOT NULL,
  "differenceAmount" DECIMAL(18,2) NOT NULL,
  "allocationSnapshotHash" VARCHAR(64) NOT NULL,
  "allocationSnapshot" JSONB NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "approvedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseReceiptReconciliationApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseReceiptApproval_amount_check" CHECK ("receiptNetAmount" >= 0 AND "allocatedTotalAmount" >= 0),
  CONSTRAINT "PurchaseReceiptApproval_reason_check" CHECK (length(btrim("reason")) > 0)
);
CREATE UNIQUE INDEX "PurchaseReceiptApproval_snapshot_key"
  ON "PurchaseReceiptReconciliationApproval" ("companyId", "receiptId", "allocationSnapshotHash");
CREATE INDEX "PurchaseReceiptApproval_companyId_receiptId_createdAt_id_idx"
  ON "PurchaseReceiptReconciliationApproval" ("companyId", "receiptId", "createdAt", "id");
ALTER TABLE "PurchaseReceiptReconciliationApproval" ADD CONSTRAINT "PurchaseReceiptApproval_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptReconciliationApproval" ADD CONSTRAINT "PurchaseReceiptApproval_supplierId_companyId_fkey"
  FOREIGN KEY ("supplierId", "companyId") REFERENCES "Supplier"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptReconciliationApproval" ADD CONSTRAINT "PurchaseReceiptApproval_purchase_fkey"
  FOREIGN KEY ("purchaseId", "companyId", "supplierId") REFERENCES "Purchase"("id", "companyId", "supplierId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptReconciliationApproval" ADD CONSTRAINT "PurchaseReceiptApproval_receipt_fkey"
  FOREIGN KEY ("receiptId", "companyId", "purchaseId") REFERENCES "PurchaseReceipt"("id", "companyId", "purchaseId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptReconciliationApproval" ADD CONSTRAINT "PurchaseReceiptApproval_actor_fkey"
  FOREIGN KEY ("approvedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "reject_supplier_document_approval_mutation"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PurchaseReceiptReconciliationApproval is append-only'; END;
$$;
CREATE TRIGGER "PurchaseReceiptApproval_append_only" BEFORE UPDATE OR DELETE
  ON "PurchaseReceiptReconciliationApproval" FOR EACH ROW
  EXECUTE FUNCTION "reject_supplier_document_approval_mutation"();
