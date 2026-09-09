import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

import { DashboardService } from './dashboard.service';

type ProductRecord = {
  id: string;
  companyId: string;
  name: string;
  stock: number;
  minStock: number;
  cost: number;
  isActive: boolean;
};

type ProductQuery = {
  where: {
    companyId: string;
    isActive?: boolean;
  };
  select: {
    id?: boolean;
    name?: boolean;
    stock: boolean;
    minStock?: boolean;
    cost?: boolean;
  };
};

type PrismaServiceMock = {
  customer: { count: jest.Mock };
  supplier: { count: jest.Mock };
  product: { count: jest.Mock; findMany: jest.Mock };
  quote: { count: jest.Mock };
  purchase: { count: jest.Mock };
  sale: { count: jest.Mock };
};

describe('DashboardService', () => {
  const companyId = '33333333-3333-4333-8333-333333333333';

  let service: DashboardService;
  let prisma: PrismaServiceMock;

  beforeEach(() => {
    prisma = {
      customer: { count: jest.fn().mockResolvedValue(0) },
      supplier: { count: jest.fn().mockResolvedValue(0) },
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      quote: { count: jest.fn().mockResolvedValue(0) },
      purchase: { count: jest.fn().mockResolvedValue(0) },
      sale: { count: jest.fn().mockResolvedValue(0) },
    };

    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    {
      role: UserRole.ADMIN,
      commercialMetrics: true,
      purchaseMetrics: true,
    },
    {
      role: UserRole.MANAGER,
      commercialMetrics: true,
      purchaseMetrics: true,
    },
    {
      role: UserRole.SALES,
      commercialMetrics: true,
      purchaseMetrics: false,
    },
    {
      role: UserRole.WAREHOUSE,
      commercialMetrics: false,
      purchaseMetrics: true,
    },
  ])(
    'returns only domain metrics allowed for $role while preserving common metrics',
    async ({ role, commercialMetrics, purchaseMetrics }) => {
      prisma.product.count.mockResolvedValue(4);
      prisma.quote.count.mockResolvedValue(7);
      prisma.purchase.count.mockResolvedValue(5);
      prisma.sale.count.mockResolvedValue(6);

      const result = await service.get(companyId, role);

      expect(result.totals.products).toBe(4);
      expect(result.inventoryValue).toBe(0);
      expect(result.lowStockProducts).toBe(0);
      expect(result.lowStock).toEqual([]);
      if (commercialMetrics) {
        expect(result.totals).toHaveProperty('quotes', 7);
        expect(result.totals).toHaveProperty('sales', 6);
      } else {
        expect(result.totals).not.toHaveProperty('quotes');
        expect(result.totals).not.toHaveProperty('sales');
      }

      if (purchaseMetrics) {
        expect(result.totals).toHaveProperty('purchases', 5);
      } else {
        expect(result.totals).not.toHaveProperty('purchases');
      }
      expect(result.totals.quotes).toBe(commercialMetrics ? 7 : undefined);
      expect(result.totals.sales).toBe(commercialMetrics ? 6 : undefined);
      expect(result.totals.purchases).toBe(purchaseMetrics ? 5 : undefined);

      expect(prisma.quote.count).toHaveBeenCalledTimes(
        commercialMetrics ? 1 : 0,
      );
      expect(prisma.sale.count).toHaveBeenCalledTimes(
        commercialMetrics ? 1 : 0,
      );
      expect(prisma.purchase.count).toHaveBeenCalledTimes(
        purchaseMetrics ? 1 : 0,
      );
      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: { companyId },
      });
      expect(prisma.supplier.count).toHaveBeenCalledWith({
        where: { companyId },
      });
      expect(prisma.product.count).toHaveBeenCalledWith({
        where: { companyId, isActive: true },
      });

      if (commercialMetrics) {
        expect(prisma.quote.count).toHaveBeenCalledWith({
          where: { companyId },
        });
        expect(prisma.sale.count).toHaveBeenCalledWith({
          where: { companyId },
        });
      }

      if (purchaseMetrics) {
        expect(prisma.purchase.count).toHaveBeenCalledWith({
          where: { companyId },
        });
      }
    },
  );

  it('excludes inactive products from totals, stock alerts, and inventory value', async () => {
    const products: ProductRecord[] = [
      {
        id: 'active-low',
        companyId,
        name: 'Producto activo bajo',
        stock: 2,
        minStock: 3,
        cost: 10,
        isActive: true,
      },
      {
        id: 'active-healthy',
        companyId,
        name: 'Producto activo saludable',
        stock: 5,
        minStock: 3,
        cost: 4,
        isActive: true,
      },
      {
        id: 'inactive-out-of-stock',
        companyId,
        name: 'Producto inactivo agotado',
        stock: 0,
        minStock: 3,
        cost: 999,
        isActive: false,
      },
      {
        id: 'inactive-valued',
        companyId,
        name: 'Producto inactivo con valor',
        stock: 7,
        minStock: 3,
        cost: 100,
        isActive: false,
      },
    ];
    const filterProducts = (where: ProductQuery['where']) =>
      products.filter(
        (product) =>
          product.companyId === where.companyId &&
          (where.isActive === undefined || product.isActive === where.isActive),
      );

    prisma.product.count.mockImplementation(
      ({ where }: Pick<ProductQuery, 'where'>) => filterProducts(where).length,
    );
    prisma.product.findMany.mockImplementation((query: ProductQuery) => {
      const matchingProducts = filterProducts(query.where);

      if (query.select.cost) {
        return matchingProducts.map(({ stock, cost }) => ({ stock, cost }));
      }

      return matchingProducts.map(({ id, name, stock, minStock }) => ({
        id,
        name,
        stock,
        minStock,
      }));
    });

    const result = await service.get(companyId, UserRole.ADMIN);

    expect(result.totals.products).toBe(2);
    expect(result.lowStockProducts).toBe(1);
    expect(result.lowStock).toEqual([
      {
        id: 'active-low',
        name: 'Producto activo bajo',
        stock: 2,
        minStock: 3,
      },
    ]);
    expect(
      result.lowStock.filter((product) => product.stock <= 0),
    ).toHaveLength(0);
    expect(result.inventoryValue).toBe(40);

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { companyId, isActive: true },
    });
    expect(prisma.product.findMany).toHaveBeenNthCalledWith(1, {
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
    expect(prisma.product.findMany).toHaveBeenNthCalledWith(2, {
      where: { companyId, isActive: true },
      select: {
        stock: true,
        cost: true,
      },
    });
  });
});
