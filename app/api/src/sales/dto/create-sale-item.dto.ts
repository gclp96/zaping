import { IsInt, IsUUID, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class CreateSaleItemDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
