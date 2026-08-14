import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseReceiptItemDto {
  @IsUUID()
  purchaseItemId!: string;

  @IsInt()
  @Min(1)
  quantityReceived!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
