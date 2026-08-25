export type EquipmentLifecycle = 'ACTIVE' | 'RETIRED';

export type EquipmentCondition =
  | 'GOOD'
  | 'INSPECTION_PENDING'
  | 'DAMAGED'
  | 'OUT_OF_SERVICE';

export type EquipmentOrigin =
  | 'MANUAL'
  | 'PURCHASE_RECEIPT'
  | 'IMPORT'
  | 'INITIAL_MIGRATION';

export type EquipmentRetirementReason =
  | 'SOLD'
  | 'LOST'
  | 'DESTROYED'
  | 'END_OF_LIFE'
  | 'REPLACED'
  | 'OTHER';

export type EquipmentProduct = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  barcode: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  inventoryTracking: 'QUANTITY' | 'SERIALIZED' | 'ASSET';
  lotTracking: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  createdAt: string;
  updatedAt: string;
};

export type EquipmentBatch = {
  id: string;
  companyId: string;
  productId: string;
  lotNumber: string;
  expirationDate: string | null;
  initialQuantity: number;
  availableQuantity: number;
  unitCost: number;
  receivedAt: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentInspection = {
  id: string;
  companyId: string;
  equipmentAssetId: string;
  conditionBefore: EquipmentCondition;
  conditionAfter: EquipmentCondition;
  inspectedAt: string;
  inspectedById: string;
  notes: string | null;
  createdAt: string;
};

export type EquipmentAsset = {
  id: string;
  companyId: string;
  productId: string;
  assetCode: string;
  serialNumber: string | null;
  serialNumberKey: string | null;
  lifecycle: EquipmentLifecycle;
  condition: EquipmentCondition;
  origin: EquipmentOrigin;
  batchId: string | null;
  purchaseReceiptItemId: string | null;
  retiredAt: string | null;
  retiredById: string | null;
  retiredReason: EquipmentRetirementReason | null;
  retirementNotes: string | null;
  createdAt: string;
  updatedAt: string;
  product: EquipmentProduct;
  batch: EquipmentBatch | null;
};

export type EquipmentAssetDetail = EquipmentAsset & {
  inspections: EquipmentInspection[];
};
