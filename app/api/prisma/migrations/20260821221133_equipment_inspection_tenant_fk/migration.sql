-- DropForeignKey
ALTER TABLE "EquipmentInspection" DROP CONSTRAINT "EquipmentInspection_equipmentAssetId_fkey";

-- AddForeignKey
ALTER TABLE "EquipmentInspection" ADD CONSTRAINT "EquipmentInspection_equipmentAssetId_companyId_fkey" FOREIGN KEY ("equipmentAssetId", "companyId") REFERENCES "EquipmentAsset"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
