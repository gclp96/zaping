import {
  cleanup,
  render,
  screen,
  waitFor,
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
  EquipmentAvailability,
  EquipmentBatch,
  EquipmentInspection,
  EquipmentProduct,
} from './types';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
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

const equipmentAvailability: Record<string, EquipmentAvailability> = {
  'equipment-1': {
    available: true,
    primaryReason: null,
    reasons: [],
    evaluatedAt: '2026-08-22T18:00:00.000Z',
  },
  'equipment-2': {
    available: false,
    primaryReason: 'RETIRED',
    reasons: ['RETIRED', 'DAMAGED'],
    evaluatedAt: '2026-08-22T18:05:00.000Z',
  },
};

const equipmentInspections: Record<string, EquipmentInspection[]> = {
  'equipment-1': [
    {
      id: 'inspection-api-1',
      companyId: 'company-1',
      equipmentAssetId: 'equipment-1',
      conditionBefore: 'INSPECTION_PENDING',
      conditionAfter: 'GOOD',
      inspectedAt: '2026-08-20T17:00:00.000Z',
      inspectedById: 'user-1',
      notes: 'Revisión operativa completada',
      createdAt: '2026-08-20T17:00:00.000Z',
      inspectedBy: {
        id: 'user-1',
        firstName: 'Ana',
        lastName: 'López',
        email: 'ana@example.com',
      },
    },
    {
      id: 'inspection-api-0',
      companyId: 'company-1',
      equipmentAssetId: 'equipment-1',
      conditionBefore: 'GOOD',
      conditionAfter: 'DAMAGED',
      inspectedAt: '2026-08-18T12:00:00.000Z',
      inspectedById: 'user-2',
      notes: null,
      createdAt: '2026-08-18T12:00:00.000Z',
      inspectedBy: {
        id: 'user-2',
        firstName: '',
        lastName: '',
        email: 'inspector@example.com',
      },
    },
  ],
  'equipment-2': [],
};

function configureApiMocks({
  list = equipmentList,
  details = equipmentDetails,
  availability = equipmentAvailability,
  inspections = equipmentInspections,
  products = [buildProduct()],
  listError,
  productsError,
}: {
  list?: EquipmentAsset[];
  details?: Record<string, EquipmentAssetDetail>;
  availability?: Record<string, EquipmentAvailability>;
  inspections?: Record<string, EquipmentInspection[]>;
  products?: EquipmentProduct[];
  listError?: Error;
  productsError?: Error;
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/equipment') {
      if (listError) {
        throw listError;
      }

      return { data: list } as never;
    }

    if (endpoint === '/products') {
      if (productsError) {
        throw productsError;
      }

      return { data: products } as never;
    }

    const availabilityMatch = endpoint.match(
      /^\/equipment\/([^/]+)\/availability$/,
    );

    if (availabilityMatch) {
      const result = availability[availabilityMatch[1]];

      if (result) {
        return { data: result } as never;
      }
    }

    const inspectionsMatch = endpoint.match(
      /^\/equipment\/([^/]+)\/inspections$/,
    );

    if (inspectionsMatch) {
      const result = inspections[inspectionsMatch[1]];

      if (result) {
        return { data: result } as never;
      }
    }

    const detailMatch = endpoint.match(/^\/equipment\/([^/]+)$/);

    if (detailMatch) {
      const detail = details[detailMatch[1]];

      if (detail) {
        return { data: detail } as never;
      }
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });

  vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
}

async function renderEquipmentPage() {
  render(<EquipmentPage />);
  await screen.findByText('EQ-000001');
}

async function openCreateEquipmentModal() {
  const user = userEvent.setup();

  await renderEquipmentPage();
  await user.click(screen.getByRole('button', { name: 'Nuevo equipo' }));

  return {
    user,
    form: await screen.findByRole('form', { name: 'Nuevo equipo' }),
  };
}

