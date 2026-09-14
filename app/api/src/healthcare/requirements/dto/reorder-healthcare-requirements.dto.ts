import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ReorderHealthcareRequirementItemDto {
  @IsUUID()
  requirementId!: string;

  @IsInt()
  sortOrder!: number;
}

export class ReorderHealthcareRequirementsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderHealthcareRequirementItemDto)
  items!: ReorderHealthcareRequirementItemDto[];
}
