import {
  cleanup,
  fireEvent,
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

import ProductsPage from './page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (
    error: unknown,
    fallbackMessage: string,
  ) => {
    if (error instanceof Error) {
      return error.message;
    }

    return fallbackMessage;
  },
}));

type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  categoryId?: string | null;
  barcode?: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  inventoryTracking: 'QUANTITY' | 'SERIALIZED' | 'ASSET';
  lotTracking: 'NONE' | 'OPTIONAL' | 'REQUIRED';
};

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

const surgicalCategory: Category = {
  id: 'category-surgical',
  name: 'Quirúrgico',
  isActive: true,
};

const inactiveCategory: Category = {
  id: 'category-inactive',
  name: 'Inactiva',
  isActive: false,
};

const bluntTipProduct: Product = {
  id: 'product-blunt-tip',
  sku: 'LF1837',
  name: 'BLUNT TIP',
  description: 'Punta roma',
  brand: 'Acme Medical',
  categoryId: surgicalCategory.id,
  barcode: '750000000001',
  cost: 100,
  price: 150,
  stock: 7,
  minStock: 2,
  isActive: true,
  inventoryTracking: 'QUANTITY',
  lotTracking: 'OPTIONAL',
};

const noBrandProduct: Product = {
  ...bluntTipProduct,
  id: 'product-no-brand',
  sku: 'NB001',
  name: 'SIN MARCA',
  brand: null,
  categoryId: null,
};

function configureApiMocks({
  products = [bluntTipProduct, noBrandProduct],
  categories = [surgicalCategory, inactiveCategory],
  categoryError,
  productError,
}: {
  products?: Product[];
  categories?: Category[];
  categoryError?: Error;
  productError?: Error;
} = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const endpoint = String(url);

    if (endpoint === '/products') {
      if (productError) {
        throw productError;
      }

      return {
        data: products,
      } as never;
    }

    if (endpoint === '/categories') {
      if (categoryError) {
        throw categoryError;
      }

      return {
        data: categories,
      } as never;
    }

    throw new Error(`Solicitud GET no configurada: ${endpoint}`);
  });
}

async function renderProductsPage() {
  render(<ProductsPage />);

  await screen.findByText('LF1837');
}

async function openCreateProductModal() {
  const user = userEvent.setup();

  await renderProductsPage();
  await user.click(
    screen.getByRole('button', {
      name: /agregar producto/i,
    }),
  );

  return user;
}

async function openEditProductModal(productName = 'BLUNT TIP') {
  const user = userEvent.setup();

  await renderProductsPage();

  const productRow = screen.getAllByText(productName)[0].closest('tr');
  expect(productRow).toBeTruthy();

  await user.click(
    within(productRow as HTMLTableRowElement).getByRole('button', {
      name: /editar/i,
    }),
  );

  return user;
}

async function clickEditProduct(
  user: ReturnType<typeof userEvent.setup>,
  productName = 'BLUNT TIP',
) {
  const productRow = screen.getAllByText(productName)[0].closest('tr');
  expect(productRow).toBeTruthy();

  await user.click(
    within(productRow as HTMLTableRowElement).getByRole('button', {
      name: /editar/i,
    }),
  );
}

