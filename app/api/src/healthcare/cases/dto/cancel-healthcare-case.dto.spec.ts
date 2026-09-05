import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CancelHealthcareCaseDto } from './cancel-healthcare-case.dto';

describe('CancelHealthcareCaseDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CancelHealthcareCaseDto,
    });

  it('should accept a valid cancellation reason', async () => {
    await expect(
      transformDto({
        cancellationReason: 'Cancelación operacional',
      }),
    ).resolves.toMatchObject({
      cancellationReason: 'Cancelación operacional',
    });
  });

  it('should reject a missing cancellation reason', async () => {
    await expect(transformDto({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a non-string cancellation reason', async () => {
    await expect(
      transformDto({
        cancellationReason: 123,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a blank cancellation reason', async () => {
    await expect(
      transformDto({
        cancellationReason: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a cancellation reason above the max length', async () => {
    await expect(
      transformDto({
        cancellationReason: 'x'.repeat(1001),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject unexpected cancellation audit fields', async () => {
    await expect(
      transformDto({
        cancellationReason: 'Cancelación operacional',
        cancelledById: 'f6c503b4-82db-4e21-b2ce-f7cc9e13f021',
        cancelledAt: '2026-09-01T10:00:00.000Z',
        status: 'CANCELLED',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
