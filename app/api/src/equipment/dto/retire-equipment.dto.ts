import { EquipmentRetirementReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RetireEquipmentDto {
  @IsEnum(EquipmentRetirementReason)
  retiredReason!: EquipmentRetirementReason;

  @IsString()
  @IsOptional()
  retirementNotes?: string;
}
