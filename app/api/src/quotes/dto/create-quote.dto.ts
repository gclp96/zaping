import { Type } from 'class-transformer';

import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';

import { CreateQuoteItemDto } from './create-quote-item.dto';

export class CreateQuoteDto {
  @IsUUID('4', {
    message: 'El cliente debe tener un UUID válido',
  })
  customerId!: string;

  @IsArray({
    message: 'Los productos deben enviarse como un arreglo',
  })
  @ArrayMinSize(1, {
    message: 'La cotización debe contener al menos un producto',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items!: CreateQuoteItemDto[];
}
