import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ForgotPasswordDto } from './forgot-password.dto';

describe('ForgotPasswordDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: ForgotPasswordDto,
    });

  it('accepts only an email', async () => {
    await expect(
      transformDto({
        email: 'ada@example.com',
      }),
    ).resolves.toMatchObject({
      email: 'ada@example.com',
    });
  });

  it('rejects invalid emails and recovery secrets from clients', async () => {
    await expect(
      transformDto({
        email: 'not-an-email',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transformDto({
        email: 'ada@example.com',
        token: 'client-token',
        userId: 'user-1',
        companyId: 'company-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
