import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
