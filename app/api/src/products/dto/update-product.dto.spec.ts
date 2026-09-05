import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ProductInventoryTracking, ProductLotTracking } from '@prisma/client';

import { UpdateProductDto } from './update-product.dto';

describe('UpdateProductDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: UpdateProductDto,
    });

  it('accepts normal catalog/configuration fields including minStock', async () => {
    await expect(
      transformDto({
        name: 'BLUNT TIP UPDATED',
        brand: 'Acme Medical',
        categoryId: null,
        minStock: 5,
      }),
    ).resolves.toMatchObject({
      name: 'BLUNT TIP UPDATED',
      brand: 'Acme Medical',
      categoryId: null,
      minStock: 5,
    });
  });

  it('rejects client-provided stock as a non-whitelisted field', async () => {
    await expect(
      transformDto({
        stock: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps inventoryTracking and lotTracking unavailable through PATCH', async () => {
    await expect(
      transformDto({
        inventoryTracking: ProductInventoryTracking.ASSET,
        lotTracking: ProductLotTracking.REQUIRED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
