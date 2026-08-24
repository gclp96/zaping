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
    });

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
