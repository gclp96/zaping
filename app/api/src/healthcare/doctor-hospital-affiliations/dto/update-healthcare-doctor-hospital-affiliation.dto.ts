import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class UpdateHealthcareDoctorHospitalAffiliationDto {
  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
