import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEmail,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.\-()]+$/, {
    message: 'El nombre solo puede contener letras y espacios',
  })
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
