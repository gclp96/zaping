import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import {
  HealthcareRequirementLifecycle,
  HealthcareRequirementType,
} from '@prisma/client';

import { HealthcareRequirementListStatus } from './dto/healthcare-requirement-list-query.dto';
import { HealthcareRequirementsController } from './healthcare-requirements.controller';

const companyId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const caseId = '33333333-3333-4333-8333-333333333333';
const requirementId = '44444444-4444-4444-8444-444444444444';
const productId = '55555555-5555-4555-8555-555555555555';
const request = { user: { id: userId, companyId } };

describe('HealthcareRequirementsController', () => {
  const service = {
    findAllForCase: jest.fn(),
    create: jest.fn(),
    reorder: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    retire: jest.fn(),
    reactivate: jest.fn(),
  };
  const controller = new HealthcareRequirementsController(service as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the Healthcare root for the approved nested and top-level routes', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, HealthcareRequirementsController),
    ).toBe('healthcare');

    expect(getPath('findAllForCase')).toBe('cases/:caseId/requirements');
    expect(getPath('create')).toBe('cases/:caseId/requirements');
    expect(getPath('reorder')).toBe('cases/:caseId/requirements/reorder');
    expect(getPath('findOne')).toBe('requirements/:requirementId');
    expect(getPath('update')).toBe('requirements/:requirementId');
    expect(getPath('retire')).toBe('requirements/:requirementId/retire');
    expect(getPath('reactivate')).toBe(
      'requirements/:requirementId/reactivate',
    );
  });

  it('lists a Case using only authenticated companyId and the validated query', async () => {
    const query = { status: HealthcareRequirementListStatus.ALL };
    service.findAllForCase.mockResolvedValue({ items: [] });

    await controller.findAllForCase(request as never, caseId, query);

    expect(service.findAllForCase).toHaveBeenCalledWith(
      companyId,
      caseId,
      query,
    );
  });

  it('creates with authenticated tenant and actor IDs', async () => {
    const dto = {
      productId,
      requestedQty: 2,
      type: HealthcareRequirementType.REQUIRED,
      notes: null,
      sortOrder: 10,
    };
    service.create.mockResolvedValue({ id: requirementId });

    await controller.create(request as never, caseId, dto);

    expect(service.create).toHaveBeenCalledWith(companyId, userId, caseId, dto);
    expect(getHttpCode('create')).toBe(HttpStatus.CREATED);
  });

  it('reorders within the Case and authenticated tenant', async () => {
    const dto = { items: [{ requirementId, sortOrder: 20 }] };
    service.reorder.mockResolvedValue({ items: [] });

    await controller.reorder(request as never, caseId, dto);

    expect(service.reorder).toHaveBeenCalledWith(companyId, caseId, dto);
  });

  it('reads and updates a tenant-scoped top-level Requirement', async () => {
    const dto = {
      lifecycle: HealthcareRequirementLifecycle.ACTIVE,
      requestedQty: 3,
    };
    service.findOne.mockResolvedValue({ id: requirementId });
    service.update.mockResolvedValue({ id: requirementId });

    await controller.findOne(request as never, requirementId);
    await controller.update(request as never, requirementId, {
      requestedQty: dto.requestedQty,
    });

    expect(service.findOne).toHaveBeenCalledWith(companyId, requirementId);
    expect(service.update).toHaveBeenCalledWith(companyId, requirementId, {
      requestedQty: 3,
    });
  });

  it('passes authenticated actor IDs through lifecycle commands', async () => {
    const retireDto = { retirementReason: 'Ya no se requiere' };
    service.retire.mockResolvedValue({ id: requirementId });
    service.reactivate.mockResolvedValue({ id: requirementId });

    await controller.retire(request as never, requirementId, retireDto);
    await controller.reactivate(request as never, requirementId, {});

    expect(service.retire).toHaveBeenCalledWith(
      companyId,
      userId,
      requirementId,
      retireDto,
    );
    expect(service.reactivate).toHaveBeenCalledWith(
      companyId,
      userId,
      requirementId,
    );
    expect(getHttpCode('retire')).toBe(HttpStatus.OK);
    expect(getHttpCode('reactivate')).toBe(HttpStatus.OK);
  });

  it.each(['findAllForCase', 'create', 'reorder'] as const)(
    'validates %s caseId with ParseUUIDPipe',
    (methodName) => {
      expect(getParamPipes(methodName, 'caseId')).toContain(ParseUUIDPipe);
    },
  );

  it.each(['findOne', 'update', 'retire', 'reactivate'] as const)(
    'validates %s requirementId with ParseUUIDPipe',
    (methodName) => {
      expect(getParamPipes(methodName, 'requirementId')).toContain(
        ParseUUIDPipe,
      );
    },
  );
});

type ControllerMethod = Exclude<
  keyof HealthcareRequirementsController,
  'constructor'
>;

function getHandler(methodName: ControllerMethod): object {
  return Object.getOwnPropertyDescriptor(
    HealthcareRequirementsController.prototype,
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

function getParamPipes(
  methodName: ControllerMethod,
  parameterName: string,
): unknown[] | undefined {
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    HealthcareRequirementsController,
    methodName,
  ) as Record<string, { data?: string; pipes?: unknown[] }>;

  return Object.values(metadata).find((value) => value.data === parameterName)
    ?.pipes;
}
