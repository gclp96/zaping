import { IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSaleItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  price!: number;
}
