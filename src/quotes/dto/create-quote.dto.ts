import { IsArray, IsString, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';

import { CreateQuoteItemDto } from './create-quote-item.dto';

export class CreateQuoteDto {
  @IsString()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items!: CreateQuoteItemDto[];
}
