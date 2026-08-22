import { EquipmentCondition } from '@prisma/client';

import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEquipmentDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/)
  assetCode!: string;

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
