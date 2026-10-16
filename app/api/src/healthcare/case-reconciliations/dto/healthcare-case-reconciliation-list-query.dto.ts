import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { HealthcareCaseReconciliationStatus } from '@prisma/client';
export class HealthcareCaseReconciliationListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional()
  @IsEnum(HealthcareCaseReconciliationStatus)
  status?: HealthcareCaseReconciliationStatus;
  @IsOptional() @IsUUID() dispatchId?: string;
}
