import 'reflect-metadata';

import { BadRequestException, ValidationPipe } from '@nestjs/common';

import {
  AddHealthcareCaseKitItemDto,
  HealthcareCaseKitItemSourceType,
} from './add-healthcare-case-kit-item.dto';
import { CreateHealthcareCaseKitDto } from './create-healthcare-case-kit.dto';
import { ExcludeHealthcareCaseKitItemDto } from './exclude-healthcare-case-kit-item.dto';
import { ConfirmHealthcareCaseKitPreparationDto } from './confirm-healthcare-case-kit-preparation.dto';

describe('Healthcare CaseKit DTO allowlists', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('accepts only the empty Create body', async () => {
    await expect(
      pipe.transform(
        {},
        { type: 'body', metatype: CreateHealthcareCaseKitDto },
      ),
    ).resolves.toEqual({});
    await expect(
      pipe.transform(
        { status: 'DRAFT' },
        { type: 'body', metatype: CreateHealthcareCaseKitDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts only the empty Confirm Preparation body', async () => {
    await expect(
      pipe.transform(
        {},
        {
          type: 'body',
          metatype: ConfirmHealthcareCaseKitPreparationDto,
        },
      ),
    ).resolves.toEqual({});
    await expect(
      pipe.transform(
        { status: 'PREPARED' },
        {
          type: 'body',
          metatype: ConfirmHealthcareCaseKitPreparationDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps only the documented Add Item fields', async () => {
    const payload = {
      sourceType: HealthcareCaseKitItemSourceType.REQUIREMENT,
      requirementId: '11111111-1111-4111-8111-111111111111',
      preparedQuantity: 2,
    };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: AddHealthcareCaseKitItemDto,
      }),
    ).resolves.toMatchObject(payload);
    await expect(
      pipe.transform(
        { ...payload, companyId: 'protected' },
        { type: 'body', metatype: AddHealthcareCaseKitItemDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes and allowlists the required exclusion reason', async () => {
    await expect(
      pipe.transform(
        { reason: '  Selección   incorrecta  ' },
        { type: 'body', metatype: ExcludeHealthcareCaseKitItemDto },
      ),
    ).resolves.toEqual({ reason: 'Selección   incorrecta' });
    await expect(
      pipe.transform(
        { reason: '   ' },
        { type: 'body', metatype: ExcludeHealthcareCaseKitItemDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { reason: 'Válida', lifecycle: 'EXCLUDED' },
        { type: 'body', metatype: ExcludeHealthcareCaseKitItemDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
