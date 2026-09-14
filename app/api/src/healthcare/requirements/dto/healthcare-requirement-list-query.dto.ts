import { IsEnum, IsOptional } from 'class-validator';

export enum HealthcareRequirementListStatus {
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
  ALL = 'ALL',
}

export class HealthcareRequirementListQueryDto {
  @IsOptional()
  @IsEnum(HealthcareRequirementListStatus)
  status?: HealthcareRequirementListStatus;
}
