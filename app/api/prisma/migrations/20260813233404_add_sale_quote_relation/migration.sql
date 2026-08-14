/*
  Warnings:

  - A unique constraint covering the columns `[quoteId]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "quoteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_quoteId_key" ON "Sale"("quoteId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
