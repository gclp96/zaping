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
} from 'vitest';

import Select from './Select';

const options = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

afterEach(() => {
  cleanup();
});

describe('Select', () => {
  it('separa las clases base y las clases del container', () => {
    render(
      <Select
        label="Estado"
        value=""
        options={options}
        containerClassName="custom-container"
        onChange={() => undefined}
      />,
    );

    const container = screen.getByRole('combobox', {
      name: 'Estado',
    }).parentElement;

    expect(container).not.toBeNull();
    expect(container?.classList.contains('gap-2')).toBe(true);
    expect(container?.classList.contains('custom-container')).toBe(true);
  });

  it('separa los múltiples IDs de aria-describedby', () => {
    render(
      <>
        <p id="external-description">Descripción externa</p>
        <Select
          id="status"
          label="Estado"
          value=""
          options={options}
          helperText="Selecciona un estado"
          aria-describedby="external-description"
          onChange={() => undefined}
        />
      </>,
    );

    expect(
      screen.getByRole('combobox', { name: 'Estado' }).getAttribute(
        'aria-describedby',
      ),
    ).toBe('external-description status-description');
  });

  it('mantiene el error y el helper accesibles', () => {
    const { rerender } = render(
      <Select
        id="status"
        label="Estado"
        value=""
        options={options}
        error="Selecciona un estado"
        onChange={() => undefined}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Estado' });

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe(
      'status-description',
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Selecciona un estado',
    );

    rerender(
      <Select
        id="status"
        label="Estado"
        value=""
        options={options}
        helperText="Selecciona un estado"
        onChange={() => undefined}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Selecciona un estado').id).toBe(
      'status-description',
    );
  });

  it('mantiene la API de cambio existente', () => {
    const selectedValues: string[] = [];

    render(
      <Select
        label="Estado"
        value=""
        options={options}
        onChange={(event) => {
          selectedValues.push(event.target.value);
        }}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Estado' }),
      {
        target: { value: 'active' },
      },
    );

    expect(selectedValues).toEqual(['active']);
  });
});
