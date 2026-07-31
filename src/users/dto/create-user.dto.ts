import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
