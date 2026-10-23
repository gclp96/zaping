-- Optional supplier invoice/remission reference on each physical receipt.
-- Existing receipts remain valid; no inventory balance is modified.
ALTER TABLE "PurchaseReceipt"
  ADD COLUMN "supplierDocumentType" TEXT,
  ADD COLUMN "supplierDocumentNumber" TEXT;

ALTER TABLE "PurchaseReceipt"
  ADD CONSTRAINT "PurchaseReceipt_supplierDocumentType_check"
  CHECK ("supplierDocumentType" IS NULL OR "supplierDocumentType" IN ('FACTURA', 'REMISION', 'NOTA_ENTREGA'));
