/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';

import { HttpStatus } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { HealthcareCaseKitsController } from './healthcare-case-kits.controller';
import { HealthcareCaseKitsService } from './healthcare-case-kits.service';

describe('HealthcareCaseKitsController', () => {
  const service = {
    get: jest.fn(),
    create: jest.fn(),
    addItem: jest.fn(),
  };
  const controller = new HealthcareCaseKitsController(
    service as unknown as HealthcareCaseKitsService,
  );
  const request = {
    user: { id: 'user-id', companyId: 'company-id', role: UserRole.MANAGER },
  };
  const response = { status: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('exposes read to every fixed role and mutation without SALES', () => {
    expect(Reflect.getMetadata('roles', controller.get)).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.SALES,
      UserRole.WAREHOUSE,
    ]);
    expect(Reflect.getMetadata('roles', controller.create)).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.WAREHOUSE,
    ]);
    expect(Reflect.getMetadata('roles', controller.addItem)).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.WAREHOUSE,
    ]);
  });

  it('requires Idempotency-Key with stable errors', async () => {
    await expect(
      controller.create(
        request as never,
        'case-id',
        undefined,
        {},
        response as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    await expect(
      controller.create(
        request as never,
        'case-id',
        '   ',
        {},
        response as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_IDEMPOTENCY_KEY' } });
  });

  it.each([
    [false, HttpStatus.CREATED],
    [true, HttpStatus.OK],
  ])(
    'returns the direct response with the documented status',
    async (replay, status) => {
      const data = { id: 'kit-id' };
      service.create.mockResolvedValue({ replay, data });

      await expect(
        controller.create(
          request as never,
          'case-id',
          '  key  ',
          {},
          response as never,
        ),
      ).resolves.toBe(data);
      expect(service.create).toHaveBeenCalledWith(
        'company-id',
        'user-id',
        'case-id',
        'key',
      );
      expect(response.status).toHaveBeenCalledWith(status);
    },
  );
});
