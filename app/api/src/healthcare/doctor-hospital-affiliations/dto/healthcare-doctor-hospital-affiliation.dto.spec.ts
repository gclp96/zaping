import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { HealthcareMasterListQueryDto } from '../../common/dto/healthcare-master-list-query.dto';
import { CreateHealthcareDoctorHospitalAffiliationDto } from './create-healthcare-doctor-hospital-affiliation.dto';
import { UpdateHealthcareDoctorHospitalAffiliationDto } from './update-healthcare-doctor-hospital-affiliation.dto';

describe('Healthcare Doctor/Hospital affiliation DTOs', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const doctorId = '11111111-1111-4111-8111-111111111111';
  const hospitalId = '22222222-2222-4222-8222-222222222222';

  const transformBody = (
    value: Record<string, unknown>,
    metatype:
      | typeof CreateHealthcareDoctorHospitalAffiliationDto
      | typeof UpdateHealthcareDoctorHospitalAffiliationDto,
  ) => validationPipe.transform(value, { type: 'body', metatype });

  it('accepts UUID endpoints and normalizes optional notes on create', async () => {
    await expect(
      transformBody(
        { doctorId, hospitalId, notes: '  Atención preferente  ' },
        CreateHealthcareDoctorHospitalAffiliationDto,
      ),
    ).resolves.toMatchObject({
      doctorId,
      hospitalId,
      notes: 'Atención preferente',
    });
  });

  it.each([
    [{ hospitalId }],
    [{ doctorId }],
    [{ doctorId: 'not-a-uuid', hospitalId }],
    [{ doctorId, hospitalId: 'not-a-uuid' }],
    [{ doctorId, hospitalId, notes: 'x'.repeat(1001) }],
  ])('rejects invalid create payload %#', async (payload) => {
    await expect(
      transformBody(payload, CreateHealthcareDoctorHospitalAffiliationDto),
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
        { doctorId, hospitalId, [field]: 'protected' },
        CreateHealthcareDoctorHospitalAffiliationDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supports omitted PATCH notes and explicit null/blank clears', async () => {
    await expect(
      transformBody({}, UpdateHealthcareDoctorHospitalAffiliationDto),
    ).resolves.toEqual({});
    await expect(
      transformBody(
        { notes: null },
        UpdateHealthcareDoctorHospitalAffiliationDto,
      ),
    ).resolves.toMatchObject({ notes: null });
    await expect(
      transformBody(
        { notes: '   ' },
        UpdateHealthcareDoctorHospitalAffiliationDto,
      ),
    ).resolves.toMatchObject({ notes: null });
  });

  it.each([
    'id',
    'doctorId',
    'hospitalId',
    'companyId',
    'searchKey',
    'isActive',
    'createdAt',
    'updatedAt',
  ])('rejects protected PATCH field %s', async (field) => {
    await expect(
      transformBody(
        { [field]: doctorId },
        UpdateHealthcareDoctorHospitalAffiliationDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reuses strict common nested-list query validation', async () => {
    await expect(
      validationPipe.transform(
        { page: '2', pageSize: '100', status: 'INACTIVE', search: ' José ' },
        { type: 'query', metatype: HealthcareMasterListQueryDto },
      ),
    ).resolves.toMatchObject({
      page: 2,
      pageSize: 100,
      status: 'INACTIVE',
      search: 'jose',
    });

    await expect(
      validationPipe.transform(
        { city: 'Hermosillo' },
        { type: 'query', metatype: HealthcareMasterListQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
