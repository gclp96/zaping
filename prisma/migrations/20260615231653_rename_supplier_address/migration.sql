/*
  Warnings:

  - You are about to drop the column `addres` on the `Supplier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "addres",
ADD COLUMN     "address" TEXT;
