import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  HealthcareEquipmentAssignmentLifecycle,
  HealthcareEquipmentAssignmentOrigin,
} from '@prisma/client';

export enum HealthcareEquipmentAssignmentListStatus {
  RESERVED = 'RESERVED',
  RELEASED = 'RELEASED',
  REPLACED = 'REPLACED',
  ALL = 'ALL',
}

export class HealthcareEquipmentAssignmentListQueryDto {
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
  requirementId?: string;

  @IsOptional()
  @IsUUID()
  equipmentAssetId?: string;

  @IsEnum(HealthcareEquipmentAssignmentListStatus)
  status: HealthcareEquipmentAssignmentListStatus =
    HealthcareEquipmentAssignmentListStatus.RESERVED;

  @IsOptional()
  @IsEnum(HealthcareEquipmentAssignmentOrigin)
  origin?: HealthcareEquipmentAssignmentOrigin;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export function toAssignmentLifecycleFilter(
  status: HealthcareEquipmentAssignmentListStatus,
): HealthcareEquipmentAssignmentLifecycle | undefined {
  return status === HealthcareEquipmentAssignmentListStatus.ALL
    ? undefined
    : HealthcareEquipmentAssignmentLifecycle[status];
}
