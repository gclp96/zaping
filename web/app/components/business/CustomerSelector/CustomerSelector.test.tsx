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

import CustomerSelector from './CustomerSelector';

afterEach(() => {
  cleanup();
});

const customers = [
  {
    id: 'customer-1',
    name: 'Hospital San José',
    type: 'Hospital',
    contactName: 'Juan Pérez',
    email: 'compras@sanjose.com',
    phone: '6621000001',
    isActive: true,
  },
  {
    id: 'customer-2',
    name: 'Clínica del Norte',
    type: 'Clínica',
    contactName: 'María López',
    email: 'contacto@norte.com',
    phone: '6621000002',
    isActive: true,
  },
  {
    id: 'customer-3',
    name: 'Cliente inactivo',
    type: 'Hospital',
    email: 'inactivo@example.com',
    phone: '6621000003',
    isActive: false,
  },
];

function openSelector() {
  fireEvent.focus(
    screen.getByRole('combobox', {
      name: 'Cliente',
    }),
  );
}

describe('CustomerSelector', () => {
  it('muestra los clientes activos', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    openSelector();

    expect(
      screen.getByRole('option', {
        name: /Hospital San José/i,
      }),
    ).toBeDefined();

    expect(
      screen.getByRole('option', {
        name: /Clínica del Norte/i,
      }),
    ).toBeDefined();
  });

  it('no muestra clientes inactivos', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    openSelector();

    expect(
      screen.queryByRole('option', {
        name: /Cliente inactivo/i,
      }),
    ).toBeNull();
  });

  it('devuelve el identificador seleccionado', () => {
    const onChange = vi.fn();

    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={onChange}
      />,
    );

    openSelector();

    fireEvent.click(
      screen.getByRole('option', {
        name: /Hospital San José/i,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(
      'customer-1',
    );
  });

  it('busca por nombre', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: 'Clínica del Norte',
        },
      },
    );

    expect(
      screen.getByRole('option', {
        name: /Clínica del Norte/i,
      }),
    ).toBeDefined();

    expect(
      screen.queryByRole('option', {
        name: /Hospital San José/i,
      }),
    ).toBeNull();
  });

  it('busca por nombre sin requerir acentos', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: 'clinica',
        },
      },
    );

    expect(
      screen.getByRole('option', {
        name: /Clínica del Norte/i,
      }),
    ).toBeDefined();
  });

  it('busca por tipo', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: 'Hospital',
        },
      },
    );

    expect(
      screen.getByRole('option', {
        name: /Hospital San José/i,
      }),
    ).toBeDefined();

    expect(
      screen.queryByRole('option', {
        name: /Clínica del Norte/i,
      }),
    ).toBeNull();
  });

  it('busca por contacto', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: 'María López',
        },
      },
    );

    expect(
      screen.getByRole('option', {
        name: /Clínica del Norte/i,
      }),
    ).toBeDefined();
  });

  it('busca por email', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: 'compras@sanjose.com',
        },
      },
    );

    expect(
      screen.getByRole('option', {
        name: /Hospital San José/i,
      }),
    ).toBeDefined();
  });

  it('busca por teléfono', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: '6621000002',
        },
      },
    );

    expect(
      screen.getByRole('option', {
        name: /Clínica del Norte/i,
      }),
    ).toBeDefined();
  });

  it('muestra el cliente seleccionado', () => {
    render(
      <CustomerSelector
        options={customers}
        value="customer-1"
        onChange={() => undefined}
      />,
    );

    expect(
      screen.getByText('Hospital San José'),
    ).toBeDefined();

    expect(
      screen.getByText(/Juan Pérez/i),
    ).toBeDefined();

    expect(
      screen.getByText('compras@sanjose.com'),
    ).toBeDefined();
  });

  it('permite cambiar el cliente seleccionado', () => {
    const onChange = vi.fn();

    render(
      <CustomerSelector
        options={customers}
        value="customer-1"
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cambiar',
      }),
    );

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('ejecuta el registro de nuevo cliente', () => {
    const onCreateNew = vi.fn();

    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
        onCreateNew={onCreateNew}
      />,
    );

    openSelector();

    fireEvent.click(
      screen.getByRole('button', {
        name: /registrar nuevo cliente/i,
      }),
    );

    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío y permite registrar el primer cliente', () => {
    const onCreateNew = vi.fn();

    render(
      <CustomerSelector
        options={[]}
        value=""
        onChange={() => undefined}
        onCreateNew={onCreateNew}
      />,
    );

    expect(
      screen.getByText(
        'No hay clientes registrados.',
      ),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', {
        name: /registrar primer cliente/i,
      }),
    );

    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('muestra carga y deshabilita el buscador', () => {
    render(
      <CustomerSelector
        options={[]}
        value=""
        loading
        onChange={() => undefined}
      />,
    );

    const search = screen.getByRole(
      'combobox',
      {
        name: 'Cliente',
      },
    ) as HTMLInputElement;

    expect(search.disabled).toBe(true);

    expect(
      search.getAttribute('aria-busy'),
    ).toBe('true');

    expect(
      screen.getByText('Cargando clientes...'),
    ).toBeDefined();
  });

  it('muestra errores de forma accesible', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        error="Selecciona un cliente"
        onChange={() => undefined}
      />,
    );

    const search = screen.getByRole(
      'combobox',
      {
        name: 'Cliente',
      },
    );

    expect(
      search.getAttribute('aria-invalid'),
    ).toBe('true');

    expect(
      screen.getByRole('alert').textContent,
    ).toBe('Selecciona un cliente');
  });

  it('muestra mensaje cuando la búsqueda no tiene resultados', () => {
    render(
      <CustomerSelector
        options={customers}
        value=""
        onChange={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Cliente',
      }),
      {
        target: {
          value: 'Cliente inexistente',
        },
      },
    );

    expect(
      screen.getByText(
        'No se encontraron clientes.',
      ),
    ).toBeDefined();
  });
});