import { IsInt, Max, Min } from 'class-validator';
import { CreateHealthcareCaseDispatchDto } from './create-healthcare-case-dispatch.dto';
export class SetHealthcareCaseDispatchCustodianDto extends CreateHealthcareCaseDispatchDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
}
