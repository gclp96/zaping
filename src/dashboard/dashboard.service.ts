import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const [customers, products, quotes, purchases, lowStockProducts] =
      await Promise.all([
        this.prisma.customer.count({
          where: { companyId },
        }),

        this.prisma.product.count({
          where: { companyId },
        }),

        this.prisma.quote.count({
          where: { companyId },
        }),

        this.prisma.purchase.count({
          where: { companyId },
        }),

        this.prisma.product.findMany({
          where: {
            companyId,
            stock: {
              lte: 2,
            },
          },
        }),
      ]);

    const inventory = await this.prisma.product.findMany({
      where: { companyId },
    });

    const inventoryValue = inventory.reduce(
      (sum, product) => sum + product.stock * product.cost,
      0,
    );

    return {
      customers,
      products,
      quotes,
      purchases,
      inventoryValue,
      lowStockProducts: lowStockProducts.length,
    };
  }
}
