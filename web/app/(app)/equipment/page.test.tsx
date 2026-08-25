import {
  cleanup,
  render,
  screen,
  within,
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

import { formatEquipmentDate } from './equipment-display';
import EquipmentPage from './page';

import type {
  EquipmentAsset,
  EquipmentAssetDetail,
  EquipmentBatch,
  EquipmentProduct,
} from './types';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function buildProduct(
  overrides: Partial<EquipmentProduct> = {},
): EquipmentProduct {
  return {
    id: 'product-equipment',
    companyId: 'company-1',
    sku: 'EQP-001',
    name: 'EQUIPO DE PRUEBA',
    description: null,
    brand: 'Marca médica',
    categoryId: null,
    barcode: null,
    cost: 1000,
    price: 1500,
    stock: 1,
    minStock: 0,
    isActive: true,
    inventoryTracking: 'ASSET',
    lotTracking: 'OPTIONAL',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-20T18:00:00.000Z',
    ...overrides,
  };
}

function buildBatch(
  overrides: Partial<EquipmentBatch> = {},
): EquipmentBatch {
  return {
    id: 'batch-1',
    companyId: 'company-1',
    productId: 'product-equipment',
    lotNumber: 'LOT-EQ-001',
    expirationDate: null,
    initialQuantity: 2,
    availableQuantity: 0,
    unitCost: 1000,
    receivedAt: '2026-08-15T18:00:00.000Z',
    notes: null,
    isActive: true,
    createdAt: '2026-08-15T18:00:00.000Z',
    updatedAt: '2026-08-15T18:00:00.000Z',
    ...overrides,
  };
}

function buildEquipment(
  overrides: Partial<EquipmentAsset> = {},
): EquipmentAsset {
  return {
    id: 'equipment-1',
    companyId: 'company-1',
    productId: 'product-equipment',
    assetCode: 'EQ-000001',
    serialNumber: 'SN-EQ-001',
    serialNumberKey: 'SN-EQ-001',
    lifecycle: 'ACTIVE',
    condition: 'GOOD',
    origin: 'PURCHASE_RECEIPT',
    batchId: 'batch-1',
    purchaseReceiptItemId:
      '658dc34b-1111-2222-3333-444444444444',
    retiredAt: null,
    retiredById: null,
    retiredReason: null,
    retirementNotes: null,
    createdAt: '2026-08-20T18:00:00.000Z',
    updatedAt: '2026-08-20T18:00:00.000Z',
    product: buildProduct(),
    batch: buildBatch(),
    ...overrides,
  };
}

const purchaseReceiptEquipment = buildEquipment();
const manualEquipment = buildEquipment({
  id: 'equipment-2',
  assetCode: 'EQ-000002',
  productId: 'product-other',
  serialNumber: null,
  serialNumberKey: null,
  lifecycle: 'RETIRED',
  condition: 'DAMAGED',
  origin: 'MANUAL',
  batchId: null,
  purchaseReceiptItemId: null,
  retiredAt: '2026-08-21T18:00:00.000Z',
  retiredById: 'user-1',
  retiredReason: 'END_OF_LIFE',
  retirementNotes: 'Fin de vida útil',
  product: buildProduct({
    id: 'product-other',
    sku: 'ALT-002',
    name: 'MONITOR RETIRADO',
  }),
  batch: null,
});

const equipmentList = [purchaseReceiptEquipment, manualEquipment];

const equipmentDetails: Record<string, EquipmentAssetDetail> = {
  'equipment-1': {
    ...purchaseReceiptEquipment,
    serialNumber: 'DETAIL-SN-001',
    serialNumberKey: 'DETAIL-SN-001',
    inspections: [
      {
        id: 'inspection-1',
        companyId: 'company-1',
        equipmentAssetId: 'equipment-1',
        conditionBefore: 'INSPECTION_PENDING',
        conditionAfter: 'GOOD',
        inspectedAt: '2026-08-20T17:00:00.000Z',
        inspectedById: 'user-1',
        notes: 'Inspección no visible en B.5E',
        createdAt: '2026-08-20T17:00:00.000Z',
      },
    ],
  },
  'equipment-2': {
    ...manualEquipment,
    inspections: [],
  },
};

function configureApiMocks({
  list = equipmentList,
  details = equipmentDetails,
  listError,
}: {
  list?: EquipmentAsset[];
  details?: Record<string, EquipmentAssetDetail>;
  listError?: Error;
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/equipment') {
      if (listError) {
        throw listError;
      }

      return { data: list } as never;
    }

    if (endpoint.startsWith('/equipment/')) {
      const equipmentId = endpoint.replace('/equipment/', '');
      const detail = details[equipmentId];

      if (detail) {
        return { data: detail } as never;
      }
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });
}

