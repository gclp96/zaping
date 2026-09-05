import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateProductDto } from './create-product.dto';

class UpdatableProductDto extends OmitType(CreateProductDto, [
  'inventoryTracking',
  'lotTracking',
] as const) {}

export class UpdateProductDto extends PartialType(UpdatableProductDto) {}
