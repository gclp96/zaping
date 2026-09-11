import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  transformHealthcareDisplayText,
  transformHealthcareEmail,
  transformHealthcareOptionalDisplayText,
  transformHealthcareOptionalText,
} from '../../common/healthcare-normalization';

export class UpdateHealthcareHospitalDto {
  @Transform(({ value }) => transformHealthcareDisplayText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @Transform(({ value }) => transformHealthcareDisplayText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @Transform(({ value }) => transformHealthcareDisplayText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state?: string;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string | null;

  @Transform(({ value }) => transformHealthcareOptionalDisplayText(value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @Transform(({ value }) => transformHealthcareEmail(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @Transform(({ value }) => transformHealthcareOptionalDisplayText(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string | null;

  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  confirmPossibleDuplicate?: boolean;
}
