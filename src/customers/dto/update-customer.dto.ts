import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
