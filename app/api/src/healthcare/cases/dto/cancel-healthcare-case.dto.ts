import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelHealthcareCaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  cancellationReason!: string;
}
