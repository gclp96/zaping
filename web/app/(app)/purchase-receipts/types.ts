import type { PurchaseStatus } from '@/app/(app)/purchases/types';

export type ReceiptUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type ReceiptProduct = {
  id: string;
  sku: string;
  name: string;
};

export type ReceiptBatch = {
  id: string;
  lotNumber: string;
  expirationDate?: string | null;
};

export type ReceiptEquipmentAsset = {
  id: string;
  assetCode: string;
  serialNumber: string | null;
  lifecycle: string;
  condition: string;
  origin: string;
  purchaseReceiptItemId: string | null;
  batchId: string | null;
  createdAt: string;
  product: ReceiptProduct;
  batch: Pick<ReceiptBatch, 'id' | 'lotNumber'> | null;
};

export type PurchaseReceiptItem = {
  id: string;
  purchaseItemId: string;
  productId: string;
  quantityReceived: number;
  lotNumber: string | null;
  expirationDate: string | null;
  unitCost: number;
  batchId: string | null;
  product: ReceiptProduct;
  batch: ReceiptBatch | null;
  equipmentAssets: ReceiptEquipmentAsset[];
};

export type ReceiptInventoryMovement = {
  id: string;
  productId: string;
  movementType: string;
  quantity: number;
  balance: number | null;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  product: ReceiptProduct;
};

type ReceiptPurchaseSummary = {
  id: string;
  folio: string;
  status: PurchaseStatus;
  supplier: {
    id: string;
    name: string;
  };
};

type PurchaseReceiptListItemLine = Omit<
  PurchaseReceiptItem,
  'equipmentAssets'
>;

export type PurchaseReceiptListItem = {
  id: string;
  purchaseId: string;
  folio: string;
  receivedAt: string;
  receivedBy: string | null;
  notes: string | null;
  receivedByUser: ReceiptUser | null;
  purchase: ReceiptPurchaseSummary;
  items: PurchaseReceiptListItemLine[];
};

export type PurchaseReceiptDetail = {
  id: string;
  purchaseId: string;
  folio: string;
  receivedAt: string;
  receivedBy: string | null;
  notes: string | null;
  receivedByUser: ReceiptUser | null;
  purchase: ReceiptPurchaseSummary & {
    total: number;
  };
  items: PurchaseReceiptItem[];
  inventoryMovements: ReceiptInventoryMovement[];
};