function fillRequiredProductFields() {
  fireEvent.change(screen.getByLabelText(/sku/i), {
    target: {
      value: 'NEW001',
    },
  });
  fireEvent.change(screen.getByLabelText(/nombre/i), {
    target: {
      value: 'Producto nuevo',
    },
  });
  fireEvent.change(screen.getByLabelText(/marca/i), {
    target: {
      value: 'Marca nueva',
    },
  });
  fireEvent.change(screen.getByLabelText(/costo/i), {
    target: {
      value: '10',
    },
  });
  fireEvent.change(screen.getByLabelText(/precio/i), {
    target: {
      value: '20',
    },
  });
  fireEvent.change(screen.getByLabelText(/stock mínimo/i), {
    target: {
      value: '3',
    },
  });
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureApiMocks();

    vi.mocked(api.post).mockResolvedValue({
      data: bluntTipProduct,
    } as never);
    vi.mocked(api.patch).mockResolvedValue({
      data: bluntTipProduct,
    } as never);
    vi.mocked(api.delete).mockResolvedValue({
      data: bluntTipProduct,
    } as never);

    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
    cleanup();
  });

  it('muestra loading, lista y estado vacío', async () => {
    const { unmount } = render(<ProductsPage />);

    expect(screen.getByText('Cargando productos...')).toBeTruthy();
    expect(await screen.findByText('LF1837')).toBeTruthy();

    unmount();
    cleanup();
    vi.clearAllMocks();
    configureApiMocks({ products: [] });

    render(<ProductsPage />);

    expect(
      await screen.findByText('No hay productos registrados'),
    ).toBeTruthy();
  });

  it('muestra error de productos y permite reintentar', async () => {
    const user = userEvent.setup();
    let firstRequest = true;

    configureApiMocks({
      productError: new Error('Productos no disponibles'),
    });

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/products' && firstRequest) {
        firstRequest = false;
        throw new Error('Productos no disponibles');
      }

      if (endpoint === '/products') {
        return {
          data: [bluntTipProduct],
        } as never;
      }

      if (endpoint === '/categories') {
        return {
          data: [surgicalCategory],
        } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    render(<ProductsPage />);

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain('Productos no disponibles');

    await user.click(
      within(alert).getByRole('button', {
        name: /reintentar/i,
      }),
    );

    expect(await screen.findByText('LF1837')).toBeTruthy();
  });

  it('renderiza Brand desde product.brand y no duplica el nombre', async () => {
    await renderProductsPage();

    const brandedRow = screen.getByText('BLUNT TIP').closest('tr');
    const noBrandRow = screen.getByText('SIN MARCA').closest('tr');

    expect(brandedRow).toBeTruthy();
    expect(noBrandRow).toBeTruthy();
    expect(
      within(brandedRow as HTMLTableRowElement).getByText('Acme Medical'),
    ).toBeTruthy();
    expect(
      within(brandedRow as HTMLTableRowElement).queryAllByText('BLUNT TIP'),
    ).toHaveLength(1);
    expect(
      within(noBrandRow as HTMLTableRowElement).getAllByText('-').length,
    ).toBeGreaterThan(0);
  });

  it('muestra categoria, tracking y estado en la lista', async () => {
    await renderProductsPage();

    expect(screen.getByText('Quirúrgico')).toBeTruthy();
    expect(
      screen.getAllByLabelText('Seguimiento de inventario: Por cantidad')
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText('Estado del producto: Activo').length,
    ).toBeGreaterThan(0);
  });

  it('renderiza selectores de tracking en create con defaults backend', async () => {
    const user = await openCreateProductModal();

    const inventoryTrackingSelect = screen.getByRole('combobox', {
      name: /seguimiento de inventario/i,
    }) as HTMLSelectElement;
    const lotTrackingSelect = screen.getByRole('combobox', {
      name: /seguimiento por lote/i,
    }) as HTMLSelectElement;

    expect(screen.getByRole('option', { name: 'Por cantidad' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Serializado' })).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Equipo / activo físico' }),
    ).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Sin lote' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Lote opcional' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Lote requerido' })).toBeTruthy();
    expect(inventoryTrackingSelect.value).toBe('QUANTITY');
    expect(lotTrackingSelect.value).toBe('OPTIONAL');

    await user.selectOptions(inventoryTrackingSelect, 'ASSET');
    await user.selectOptions(lotTrackingSelect, 'REQUIRED');

    expect(screen.getByText('Cada unidad se controla como EquipmentAsset.'))
      .toBeTruthy();
    expect(screen.getByText('Requiere flujo de lote específico.')).toBeTruthy();
  });

  it('envia tracking, categoria y minStock al crear sin enviar stock', async () => {
    const user = await openCreateProductModal();

    fillRequiredProductFields();
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /categoría/i,
      }),
      surgicalCategory.id,
    );
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /seguimiento de inventario/i,
      }),
      'ASSET',
    );
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /seguimiento por lote/i,
      }),
      'REQUIRED',
    );

    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(api.post).toHaveBeenCalledWith('/products', {
      sku: 'NEW001',
      name: 'Producto nuevo',
      description: undefined,
      brand: 'Marca nueva',
      categoryId: surgicalCategory.id,
      barcode: undefined,
      cost: 10,
      price: 20,
      minStock: 3,
      inventoryTracking: 'ASSET',
      lotTracking: 'REQUIRED',
    });

    const payload = vi.mocked(api.post).mock.calls[0][1] as Record<
      string,
      unknown
    >;

    expect(payload).not.toHaveProperty('stock');
  });

  it('resetea tracking a defaults al volver a crear', async () => {
    const user = await openCreateProductModal();

    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /seguimiento de inventario/i,
      }),
      'ASSET',
    );
    await user.click(screen.getByLabelText('Cerrar modal'));
    await user.click(
      screen.getByRole('button', {
        name: /agregar producto/i,
      }),
    );

    expect(
      (
        screen.getByRole('combobox', {
          name: /seguimiento de inventario/i,
        }) as HTMLSelectElement
      ).value,
    ).toBe('QUANTITY');
  });

  it('muestra tracking readonly en edit y PATCH excluye tracking y stock', async () => {
    const user = await openEditProductModal();

    expect(screen.getByText('Stock actual')).toBeTruthy();
    expect(screen.getByText('Las operaciones de inventario administran este valor.'))
      .toBeTruthy();
    expect(screen.getByText('Por cantidad')).toBeTruthy();
    expect(screen.getByText('Lote opcional')).toBeTruthy();
    expect(
      screen.queryByRole('combobox', {
        name: /seguimiento de inventario/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('combobox', {
        name: /seguimiento por lote/i,
      }),
    ).toBeNull();

    await user.clear(screen.getByLabelText(/nombre/i));
    await user.type(screen.getByLabelText(/nombre/i), 'BLUNT TIP EDITADO');
    await user.clear(screen.getByLabelText(/stock mínimo/i));
    await user.type(screen.getByLabelText(/stock mínimo/i), '5');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(api.patch).toHaveBeenCalledWith('/products/product-blunt-tip', {
      sku: 'LF1837',
      name: 'BLUNT TIP EDITADO',
      description: 'Punta roma',
      brand: 'Acme Medical',
      categoryId: surgicalCategory.id,
      barcode: '750000000001',
      cost: 100,
      price: 150,
      minStock: 5,
    });

    const payload = vi.mocked(api.patch).mock.calls[0][1] as Record<
      string,
      unknown
    >;

    expect(payload).not.toHaveProperty('stock');
    expect(payload).not.toHaveProperty('inventoryTracking');
    expect(payload).not.toHaveProperty('lotTracking');
  });

  it('cambia y limpia categoria en edit', async () => {
    const user = await openEditProductModal();

    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /categoría/i,
      }),
      '',
    );
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(api.patch).toHaveBeenCalledWith(
      '/products/product-blunt-tip',
      expect.objectContaining({
        categoryId: null,
      }),
    );
  });

  it('maneja error de categorias sin romper lista ni selector', async () => {
    configureApiMocks({
      categoryError: new Error('Categorias no disponibles'),
    });

    render(<ProductsPage />);

    expect(await screen.findByText('LF1837')).toBeTruthy();
    expect(
      screen.getByText('Categorias no disponibles'),
    ).toBeTruthy();

    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', {
        name: /agregar producto/i,
      }),
    );

    expect(
      (
        screen.getByRole('combobox', {
          name: /categoría/i,
        }) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
  });

  it('no renderiza input editable de stock y mantiene minStock editable', async () => {
    const user = await openCreateProductModal();

    expect(
      screen.queryByRole('spinbutton', {
        name: /^stock$/i,
      }),
    ).toBeNull();
    expect(
      screen.getByRole('spinbutton', {
        name: /stock mínimo/i,
      }),
    ).toBeTruthy();

    await user.click(screen.getByLabelText('Cerrar modal'));
    await clickEditProduct(user);

    expect(
      screen.queryByRole('spinbutton', {
        name: /^stock$/i,
      }),
    ).toBeNull();
    expect(screen.getByText('Stock actual')).toBeTruthy();
  });

  it('presenta la desactivacion con copy no destructivo y contexto accesible', async () => {
    const user = userEvent.setup();

    await renderProductsPage();
    const productRow = screen.getByText('BLUNT TIP').closest('tr');
    expect(productRow).toBeTruthy();

    const deactivateButton = within(
      productRow as HTMLTableRowElement,
    ).getByRole('button', {
      name: 'Desactivar producto LF1837',
    });

    expect(deactivateButton.textContent).toBe('Desactivar');
    expect(deactivateButton.getAttribute('title')).toBe(
      'Desactivar producto LF1837',
    );
    expect(screen.queryByText(/eliminar/i)).toBeNull();

    await user.click(deactivateButton);

    expect(
      screen.getByRole('heading', {
        name: 'Desactivar producto',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /dejará de estar disponible para nuevas operaciones, pero su historial se conservará/i,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /^desactivar$/i,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/eliminar/i)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.queryByRole('combobox', {
        name: /estado|activo|inactivo/i,
      }),
    ).toBeNull();
  });

  it('mantiene DELETE y recarga la lista hasta retirar el producto desactivado', async () => {
    let productRequestCount = 0;

    vi.mocked(api.get).mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint === '/products') {
        productRequestCount += 1;

        return {
          data:
            productRequestCount === 1
              ? [bluntTipProduct, noBrandProduct]
              : [noBrandProduct],
        } as never;
      }

      if (endpoint === '/categories') {
        return {
          data: [surgicalCategory, inactiveCategory],
        } as never;
      }

      throw new Error(`Solicitud GET no configurada: ${endpoint}`);
    });

    const user = userEvent.setup();

    await renderProductsPage();
    const productRow = screen.getByText('BLUNT TIP').closest('tr');
    expect(productRow).toBeTruthy();

    await user.click(
      within(productRow as HTMLTableRowElement).getByRole('button', {
        name: 'Desactivar producto LF1837',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: /^desactivar$/i,
      }),
    );

    expect(api.delete).toHaveBeenCalledWith('/products/product-blunt-tip');
    await waitFor(() => {
      expect(screen.queryByText('BLUNT TIP')).toBeNull();
    });
    expect(screen.getByText('NB001')).toBeTruthy();
    expect(productRequestCount).toBe(2);
    expect(
      screen.queryByRole('heading', {
        name: 'Desactivar producto',
      }),
    ).toBeNull();
  });

  it('conserva el producto y muestra el error cuando falla la desactivacion', async () => {
    vi.mocked(api.delete).mockRejectedValue(
      new Error('No fue posible desactivar el producto'),
    );

    const user = userEvent.setup();

    await renderProductsPage();
    const productRow = screen.getByText('BLUNT TIP').closest('tr');
    expect(productRow).toBeTruthy();

    await user.click(
      within(productRow as HTMLTableRowElement).getByRole('button', {
        name: 'Desactivar producto LF1837',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: /^desactivar$/i,
      }),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'No fue posible desactivar el producto',
      );
    });
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(api.get).mock.calls.filter(
        ([url]) => String(url) === '/products',
      ),
    ).toHaveLength(1);
    expect(screen.getAllByText('BLUNT TIP').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', {
        name: 'Desactivar producto',
      }),
    ).toBeTruthy();
  });
});
