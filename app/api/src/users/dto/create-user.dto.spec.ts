import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateUserDto,
    });

  const validPayload = {
    firstName: 'User',
    lastName: 'Zaping',
    email: 'user@zaping.test',
    password: 'secure-password',
    role: UserRole.SALES,
  };

  it('accepts the user creation contract', async () => {
    await expect(transformDto(validPayload)).resolves.toMatchObject({
      email: 'user@zaping.test',
      role: UserRole.SALES,
    });
  });

  it('requires passwords to be at least eight characters', async () => {
    await expect(
      transformDto({
        ...validPayload,
        password: '1234567',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing or invalid roles', async () => {
    await expect(
      transformDto({
        ...validPayload,
        role: 'OWNER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects client-provided companyId as a non-whitelisted field', async () => {
    await expect(
      transformDto({
        ...validPayload,
        companyId: 'client-company-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