async function openActiveEquipmentDetail() {
  const user = userEvent.setup();

  await renderEquipmentPage();
  await user.click(
    screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
  );
  await screen.findByText('DETAIL-SN-001');

  return {
    user,
    detail: screen.getByRole('region', {
      name: 'Información del equipo',
    }),
  };
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
    expect(
      screen.getByRole('button', { name: 'Nuevo equipo' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /retirar/i })).toBeNull();
  });

  it('abre, cancela y reinicia el formulario de nuevo equipo', async () => {
    const { user, form } = await openCreateEquipmentModal();
    const productSelect = within(form).getByRole('combobox', {
      name: /Producto/,
    });
    const conditionSelect = within(form).getByRole('combobox', {
      name: /Condición inicial/,
    });
    const serialInput = within(form).getByRole('textbox', {
      name: 'Número de serie (opcional)',
    });

    expect(api.get).toHaveBeenCalledWith('/products');
    expect(
      within(productSelect).getByRole('option', {
        name: 'EQUIPO DE PRUEBA · EQP-001',
      }),
    ).toBeTruthy();
    expect(
      within(conditionSelect)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual([
      '',
      'GOOD',
      'INSPECTION_PENDING',
      'DAMAGED',
      'OUT_OF_SERVICE',
    ]);

    await user.selectOptions(productSelect, 'product-equipment');
    await user.selectOptions(conditionSelect, 'GOOD');
    await user.type(serialInput, 'SERIE-TEMPORAL');
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.queryByRole('form', { name: 'Nuevo equipo' }),
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Nuevo equipo' }));
    const reopenedForm = await screen.findByRole('form', {
      name: 'Nuevo equipo',
    });

    expect(
      (
        within(reopenedForm).getByRole('combobox', { name: /Producto/ }) as
          HTMLSelectElement
      ).value,
    ).toBe('');
    expect(
      (
        within(reopenedForm).getByRole('combobox', {
          name: /Condición inicial/,
        }) as HTMLSelectElement
      ).value,
    ).toBe('');
    expect(
      (
        within(reopenedForm).getByRole('textbox', {
          name: 'Número de serie (opcional)',
        }) as HTMLInputElement
      ).value,
    ).toBe('');
  });

  it('ofrece únicamente productos activos con seguimiento ASSET', async () => {
    const products = [
      buildProduct({
        id: 'product-quantity',
        name: 'PRODUCTO POR CANTIDAD',
        sku: 'QTY-001',
        inventoryTracking: 'QUANTITY',
      }),
      buildProduct({
        id: 'product-asset',
        name: 'EQUIPO ELEGIBLE',
        sku: 'AST-001',
        inventoryTracking: 'ASSET',
      }),
      buildProduct({
        id: 'product-inactive-asset',
        name: 'EQUIPO INACTIVO',
        sku: 'AST-002',
        inventoryTracking: 'ASSET',
        isActive: false,
      }),
      buildProduct({
        id: 'product-serialized',
        name: 'PRODUCTO SERIALIZADO',
        sku: 'SER-001',
        inventoryTracking: 'SERIALIZED',
      }),
    ];

    configureApiMocks({ products });
    const { form } = await openCreateEquipmentModal();
    const productSelect = within(form).getByRole('combobox', {
      name: /Producto/,
    });

    expect(
      within(productSelect).getByRole('option', {
        name: 'EQUIPO ELEGIBLE · AST-001',
      }),
    ).toBeTruthy();
    expect(
      within(productSelect).queryByRole('option', {
        name: /PRODUCTO POR CANTIDAD/,
      }),
    ).toBeNull();
    expect(
      within(productSelect).queryByRole('option', {
        name: /EQUIPO INACTIVO/,
      }),
    ).toBeNull();
    expect(
      within(productSelect).queryByRole('option', {
        name: /PRODUCTO SERIALIZADO/,
      }),
    ).toBeNull();
  });

  it('distingue la ausencia de productos elegibles de un error de API', async () => {
    configureApiMocks({
      products: [
        buildProduct({ inventoryTracking: 'QUANTITY' }),
        buildProduct({
          id: 'serialized-product',
          inventoryTracking: 'SERIALIZED',
        }),
      ],
    });
    const { form } = await openCreateEquipmentModal();

    expect(
      within(form).getByText(
        'No hay productos de tipo equipo disponibles para registrar.',
      ),
    ).toBeTruthy();
    expect(
      (
        within(form).getByRole('button', { name: 'Registrar equipo' }) as
          HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(within(form).queryByRole('alert')).toBeNull();
  });

  it('muestra y reintenta el error de carga de productos sin bloquear la lista', async () => {
    const defaultGet = vi.mocked(api.get).getMockImplementation();
    let productAttempts = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/products') {
        productAttempts += 1;

        if (productAttempts === 1) {
          throw new Error('Productos para equipo no disponibles');
        }

        return { data: [buildProduct()] } as never;
      }

      return await defaultGet!(url);
    });

    const { user, form } = await openCreateEquipmentModal();

    expect(
      await within(form).findByText('Productos para equipo no disponibles'),
    ).toBeTruthy();
    expect(
      within(form).queryByText(
        'No hay productos de tipo equipo disponibles para registrar.',
      ),
    ).toBeNull();
    expect(screen.getAllByText('EQ-000001').length).toBeGreaterThan(0);

    await user.click(
      within(form).getByRole('button', { name: 'Reintentar productos' }),
    );

    expect(
      await within(form).findByRole('option', {
        name: 'EQUIPO DE PRUEBA · EQP-001',
      }),
    ).toBeTruthy();
    expect(productAttempts).toBe(2);
  });

  it('envía el DTO exacto, normaliza serie y omite la serie vacía', async () => {
    const { user, form } = await openCreateEquipmentModal();
    const productSelect = within(form).getByRole('combobox', {
      name: /Producto/,
    });
    const conditionSelect = within(form).getByRole('combobox', {
      name: /Condición inicial/,
    });
    const serialInput = within(form).getByRole('textbox', {
      name: 'Número de serie (opcional)',
    });

    await user.selectOptions(productSelect, 'product-equipment');
    await user.selectOptions(conditionSelect, 'INSPECTION_PENDING');
    await user.type(serialInput, '  QA-G1-001  ');
    await user.click(
      within(form).getByRole('button', { name: 'Registrar equipo' }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/equipment', {
        productId: 'product-equipment',
        condition: 'INSPECTION_PENDING',
        serialNumber: 'QA-G1-001',
      });
    });

    const firstPayload = vi.mocked(api.post).mock.calls[0][1] as Record<
      string,
      unknown
    >;

    for (const serverField of [
      'companyId',
      'assetCode',
      'serialNumberKey',
      'lifecycle',
      'origin',
      'batchId',
      'purchaseReceiptItemId',
      'createdAt',
      'updatedAt',
    ]) {
      expect(firstPayload).not.toHaveProperty(serverField);
    }

    await waitFor(() => {
      expect(
        screen.queryByRole('form', { name: 'Nuevo equipo' }),
      ).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: 'Nuevo equipo' }));
    const reopenedForm = await screen.findByRole('form', {
      name: 'Nuevo equipo',
    });
    await user.selectOptions(
      within(reopenedForm).getByRole('combobox', { name: /Producto/ }),
      'product-equipment',
    );
    await user.selectOptions(
      within(reopenedForm).getByRole('combobox', {
        name: /Condición inicial/,
      }),
      'GOOD',
    );
    await user.type(
      within(reopenedForm).getByRole('textbox', {
        name: 'Número de serie (opcional)',
      }),
      '   ',
    );
    await user.click(
      within(reopenedForm).getByRole('button', {
        name: 'Registrar equipo',
      }),
    );

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenNthCalledWith(2, '/equipment', {
      productId: 'product-equipment',
      condition: 'GOOD',
    });
  });

  it('evita doble envío y conserva valores ante un serial duplicado', async () => {
    let rejectCreate: (reason: Error) => void = () => undefined;

    vi.mocked(api.post).mockImplementation(
      async () =>
        await new Promise((_, reject) => {
          rejectCreate = reject;
        }),
    );

    const { user, form } = await openCreateEquipmentModal();
    const productSelect = within(form).getByRole('combobox', {
      name: /Producto/,
    });
    const conditionSelect = within(form).getByRole('combobox', {
      name: /Condición inicial/,
    });
    const serialInput = within(form).getByRole('textbox', {
      name: 'Número de serie (opcional)',
    });

    await user.selectOptions(productSelect, 'product-equipment');
    await user.selectOptions(conditionSelect, 'GOOD');
    await user.type(serialInput, 'DUPLICADA-001');

    const submit = within(form).getByRole('button', {
      name: 'Registrar equipo',
    });
    await user.click(submit);
    await user.click(submit);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(api.get).mock.calls.filter(
        ([url]) => String(url) === '/equipment',
      ),
    ).toHaveLength(1);

    rejectCreate(
      new Error(
        'Ya existe un equipo de este producto con ese número de serie',
      ),
    );

    expect(
      await within(form).findByText(
        'Ya existe un equipo de este producto con ese número de serie',
      ),
    ).toBeTruthy();
    expect((productSelect as HTMLSelectElement).value).toBe(
      'product-equipment',
    );
    expect((conditionSelect as HTMLSelectElement).value).toBe('GOOD');
    expect((serialInput as HTMLInputElement).value).toBe('DUPLICADA-001');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByText('EQ-000001').length).toBeGreaterThan(0);
  });

  it('refresca la lista y muestra exclusivamente el assetCode generado por backend', async () => {
    let created = false;
    const createdEquipment = buildEquipment({
      id: 'equipment-created',
      assetCode: 'EQ-004321',
      serialNumber: 'QA-G1-001',
      serialNumberKey: 'QA-G1-001',
      condition: 'GOOD',
      origin: 'MANUAL',
      batchId: null,
      batch: null,
      purchaseReceiptItemId: null,
    });

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment') {
        return {
          data: created
            ? [createdEquipment, ...equipmentList]
            : equipmentList,
        } as never;
      }

      if (endpoint === '/products') {
        return { data: [buildProduct()] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (String(url) !== '/equipment') {
        throw new Error(`Solicitud POST no configurada: ${String(url)}`);
      }

      created = true;
      return { data: createdEquipment } as never;
    });

    const { user, form } = await openCreateEquipmentModal();
    await user.selectOptions(
      within(form).getByRole('combobox', { name: /Producto/ }),
      'product-equipment',
    );
    await user.selectOptions(
      within(form).getByRole('combobox', { name: /Condición inicial/ }),
      'GOOD',
    );
    await user.type(
      within(form).getByRole('textbox', {
        name: 'Número de serie (opcional)',
      }),
      'QA-G1-001',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Registrar equipo' }),
    );

    expect(await screen.findByText('EQ-004321')).toBeTruthy();
    expect(screen.getByText('QA-G1-001')).toBeTruthy();
    expect(
      vi.mocked(api.get).mock.calls.filter(
        ([url]) => String(url) === '/equipment',
      ),
    ).toHaveLength(2);
    expect(
      vi.mocked(api.get).mock.calls.some(([url]) =>
        String(url).includes('/availability'),
      ),
    ).toBe(false);
    expect(api.post).toHaveBeenCalledTimes(1);
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
    expect(api.get).toHaveBeenCalledWith(
      '/equipment/equipment-1/availability',
    );
    expect(api.get).toHaveBeenCalledWith(
      '/equipment/equipment-1/inspections',
    );
    expect(
      within(detailRegion).getByLabelText(
        'Disponibilidad del equipo: Disponible',
      ),
    ).toBeTruthy();
    expect(
      within(detailRegion).getByText(
        `Evaluado: ${formatEquipmentDate(
          equipmentAvailability['equipment-1'].evaluatedAt,
        )}`,
      ),
    ).toBeTruthy();
    const inspectionsRegion = within(detailRegion).getByRole('region', {
      name: 'Inspecciones',
    });
    expect(
      within(inspectionsRegion).getByText('Revisión operativa completada'),
    ).toBeTruthy();
    expect(within(inspectionsRegion).getByText('Ana López')).toBeTruthy();
    expect(
      within(inspectionsRegion).getByText(
        formatEquipmentDate(
          equipmentInspections['equipment-1'][0].inspectedAt,
        ),
      ),
    ).toBeTruthy();
    const inspectionRows = within(inspectionsRegion).getAllByRole('listitem');
    expect(
      within(inspectionRows[0]).getByText('Revisión operativa completada'),
    ).toBeTruthy();
    expect(within(inspectionRows[1]).getByText('Sin notas')).toBeTruthy();
    expect(
      within(inspectionRows[1]).getByText('inspector@example.com'),
    ).toBeTruthy();
    expect(within(detailRegion).queryByRole('link')).toBeNull();
    expect(
      within(detailRegion).getByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));
    expect(
      screen.queryByRole('heading', {
        name: 'Detalle del equipo EQ-000001',
      }),
    ).toBeNull();
  });

  it('abre el retiro activo con advertencia, enum exacto y cancelación limpia', async () => {
    const { user, detail } = await openActiveEquipmentDetail();

    await user.click(
      within(detail).getByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    );

    const form = screen.getByRole('form', { name: 'Retirar equipo' });
    const reasonSelect = within(form).getByRole('combobox', {
      name: /Motivo del retiro/,
    });
    const submit = within(form).getByRole('button', {
      name: 'Retirar equipo',
    }) as HTMLButtonElement;

    expect(
      within(form).getByText(
        /El equipo quedará retirado y dejará de estar disponible/,
      ),
    ).toBeTruthy();
    expect(
      within(reasonSelect)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual([
      '',
      'SOLD',
      'LOST',
      'DESTROYED',
      'END_OF_LIFE',
      'REPLACED',
      'OTHER',
    ]);
    expect(submit.disabled).toBe(true);

    await user.selectOptions(reasonSelect, 'SOLD');
    expect(submit.disabled).toBe(false);
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.queryByRole('form', { name: 'Retirar equipo' }),
    ).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(
      within(detail).getByLabelText('Estado del equipo: Activo'),
    ).toBeTruthy();
  });

  it('exige notas útiles para OTHER y envía sólo el DTO de retiro', async () => {
    const { user, detail } = await openActiveEquipmentDetail();
    await user.click(
      within(detail).getByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    );

    const form = screen.getByRole('form', { name: 'Retirar equipo' });
    const reasonSelect = within(form).getByRole('combobox', {
      name: /Motivo del retiro/,
    });
    const notes = within(form).getByRole('textbox', {
      name: 'Notas (opcional)',
    });
    const submit = within(form).getByRole('button', {
      name: 'Retirar equipo',
    }) as HTMLButtonElement;

    await user.selectOptions(reasonSelect, 'OTHER');
    expect(within(form).getByRole('textbox', { name: 'Notas' })).toBe(notes);
    expect(
      within(form).getByText(
        'Las notas son obligatorias cuando el motivo es Otro.',
      ),
    ).toBeTruthy();
    expect(submit.disabled).toBe(true);

    await user.type(notes, '   ');
    expect(submit.disabled).toBe(true);
    await user.clear(notes);
    await user.type(notes, '  QA UX-B.5G2 - retiro funcional  ');
    expect(submit.disabled).toBe(false);
    await user.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/equipment/equipment-1/retirement',
        {
          retiredReason: 'OTHER',
          retirementNotes: 'QA UX-B.5G2 - retiro funcional',
        },
      );
    });

    const payload = vi.mocked(api.post).mock.calls[0][1] as Record<
      string,
      unknown
    >;

    for (const serverField of [
      'companyId',
      'equipmentId',
      'retiredAt',
      'retiredById',
      'lifecycle',
      'condition',
      'createdAt',
      'updatedAt',
    ]) {
      expect(payload).not.toHaveProperty(serverField);
    }
  });

  it('permite un motivo no OTHER sin notas y omite el campo opcional', async () => {
    const { user, detail } = await openActiveEquipmentDetail();
    await user.click(
      within(detail).getByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    );

    const form = screen.getByRole('form', { name: 'Retirar equipo' });
    await user.selectOptions(
      within(form).getByRole('combobox', { name: /Motivo del retiro/ }),
      'REPLACED',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Retirar equipo' }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/equipment/equipment-1/retirement',
        { retiredReason: 'REPLACED' },
      );
    });
  });

  it('evita doble retiro y conserva el formulario cuando el POST falla', async () => {
    let rejectRetirement: (reason: Error) => void = () => undefined;

    vi.mocked(api.post).mockImplementation(
      async () =>
        await new Promise((_, reject) => {
          rejectRetirement = reject;
        }),
    );

    const { user, detail } = await openActiveEquipmentDetail();
    await user.click(
      within(detail).getByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    );

    const form = screen.getByRole('form', { name: 'Retirar equipo' });
    const reasonSelect = within(form).getByRole('combobox', {
      name: /Motivo del retiro/,
    });
    const notes = within(form).getByRole('textbox', {
      name: 'Notas (opcional)',
    });

    await user.selectOptions(reasonSelect, 'LOST');
    await user.type(notes, 'Reporte pendiente');

    const submit = within(form).getByRole('button', {
      name: 'Retirar equipo',
    });
    await user.click(submit);
    await user.click(submit);

    expect(api.post).toHaveBeenCalledTimes(1);
    rejectRetirement(new Error('El equipo ya se encuentra retirado'));

    expect(
      await within(form).findByText('El equipo ya se encuentra retirado'),
    ).toBeTruthy();
    expect((reasonSelect as HTMLSelectElement).value).toBe('LOST');
    expect((notes as HTMLTextAreaElement).value).toBe('Reporte pendiente');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(
      within(detail).getByLabelText('Estado del equipo: Activo'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Estado del equipo EQ-000001: Activo'),
    ).toBeTruthy();
  });

  it('refresca el estado terminal, disponibilidad, historial y lista desde backend', async () => {
    let retired = false;
    const retiredAt = '2026-08-25T20:00:00.000Z';
    const retiredEquipment = buildEquipment({
      lifecycle: 'RETIRED',
      retiredAt,
      retiredById: 'user-qa',
      retiredReason: 'OTHER',
      retirementNotes: 'QA UX-B.5G2 - retiro funcional',
    });
    const retiredDetail: EquipmentAssetDetail = {
      ...equipmentDetails['equipment-1'],
      lifecycle: 'RETIRED',
      retiredAt,
      retiredById: 'user-qa',
      retiredReason: 'OTHER',
      retirementNotes: 'QA UX-B.5G2 - retiro funcional',
    };
    const retiredAvailability: EquipmentAvailability = {
      available: false,
      primaryReason: 'RETIRED',
      reasons: ['RETIRED'],
      evaluatedAt: '2026-08-25T20:00:01.000Z',
    };

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment') {
        return {
          data: retired
            ? [retiredEquipment, manualEquipment]
            : equipmentList,
        } as never;
      }

      if (endpoint === '/equipment/equipment-1') {
        return {
          data: retired ? retiredDetail : equipmentDetails['equipment-1'],
        } as never;
      }

      if (endpoint === '/equipment/equipment-1/availability') {
        return {
          data: retired
            ? retiredAvailability
            : equipmentAvailability['equipment-1'],
        } as never;
      }

      if (endpoint === '/equipment/equipment-1/inspections') {
        return { data: equipmentInspections['equipment-1'] } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (String(url) !== '/equipment/equipment-1/retirement') {
        throw new Error(`Solicitud POST no configurada: ${String(url)}`);
      }

      retired = true;
      return { data: retiredEquipment } as never;
    });

    const { user, detail } = await openActiveEquipmentDetail();
    await user.click(
      within(detail).getByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    );
    const form = screen.getByRole('form', { name: 'Retirar equipo' });
    await user.selectOptions(
      within(form).getByRole('combobox', { name: /Motivo del retiro/ }),
      'OTHER',
    );
    await user.type(
      within(form).getByRole('textbox', { name: 'Notas' }),
      'QA UX-B.5G2 - retiro funcional',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Retirar equipo' }),
    );

    expect(
      await screen.findByLabelText('Estado del equipo: Retirado'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Estado del equipo EQ-000001: Retirado'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Disponibilidad del equipo: No disponible'),
    ).toBeTruthy();
    expect(screen.getByText('Retirado (principal)')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: 'Retirar equipo EQ-000001',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Registrar inspección de EQ-000001',
      }),
    ).toBeNull();
    expect(screen.getByText('DETAIL-SN-001')).toBeTruthy();
    expect(screen.getAllByText('EQUIPO DE PRUEBA').length).toBeGreaterThan(0);
    expect(screen.getByText('Revisión operativa completada')).toBeTruthy();
    expect(
      screen.getByLabelText('Condición del equipo: Bueno'),
    ).toBeTruthy();

    const retirementRegion = screen.getByRole('region', {
      name: 'Datos de retiro',
    });
    expect(within(retirementRegion).getByText('Otro')).toBeTruthy();
    expect(
      within(retirementRegion).getByText(formatEquipmentDate(retiredAt)),
    ).toBeTruthy();
    expect(
      within(retirementRegion).getByText(
        'QA UX-B.5G2 - retiro funcional',
      ),
    ).toBeTruthy();
    expect(screen.getAllByText('EQ-000001').length).toBeGreaterThan(1);

    for (const endpoint of [
      '/equipment',
      '/equipment/equipment-1',
      '/equipment/equipment-1/availability',
      '/equipment/equipment-1/inspections',
    ]) {
      expect(
        vi.mocked(api.get).mock.calls.filter(
          ([url]) => String(url) === endpoint,
        ),
      ).toHaveLength(2);
    }
  });

  it('presenta no disponibilidad, todos sus motivos y el vacío de inspecciones', async () => {
    const user = userEvent.setup();
    await renderEquipmentPage();

    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000002' }),
    );

    await screen.findByText('Sin número de serie');
    const availabilityRegion = screen.getByRole('region', {
      name: 'Disponibilidad actual',
    });
    const inspectionsRegion = screen.getByRole('region', {
      name: 'Inspecciones',
    });

    expect(
      within(availabilityRegion).getByLabelText(
        'Disponibilidad del equipo: No disponible',
      ),
    ).toBeTruthy();
    expect(
      within(availabilityRegion).getByText('Retirado (principal)'),
    ).toBeTruthy();
    expect(within(availabilityRegion).getByText('Dañado')).toBeTruthy();
    expect(
      within(inspectionsRegion).getByText(
        'Aún no hay inspecciones registradas.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: 'Registrar inspección de EQ-000002',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Retirar equipo EQ-000002',
      }),
    ).toBeNull();
    const retirementRegion = screen.getByRole('region', {
      name: 'Datos de retiro',
    });
    expect(
      within(retirementRegion).getAllByText('Fin de vida útil'),
    ).toHaveLength(2);
    expect(
      within(retirementRegion).getByText(
        formatEquipmentDate(manualEquipment.retiredAt!),
      ),
    ).toBeTruthy();
  });

  it('mantiene el detalle usable mientras disponibilidad e inspecciones cargan', async () => {
    const defaultGet = vi.mocked(api.get).getMockImplementation();
    let resolveAvailability: (
      value: { data: EquipmentAvailability },
    ) => void = () => undefined;
    let resolveInspections: (
      value: { data: EquipmentInspection[] },
    ) => void = () => undefined;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment/equipment-1/availability') {
        return await new Promise<{ data: EquipmentAvailability }>((resolve) => {
          resolveAvailability = resolve;
        });
      }

      if (endpoint === '/equipment/equipment-1/inspections') {
        return await new Promise<{ data: EquipmentInspection[] }>((resolve) => {
          resolveInspections = resolve;
        });
      }

      return await defaultGet!(url);
    });

    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );

    expect(await screen.findByText('DETAIL-SN-001')).toBeTruthy();
    expect(screen.getByText('Consultando disponibilidad...')).toBeTruthy();
    expect(screen.getByText('Cargando inspecciones...')).toBeTruthy();

    resolveAvailability({ data: equipmentAvailability['equipment-1'] });
    resolveInspections({ data: equipmentInspections['equipment-1'] });

    expect(
      await screen.findByLabelText('Disponibilidad del equipo: Disponible'),
    ).toBeTruthy();
    expect(
      await screen.findByText('Revisión operativa completada'),
    ).toBeTruthy();
  });

  it('aísla errores de disponibilidad e inspecciones y reintenta cada recurso', async () => {
    const defaultGet = vi.mocked(api.get).getMockImplementation();
    let availabilityAttempts = 0;
    let inspectionAttempts = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment/equipment-1/availability') {
        availabilityAttempts += 1;

        if (availabilityAttempts === 1) {
          throw new Error('Disponibilidad temporalmente inaccesible');
        }

        return { data: equipmentAvailability['equipment-1'] } as never;
      }

      if (endpoint === '/equipment/equipment-1/inspections') {
        inspectionAttempts += 1;

        if (inspectionAttempts === 1) {
          throw new Error('Historial temporalmente inaccesible');
        }

        return { data: equipmentInspections['equipment-1'] } as never;
      }

      return await defaultGet!(url);
    });

    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );

    expect(await screen.findByText('DETAIL-SN-001')).toBeTruthy();
    expect(
      await screen.findByText('Disponibilidad temporalmente inaccesible'),
    ).toBeTruthy();
    expect(
      screen.getByText('Historial temporalmente inaccesible'),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Reintentar disponibilidad' }),
    );
    expect(
      await screen.findByLabelText('Disponibilidad del equipo: Disponible'),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Reintentar inspecciones' }),
    );
    expect(
      await screen.findByText('Revisión operativa completada'),
    ).toBeTruthy();
    expect(availabilityAttempts).toBe(2);
    expect(inspectionAttempts).toBe(2);
  });

  it('envía únicamente el resultado y las notas permitidas por el DTO', async () => {
    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );
    await screen.findByText('DETAIL-SN-001');
    await user.click(
      screen.getByRole('button', {
        name: 'Registrar inspección de EQ-000001',
      }),
    );

    const form = screen.getByRole('form', {
      name: 'Registrar inspección',
    });
    const resultSelect = within(form).getByRole('combobox', {
      name: /Condición resultante/,
    });
    const optionValues = within(resultSelect)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);

    expect(optionValues).toEqual([
      '',
      'GOOD',
      'DAMAGED',
      'OUT_OF_SERVICE',
    ]);
    expect(optionValues).not.toContain('INSPECTION_PENDING');

    await user.selectOptions(resultSelect, 'DAMAGED');
    await user.type(
      within(form).getByRole('textbox', { name: 'Notas (opcional)' }),
      '  Carcasa fisurada  ',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Registrar inspección' }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/equipment/equipment-1/inspections',
        {
          conditionAfter: 'DAMAGED',
          notes: 'Carcasa fisurada',
        },
      );
    });
    expect(Object.keys(vi.mocked(api.post).mock.calls[0][1])).toEqual([
      'conditionAfter',
      'notes',
    ]);
  });

  it('bloquea el doble envío y conserva el formulario cuando el POST falla', async () => {
    let rejectPost: (reason: Error) => void = () => undefined;

    vi.mocked(api.post).mockImplementation(
      async () =>
        await new Promise((_, reject) => {
          rejectPost = reject;
        }),
    );

    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );
    await screen.findByText('DETAIL-SN-001');
    await user.click(
      screen.getByRole('button', {
        name: 'Registrar inspección de EQ-000001',
      }),
    );

    const form = screen.getByRole('form', {
      name: 'Registrar inspección',
    });
    const resultSelect = within(form).getByRole('combobox', {
      name: /Condición resultante/,
    });
    const notes = within(form).getByRole('textbox', {
      name: 'Notas (opcional)',
    });

    await user.selectOptions(resultSelect, 'OUT_OF_SERVICE');
    await user.type(notes, 'Requiere reparación especializada');

    const submit = within(form).getByRole('button', {
      name: 'Registrar inspección',
    });
    await user.click(submit);
    await user.click(submit);

    expect(api.post).toHaveBeenCalledTimes(1);
    rejectPost(new Error('No fue posible completar la inspección'));

    expect(
      await screen.findByText('No fue posible completar la inspección'),
    ).toBeTruthy();
    expect((resultSelect as HTMLSelectElement).value).toBe(
      'OUT_OF_SERVICE',
    );
    expect((notes as HTMLTextAreaElement).value).toBe(
      'Requiere reparación especializada',
    );
    expect(
      screen.getByRole('heading', {
        name: 'Registrar inspección de EQ-000001',
      }),
    ).toBeTruthy();
  });

  it('refresca detalle, historial, disponibilidad y lista con datos del servidor', async () => {
    let inspectionCreated = false;
    const updatedEquipment = buildEquipment({ condition: 'DAMAGED' });
    const updatedDetail: EquipmentAssetDetail = {
      ...equipmentDetails['equipment-1'],
      condition: 'DAMAGED',
    };
    const updatedAvailability: EquipmentAvailability = {
      available: false,
      primaryReason: 'DAMAGED',
      reasons: ['DAMAGED'],
      evaluatedAt: '2026-08-22T19:00:00.000Z',
    };
    const updatedInspections: EquipmentInspection[] = [
      {
        ...equipmentInspections['equipment-1'][0],
        id: 'inspection-new',
        conditionBefore: 'GOOD',
        conditionAfter: 'DAMAGED',
        inspectedAt: '2026-08-22T18:59:00.000Z',
        notes: 'Daño confirmado por inspección',
      },
      ...equipmentInspections['equipment-1'],
    ];

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/equipment') {
        return {
          data: inspectionCreated
            ? [updatedEquipment, manualEquipment]
            : equipmentList,
        } as never;
      }

      if (endpoint === '/equipment/equipment-1') {
        return {
          data: inspectionCreated
            ? updatedDetail
            : equipmentDetails['equipment-1'],
        } as never;
      }

      if (endpoint === '/equipment/equipment-1/availability') {
        return {
          data: inspectionCreated
            ? updatedAvailability
            : equipmentAvailability['equipment-1'],
        } as never;
      }

      if (endpoint === '/equipment/equipment-1/inspections') {
        return {
          data: inspectionCreated
            ? updatedInspections
            : equipmentInspections['equipment-1'],
        } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });
    vi.mocked(api.post).mockImplementation(async () => {
      inspectionCreated = true;
      return { data: updatedInspections[0] } as never;
    });

    const user = userEvent.setup();
    await renderEquipmentPage();
    await user.click(
      screen.getByRole('button', { name: 'Ver equipo EQ-000001' }),
    );
    await screen.findByLabelText('Disponibilidad del equipo: Disponible');
    await user.click(
      screen.getByRole('button', {
        name: 'Registrar inspección de EQ-000001',
      }),
    );

    const form = screen.getByRole('form', {
      name: 'Registrar inspección',
    });
    await user.selectOptions(
      within(form).getByRole('combobox', {
        name: /Condición resultante/,
      }),
      'DAMAGED',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Registrar inspección' }),
    );

    expect(
      await screen.findByLabelText('Disponibilidad del equipo: No disponible'),
    ).toBeTruthy();
    expect(
      await screen.findByText('Daño confirmado por inspección'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Condición del equipo: Dañado'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Condición del equipo EQ-000001: Dañado'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('form', { name: 'Registrar inspección' }),
    ).toBeNull();

    for (const endpoint of [
      '/equipment',
      '/equipment/equipment-1',
      '/equipment/equipment-1/availability',
      '/equipment/equipment-1/inspections',
    ]) {
      expect(
        vi.mocked(api.get).mock.calls.filter(
          ([url]) => String(url) === endpoint,
        ),
      ).toHaveLength(2);
    }
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

      if (endpoint === '/equipment/equipment-2/availability') {
        return { data: equipmentAvailability['equipment-2'] } as never;
      }

      if (endpoint === '/equipment/equipment-2/inspections') {
        return { data: [] } as never;
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

      if (endpoint === '/equipment/equipment-1/availability') {
        return { data: equipmentAvailability['equipment-1'] } as never;
      }

      if (endpoint === '/equipment/equipment-1/inspections') {
        return { data: equipmentInspections['equipment-1'] } as never;
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
