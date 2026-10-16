import { IsInt, IsUUID, Max, Min } from 'class-validator';
export class AddHealthcareCaseReconciliationItemDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsUUID() sourceDispatchItemId!: string;
}
