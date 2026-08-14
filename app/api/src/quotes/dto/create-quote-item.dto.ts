import { Type } from 'class-transformer';

import { IsInt, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateQuoteItemDto {
  @IsUUID('4', {
    message: 'El producto debe tener un UUID válido',
  })
  productId!: string;

  @Type(() => Number)
  @IsInt({
    message: 'La cantidad debe ser un número entero',
  })
  @Min(1, {
    message: 'La cantidad debe ser mayor o igual a 1',
  })
  quantity!: number;

  @Type(() => Number)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message: 'El precio debe ser un número válido con máximo dos decimales',
    },
  )
  @Min(0, {
    message: 'El precio no puede ser negativo',
  })
  price!: number;
}