async function renderEquipmentPage() {
  render(<EquipmentPage />);
  await screen.findByText('EQ-000001');
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('EquipmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureApiMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('carga y presenta la lista read-only con relaciones y fallbacks', async () => {
    render(<EquipmentPage />);

    expect(screen.getByText('Cargando equipos...')).toBeTruthy();
    expect(await screen.findByText('EQ-000001')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/equipment');
    expect(screen.getByText('EQUIPO DE PRUEBA')).toBeTruthy();
    expect(screen.getByText('EQP-001')).toBeTruthy();
    expect(screen.getByText('SN-EQ-001')).toBeTruthy();
    expect(screen.getByText('Sin serie')).toBeTruthy();
    expect(
      screen.getByLabelText('Estado del equipo EQ-000001: Activo'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Condición del equipo EQ-000002: Dañado'),
    ).toBeTruthy();
    expect(
      screen.getAllByText('Recepción de compra').length,
    ).toBeGreaterThan(1);
    expect(screen.getAllByText('Registro manual').length).toBeGreaterThan(1);
    expect(screen.getByText('LOT-EQ-001')).toBeTruthy();
    expect(screen.getByText('Sin lote')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Ver equipo EQ-000001',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /crear/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /retirar/i })).toBeNull();
  });

  it('distingue vacío real de error y permite reintentar la lista', async () => {
    let attempts = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) !== '/equipment') {
        throw new Error(`Solicitud no esperada: ${String(url)}`);
      }

      attempts += 1;

      if (attempts === 1) {
        throw new Error('Equipos no disponibles');
      }

      return { data: [] } as never;
    });

    const user = userEvent.setup();
    render(<EquipmentPage />);

    expect(await screen.findByText('Equipos no disponibles')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Sin equipos registrados')).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it.each([
    ['  eq-000001  ', 'EQ-000001', 'EQ-000002'],
    ['sn-eq-001', 'EQ-000001', 'EQ-000002'],
    ['equipo de prueba', 'EQ-000001', 'EQ-000002'],
    ['alt-002', 'EQ-000002', 'EQ-000001'],
  ])(
    'busca por el término %s sin distinguir mayúsculas',
    async (term, expectedCode, hiddenCode) => {
      const user = userEvent.setup();
      await renderEquipmentPage();

      await user.type(
        screen.getByRole('searchbox', { name: 'Buscar equipos' }),
        term,
      );

      expect(screen.getByText(expectedCode)).toBeTruthy();
      expect(screen.queryByText(hiddenCode)).toBeNull();
    },
  );

  it('filtra por lifecycle, condición y origen, y permite limpiar filtros', async () => {
    const user = userEvent.setup();
    await renderEquipmentPage();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'RETIRED',
    );
    expect(screen.getByText('EQ-000002')).toBeTruthy();
    expect(screen.queryByText('EQ-000001')).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Limpiar filtros' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Condición' }),
      'GOOD',
    );
    expect(screen.getByText('EQ-000001')).toBeTruthy();
    expect(screen.queryByText('EQ-000002')).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Limpiar filtros' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Origen' }),
      'MANUAL',
    );
    expect(screen.getByText('EQ-000002')).toBeTruthy();
    expect(screen.queryByText('EQ-000001')).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Limpiar filtros' }),
    );
    expect(screen.getByText('EQ-000001')).toBeTruthy();
    expect(screen.getByText('EQ-000002')).toBeTruthy();
  });

  it('diferencia filtros sin coincidencias del inventario vacío', async () => {
    const user = userEvent.setup();
    await renderEquipmentPage();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Condición' }),
      'OUT_OF_SERVICE',
    );

    expect(screen.getByText('Sin equipos coincidentes')).toBeTruthy();
    expect(screen.queryByText('Sin equipos registrados')).toBeNull();
  });

  it('consulta y presenta el contrato de detalle con trazabilidad compacta', async () => {
    const user = userEvent.setup();
    await renderEquipmentPage();

    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );

    expect(api.get).toHaveBeenCalledWith('/equipment/equipment-1');
    expect(
      await screen.findByRole('heading', {
        name: 'Detalle del equipo EQ-000001',
      }),
    ).toBeTruthy();
    const detailRegion = screen.getByRole('region', {
      name: 'Información del equipo',
    });

    expect(within(detailRegion).getByText('EQ-000001')).toBeTruthy();
    expect(within(detailRegion).getByText('EQUIPO DE PRUEBA')).toBeTruthy();
    expect(within(detailRegion).getByText('EQP-001')).toBeTruthy();
    expect(within(detailRegion).getByText('DETAIL-SN-001')).toBeTruthy();
    expect(
      within(detailRegion).getByLabelText('Estado del equipo: Activo'),
    ).toBeTruthy();
    expect(
      within(detailRegion).getByLabelText('Condición del equipo: Bueno'),
    ).toBeTruthy();
    expect(within(detailRegion).getByText('Recepción de compra')).toBeTruthy();
    expect(within(detailRegion).getByText('LOT-EQ-001')).toBeTruthy();
    expect(
      within(detailRegion).getByText(
        formatEquipmentDate(purchaseReceiptEquipment.createdAt),
      ),
    ).toBeTruthy();
    expect(within(detailRegion).getByText('ID 658dc34b…')).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Identificador de partida de recepción: ${purchaseReceiptEquipment.purchaseReceiptItemId}`,
      ),
    ).toBeTruthy();
    expect(
      within(detailRegion).queryByText('Inspección no visible en B.5E'),
    ).toBeNull();
    expect(within(detailRegion).queryByRole('link')).toBeNull();
    expect(
      vi.mocked(api.get).mock.calls.some(([url]) =>
        String(url).includes('/availability'),
      ),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));
    expect(
      screen.queryByRole('heading', {
        name: 'Detalle del equipo EQ-000001',
      }),
    ).toBeNull();
  });

  it('muestra carga y fallbacks nulos dentro del detalle', async () => {
    let resolveDetail: (
      value: { data: EquipmentAssetDetail },
    ) => void = () => undefined;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment') {
        return { data: equipmentList } as never;
      }

      if (endpoint === '/equipment/equipment-2') {
        return await new Promise<{ data: EquipmentAssetDetail }>((resolve) => {
          resolveDetail = resolve;
        });
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000002' }),
    );

    expect(screen.getByText('Cargando detalle del equipo...')).toBeTruthy();
    resolveDetail({ data: equipmentDetails['equipment-2'] });

    expect(await screen.findByText('Sin número de serie')).toBeTruthy();
    expect(screen.getAllByText('Sin lote').length).toBeGreaterThan(1);
    expect(screen.queryByText('Trazabilidad')).toBeNull();
  });

  it('muestra error de detalle y reintenta sin cerrar la lista', async () => {
    let detailAttempts = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment') {
        return { data: equipmentList } as never;
      }

      if (endpoint === '/equipment/equipment-1') {
        detailAttempts += 1;

        if (detailAttempts === 1) {
          throw new Error('Detalle no disponible');
        }

        return { data: equipmentDetails['equipment-1'] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );

    expect(await screen.findByText('Detalle no disponible')).toBeTruthy();
    expect(screen.getAllByText('EQ-000001').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('DETAIL-SN-001')).toBeTruthy();
    expect(detailAttempts).toBe(2);
  });
});
