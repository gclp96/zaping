import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateHealthcareCaseDto } from './create-healthcare-case.dto';

describe('CreateHealthcareCaseDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateHealthcareCaseDto,
    }) as Promise<CreateHealthcareCaseDto>;

  it('should accept a valid minimal create payload', async () => {
    await expect(
      transformDto({
        title: 'Cirugía programada',
      }),
    ).resolves.toMatchObject({
      title: 'Cirugía programada',
    });
  });

  it('should accept scheduledStart as an ISO date string', async () => {
    await expect(
      transformDto({
        title: 'Cirugía programada',
        scheduledStart: '2026-09-01T10:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      scheduledStart: '2026-09-01T10:00:00.000Z',
    });
  });

  it('should accept scheduledStart and scheduledEnd as ISO date strings', async () => {
    await expect(
      transformDto({
        title: 'Cirugía programada',
        scheduledStart: '2026-09-01T10:00:00.000Z',
        scheduledEnd: '2026-09-01T11:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      scheduledStart: '2026-09-01T10:00:00.000Z',
      scheduledEnd: '2026-09-01T11:00:00.000Z',
    });
  });

  it('should reject invalid non-ISO date values', async () => {
    await expect(
      transformDto({
        title: 'Cirugía programada',
        scheduledStart: 'tomorrow morning',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject invalid responsibleUserId UUID values', async () => {
    await expect(
      transformDto({
        title: 'Cirugía programada',
        responsibleUserId: 'not-a-uuid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['doctorId', 'hospitalId'] as const)(
    'should preserve an omitted %s',
    async (field) => {
      const result = await transformDto({ title: 'Cirugía programada' });

      expect(result[field]).toBeUndefined();
    },
  );
  it.each(['doctorId', 'hospitalId'] as const)(
    'should accept a nullable %s',
    async (field) => {
      await expect(
        transformDto({ title: 'Cirugía programada', [field]: null }),
      ).resolves.toMatchObject({ [field]: null });
    },
  );

  it.each(['doctorId', 'hospitalId'] as const)(
    'should accept a UUID %s',
    async (field) => {
      const id = '699baaae-2718-4d96-8683-8a2cf12bfe55';

      await expect(
        transformDto({ title: 'Cirugía programada', [field]: id }),
      ).resolves.toMatchObject({ [field]: id });
    },
  );

  it.each(['doctorId', 'hospitalId'] as const)(
    'should reject a malformed %s',
    async (field) => {
      await expect(
        transformDto({ title: 'Cirugía programada', [field]: 'not-a-uuid' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['doctor', 'hospital', 'affiliationId'] as const)(
    'should reject protected or nested field %s',
    async (field) => {
      await expect(
        transformDto({ title: 'Cirugía programada', [field]: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should reject missing title', async () => {
    await expect(transformDto({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject non-string title', async () => {
    await expect(
      transformDto({
        title: 123,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject unexpected companyId through global ValidationPipe behavior', async () => {
    await expect(
      transformDto({
        title: 'Cirugía programada',
        companyId: '699baaae-2718-4d96-8683-8a2cf12bfe55',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
