import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ProductInventoryTracking, ProductLotTracking } from '@prisma/client';

import { CreateProductDto } from './create-product.dto';

describe('CreateProductDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateProductDto,
    });

  const validPayload = {
    sku: 'LF1837',
    name: 'BLUNT TIP',
    cost: 100,
    price: 150,
    minStock: 1,
  };

  it('accepts catalog fields, minStock and tracking fields', async () => {
    await expect(
      transformDto({
        ...validPayload,
        inventoryTracking: ProductInventoryTracking.ASSET,
        lotTracking: ProductLotTracking.REQUIRED,
      }),
    ).resolves.toMatchObject({
      sku: 'LF1837',
      minStock: 1,
      inventoryTracking: ProductInventoryTracking.ASSET,
      lotTracking: ProductLotTracking.REQUIRED,
    });
  });

  it('rejects client-provided stock as a non-whitelisted field', async () => {
    await expect(
      transformDto({
        ...validPayload,
        stock: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
