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
    });

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

  it('should reject unexpected status and companyId fields', async () => {
    await expect(
      transformDto({
        title: 'Caso actualizado',
        status: 'CANCELLED',
        companyId: '699baaae-2718-4d96-8683-8a2cf12bfe55',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
