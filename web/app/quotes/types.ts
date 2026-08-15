export type QuoteStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'CANCELLED';

export type Customer = {
  id: string;
  name: string;
  type?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive?: boolean;
};

export type QuoteItemProduct = {
  id: string;
  sku: string;
  name: string;
};

export type QuoteItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
  product: QuoteItemProduct;
};

export type Quote = {
  id: string;
  companyId: string;
  customerId: string;
  folio: string;

  subtotal: number;
  iva: number;
  total: number;

  status: QuoteStatus;
  convertedToSale: boolean;

  createdAt: string;
  updatedAt: string;

  customer: Customer;
  items: QuoteItem[];
};

export type QuoteFormItem = {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export type CreateQuotePayload = {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
};

export type QuoteStatusDescriptor = {
  label: string;
  tone:
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger';
};