-- Preserve all historical folios. Abort if duplicates exist; never renumber data.
CREATE UNIQUE INDEX "Purchase_companyId_folio_key" ON "Purchase"("companyId", "folio");
