import type { StatusTone } from '@/app/components/business/StatusBadge';

export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export type ProductInventoryTracking =
  | 'QUANTITY'
  | 'ASSET'
  | 'SERIALIZED';

export type ProductLotTracking =
  | 'NONE'
  | 'OPTIONAL'
  | 'REQUIRED';

export type SaleCustomer = {
  id: string;
  name: string;
  type?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type SaleProduct = {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  brand?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive?: boolean;
  inventoryTracking: ProductInventoryTracking;
  lotTracking: ProductLotTracking;
};

export type SaleItemProduct = {
  id: string;
  sku?: string | null;
  name: string;
};

export type SaleItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
  product?: SaleItemProduct | null;
};

export type Sale = {
  id: string;
  companyId: string;
  folio: string;
  customerId: string;
  quoteId?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  status: SaleStatus;
  createdAt: string;
  updatedAt: string;
  customer?: SaleCustomer | null;
  items: SaleItem[];
};

export type SaleStatusDescriptor = {
  label: string;
  tone: StatusTone;
};

export type SaleFormItem = {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  stock: number;
  subtotal: number;
};

export type CreateSalePayload = {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};
