import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { HealthcareRequirementType } from '@prisma/client';

import { CreateHealthcareRequirementDto } from './create-healthcare-requirement.dto';
import {
  HealthcareRequirementListQueryDto,
  HealthcareRequirementListStatus,
} from './healthcare-requirement-list-query.dto';
import { ReactivateHealthcareRequirementDto } from './reactivate-healthcare-requirement.dto';
import { ReorderHealthcareRequirementsDto } from './reorder-healthcare-requirements.dto';
import { RetireHealthcareRequirementDto } from './retire-healthcare-requirement.dto';
import { UpdateHealthcareRequirementDto } from './update-healthcare-requirement.dto';

describe('Healthcare Requirement DTOs', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const productId = '11111111-1111-4111-8111-111111111111';
  const requirementId = '22222222-2222-4222-8222-222222222222';

  const transformBody = <T extends object>(
    value: Record<string, unknown>,
    metatype: new () => T,
  ) => validationPipe.transform(value, { type: 'body', metatype });

  it('accepts and normalizes the complete create contract', async () => {
    await expect(
      transformBody(
        {
          productId,
          requestedQty: 2,
          type: HealthcareRequirementType.REQUIRED,
          notes: '  Entregar antes del procedimiento  ',
          sortOrder: -10,
        },
        CreateHealthcareRequirementDto,
      ),
    ).resolves.toMatchObject({
      productId,
      requestedQty: 2,
      type: HealthcareRequirementType.REQUIRED,
      notes: 'Entregar antes del procedimiento',
      sortOrder: -10,
    });
  });

  it.each([
    [{ requestedQty: 1, type: 'REQUIRED', sortOrder: 0 }],
    [{ productId, type: 'REQUIRED', sortOrder: 0 }],
    [{ productId, requestedQty: 0, type: 'REQUIRED', sortOrder: 0 }],
    [{ productId, requestedQty: 1.5, type: 'REQUIRED', sortOrder: 0 }],
    [{ productId, requestedQty: 1, type: 'OTHER', sortOrder: 0 }],
    [{ productId, requestedQty: 1, type: 'REQUIRED', sortOrder: 1.5 }],
    [
      {
        productId,
        requestedQty: 1,
        type: 'REQUIRED',
        sortOrder: 0,
        notes: 'x'.repeat(1001),
      },
    ],
  ])('rejects invalid create payload %#', async (payload) => {
    await expect(
      transformBody(payload, CreateHealthcareRequirementDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    'id',
    'companyId',
    'caseId',
    'lifecycle',
    'createdById',
    'retiredAt',
    'retiredById',
    'retirementReason',
    'reactivatedAt',
    'reactivatedById',
    'createdAt',
    'updatedAt',
  ])('rejects protected create field %s', async (field) => {
    await expect(
      transformBody(
        {
          productId,
          requestedQty: 1,
          type: 'REQUIRED',
          sortOrder: 0,
          [field]: 'protected',
        },
        CreateHealthcareRequirementDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports partial update and blank/null note clearing', async () => {
    await expect(
      transformBody({}, UpdateHealthcareRequirementDto),
    ).resolves.toEqual({});
    await expect(
      transformBody({ notes: '   ' }, UpdateHealthcareRequirementDto),
    ).resolves.toMatchObject({ notes: null });
    await expect(
      transformBody({ notes: null }, UpdateHealthcareRequirementDto),
    ).resolves.toMatchObject({ notes: null });
  });

  it.each([
    'id',
    'companyId',
    'caseId',
    'productId',
    'lifecycle',
    'createdById',
    'retiredAt',
    'retiredById',
    'retirementReason',
    'reactivatedAt',
    'reactivatedById',
    'createdAt',
    'updatedAt',
  ])('rejects protected update field %s', async (field) => {
    await expect(
      transformBody({ [field]: 'protected' }, UpdateHealthcareRequirementDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires and normalizes a nonblank retirement reason', async () => {
    await expect(
      transformBody(
        { retirementReason: '  Ya no se requiere   en cirugía  ' },
        RetireHealthcareRequirementDto,
      ),
    ).resolves.toMatchObject({
      retirementReason: 'Ya no se requiere en cirugía',
    });

    await expect(
      transformBody(
        { retirementReason: '   ' },
        RetireHealthcareRequirementDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts only an empty reactivate body', async () => {
    await expect(
      transformBody({}, ReactivateHealthcareRequirementDto),
    ).resolves.toEqual({});
    await expect(
      transformBody(
        { lifecycle: 'ACTIVE' },
        ReactivateHealthcareRequirementDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates a nonempty reorder payload while allowing duplicate positions', async () => {
    await expect(
      transformBody(
        {
          items: [
            { requirementId, sortOrder: 10 },
            {
              requirementId: '33333333-3333-4333-8333-333333333333',
              sortOrder: 10,
            },
          ],
        },
        ReorderHealthcareRequirementsDto,
      ),
    ).resolves.toMatchObject({ items: [{ sortOrder: 10 }, { sortOrder: 10 }] });

    await expect(
      transformBody({ items: [] }, ReorderHealthcareRequirementsDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { items: [{ requirementId: 'not-a-uuid', sortOrder: 1 }] },
    { items: [{ requirementId, sortOrder: 1.5 }] },
    { items: [{ requirementId, sortOrder: 1, productId }] },
    { items: [{ requirementId }], companyId: productId },
  ])('rejects invalid or protected reorder payload %#', async (payload) => {
    await expect(
      transformBody(payload, ReorderHealthcareRequirementsDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults list status in the service and rejects unsupported query fields', async () => {
    await expect(
      validationPipe.transform(
        { status: HealthcareRequirementListStatus.ALL },
        { type: 'query', metatype: HealthcareRequirementListQueryDto },
      ),
    ).resolves.toMatchObject({ status: HealthcareRequirementListStatus.ALL });
    await expect(
      validationPipe.transform(
        { status: 'INACTIVE' },
        { type: 'query', metatype: HealthcareRequirementListQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validationPipe.transform(
        { page: '1' },
        { type: 'query', metatype: HealthcareRequirementListQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
