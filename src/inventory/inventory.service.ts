import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createMovement(companyId: string, data: any) {
    const product = await this.prisma.product.findFirst({
      where: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: data.productId,
        companyId,
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    let newStock = product.stock;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.type === 'IN') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      newStock += data.quantity;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.type === 'OUT') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (product.stock < data.quantity) {
        throw new Error('Stock insuficiente');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      newStock -= data.quantity;
    }

    const movement = await this.prisma.inventoryMovement.create({
      data: {
        companyId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        productId: data.productId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        type: data.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        quantity: data.quantity,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        notes: data.notes,
      },
    });

    await this.prisma.product.update({
      where: {
        id_companyId: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          id: data.productId,
          companyId,
        },
      },
      data: {
        stock: newStock,
      },
    });

    return movement;
  }

  findMovements(companyId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        companyId,
      },

      include: {
        product: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
