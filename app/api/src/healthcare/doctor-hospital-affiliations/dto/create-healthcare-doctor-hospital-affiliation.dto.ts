import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class CreateHealthcareDoctorHospitalAffiliationDto {
  @IsUUID()
  doctorId!: string;

  @IsUUID()
  hospitalId!: string;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
