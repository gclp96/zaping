import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class ReplaceHealthcareEquipmentAssignmentDto {
  @IsUUID()
  equipmentAssetId!: string;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  replacementReason!: string;

  @IsOptional()
  @IsBoolean()
  confirmConflictOverride?: boolean;

  @IsOptional()
  @IsString()
  conflictReviewFingerprint?: string;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  conflictOverrideReason?: string | null;
}
