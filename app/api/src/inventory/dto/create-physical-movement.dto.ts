import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { ManualPhysicalInput } from '../physical/manual-physical-inventory.service';

class PhysicalSourceDto {
  @IsUUID() positionId!: string;
  @IsInt() @Min(1) @Max(2147483647) quantity!: number;
  @IsInt() @Min(0) @Max(2147483647) expectedRevision!: number;
}
export class CreatePhysicalMovementDto {
  @IsIn(['IN', 'OUT', 'COUNT_CORRECTION']) kind!:
    'IN' | 'OUT' | 'COUNT_CORRECTION';
  @ValidateIf((o: CreatePhysicalMovementDto) => o.kind === 'IN')
  @IsUUID()
  productId?: string;
  @IsOptional() @IsUUID() batchId?: string | null;
  @ValidateIf((o: CreatePhysicalMovementDto) => o.kind === 'IN')
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity?: number;
  @ValidateIf((o: CreatePhysicalMovementDto) => o.kind === 'OUT')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PhysicalSourceDto)
  sources?: PhysicalSourceDto[];
  @ValidateIf((o: CreatePhysicalMovementDto) => o.kind === 'COUNT_CORRECTION')
  @IsUUID()
  positionId?: string;
  @ValidateIf((o: CreatePhysicalMovementDto) => o.kind === 'COUNT_CORRECTION')
  @IsInt()
  @Min(0)
  @Max(2147483647)
  countedQuantity?: number;
  @ValidateIf((o: CreatePhysicalMovementDto) => o.kind === 'COUNT_CORRECTION')
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedRevision?: number;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;

  static operation(
    dto: CreatePhysicalMovementDto,
  ): ManualPhysicalInput['operation'] {
    const keys =
      dto.kind === 'IN'
        ? ['productId', 'batchId', 'quantity']
        : dto.kind === 'OUT'
          ? ['sources']
          : ['positionId', 'countedQuantity', 'expectedRevision'];
    if (
      Object.entries(dto).some(
        ([k, v]) => v !== undefined && !['kind', 'reason', ...keys].includes(k),
      )
    )
      throw new BadRequestException(
        'Campos incompatibles con la operación física',
      );
    if (dto.kind === 'IN')
      return {
        kind: dto.kind,
        productId: dto.productId!,
        batchId: dto.batchId ?? null,
        quantity: dto.quantity!,
      };
    if (dto.kind === 'OUT') return { kind: dto.kind, sources: dto.sources! };
    if (!dto.reason?.trim())
      throw new BadRequestException('COUNT_CORRECTION requiere motivo');
    return {
      kind: dto.kind,
      positionId: dto.positionId!,
      countedQuantity: dto.countedQuantity!,
      expectedRevision: dto.expectedRevision!,
    };
  }
}
