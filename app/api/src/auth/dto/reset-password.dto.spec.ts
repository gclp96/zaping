import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: ResetPasswordDto,
    });

  const validPayload = {
    token: 'reset-token',
    newPassword: 'new-secure-password',
  };

  it('accepts the public reset contract', async () => {
    await expect(transformDto(validPayload)).resolves.toMatchObject(
      validPayload,
    );
  });

  it('requires a non-empty token and minimum password length', async () => {
    await expect(
      transformDto({
        ...validPayload,
        token: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transformDto({
        ...validPayload,
        newPassword: '1234567',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects identity fields and confirmPassword from clients', async () => {
    await expect(
      transformDto({
        ...validPayload,
        email: 'ada@example.com',
        userId: 'user-1',
        companyId: 'company-1',
        confirmPassword: 'new-secure-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
