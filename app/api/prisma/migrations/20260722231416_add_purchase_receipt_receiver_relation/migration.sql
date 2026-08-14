-- CreateIndex
CREATE INDEX "PurchaseReceipt_receivedBy_idx" ON "PurchaseReceipt"("receivedBy");

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
