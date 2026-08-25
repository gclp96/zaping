import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductInventoryTracking, ProductLotTracking } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '99999999-9999-4999-8999-999999999999';
const productId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const inactiveCategoryId = '44444444-4444-4444-8444-444444444444';

const categoryErrorMessage =
  'Categoría no encontrada, inactiva o fuera de la empresa';

function productMock(
  overrides: Partial<{
    id: string;
    companyId: string;
    sku: string;
    name: string;
    brand: string | null;
    categoryId: string | null;
    barcode: string | null;
    cost: number;
    price: number;
    stock: number;
    minStock: number;
    inventoryTracking: ProductInventoryTracking;
    lotTracking: ProductLotTracking;
  }> = {},
) {
  return {
    id: productId,
    companyId,
    sku: 'LF1837',
    name: 'BLUNT TIP',
    brand: null,
    categoryId: null,
    barcode: null,
    cost: 100,
    price: 150,
    stock: 0,
    minStock: 1,
    inventoryTracking: ProductInventoryTracking.QUANTITY,
    lotTracking: ProductLotTracking.OPTIONAL,
    ...overrides,
  };
}

function createDto(
  overrides: Partial<CreateProductDto> = {},
): CreateProductDto {
  return {
    sku: 'LF1837',
    name: 'BLUNT TIP',
    cost: 100,
    price: 150,
    minStock: 1,
    ...overrides,
  };
}

const prismaMock = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    fields: {
      minStock: 'minStock',
    },
  },
  category: {
    findFirst: jest.fn(),
  },
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.category.findFirst.mockResolvedValue({
      id: categoryId,
      companyId,
      isActive: true,
    });
    prismaMock.product.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: productId,
          ...data,
        }),
    );
    prismaMock.product.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...productMock(),
          ...data,
        }),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<ProductsService>(ProductsService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('consulta productos usando id y companyId', async () => {
      const product = productMock();

      prismaMock.product.findFirst.mockResolvedValue(product);

      const result = await service.findOne(companyId, productId);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: {
          id: productId,
          companyId,
        },
      });
      expect(result).toEqual(product);
    });

    it('lanza Producto no encontrado cuando no existe', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(companyId, productId)).rejects.toThrow(
        new NotFoundException('Producto no encontrado'),
      );
    });

    it('no devuelve productos de otra empresa', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(companyId, productId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: {
          id: productId,
          companyId,
        },
      });
      expect(prismaMock.product.findFirst).not.toHaveBeenCalledWith({
        where: {
          id: productId,
          companyId: otherCompanyId,
        },
      });
    });
  });

  describe('create category validation', () => {
    it('permite crear con una categoria activa de la misma empresa', async () => {
      await service.create(companyId, createDto({ categoryId }));

      expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: categoryId,
          companyId,
          isActive: true,
        },
      });
      expect(prismaMock.product.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          companyId,
          categoryId,
        }),
      });
    });

    it('rechaza una categoria de otra empresa sin crear producto', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(companyId, createDto({ categoryId })),
      ).rejects.toThrow(new NotFoundException(categoryErrorMessage));

      expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: categoryId,
          companyId,
          isActive: true,
        },
      });
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('rechaza una categoria inactiva sin crear producto', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          companyId,
          createDto({ categoryId: inactiveCategoryId }),
        ),
      ).rejects.toThrow(new NotFoundException(categoryErrorMessage));

      expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: inactiveCategoryId,
          companyId,
          isActive: true,
        },
      });
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('rechaza una categoria inexistente sin crear producto', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(companyId, createDto({ categoryId })),
      ).rejects.toThrow(new NotFoundException(categoryErrorMessage));

      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('permite crear cuando categoryId se omite sin consultar categorias', async () => {
      await service.create(companyId, createDto());

      expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.product.create).toHaveBeenCalledTimes(1);
    });

    it('permite crear con categoryId null sin consultar categorias', async () => {
      await service.create(
        companyId,
        createDto({ categoryId: null } as unknown as Partial<CreateProductDto>),
      );

      expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.product.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          categoryId: null,
        }),
      });
    });
  });

  describe('update category validation', () => {
    beforeEach(() => {
      prismaMock.product.findFirst.mockResolvedValueOnce(productMock());
    });

    it('permite actualizar con una categoria activa de la misma empresa', async () => {
      await service.update(companyId, productId, { categoryId });

      expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: categoryId,
          companyId,
          isActive: true,
        },
      });
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          categoryId,
        }),
      });
    });

    it('rechaza una categoria de otra empresa sin actualizar producto', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(companyId, productId, { categoryId }),
      ).rejects.toThrow(new NotFoundException(categoryErrorMessage));

      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });

    it('rechaza una categoria inactiva sin actualizar producto', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(companyId, productId, {
          categoryId: inactiveCategoryId,
        }),
      ).rejects.toThrow(new NotFoundException(categoryErrorMessage));

      expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: inactiveCategoryId,
          companyId,
          isActive: true,
        },
      });
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });

    it('rechaza una categoria inexistente sin actualizar producto', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(companyId, productId, { categoryId }),
      ).rejects.toThrow(new NotFoundException(categoryErrorMessage));

      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });

    it('permite limpiar la categoria con categoryId null', async () => {
      await service.update(companyId, productId, {
        categoryId: null,
      } as unknown as UpdateProductDto);

      expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          categoryId: null,
        }),
      });
    });

    it('omite validacion de categoria cuando categoryId no viene en PATCH', async () => {
      await service.update(companyId, productId, { name: 'BLUNT TIP UPDATED' });

      expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          name: 'BLUNT TIP UPDATED',
          categoryId: undefined,
        }),
      });
    });

    it('no permite actualizar inventoryTracking ni lotTracking por PATCH', async () => {
      await service.update(companyId, productId, {
        inventoryTracking: ProductInventoryTracking.ASSET,
        lotTracking: ProductLotTracking.REQUIRED,
      } as unknown as UpdateProductDto);

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.not.objectContaining({
          inventoryTracking: ProductInventoryTracking.ASSET,
          lotTracking: ProductLotTracking.REQUIRED,
        }),
      });
    });
  });

  describe('remove', () => {
    it('verifica tenant antes de borrar y conserva el delete fisico actual', async () => {
      prismaMock.product.findFirst.mockResolvedValue(productMock());

      await service.remove(companyId, productId);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: {
          id: productId,
          companyId,
        },
      });
      expect(prismaMock.product.delete).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
      });
    });
  });
});
