-- Additive, nonmonetary association. No automatic linkage from legacy document folios.
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_id_companyId_key" UNIQUE ("id", "companyId");

CREATE TABLE "PurchaseReceiptSupplierDocumentLink" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedById" TEXT,
  "removedAt" TIMESTAMP(3),
  "reason" VARCHAR(1000),
  CONSTRAINT "PurchaseReceiptSupplierDocumentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseReceiptSupplierDocumentLink_companyId_receiptId_documentId_key" ON "PurchaseReceiptSupplierDocumentLink"("companyId", "receiptId", "documentId");
CREATE INDEX "PurchaseReceiptSupplierDocumentLink_companyId_documentId_idx" ON "PurchaseReceiptSupplierDocumentLink"("companyId", "documentId");

ALTER TABLE "PurchaseReceiptSupplierDocumentLink" ADD CONSTRAINT "PRSDL_company_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptSupplierDocumentLink" ADD CONSTRAINT "PRSDL_receipt_fkey"
  FOREIGN KEY ("receiptId", "companyId") REFERENCES "PurchaseReceipt"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptSupplierDocumentLink" ADD CONSTRAINT "PRSDL_document_fkey"
  FOREIGN KEY ("documentId", "companyId") REFERENCES "SupplierDocument"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptSupplierDocumentLink" ADD CONSTRAINT "PRSDL_created_by_fkey"
  FOREIGN KEY ("createdById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseReceiptSupplierDocumentLink" ADD CONSTRAINT "PRSDL_removed_by_fkey"
  FOREIGN KEY ("removedById", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT;
