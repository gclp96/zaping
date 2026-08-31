import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { api } from '@/services/api';

import { formatReceiptMoney } from '../receipt-display';
import type {
  PurchaseReceiptDetail,
  ReceiptEquipmentAsset,
} from '../types';
import PurchaseReceiptDetailPage from './page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'receipt-quantity' }),
}));

const product = {
  id: 'product-quantity',
  sku: 'LF1837',
  name: 'BLUNT TIP',
};

const quantityReceipt: PurchaseReceiptDetail = {
  id: 'receipt-quantity',
  purchaseId: 'purchase-quantity',
  folio: 'REC-20260826-4D1F98E8',
  receivedAt: '2026-08-26T18:00:00.000Z',
  receivedBy: 'user-quantity',
  notes: 'Recepción de insumo clínico',
  receivedByUser: {
    id: 'user-quantity',
    firstName: 'Leonardo',
    lastName: 'Garnica',
    email: 'leonardo@example.com',
  },
  purchase: {
    id: 'purchase-quantity',
    folio: 'OC-20260826-001',
    status: 'RECEIVED',
    total: 137,
    supplier: {
      id: 'supplier-quantity',
      name: 'Proveedor médico QA',
    },
  },
  items: [
    {
      id: 'receipt-item-quantity',
      purchaseItemId: 'purchase-item-quantity',
      productId: product.id,
      quantityReceived: 1,
      lotNumber: 'ITEM-LOT-IGNORED',
      expirationDate: '2028-12-31T00:00:00.000Z',
      unitCost: 137,
      batchId: 'batch-quantity',
      product,
      batch: {
        id: 'batch-quantity',
        lotNumber: 'BATCH-LOT-PREFERRED',
        expirationDate: '2028-12-31T00:00:00.000Z',
      },
      equipmentAssets: [],
    },
  ],
  inventoryMovements: [
    {
      id: 'movement-quantity',
      productId: product.id,
      movementType: 'IN',
      quantity: 1,
      balance: 50,
      unitCost: 137,
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: 'receipt-quantity',
      notes: null,
      createdAt: '2026-08-26T18:00:01.000Z',
      product,
    },
  ],
};

function buildAsset(
  overrides: Partial<ReceiptEquipmentAsset>,
): ReceiptEquipmentAsset {
  return {
    id: 'equipment-19',
    assetCode: 'EQ-000019',
    serialNumber: 'SERIAL-019',
    lifecycle: 'ACTIVE',
    condition: 'GOOD',
    origin: 'PURCHASE_RECEIPT',
    purchaseReceiptItemId: 'receipt-item-asset',
    batchId: 'batch-asset',
    createdAt: '2026-08-24T18:00:01.000Z',
    product: {
      id: 'product-asset',
      sku: 'EQP-001',
      name: 'Equipo de monitoreo',
    },
    batch: {
      id: 'batch-asset',
      lotNumber: 'ASSET-LOT',
    },
    ...overrides,
  };
}

