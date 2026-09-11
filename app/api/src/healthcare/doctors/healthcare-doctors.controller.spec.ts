import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { HealthcareMasterStatus } from '../common/dto/healthcare-master-list-query.dto';
import { HealthcareDoctorsController } from './healthcare-doctors.controller';

const companyId = '11111111-1111-4111-8111-111111111111';
const doctorId = '22222222-2222-4222-8222-222222222222';
const request = {
  user: {
    id: '33333333-3333-4333-8333-333333333333',
    companyId,
  },
};

describe('HealthcareDoctorsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
  };
  const affiliationsService = {
    findHospitalsForDoctor: jest.fn(),
  };
  const controller = new HealthcareDoctorsController(
    service as never,
    affiliationsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the approved Doctors base route', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, HealthcareDoctorsController),
    ).toBe('healthcare/doctors');
  });

  it('lists using authenticated companyId and the validated query', async () => {
    const query = {
      page: 2,
      pageSize: 10,
      status: HealthcareMasterStatus.ALL,
      search: 'cardiologia',
    };
    service.findAll.mockResolvedValue({ items: [], pagination: {} });

    await controller.findAll(
      request as Parameters<HealthcareDoctorsController['findAll']>[0],
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
      service[serviceMethod].mockResolvedValue({ id: doctorId });

      if (controllerMethod === 'update') {
        await controller.update(
          request as Parameters<HealthcareDoctorsController['update']>[0],
          doctorId,
          { notes: null },
        );
        expect(service.update).toHaveBeenCalledWith(companyId, doctorId, {
          notes: null,
        });
        return;
      }

      await controller[controllerMethod](request as never, doctorId);
      expect(service[serviceMethod]).toHaveBeenCalledWith(companyId, doctorId);
    },
  );

  it.each(['findOne', 'update', 'deactivate', 'reactivate'] as const)(
    'validates %s doctorId with ParseUUIDPipe',
    (methodName) => {
      const metadata = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        HealthcareDoctorsController,
        methodName,
      ) as Record<string, { data?: string; pipes?: unknown[] }>;
      const idParam = Object.values(metadata).find(
        (value) => value.data === 'doctorId',
      );

      expect(idParam?.pipes).toContain(ParseUUIDPipe);
    },
  );

  it('lists affiliated Hospitals using the authenticated tenant and query', async () => {
    const query = {
      page: 2,
      pageSize: 10,
      status: HealthcareMasterStatus.ALL,
      search: 'central',
    };
    affiliationsService.findHospitalsForDoctor.mockResolvedValue({ items: [] });

    await controller.findHospitals(
      request as Parameters<HealthcareDoctorsController['findHospitals']>[0],
      doctorId,
      query,
    );

    expect(affiliationsService.findHospitalsForDoctor).toHaveBeenCalledWith(
      companyId,
      doctorId,
      query,
    );
  });

  it('validates nested-list doctorId with ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      HealthcareDoctorsController,
      'findHospitals',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;
    const idParam = Object.values(metadata).find(
      (value) => value.data === 'doctorId',
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
      request as Parameters<HealthcareDoctorsController['create']>[0],
      {
        firstName: 'José',
        lastName: 'Muñoz',
        specialty: 'Cardiología',
      },
      response as never,
    );

    expect(service.create).toHaveBeenCalledWith(companyId, {
      firstName: 'José',
      lastName: 'Muñoz',
      specialty: 'Cardiología',
    });
    expect(response.status).toHaveBeenCalledWith(status);
  });
});
