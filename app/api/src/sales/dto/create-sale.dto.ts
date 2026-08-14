import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CreateSaleItemDto } from './create-sale-item.dto';

export class CreateSaleDto {
  @IsString()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}
