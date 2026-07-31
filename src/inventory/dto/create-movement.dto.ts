import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { InventoryMovementType } from '@prisma/client';

export class CreateMovementDto {
  @IsString()
  productId!: string;

  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
