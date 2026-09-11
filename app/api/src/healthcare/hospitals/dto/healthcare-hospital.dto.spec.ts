import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateHealthcareHospitalDto } from './create-healthcare-hospital.dto';
import { HealthcareHospitalListQueryDto } from './healthcare-hospital-list-query.dto';
import { UpdateHealthcareHospitalDto } from './update-healthcare-hospital.dto';

describe('Healthcare Hospital DTOs', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformBody = (
    value: Record<string, unknown>,
    metatype:
      typeof CreateHealthcareHospitalDto | typeof UpdateHealthcareHospitalDto,
  ) => validationPipe.transform(value, { type: 'body', metatype });

  const transformQuery = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'query',
      metatype: HealthcareHospitalListQueryDto,
    });

  const validCreate = {
    name: 'Hospital San José',
    city: 'Hermosillo',
    state: 'Sonora',
  };

  it('normalizes required, optional and email fields on create', async () => {
    await expect(
      transformBody(
        {
          name: ' Hospital   San José ',
          city: ' Hermosillo ',
          state: ' Sonora ',
          address: '   ',
          phone: '  +52  662  123  ',
          email: ' CONTACTO@HOSPITAL.MX ',
          contactName: ' Ana   Pérez ',
          notes: '   ',
        },
        CreateHealthcareHospitalDto,
      ),
    ).resolves.toMatchObject({
      name: 'Hospital San José',
      city: 'Hermosillo',
      state: 'Sonora',
      address: null,
      phone: '+52 662 123',
      email: 'contacto@hospital.mx',
      contactName: 'Ana Pérez',
      notes: null,
    });
  });

  it.each([
    [{ ...validCreate, name: '   ' }],
    [{ ...validCreate, city: null }],
    [{ ...validCreate, state: 42 }],
    [{ name: 'Hospital', city: 'Hermosillo' }],
    [{ ...validCreate, email: 'invalid-email' }],
    [{ ...validCreate, name: 'x'.repeat(151) }],
    [{ ...validCreate, address: 'x'.repeat(251) }],
  ])('rejects invalid create payload %#', async (payload) => {
    await expect(
      transformBody(payload, CreateHealthcareHospitalDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    'id',
    'companyId',
    'searchKey',
    'isActive',
    'createdAt',
    'updatedAt',
  ])('rejects protected create field %s', async (field) => {
    await expect(
      transformBody(
        {
          ...validCreate,
          [field]: 'protected',
        },
        CreateHealthcareHospitalDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports omitted update fields and explicit nullable clears', async () => {
    await expect(
      transformBody(
        {
          address: null,
          email: ' NEW@HOSPITAL.MX ',
          contactName: '   ',
        },
        UpdateHealthcareHospitalDto,
      ),
    ).resolves.toMatchObject({
      address: null,
      email: 'new@hospital.mx',
      contactName: null,
    });
  });

  it.each([{ name: null }, { city: ' ' }, { state: null }])(
    'rejects nullable/blank required update field %#',
    async (payload) => {
      await expect(
        transformBody(payload, UpdateHealthcareHospitalDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('normalizes hospital location filters', async () => {
    await expect(
      transformQuery({ city: '  San   Luis  ', state: ' SONORA ' }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 25,
      status: 'ACTIVE',
      city: 'San Luis',
      state: 'SONORA',
    });
  });

  it('inherits normalized search validation from the shared query DTO', async () => {
    await expect(
      transformQuery({ search: ' José\u001F\u001FPérez ' }),
    ).resolves.toMatchObject({ search: 'jose perez' });
  });

  it.each([
    [{ city: ' ' }],
    [{ state: 'x'.repeat(101) }],
    [{ search: ' ' }],
    [{ search: '\u0301' }],
    [{ search: '\u001F' }],
    [{ search: ' \u001F ' }],
    [{ search: 'x'.repeat(101) }],
    [{ companyId: 'tenant-controlled' }],
  ])('rejects invalid hospital query %#', async (query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
