import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateCustomerDto } from './create-customer.dto';

describe('CreateCustomerDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateCustomerDto,
    });

  const validPayload = {
    name: 'Hospital Central',
    type: 'BUSINESS',
    email: 'compras@hospital.test',
    phone: '5551000000',
  };

  it('accepts the existing customer creation contract', async () => {
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
