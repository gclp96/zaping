import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import {
  SupplierDocumentTaxArea, SupplierDocumentTaxTreatment, SupplierDocumentType,
} from '@prisma/client';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export class SupplierDocumentTaxBreakdownDto {
  @IsEnum(SupplierDocumentTaxArea)
  area!: SupplierDocumentTaxArea;

  @IsEnum(SupplierDocumentTaxTreatment)
  treatment!: SupplierDocumentTaxTreatment;

  @IsString() @Matches(MONEY)
  baseAmount!: string;

  @IsString() @Matches(MONEY)
  ivaAmount!: string;
}

export class CreateSupplierDocumentDto {
  @IsUUID() supplierId!: string;
  @IsEnum(SupplierDocumentType) type!: SupplierDocumentType;
  @IsOptional() @IsString() @MaxLength(80) series?: string;
  @IsString() @MinLength(1) @MaxLength(160) number!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) documentDate!: string;
  @IsOptional() @IsUUID() cfdiUuid?: string;
  @IsOptional() @IsString()
  @Matches(/^[A-Za-zÑñ&]{3,4}\d{6}[A-Za-z0-9]{3}$/) issuerRfc?: string;
  @IsOptional() @IsString()
  @Matches(/^[A-Za-zÑñ&]{3,4}\d{6}[A-Za-z0-9]{3}$/) receiverRfc?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/) currency?: string;
  @IsOptional() @IsString() @Matches(MONEY) subtotalAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) discountAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) freightAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) ivaAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) withholdingAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) totalAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) goodsNetAmount?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => SupplierDocumentTaxBreakdownDto)
  taxBreakdowns?: SupplierDocumentTaxBreakdownDto[];
}

export class CreateSupplierDocumentExceptionDto extends CreateSupplierDocumentDto {
  @IsUUID() duplicateOfDocumentId!: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsString() @MinLength(5) @MaxLength(1000) evidenceReference!: string;
}

export class ListSupplierDocumentsQueryDto {
  @IsOptional() @IsUUID() supplierId?: string;
}
