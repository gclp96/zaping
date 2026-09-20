import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class ReleaseHealthcareEquipmentAssignmentDto {
  @Transform(({ value }) => transformHealthcareOptionalText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
