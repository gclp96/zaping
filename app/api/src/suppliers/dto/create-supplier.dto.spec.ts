import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateSupplierDto } from './create-supplier.dto';

describe('CreateSupplierDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateSupplierDto,
    });

  const validPayload = {
    name: 'Proveedor Médico',
    email: 'ventas@proveedor.test',
  };

  it('accepts the existing supplier creation contract', async () => {
    await expect(transformDto(validPayload)).resolves.toMatchObject(
      validPayload,
    );
  });

  it('rejects client-provided isActive', async () => {
    await expect(
      transformDto({
        ...validPayload,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
