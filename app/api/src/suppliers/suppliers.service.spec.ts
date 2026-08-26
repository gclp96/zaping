import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { SuppliersService } from './suppliers.service';

const activeSupplier = {
  id: 'supplier-1',
  companyId: 'company-1',
  name: 'Proveedor Médico',
  email: 'ventas@proveedor.test',
  phone: '5552000000',
  address: null,
  contactName: null,
  notes: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  isActive: true,
};

const inactiveSupplier = {
  ...activeSupplier,
  isActive: false,
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
};

describe('SuppliersService', () => {
  let service: SuppliersService;
  let supplier: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    supplier = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: PrismaService,
          useValue: { supplier },
        },
      ],
    }).compile();

    service = moduleRef.get<SuppliersService>(SuppliersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists only active suppliers from the requested company', async () => {
    supplier.findMany.mockResolvedValue([activeSupplier]);

    await expect(service.findAll('company-1')).resolves.toEqual([
      activeSupplier,
    ]);
    expect(supplier.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  });

  it('retrieves an inactive supplier for historical detail', async () => {
    supplier.findFirst.mockResolvedValue(inactiveSupplier);

    await expect(service.findOne('company-1', 'supplier-1')).resolves.toEqual(
      inactiveSupplier,
    );
    expect(supplier.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'supplier-1',
        companyId: 'company-1',
      },
    });
  });

  it('creates a supplier without exposing lifecycle state', async () => {
    supplier.findFirst.mockResolvedValue(null);
    supplier.create.mockResolvedValue(activeSupplier);

    await service.create('company-1', {
      name: activeSupplier.name,
      email: activeSupplier.email,
      phone: activeSupplier.phone,
    });

    expect(supplier.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        name: activeSupplier.name,
        email: activeSupplier.email,
        phone: activeSupplier.phone,
        address: undefined,
        contactName: undefined,
        notes: undefined,
      },
    });
  });

  it('updates through a tenant-scoped mutation without accepting lifecycle fields', async () => {
    const updatedSupplier = {
      ...activeSupplier,
      name: 'Proveedor Médico Norte',
    };
    supplier.findFirst
      .mockResolvedValueOnce(activeSupplier)
      .mockResolvedValueOnce(updatedSupplier);
    supplier.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.update('company-1', 'supplier-1', {
        name: updatedSupplier.name,
        isActive: false,
      } as never),
    ).resolves.toEqual(updatedSupplier);

    expect(supplier.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'supplier-1',
        companyId: 'company-1',
      },
      data: {
        name: updatedSupplier.name,
        email: undefined,
        phone: undefined,
        address: undefined,
        contactName: undefined,
        notes: undefined,
      },
    });
  });

  it('does not mutate a supplier from another company', async () => {
    supplier.findFirst.mockResolvedValue(null);

    await expect(
      service.update('company-1', 'supplier-other', {
        name: 'Otro proveedor',
      }),
    ).rejects.toThrow(new NotFoundException('Proveedor no encontrado'));
    expect(supplier.updateMany).not.toHaveBeenCalled();
  });

  it('treats a failed scoped update as not found', async () => {
    supplier.findFirst.mockResolvedValue(activeSupplier);
    supplier.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('company-1', 'supplier-1', { name: 'Nuevo nombre' }),
    ).rejects.toThrow(new NotFoundException('Proveedor no encontrado'));
  });

  it('deactivates an active supplier without physically deleting it', async () => {
    supplier.findFirst
      .mockResolvedValueOnce(activeSupplier)
      .mockResolvedValueOnce(inactiveSupplier);
    supplier.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove('company-1', 'supplier-1')).resolves.toEqual(
      inactiveSupplier,
    );
    expect(supplier.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'supplier-1',
        companyId: 'company-1',
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    expect(supplier.delete).not.toHaveBeenCalled();
  });

  it('returns an already inactive supplier without another write', async () => {
    supplier.findFirst.mockResolvedValue(inactiveSupplier);

    await expect(service.remove('company-1', 'supplier-1')).resolves.toEqual(
      inactiveSupplier,
    );
    expect(supplier.updateMany).not.toHaveBeenCalled();
    expect(supplier.delete).not.toHaveBeenCalled();
  });

  it('does not deactivate a supplier from another company', async () => {
    supplier.findFirst.mockResolvedValue(null);

    await expect(service.remove('company-1', 'supplier-other')).rejects.toThrow(
      new NotFoundException('Proveedor no encontrado'),
    );
    expect(supplier.updateMany).not.toHaveBeenCalled();
    expect(supplier.delete).not.toHaveBeenCalled();
  });
});
