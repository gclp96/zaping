import { IsInt, Max, Min } from 'class-validator';

export class ConfirmHealthcareCaseDispatchDto {
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedRevision!: number;
}
