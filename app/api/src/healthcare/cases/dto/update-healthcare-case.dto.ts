import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateHealthcareCaseDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  procedureDescription?: string | null;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string | null;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string | null;

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string | null;
}
