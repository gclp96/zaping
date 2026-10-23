import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreatePurchaseReceiptItemDto } from './create-purchase-receipt-item.dto';

export class CreatePurchaseReceiptDto {
  @IsUUID()
  purchaseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReceiptItemDto)
  items!: CreatePurchaseReceiptItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn(['FACTURA', 'REMISION', 'NOTA_ENTREGA'])
  supplierDocumentType?: 'FACTURA' | 'REMISION' | 'NOTA_ENTREGA';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierDocumentNumber?: string;
}
