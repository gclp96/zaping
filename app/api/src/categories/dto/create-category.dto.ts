import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.\-/()&+]+$/, {
    message:
      'El nombre solo puede contener letras, números, espacios y . - / ( ) & +',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
