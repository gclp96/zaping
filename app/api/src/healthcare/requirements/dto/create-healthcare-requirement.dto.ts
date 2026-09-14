import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { HealthcareRequirementType } from '@prisma/client';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class CreateHealthcareRequirementDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  requestedQty!: number;

  @IsEnum(HealthcareRequirementType)
  type!: HealthcareRequirementType;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsInt()
  sortOrder!: number;
}
