import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
}
