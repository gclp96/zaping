import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  create(companyId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        companyId,

        sku: dto.sku,

        name: dto.name,

        description: dto.description,

        category: dto.category,

        barcode: dto.barcode,

        cost: dto.cost,

        price: dto.price,

        stock: dto.stock,

        minStock: dto.minStock,
      },
    });
  }
  async findOne(productId: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async update(companyId: string, productId: string, dto: UpdateProductDto) {
    await this.findOne(productId, companyId);

    return this.prisma.product.update({
      where: {
        id: productId,
      },
      data: dto,
    });
  }

  async lowStock(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
      },
    });

    return products.filter((product) => product.stock <= product.minStock);
  }

  async remove(companyId: string, productId: string) {
    await this.findOne(productId, companyId);

    return this.prisma.product.delete({
      where: {
        id: productId,
      },
    });
  }
}
