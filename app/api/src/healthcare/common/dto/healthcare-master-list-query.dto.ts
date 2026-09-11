import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { transformHealthcareSearchText } from '../healthcare-normalization';

export enum HealthcareMasterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ALL = 'ALL',
}

export class HealthcareMasterListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsEnum(HealthcareMasterStatus)
  status: HealthcareMasterStatus = HealthcareMasterStatus.ACTIVE;

  @Transform(({ value }) => transformHealthcareSearchText(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;
}
