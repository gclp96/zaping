import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    product: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a category with normalized schema fields', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({
      id: 'category-1',
      companyId: 'company-1',
      name: 'Material Quirúrgico',
      description: 'Uso general',
      isActive: true,
    });

    await expect(
      service.create('company-1', {
        name: ' Material Quirúrgico ',
        description: ' Uso general ',
        isActive: true,
      }),
    ).resolves.toEqual({
      id: 'category-1',
      companyId: 'company-1',
      name: 'Material Quirúrgico',
      description: 'Uso general',
      isActive: true,
    });

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        name: 'Material Quirúrgico',
        description: 'Uso general',
        isActive: true,
      },
    });
  });

  it('updates a category scoped by id and company', async () => {
    prisma.category.findFirst
      .mockResolvedValueOnce({ id: 'category-1', companyId: 'company-1' })
      .mockResolvedValueOnce(null);
    prisma.category.update.mockResolvedValue({
      id: 'category-1',
      companyId: 'company-1',
      name: 'Implantes',
      description: null,
      isActive: true,
    });

    await expect(
      service.update('company-1', 'category-1', { name: ' Implantes ' }),
    ).resolves.toEqual({
      id: 'category-1',
      companyId: 'company-1',
      name: 'Implantes',
      description: null,
      isActive: true,
    });

    expect(prisma.category.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'category-1',
        companyId: 'company-1',
      },
    });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: {
        id: 'category-1',
      },
      data: {
        name: 'Implantes',
      },
    });
  });

  it('removes a category scoped by id and company when it has no products', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-1',
      companyId: 'company-1',
    });
    prisma.product.count.mockResolvedValue(0);
    prisma.category.delete.mockResolvedValue({
      id: 'category-1',
      companyId: 'company-1',
    });

    await expect(service.remove('company-1', 'category-1')).resolves.toEqual({
      id: 'category-1',
      companyId: 'company-1',
    });

    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'category-1',
        companyId: 'company-1',
      },
    });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        categoryId: 'category-1',
        companyId: 'company-1',
      },
    });
    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: {
        id: 'category-1',
      },
    });
  });
});
