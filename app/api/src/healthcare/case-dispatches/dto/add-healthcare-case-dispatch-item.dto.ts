import {
  Allow,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  isUUID,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
@ValidatorConstraint({ name: 'dispatchItemIntent', async: false })
class ItemIntent implements ValidatorConstraintInterface {
  validate(_v: unknown, a: ValidationArguments) {
    const o = a.object as AddHealthcareCaseDispatchItemDto;
    const common = ['type', 'expectedRevision', 'sourceCaseKitItemId'];
    if (o.type === 'EQUIPMENT')
      return Object.keys(o).every((k) => common.includes(k));
    if (o.type !== 'MATERIAL') return false;
    return (
      Object.keys(o).every((k) =>
        [...common, 'quantity', 'sourcePositionId', 'batchId'].includes(k),
      ) &&
      Number.isInteger(o.quantity) &&
      o.quantity! > 0 &&
      o.quantity! <= 2147483647 &&
      isUUID(o.sourcePositionId) &&
      Object.hasOwn(o, 'batchId') &&
      (o.batchId === null || isUUID(o.batchId))
    );
  }
  defaultMessage() {
    return 'Invalid Dispatch item discriminated intent';
  }
}
export class AddHealthcareCaseDispatchItemDto {
  @Validate(ItemIntent) type!: 'MATERIAL' | 'EQUIPMENT';
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsUUID() sourceCaseKitItemId!: string;
  @Allow() declare quantity?: number;
  @Allow() declare sourcePositionId?: string;
  @Allow() declare batchId?: string | null;
}
