import { IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;
}
