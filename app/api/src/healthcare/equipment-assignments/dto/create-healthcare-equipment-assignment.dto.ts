import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
}
