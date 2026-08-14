import { Test, TestingModule } from '@nestjs/testing';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the category id and company id when updating', async () => {
    const req = {
      user: {
        companyId: 'company-1',
      },
    };

    const dto = {
      name: 'Implantes',
    };

    await controller.update(req, 'category-1', dto);

    expect(service.update).toHaveBeenCalledWith('company-1', 'category-1', dto);
  });

  it('passes the category id and company id when deleting', async () => {
    const req = {
      user: {
        companyId: 'company-1',
      },
    };

    await controller.remove(req, 'category-1');

    expect(service.remove).toHaveBeenCalledWith('company-1', 'category-1');
  });
});
