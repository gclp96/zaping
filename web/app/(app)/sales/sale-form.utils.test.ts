import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getCompatibleSalesProducts,
  isGenericSaleCompatibleProduct,
} from './sale-form.utils';

import type { SaleProduct } from './types';

function createProduct(
  overrides: Partial<SaleProduct>,
): SaleProduct {
  return {
    id: 'product-1',
    sku: 'SKU-001',
    name: 'Producto médico',
    cost: 50,
    price: 100,
    stock: 10,
    minStock: 2,
    isActive: true,
    inventoryTracking: 'QUANTITY',
    lotTracking: 'OPTIONAL',
    ...overrides,
  };
}

describe('Sales product eligibility', () => {
  it('allows QUANTITY products without lot tracking', () => {
    expect(
      isGenericSaleCompatibleProduct(
        createProduct({
          inventoryTracking: 'QUANTITY',
          lotTracking: 'NONE',
        }),
      ),
    ).toBe(true);
  });

  it('allows QUANTITY products with optional lot tracking', () => {
    expect(
      isGenericSaleCompatibleProduct(
        createProduct({
          inventoryTracking: 'QUANTITY',
          lotTracking: 'OPTIONAL',
        }),
      ),
    ).toBe(true);
  });

  it('hides ASSET products from generic Sales', () => {
    expect(
      isGenericSaleCompatibleProduct(
        createProduct({
          inventoryTracking: 'ASSET',
        }),
      ),
    ).toBe(false);
  });

  it('hides SERIALIZED products from generic Sales', () => {
    expect(
      isGenericSaleCompatibleProduct(
        createProduct({
          inventoryTracking: 'SERIALIZED',
        }),
      ),
    ).toBe(false);
  });

  it('hides QUANTITY products that require lot selection', () => {
    expect(
      isGenericSaleCompatibleProduct(
        createProduct({
          inventoryTracking: 'QUANTITY',
          lotTracking: 'REQUIRED',
        }),
      ),
    ).toBe(false);
  });

  it('does not mutate returned Product data while filtering', () => {
    const products = [
      createProduct({
        id: 'quantity-none',
        lotTracking: 'NONE',
      }),
      createProduct({
        id: 'asset',
        inventoryTracking: 'ASSET',
      }),
    ];

    const before = structuredClone(products);

    expect(getCompatibleSalesProducts(products)).toEqual([
      products[0],
    ]);
    expect(products).toEqual(before);
  });
});
