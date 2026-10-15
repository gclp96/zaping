import { Type, Transform } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  IsEnum,
  IsString,
  Length,
  IsOptional,
  IsUUID,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { HealthcareCaseDispatchCustodianType } from '@prisma/client';
import { transformHealthcareDisplayText } from '../../common/healthcare-normalization';
@ValidatorConstraint({ name: 'dispatchCustodian', async: false })
class CustodianShape implements ValidatorConstraintInterface {
  validate(_v: unknown, a: ValidationArguments) {
    const o = a.object as DispatchCustodianDto;
    return (
      Object.keys(o).every((k) =>
        ['type', 'displayName', 'userId'].includes(k),
      ) &&
      (o.type !== 'EXTERNAL_PERSON' || o.userId == null)
    );
  }
  defaultMessage() {
    return 'Invalid custodian shape';
  }
}
export class DispatchCustodianDto {
  @IsEnum(HealthcareCaseDispatchCustodianType)
  @Validate(CustodianShape)
  type!: HealthcareCaseDispatchCustodianType;
  @Transform(({ value }: { value: unknown }) =>
    transformHealthcareDisplayText(value),
  )
  @IsString()
  @Length(1, 256)
  displayName!: string;
  @IsOptional() @IsUUID() userId?: string | null;
}
export class CreateHealthcareCaseDispatchDto {
  @Type(() => DispatchCustodianDto)
  @ValidateNested()
  @IsDefined()
  @IsObject()
  custodian!: DispatchCustodianDto;
}
