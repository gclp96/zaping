import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  category!: string;

  @IsString()
  barcode!: string;

  @Type(() => Number)
  @IsNumber()
  cost!: number;

  @Type(() => Number)
  @IsNumber()
  price!: number;

  @Type(() => Number)
  @IsNumber()
  minStock!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  stock?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
