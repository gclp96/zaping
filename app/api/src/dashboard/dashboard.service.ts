import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string, role: UserRole) {
    const canReadCommercialMetrics = role !== UserRole.WAREHOUSE;
    const canReadPurchaseMetrics = role !== UserRole.SALES;
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
        where: { companyId, isActive: true },
      }),

      canReadCommercialMetrics
        ? this.prisma.quote.count({
            where: { companyId },
          })
        : Promise.resolve(undefined),

      canReadPurchaseMetrics
        ? this.prisma.purchase.count({
            where: { companyId },
          })
        : Promise.resolve(undefined),

      canReadCommercialMetrics
        ? this.prisma.sale.count({
            where: { companyId },
          })
        : Promise.resolve(undefined),
    ]);

    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
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
      where: { companyId, isActive: true },
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
        ...(totalQuotes === undefined ? {} : { quotes: totalQuotes }),
        ...(totalPurchases === undefined ? {} : { purchases: totalPurchases }),
        ...(totalSales === undefined ? {} : { sales: totalSales }),
      },
      inventoryValue,
      lowStockProducts: lowStock.length,
      lowStock,
    };
  }
}
