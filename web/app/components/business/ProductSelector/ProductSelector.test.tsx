import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import ProductSelector from './ProductSelector';

afterEach(() => {
  cleanup();
});

const products = [
  {
    id: 'product-1',
    sku: 'SKU-001',
    name: 'Catéter diagnóstico',
    cost: 150.5,
    stock: 10,
    minStock: 5,
  },
  {
    id: 'product-2',
    sku: 'SKU-002',
    name: 'Guía médica',
    cost: 80,
    stock: 0,
    minStock: 3,
  },
];

describe('ProductSelector', () => {
  it('muestra los productos con SKU, nombre y costo', () => {
    render(
      <ProductSelector
        options={products}
        value=""
        onChange={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        'SKU-001 — Catéter diagnóstico — $150.50',
      ),
    ).toBeDefined();

    expect(
      screen.getByText(
        'SKU-002 — Guía médica — $80.00',
      ),
    ).toBeDefined();  });

  it('devuelve el identificador seleccionado', () => {
    const onChange = vi.fn();

    render(
      <ProductSelector
        options={products}
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Producto',
      }),
      {
        target: {
          value: 'product-2',
        },
      },
    );

    expect(onChange).toHaveBeenCalledWith('product-2');
  });

  it('deshabilita los productos excluidos', () => {
    render(
      <ProductSelector
        options={products}
        value=""
        excludedProductIds={['product-1']}
        onChange={() => undefined}
      />,
    );

    const option = screen.getByRole(
      'option',
      {
        name: 'SKU-001 — Catéter diagnóstico — $150.50',
      },
    ) as HTMLOptionElement;

    expect(option.disabled).toBe(true);
  });

  it('permite seleccionar productos sin stock', () => {
    render(
      <ProductSelector
        options={products}
        value=""
        onChange={() => undefined}
      />,
    );

    const option = screen.getByRole(
      'option',
      {
        name: 'SKU-002 — Guía médica — $80.00',
      },
    ) as HTMLOptionElement;

    expect(option.disabled).toBe(false);
  });

  it('muestra carga y deshabilita el selector', () => {
    render(
      <ProductSelector
        options={[]}
        value=""
        loading
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole(
      'combobox',
      {
        name: 'Producto',
      },
    ) as HTMLSelectElement;

    expect(select.disabled).toBe(true);
    expect(select.getAttribute('aria-busy')).toBe('true');

    expect(
      screen.getByText('Cargando productos...'),
    ).toBeDefined();
  });

  it('muestra el estado vacío', () => {
    render(
      <ProductSelector
        options={[]}
        value=""
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole(
      'combobox',
      {
        name: 'Producto',
      },
    ) as HTMLSelectElement;

    expect(select.disabled).toBe(true);

    expect(
      screen.getByText('No hay productos disponibles'),
    ).toBeDefined();
  });

  it('muestra errores de forma accesible', () => {
    render(
      <ProductSelector
        options={products}
        value=""
        error="Selecciona un producto"
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole('combobox', {
      name: 'Producto',
    });

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe(
      'Selecciona un producto',
    );
  });

  it('respeta el producto seleccionado', () => {
    render(
      <ProductSelector
        options={products}
        value="product-2"
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole(
      'combobox',
      {
        name: 'Producto',
      },
    ) as HTMLSelectElement;

    expect(select.value).toBe('product-2');
  });
});