import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { UpdateSupplierDto } from './update-supplier.dto';

describe('UpdateSupplierDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: UpdateSupplierDto,
    });

  it('accepts existing partial supplier fields', async () => {
    await expect(
      transformDto({ name: 'Proveedor Médico Norte' }),
    ).resolves.toMatchObject({ name: 'Proveedor Médico Norte' });
  });

  it('rejects isActive as a general update field', async () => {
    await expect(
      transformDto({
        name: 'Proveedor Médico Norte',
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
