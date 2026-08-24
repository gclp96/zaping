import type { StatusTone } from '@/app/components/business/StatusBadge';

export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export type SaleCustomer = {
  id: string;
  name: string;
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
