import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { UpdateCustomerDto } from './update-customer.dto';

describe('UpdateCustomerDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: UpdateCustomerDto,
    });

  it('accepts existing partial customer fields', async () => {
    await expect(
      transformDto({ name: 'Hospital Central Norte' }),
    ).resolves.toMatchObject({ name: 'Hospital Central Norte' });
  });

  it('rejects isActive as a general update field', async () => {
    await expect(
      transformDto({
        name: 'Hospital Central Norte',
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
