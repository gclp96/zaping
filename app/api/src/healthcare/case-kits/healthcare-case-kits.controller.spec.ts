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
    excludeItem: jest.fn(),
    confirmPreparation: jest.fn(),
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
    expect(Reflect.getMetadata('roles', controller.excludeItem)).toEqual([
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.WAREHOUSE,
    ]);
    expect(Reflect.getMetadata('roles', controller.confirmPreparation)).toEqual(
      [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE],
    );
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

  it('excludes with the normalized key and direct HTTP 200 response', async () => {
    const data = { id: 'item-id', lifecycle: 'EXCLUDED' };
    service.excludeItem.mockResolvedValue({ replay: false, data });

    await expect(
      controller.excludeItem(
        request as never,
        'kit-id',
        'item-id',
        '  exclusion-key  ',
        { reason: 'Selección incorrecta' },
        response as never,
      ),
    ).resolves.toBe(data);
    expect(service.excludeItem).toHaveBeenCalledWith(
      'company-id',
      'user-id',
      'kit-id',
      'item-id',
      'exclusion-key',
      { reason: 'Selección incorrecta' },
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('confirms preparation with a normalized key and direct HTTP 200 response', async () => {
    const data = { id: 'kit-id', status: 'PREPARED' };
    service.confirmPreparation.mockResolvedValue({ replay: false, data });

    await expect(
      controller.confirmPreparation(
        request as never,
        'kit-id',
        '  confirm-key  ',
        {},
        response as never,
      ),
    ).resolves.toBe(data);
    expect(service.confirmPreparation).toHaveBeenCalledWith(
      'company-id',
      'user-id',
      'kit-id',
      'confirm-key',
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('requires Idempotency-Key for preparation confirmation', async () => {
    await expect(
      controller.confirmPreparation(
        request as never,
        'kit-id',
        undefined,
        {},
        response as never,
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: 'IDEMPOTENCY_KEY_REQUIRED' },
    });
    expect(service.confirmPreparation).not.toHaveBeenCalled();
  });

  it('rejects a non-empty preparation body with the stable error', async () => {
    await expect(
      controller.confirmPreparation(
        request as never,
        'kit-id',
        'confirm-key',
        { status: 'PREPARED' },
        response as never,
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: 'INVALID_REQUEST_BODY' },
    });
    expect(service.confirmPreparation).not.toHaveBeenCalled();
  });
});
