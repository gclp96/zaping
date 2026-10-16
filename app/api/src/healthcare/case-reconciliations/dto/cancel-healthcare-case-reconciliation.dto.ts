import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
export class CancelHealthcareCaseReconciliationDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
