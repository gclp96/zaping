import { Transform } from 'class-transformer';
import { IsInt, Min, Max, IsString, Length } from 'class-validator';
export class ExcludeHealthcareCaseDispatchItemDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
