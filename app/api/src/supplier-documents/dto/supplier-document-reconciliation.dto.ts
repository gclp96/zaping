import {
  IsEnum,
  IsOptional,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SupplierDocumentCancellationSource } from '@prisma/client';

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

export enum AllocationRevisionAction {
  REPLACE_AMOUNT = 'REPLACE_AMOUNT',
  DEACTIVATE = 'DEACTIVATE',
  REACTIVATE = 'REACTIVATE',
}

export class ReviseSupplierDocumentAllocationDto {
  @IsUUID()
  allocationId!: string;

  @IsEnum(AllocationRevisionAction)
  action!: AllocationRevisionAction;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  allocatedSubtotal?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsInt()
  @Min(0)
  expectedAllocationRevision!: number;
}

export class CorrectSupplierDocumentBasisDto {
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

export class CancelSupplierDocumentDto {
  @IsEnum(SupplierDocumentCancellationSource)
  source!: SupplierDocumentCancellationSource;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  evidenceReference?: string;

  @IsOptional()
  @IsUUID()
  replacedByDocumentId?: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class ApproveReceiptVarianceDto {
  @IsString()
  @Matches(MONEY)
  receiptComparableNetAmount!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  receiptCurrency!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  evidenceReference!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  expectedSnapshotHash!: string;
}
