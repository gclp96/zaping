import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreatePurchaseItemDto {
  @IsUUID('4', {
    message: 'El producto debe tener un identificador válido',
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
}
