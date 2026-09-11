import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { HealthcareHospitalsController } from './healthcare-hospitals.controller';

const companyId = '11111111-1111-4111-8111-111111111111';
const hospitalId = '22222222-2222-4222-8222-222222222222';
const request = {
  user: {
    id: '33333333-3333-4333-8333-333333333333',
    companyId,
  },
};

describe('HealthcareHospitalsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
  };
  const affiliationsService = {
    findDoctorsForHospital: jest.fn(),
  };
  const controller = new HealthcareHospitalsController(
    service as never,
    affiliationsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the approved Hospitals base route', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, HealthcareHospitalsController),
    ).toBe('healthcare/hospitals');
  });

  it('lists using authenticated companyId and location filters', async () => {
    const query = {
      page: 1,
      pageSize: 25,
      status: 'ACTIVE' as const,
      city: 'Hermosillo',
      state: 'Sonora',
    };
    service.findAll.mockResolvedValue({ items: [], pagination: {} });

    await controller.findAll(
      request as Parameters<HealthcareHospitalsController['findAll']>[0],
      query,
    );

    expect(service.findAll).toHaveBeenCalledWith(companyId, query);
  });

  it.each([
    ['findOne', 'findOne'],
    ['update', 'update'],
    ['deactivate', 'deactivate'],
    ['reactivate', 'reactivate'],
  ] as const)(
    'passes authenticated tenant and route ID through %s',
    async (controllerMethod, serviceMethod) => {
      service[serviceMethod].mockResolvedValue({ id: hospitalId });

      if (controllerMethod === 'update') {
        await controller.update(
          request as Parameters<HealthcareHospitalsController['update']>[0],
          hospitalId,
          { notes: null },
        );
        expect(service.update).toHaveBeenCalledWith(companyId, hospitalId, {
          notes: null,
        });
        return;
      }

      await controller[controllerMethod](request as never, hospitalId);
      expect(service[serviceMethod]).toHaveBeenCalledWith(
        companyId,
        hospitalId,
      );
    },
  );

  it.each(['findOne', 'update', 'deactivate', 'reactivate'] as const)(
    'validates %s hospitalId with ParseUUIDPipe',
    (methodName) => {
      const metadata = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        HealthcareHospitalsController,
        methodName,
      ) as Record<string, { data?: string; pipes?: unknown[] }>;
      const idParam = Object.values(metadata).find(
        (value) => value.data === 'hospitalId',
      );

      expect(idParam?.pipes).toContain(ParseUUIDPipe);
    },
  );

  it('lists affiliated Doctors using the authenticated tenant and query', async () => {
    const query = {
      page: 2,
      pageSize: 10,
      status: 'ALL' as const,
      search: 'cardiologia',
    };
    affiliationsService.findDoctorsForHospital.mockResolvedValue({ items: [] });

    await controller.findDoctors(
      request as Parameters<HealthcareHospitalsController['findDoctors']>[0],
      hospitalId,
      query,
    );

    expect(affiliationsService.findDoctorsForHospital).toHaveBeenCalledWith(
      companyId,
      hospitalId,
      query,
    );
  });

  it('validates nested-list hospitalId with ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      HealthcareHospitalsController,
      'findDoctors',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;
    const idParam = Object.values(metadata).find(
      (value) => value.data === 'hospitalId',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });

  it.each([
    ['CREATED', HttpStatus.CREATED],
    ['DUPLICATE_REVIEW_REQUIRED', HttpStatus.OK],
  ] as const)('sets create outcome %s to HTTP %s', async (outcome, status) => {
    service.create.mockResolvedValue({ outcome });
    const response = { status: jest.fn() };

    await controller.create(
      request as Parameters<HealthcareHospitalsController['create']>[0],
      {
        name: 'Hospital San José',
        city: 'Hermosillo',
        state: 'Sonora',
      },
      response as never,
    );

    expect(service.create).toHaveBeenCalledWith(companyId, {
      name: 'Hospital San José',
      city: 'Hermosillo',
      state: 'Sonora',
    });
    expect(response.status).toHaveBeenCalledWith(status);
  });
});
