import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

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

  update(companyId: string, productId: string, data: any) {
    return this.prisma.product.update({
      where: {
        id: productId,
      },

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data,
    });
  }

  remove(companyId: string, productId: string) {
    return this.prisma.product.delete({
      where: {
        id: productId,
      },
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
}
