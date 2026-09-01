import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: ChangePasswordDto,
    });

  const validPayload = {
    currentPassword: 'current-password',
    newPassword: 'new-secure-password',
  };

  it('accepts the authenticated change-password contract', async () => {
    await expect(transformDto(validPayload)).resolves.toMatchObject(
      validPayload,
    );
  });

  it('requires a non-empty current password', async () => {
    await expect(
      transformDto({
        ...validPayload,
        currentPassword: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the new password to be at least eight characters', async () => {
    await expect(
      transformDto({
        ...validPayload,
        newPassword: '1234567',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects user-controlled identity fields', async () => {
    await expect(
      transformDto({
        ...validPayload,
        userId: 'user-other',
        companyId: 'company-other',
        email: 'other@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