const assetReceipt: PurchaseReceiptDetail = {
  ...quantityReceipt,
  id: 'receipt-asset',
  folio: 'REC-20260824-03A9A7F8',
  items: [
    {
      ...quantityReceipt.items[0],
      id: 'receipt-item-asset',
      productId: 'product-asset',
      lotNumber: 'ITEM-ASSET-LOT',
      batchId: null,
      product: {
        id: 'product-asset',
        sku: 'EQP-001',
        name: 'Equipo de monitoreo',
      },
      batch: null,
      equipmentAssets: [
        buildAsset({}),
        buildAsset({
          id: 'equipment-20',
          assetCode: 'EQ-000020',
          serialNumber: null,
          batchId: null,
          batch: null,
        }),
        buildAsset({
          id: 'equipment-21',
          assetCode: 'EQ-000021',
          serialNumber: 'SERIAL-021',
          lifecycle: 'RETIRED',
          condition: 'DAMAGED',
          batchId: null,
          batch: null,
        }),
      ],
    },
  ],
  inventoryMovements: [
    {
      ...quantityReceipt.inventoryMovements[0],
      id: 'movement-asset',
      productId: 'product-asset',
      quantity: 3,
      balance: 3,
      product: {
        id: 'product-asset',
        sku: 'EQP-001',
        name: 'Equipo de monitoreo',
      },
    },
  ],
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('PurchaseReceiptDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: quantityReceipt } as never);
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('presenta la recepción QUANTITY y su movimiento IN sin inventar equipos', async () => {
    render(<PurchaseReceiptDetailPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Recepción REC-20260826-4D1F98E8',
      }),
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(
      '/purchase-receipts/receipt-quantity',
    );
    expect(screen.getByText('Leonardo Garnica')).toBeTruthy();
    expect(screen.getByText('Recepción de insumo clínico')).toBeTruthy();
    expect(screen.getByText('OC-20260826-001')).toBeTruthy();
    expect(screen.getByText('Proveedor médico QA')).toBeTruthy();
    expect(screen.getByLabelText('Estado de compra: Recibida')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Ver compra' }).getAttribute('href'),
    ).toBe('/purchases/purchase-quantity');
    expect(
      screen
        .getByRole('link', { name: 'Ver en inventario' })
        .getAttribute('href'),
    ).toBe(
      '/inventory?tab=movements&referenceType=PURCHASE_RECEIPT&referenceId=receipt-quantity&receiptFolio=REC-20260826-4D1F98E8',
    );
    expect(screen.getAllByText('LF1837').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BLUNT TIP').length).toBeGreaterThan(0);
    expect(screen.getByText('BATCH-LOT-PREFERRED')).toBeTruthy();
    expect(screen.queryByText('ITEM-LOT-IGNORED')).toBeNull();
    expect(
      screen.getAllByText(formatReceiptMoney(137)).length,
    ).toBeGreaterThan(1);
    expect(screen.getByLabelText('Tipo de movimiento: Entrada')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(
      screen.queryByText(
        'No hay movimientos de inventario asociados a esta recepción.',
      ),
    ).toBeNull();
    expect(screen.getByText('Esta recepción no generó equipos.')).toBeTruthy();
  });

  it('aplana y traduce los equipos generados por una recepción ASSET', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: assetReceipt } as never);

    render(<PurchaseReceiptDetailPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Recepción REC-20260824-03A9A7F8',
      }),
    ).toBeTruthy();
    expect(screen.getByText('EQ-000019')).toBeTruthy();
    expect(screen.getByText('EQ-000020')).toBeTruthy();
    expect(screen.getByText('EQ-000021')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Ver equipo EQ-000019' })
        .getAttribute('href'),
    ).toBe('/equipment?assetId=equipment-19');
    expect(screen.getByText('SERIAL-019')).toBeTruthy();
    expect(
      screen.getByLabelText('Estado del equipo EQ-000019: Activo'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Estado del equipo EQ-000021: Retirado'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Condición del equipo EQ-000021: Dañado'),
    ).toBeTruthy();
    expect(
      screen.getAllByText('Recepción de compra').length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('ASSET-LOT')).toBeTruthy();
    expect(
      screen.getAllByText('ITEM-ASSET-LOT').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('trata la ausencia histórica de movimientos y equipos como estados normales', async () => {
    const historicalReceipt: PurchaseReceiptDetail = {
      ...quantityReceipt,
      id: 'receipt-historical',
      folio: 'REC-HISTORICAL',
      items: quantityReceipt.items.map((item) => ({
        ...item,
        equipmentAssets: [],
      })),
      inventoryMovements: [],
    };
    vi.mocked(api.get).mockResolvedValue({ data: historicalReceipt } as never);

    render(<PurchaseReceiptDetailPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Recepción REC-HISTORICAL',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'No hay movimientos de inventario asociados a esta recepción.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Esta recepción no generó equipos.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('muestra el error de detalle, conserva Volver y permite reintentar', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Recepción no encontrada'))
      .mockResolvedValueOnce({ data: quantityReceipt } as never);

    render(<PurchaseReceiptDetailPage />);

    expect(await screen.findByText('Recepción no encontrada')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe(
      '/purchase-receipts',
    );

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Recepción REC-20260826-4D1F98E8',
      }),
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
