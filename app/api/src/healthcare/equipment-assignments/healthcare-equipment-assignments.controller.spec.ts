import { BadRequestException, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';

import { HealthcareEquipmentAssignmentListStatus } from './dto/healthcare-equipment-assignment-list-query.dto';
import { HealthcareEquipmentAssignmentsController } from './healthcare-equipment-assignments.controller';

const companyId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const assignmentId = '33333333-3333-4333-8333-333333333333';
const caseId = '44444444-4444-4444-8444-444444444444';
const equipmentAssetId = '55555555-5555-4555-8555-555555555555';
const request = { user: { id: userId, companyId } };

describe('HealthcareEquipmentAssignmentsController', () => {
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const controller = new HealthcareEquipmentAssignmentsController(
    service as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers only the canonical C2 resource routes', () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        HealthcareEquipmentAssignmentsController,
      ),
    ).toBe('healthcare/equipment-assignments');
    expect(getPath('findAll')).toBe('/');
    expect(getPath('findOne')).toBe(':assignmentId');
    expect(getPath('create')).toBe('/');
  });

  it('lists and reads with authenticated companyId', async () => {
    const query = {
      status: HealthcareEquipmentAssignmentListStatus.ALL,
      page: 1,
      pageSize: 25,
    };
    service.findAll.mockResolvedValue({ items: [] });
    service.findOne.mockResolvedValue({ id: assignmentId });

    await controller.findAll(request as never, query);
    await controller.findOne(request as never, assignmentId);

    expect(service.findAll).toHaveBeenCalledWith(companyId, query);
    expect(service.findOne).toHaveBeenCalledWith(companyId, assignmentId);
  });

  it('creates with authenticated tenant/actor and trimmed idempotency key', async () => {
    const dto = {
      caseId,
      equipmentAssetId,
      directAssignmentReason: 'Urgente',
    };
    service.create.mockResolvedValue({ outcome: 'CREATED' });

    await controller.create(request as never, '  request-key  ', dto);

    expect(service.create).toHaveBeenCalledWith(
      companyId,
      userId,
      'request-key',
      dto,
    );
    expect(getHttpCode('create')).toBe(HttpStatus.CREATED);
  });

  it.each([undefined, '', '   ', 'x'.repeat(129)])(
    'rejects invalid Idempotency-Key %p before service lookup',
    (key) => {
      expect(() =>
        controller.create(request as never, key, {
          caseId,
          equipmentAssetId,
          directAssignmentReason: 'Urgente',
        }),
      ).toThrow(BadRequestException);
      expect(service.create).not.toHaveBeenCalled();
    },
  );

  it('validates assignmentId with ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      HealthcareEquipmentAssignmentsController,
      'findOne',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;
    const idParam = Object.values(metadata).find(
      (value) => value.data === 'assignmentId',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });
});

type ControllerMethod = 'findAll' | 'findOne' | 'create';

function getHandler(methodName: ControllerMethod): object {
  return Object.getOwnPropertyDescriptor(
    HealthcareEquipmentAssignmentsController.prototype,
    methodName,
  )?.value as object;
}

function getPath(methodName: ControllerMethod): string {
  return Reflect.getMetadata(PATH_METADATA, getHandler(methodName)) as string;
}

function getHttpCode(methodName: ControllerMethod): number {
  return Reflect.getMetadata(
    HTTP_CODE_METADATA,
    getHandler(methodName),
  ) as number;
}
