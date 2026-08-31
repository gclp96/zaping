import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: UpdateUserDto,
    });

  it('accepts only editable user fields', async () => {
    await expect(
      transformDto({
        firstName: 'Updated',
        lastName: 'User',
        email: 'updated@zaping.test',
        role: UserRole.MANAGER,
        isActive: false,
      }),
    ).resolves.toMatchObject({
      firstName: 'Updated',
      role: UserRole.MANAGER,
      isActive: false,
    });
  });

  it('rejects password changes through PATCH /users/:id', async () => {
    await expect(
      transformDto({
        password: 'new-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects companyId changes through PATCH /users/:id', async () => {
    await expect(
      transformDto({
        companyId: 'client-company-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid role values', async () => {
    await expect(
      transformDto({
        role: 'OWNER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
