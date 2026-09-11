import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { HealthcareMasterListQueryDto } from '../../common/dto/healthcare-master-list-query.dto';
import { transformHealthcareDisplayText } from '../../common/healthcare-normalization';

export class HealthcareHospitalListQueryDto extends HealthcareMasterListQueryDto {
  @Transform(({ value }) => transformHealthcareDisplayText(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @Transform(({ value }) => transformHealthcareDisplayText(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state?: string;
}
