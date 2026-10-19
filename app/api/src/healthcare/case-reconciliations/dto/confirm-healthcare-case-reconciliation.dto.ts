import { IsInt, Max, Min } from 'class-validator';
export class ConfirmHealthcareCaseReconciliationDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
}
