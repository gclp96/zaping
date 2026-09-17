import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class CreateHealthcareEquipmentAssignmentDto {
  @IsUUID()
  caseId!: string;

  @IsUUID()
  equipmentAssetId!: string;

  @IsOptional()
  @IsUUID()
  requirementId?: string | null;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  directAssignmentReason?: string | null;

  @IsOptional()
  @IsBoolean()
  confirmConflictOverride?: boolean;

  @IsOptional()
  @IsString()
  conflictReviewFingerprint?: string;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conflictOverrideReason?: string | null;
}
