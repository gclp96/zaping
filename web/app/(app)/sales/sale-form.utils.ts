import type { SaleProduct } from './types';

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isGenericSaleCompatibleProduct(
  product: SaleProduct,
): boolean {
  return (
    product.isActive !== false &&
    product.inventoryTracking === 'QUANTITY' &&
    product.lotTracking !== 'REQUIRED'
  );
}

export function getCompatibleSalesProducts(
  products: SaleProduct[],
): SaleProduct[] {
  return products.filter(isGenericSaleCompatibleProduct);
}
