import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

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

  create(companyId: string, data: any) {
    return this.prisma.product.create({
      data: {
        companyId,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        sku: data.sku,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        name: data.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        description: data.description,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        category: data.category,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        barcode: data.barcode,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        cost: data.cost,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        price: data.price,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        stock: data.stock,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        minStock: data.minStock,
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
