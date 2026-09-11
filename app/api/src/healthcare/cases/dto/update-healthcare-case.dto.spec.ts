import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { UpdateHealthcareCaseDto } from './update-healthcare-case.dto';

describe('UpdateHealthcareCaseDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: UpdateHealthcareCaseDto,
    }) as Promise<UpdateHealthcareCaseDto>;

  it('should accept a valid partial update payload', async () => {
    await expect(
      transformDto({
        title: 'Caso actualizado',
      }),
    ).resolves.toMatchObject({
      title: 'Caso actualizado',
    });
  });

  it('should accept explicit nulls for nullable update fields', async () => {
    await expect(
      transformDto({
        procedureDescription: null,
        scheduledStart: null,
        scheduledEnd: null,
        responsibleUserId: null,
      }),
    ).resolves.toMatchObject({
      procedureDescription: null,
      scheduledStart: null,
      scheduledEnd: null,
      responsibleUserId: null,
    });
  });

  it('should reject invalid date syntax', async () => {
    await expect(
      transformDto({
        scheduledStart: 'tomorrow morning',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject invalid responsibleUserId UUID values', async () => {
    await expect(
      transformDto({
        responsibleUserId: 'not-a-uuid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['doctorId', 'hospitalId'] as const)(
    'should preserve an omitted %s',
    async (field) => {
      const result = await transformDto({ title: 'Caso actualizado' });

      expect(result[field]).toBeUndefined();
    },
  );

  it.each(['doctorId', 'hospitalId'] as const)(
    'should preserve explicit null for %s',
    async (field) => {
      const result = await transformDto({ [field]: null });

      expect(result).toHaveProperty(field, null);
    },
  );

  it.each(['doctorId', 'hospitalId'] as const)(
    'should accept a UUID %s',
    async (field) => {
      const id = '699baaae-2718-4d96-8683-8a2cf12bfe55';

      await expect(transformDto({ [field]: id })).resolves.toMatchObject({
        [field]: id,
      });
    },
  );

  it.each(['doctorId', 'hospitalId'] as const)(
    'should reject a malformed %s',
    async (field) => {
      await expect(
        transformDto({ [field]: 'not-a-uuid' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['doctor', 'hospital', 'affiliationId'] as const)(
    'should reject protected or nested field %s',
    async (field) => {
      await expect(transformDto({ [field]: {} })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each([
    'companyId',
    'status',
    'searchKey',
    'isActive',
    'cancelledAt',
    'cancelledById',
  ])('should reject protected field %s', async (field) => {
    await expect(
      transformDto({
        title: 'Caso actualizado',
        [field]: 'protected',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
