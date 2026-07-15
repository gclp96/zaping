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

import SupplierSelector from './SupplierSelector';

afterEach(() => {
  cleanup();
});

const suppliers = [
  {
    id: 'supplier-1',
    name: 'Distribuidora Médica del Norte',
    email: 'compras@proveedor.com',
    contactName: 'Juan Pérez',
  },
  {
    id: 'supplier-2',
    name: 'Suministros Hospitalarios',
    email: null,
    contactName: null,
  },
];

describe('SupplierSelector', () => {
  it('muestra los proveedores disponibles', () => {
    render(
      <SupplierSelector
        options={suppliers}
        value=""
        onChange={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        'Distribuidora Médica del Norte — compras@proveedor.com',
      ),
    ).toBeDefined();

    expect(
      screen.getByText('Suministros Hospitalarios'),
    ).toBeDefined();
  });

  it('devuelve el identificador del proveedor seleccionado', () => {
    const onChange = vi.fn();

    render(
      <SupplierSelector
        options={suppliers}
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Proveedor',
      }),
      {
        target: {
          value: 'supplier-2',
        },
      },
    );

    expect(onChange).toHaveBeenCalledWith('supplier-2');
  });

  it('muestra el estado de carga y deshabilita el selector', () => {
    render(
      <SupplierSelector
        options={[]}
        value=""
        loading
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole('combobox', {
      name: 'Proveedor',
    });

    expect(select.hasAttribute('disabled')).toBe(true);
    expect(select.getAttribute('aria-busy')).toBe('true');

    expect(
      screen.getByText('Cargando proveedores...'),
    ).toBeDefined();
  });

  it('muestra el estado vacío y deshabilita el selector', () => {
    render(
      <SupplierSelector
        options={[]}
        value=""
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole('combobox', {
      name: 'Proveedor',
    });

    expect(select.hasAttribute('disabled')).toBe(true);

    expect(
      screen.getByText('No hay proveedores disponibles'),
    ).toBeDefined();
  });

  it('muestra el error de forma accesible', () => {
    render(
      <SupplierSelector
        options={suppliers}
        value=""
        error="Selecciona un proveedor"
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole('combobox', {
      name: 'Proveedor',
    });

    expect(select.getAttribute('aria-invalid')).toBe('true');

    expect(
      screen.getByRole('alert').textContent,
    ).toBe('Selecciona un proveedor');
  });

  it('respeta el proveedor seleccionado', () => {
    render(
      <SupplierSelector
        options={suppliers}
        value="supplier-1"
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole(
      'combobox',
      {
        name: 'Proveedor',
      },
    ) as HTMLSelectElement;

    expect(select.value).toBe('supplier-1');
  });
});