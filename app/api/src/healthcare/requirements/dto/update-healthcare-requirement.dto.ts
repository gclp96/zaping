import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { HealthcareRequirementType } from '@prisma/client';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class UpdateHealthcareRequirementDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  requestedQty?: number;

  @IsOptional()
  @IsEnum(HealthcareRequirementType)
  type?: HealthcareRequirementType;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
