import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const description = dto.description?.trim();

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        companyId,
        name,
      },
    });

    if (existingCategory) {
      throw new BadRequestException('La categoría ya existe');
    }

    return this.prisma.category.create({
      data: {
        companyId,
        name,
        description: description || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.category.findMany({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async update(companyId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(companyId, id);

    const name = dto.name?.trim();
    const description = dto.description?.trim();

    if (name) {
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          companyId,
          name,
          NOT: {
            id,
          },
        },
      });

      if (existingCategory) {
        throw new BadRequestException('La categoría ya existe');
      }
    }

    const updateResult = await this.prisma.category.updateMany({
      where: {
        id,
        companyId,
      },
      data: {
        ...(name ? { name } : {}),
        ...(dto.description !== undefined
          ? { description: description || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    if (updateResult.count === 0) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return this.findOne(companyId, id);
  }

  async remove(companyId: string, id: string) {
    const category = await this.findOne(companyId, id);

    const productsCount = await this.prisma.product.count({
      where: {
        categoryId: id,
        companyId,
      },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        'No se puede eliminar la categoría porque tiene productos asociados',
      );
    }

    const deleteResult = await this.prisma.category.deleteMany({
      where: {
        id,
        companyId,
      },
    });

    if (deleteResult.count === 0) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }
}
