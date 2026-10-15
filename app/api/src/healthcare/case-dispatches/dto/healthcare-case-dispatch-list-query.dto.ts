import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { HealthcareCaseDispatchStatus } from '@prisma/client';
export class HealthcareCaseDispatchListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional()
  @IsEnum(HealthcareCaseDispatchStatus)
  status?: HealthcareCaseDispatchStatus;
}
