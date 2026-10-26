import {
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export class ConfirmSupplierDocumentBasisDto {
  @IsString()
  @Matches(MONEY)
  goodsNetAmount!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class CreateSupplierDocumentAllocationDto {
  @IsUUID()
  receiptId!: string;

  @IsString()
  @Matches(MONEY)
  allocatedSubtotal!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
