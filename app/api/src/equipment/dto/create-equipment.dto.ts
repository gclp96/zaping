import { EquipmentCondition } from '@prisma/client';

import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEquipmentDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serialNumber?: string;

  @IsEnum(EquipmentCondition)
  condition!: EquipmentCondition;

  @IsUUID()
  @IsOptional()
  batchId?: string;
}
