import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const [
      totalCustomers,
      totalSuppliers,
      totalProducts,
      totalQuotes,
      totalPurchases,
      totalSales,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: { companyId },
      }),

      this.prisma.supplier.count({
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

      this.prisma.sale.count({
        where: { companyId },
      }),
    ]);

    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        companyId,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        minStock: true,
      },
    });

    const lowStock = lowStockProducts.filter(
      (product) => product.stock <= product.minStock,
    );

    const inventory = await this.prisma.product.findMany({
      where: { companyId },
      select: {
        stock: true,
        cost: true,
      },
    });

    const inventoryValue = inventory.reduce(
      (sum, product) => sum + product.stock * product.cost,
      0,
    );

    return {
      totals: {
        customers: totalCustomers,
        suppliers: totalSuppliers,
        products: totalProducts,
        quotes: totalQuotes,
        purchases: totalPurchases,
        sales: totalSales,
      },
      inventoryValue,
      lowStockProducts: lowStock.length,
      lowStock,
    };
  }
}
