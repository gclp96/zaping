import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { transformHealthcareDisplayText } from '../../common/healthcare-normalization';

export class RetireHealthcareRequirementDto {
  @Transform(({ value }) => transformHealthcareDisplayText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  retirementReason!: string;
}
