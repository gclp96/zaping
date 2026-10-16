import {
  Allow,
  IsInt,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  EquipmentCondition,
  HealthcareCaseReconciliationEquipmentOutcome,
} from '@prisma/client';
@ValidatorConstraint({ name: 'reconciliationOutcomeIntent', async: false })
class OutcomeIntent implements ValidatorConstraintInterface {
  validate(_v: unknown, a: ValidationArguments) {
    const o = a.object as SetHealthcareCaseReconciliationOutcomeDto;
    const common = ['type', 'expectedRevision'];
    if (o.type === 'MATERIAL')
      return (
        Object.keys(o).every((k) =>
          [...common, 'returnedQty', 'usedQty'].includes(k),
        ) &&
        [o.returnedQty, o.usedQty].every(
          (q) =>
            typeof q === 'number' &&
            Number.isInteger(q) &&
            q >= 0 &&
            q <= 2147483647,
        )
      );
    if (
      o.type !== 'EQUIPMENT' ||
      !Object.keys(o).every((k) =>
        [...common, 'outcome', 'reportedCondition'].includes(k),
      ) ||
      !Object.hasOwn(o, 'reportedCondition')
    )
      return false;
    return o.outcome === 'UNRESOLVED'
      ? o.reportedCondition === null
      : o.outcome === 'RETURNED' &&
          Object.values(EquipmentCondition).includes(
            o.reportedCondition as EquipmentCondition,
          );
  }
  defaultMessage() {
    return 'Invalid Reconciliation outcome discriminated intent';
  }
}
export class SetHealthcareCaseReconciliationOutcomeDto {
  @Validate(OutcomeIntent) type!: 'MATERIAL' | 'EQUIPMENT';
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @Allow() declare returnedQty?: number;
  @Allow() declare usedQty?: number;
  @Allow() declare outcome?: HealthcareCaseReconciliationEquipmentOutcome;
  @Allow() declare reportedCondition?: EquipmentCondition | null;
}
