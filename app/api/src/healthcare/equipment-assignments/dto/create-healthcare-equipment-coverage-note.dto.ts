import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { HealthcareEquipmentRequirementCoverageNoteKind } from '@prisma/client';
import { transformHealthcareOptionalText } from '../../common/healthcare-normalization';

export class CreateHealthcareEquipmentCoverageNoteDto {
  @IsEnum(HealthcareEquipmentRequirementCoverageNoteKind)
  kind!: HealthcareEquipmentRequirementCoverageNoteKind;

  @Transform(({ value }: { value: unknown }) =>
    transformHealthcareOptionalText(value),
  )
  @IsString()
  @IsNotEmpty()
  comment!: string;
}
