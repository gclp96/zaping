import type { StatusTone } from '@/app/components/business/StatusBadge';

export type PurchaseReceiptFormField =
  | 'quantityReceived'
  | 'lotNumber'
  | 'expirationDate';

export type PurchaseReceiptFormItem = {
  purchaseItemId: string;
  productId: string;
  sku: string;
  name: string;

  orderedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;

  quantityReceived: string;
  lotNumber: string;
  expirationDate: string;
};

export type PurchaseReceiptItem = {
  id: string;
  purchaseItemId: string;
  productId: string;
  quantityReceived: number;
  lotNumber?: string | null;
  expirationDate?: string | null;
  unitCost: number;
  batchId?: string | null;

  product: {
    id: string;
    sku: string;
    name: string;
  };

  batch?: {
    id: string;
    lotNumber: string;
    expirationDate?: string | null;
    initialQuantity: number;
    availableQuantity: number;
    unitCost: number;
  } | null;
};

export type PurchaseReceipt = {
  id: string;
  purchaseId: string;
  folio: string;
  receivedAt: string;
  receivedBy?: string | null;
  notes?: string | null;
  items: PurchaseReceiptItem[];

  receivedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type InventoryMovement = {
  id: string;
  productId: string;
  movementType: string;
  quantity: number;
  balance: number;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;

  product: {
    id: string;
    sku: string;
    name: string;
  };
};

export type PurchaseItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;

  product: {
    id: string;
    sku: string;
    name: string;
  };
};

export type Purchase = {
  id: string;
  folio: string;
  status: string;
  subtotal: number;
  iva: number;
  total: number;
  createdAt: string;

  supplier: {
    id: string;
    name: string;
  };

  items: PurchaseItem[];
};

export type PurchaseStatusDescriptor = {
  label: string;
  tone: StatusTone;
};

export type Supplier = {
  id: string;
  name: string;
  email?: string | null;
  contactName?: string | null;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  cost: number;
  stock: number;
  minStock: number;
  price: number;
};

export type PurchaseFormItem = {
  productId: string;
  sku: string;
  name: string;
  quantity: string;
  unitCost: number;
};