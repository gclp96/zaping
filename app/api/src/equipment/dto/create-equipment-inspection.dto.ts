import { EquipmentCondition } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateEquipmentInspectionDto {
  @IsIn([
    EquipmentCondition.GOOD,
    EquipmentCondition.DAMAGED,
    EquipmentCondition.OUT_OF_SERVICE,
  ])
  conditionAfter!: EquipmentCondition;

  @IsString()
  @IsOptional()
  notes?: string;
}
