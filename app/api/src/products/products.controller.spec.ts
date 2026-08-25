import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import {
  NotFoundException,
  ParseUUIDPipe,
  RequestMethod,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

const companyId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';

const request = {
  user: {
    id: '33333333-3333-4333-8333-333333333333',
    companyId,
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

const product = {
  id: productId,
  companyId,
  sku: 'LF1837',
  name: 'BLUNT TIP',
};

const createProductDto: CreateProductDto = {
  sku: 'LF1837',
  name: 'BLUNT TIP',
  cost: 100,
  price: 150,
  minStock: 1,
};

const updateProductDto: UpdateProductDto = {
  name: 'BLUNT TIP UPDATED',
};

const productsServiceMock = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  lowStock: jest.fn(),
};

function getRouteHandler(methodName: keyof ProductsController) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ProductsController.prototype,
    methodName,
  );

  return descriptor?.value as (...args: unknown[]) => unknown;
}

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ProductsController>(ProductsController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('consulta el detalle usando companyId autenticado y productId de ruta', async () => {
    productsServiceMock.findOne.mockResolvedValue(product);

    const result = await controller.findOne(
      request as Parameters<ProductsController['findOne']>[0],
      productId,
    );

    expect(productsServiceMock.findOne).toHaveBeenCalledWith(
      companyId,
      productId,
    );
    expect(productsServiceMock.findOne).not.toHaveBeenCalledWith(
      productId,
      companyId,
    );
    expect(result).toEqual(product);
  });

  it('propaga NotFound del servicio al consultar detalle', async () => {
    const error = new NotFoundException('Producto no encontrado');

    productsServiceMock.findOne.mockRejectedValue(error);

    await expect(
      controller.findOne(
        request as Parameters<ProductsController['findOne']>[0],
        productId,
      ),
    ).rejects.toBe(error);
  });

  it('valida el id de detalle con ParseUUIDPipe', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProductsController,
      'findOne',
    ) as Record<string, { data?: string; pipes?: unknown[] }>;

    const idParam = Object.values(metadata).find(
      (value) => value.data === 'id',
    );

    expect(idParam?.pipes).toContain(ParseUUIDPipe);
  });

  it('mantiene low-stock como ruta estatica antes de la ruta dinamica', () => {
    const routeOrder = Object.getOwnPropertyNames(
      ProductsController.prototype,
    ).filter((methodName) => methodName !== 'constructor');

    expect(routeOrder.indexOf('findLowStock')).toBeLessThan(
      routeOrder.indexOf('findOne'),
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, getRouteHandler('findLowStock')),
    ).toBe('low-stock');
    expect(Reflect.getMetadata(PATH_METADATA, getRouteHandler('findOne'))).toBe(
      ':id',
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, getRouteHandler('findLowStock')),
    ).toBe(RequestMethod.GET);
  });

  it('consulta productos con el companyId autenticado', async () => {
    const products = [product];

    productsServiceMock.findAll.mockResolvedValue(products);

    const result = await controller.findAll(
      request as Parameters<ProductsController['findAll']>[0],
    );

    expect(productsServiceMock.findAll).toHaveBeenCalledWith(companyId);
    expect(result).toEqual(products);
  });

  it('consulta productos de bajo stock con el companyId autenticado', async () => {
    const products = [product];

    productsServiceMock.lowStock.mockResolvedValue(products);

    const result = await controller.findLowStock(
      request as Parameters<ProductsController['findLowStock']>[0],
    );

    expect(productsServiceMock.lowStock).toHaveBeenCalledWith(companyId);
    expect(productsServiceMock.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(products);
  });

  it('crea productos con el companyId autenticado', async () => {
    productsServiceMock.create.mockResolvedValue(product);

    const result = await controller.create(
      request as Parameters<ProductsController['create']>[0],
      createProductDto,
    );

    expect(productsServiceMock.create).toHaveBeenCalledWith(
      companyId,
      createProductDto,
    );
    expect(result).toEqual(product);
  });

  it('actualiza productos con companyId autenticado y productId de ruta', async () => {
    productsServiceMock.update.mockResolvedValue(product);

    const result = await controller.update(
      request as Parameters<ProductsController['update']>[0],
      productId,
      updateProductDto,
    );

    expect(productsServiceMock.update).toHaveBeenCalledWith(
      companyId,
      productId,
      updateProductDto,
    );
    expect(result).toEqual(product);
  });
});
