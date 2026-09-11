import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { HealthcareMasterListQueryDto } from '../../common/dto/healthcare-master-list-query.dto';
import { CreateHealthcareDoctorDto } from './create-healthcare-doctor.dto';
import { UpdateHealthcareDoctorDto } from './update-healthcare-doctor.dto';

describe('Healthcare Doctor DTOs', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformBody = (
    value: Record<string, unknown>,
    metatype:
      typeof CreateHealthcareDoctorDto | typeof UpdateHealthcareDoctorDto,
  ) => validationPipe.transform(value, { type: 'body', metatype });

  const transformQuery = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'query',
      metatype: HealthcareMasterListQueryDto,
    });

  const validCreate = {
    firstName: 'José',
    lastName: 'Muñoz',
    specialty: 'Cardiología',
  };

  it('normalizes required, optional and email fields on create', async () => {
    await expect(
      transformBody(
        {
          firstName: '  José   Luis ',
          lastName: ' Muñoz ',
          specialty: ' Cardiología   Pediátrica ',
          phone: '  +52  662  123  ',
          email: '  MEDICO@EXAMPLE.COM ',
          notes: '   ',
        },
        CreateHealthcareDoctorDto,
      ),
    ).resolves.toMatchObject({
      firstName: 'José Luis',
      lastName: 'Muñoz',
      specialty: 'Cardiología Pediátrica',
      phone: '+52 662 123',
      email: 'medico@example.com',
      notes: null,
    });
  });

  it.each([
    [{ ...validCreate, firstName: '   ' }],
    [{ ...validCreate, lastName: null }],
    [{ ...validCreate, specialty: 42 }],
    [{ firstName: 'José', lastName: 'Muñoz' }],
    [{ ...validCreate, email: 'invalid-email' }],
    [{ ...validCreate, firstName: 'x'.repeat(101) }],
    [{ ...validCreate, specialty: 'x'.repeat(151) }],
  ])('rejects invalid create payload %#', async (payload) => {
    await expect(
      transformBody(payload, CreateHealthcareDoctorDto),
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
        CreateHealthcareDoctorDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports omitted update fields and explicit nullable clears', async () => {
    await expect(
      transformBody(
        {
          phone: null,
          email: ' NEW@EXAMPLE.COM ',
          notes: '   ',
        },
        UpdateHealthcareDoctorDto,
      ),
    ).resolves.toMatchObject({
      phone: null,
      email: 'new@example.com',
      notes: null,
    });
  });

  it.each([{ firstName: null }, { lastName: ' ' }, { specialty: null }])(
    'rejects nullable/blank required update field %#',
    async (payload) => {
      await expect(
        transformBody(payload, UpdateHealthcareDoctorDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([
    'id',
    'companyId',
    'searchKey',
    'isActive',
    'createdAt',
    'updatedAt',
  ])('rejects protected update field %s', async (field) => {
    await expect(
      transformBody({ [field]: 'protected' }, UpdateHealthcareDoctorDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies list defaults and transforms numeric pagination', async () => {
    await expect(transformQuery({})).resolves.toMatchObject({
      page: 1,
      pageSize: 25,
      status: 'ACTIVE',
    });
    await expect(
      transformQuery({ page: '2', pageSize: '100', status: 'ALL' }),
    ).resolves.toMatchObject({ page: 2, pageSize: 100, status: 'ALL' });
  });

  it.each([
    ['x', 'x'],
    ['x'.repeat(100), 'x'.repeat(100)],
    [' José ', 'jose'],
    ['José Pérez', 'jose perez'],
    ['José\u001FPérez', 'jose perez'],
  ])('accepts and normalizes valid search %j', async (search, expected) => {
    await expect(transformQuery({ search })).resolves.toMatchObject({
      search: expected,
    });
  });

  it.each([
    [{ page: '0' }],
    [{ pageSize: '101' }],
    [{ status: 'UNKNOWN' }],
    [{ search: '   ' }],
    [{ search: '\u0301' }],
    [{ search: '\u001F' }],
    [{ search: ' \u001F ' }],
    [{ search: 'x'.repeat(101) }],
    [{ companyId: 'tenant-controlled' }],
  ])('rejects invalid list query %#', async (query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
