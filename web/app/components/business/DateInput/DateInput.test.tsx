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

import DateInput from './DateInput';

afterEach(() => {
  cleanup();
});

describe('DateInput', () => {
  it('muestra el valor recibido', () => {
    render(
      <DateInput
        label="Fecha de caducidad"
        value="2026-08-17"
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText(
      /fecha de caducidad/i,
    ) as HTMLInputElement;

    expect(input.value).toBe('2026-08-17');
  });

  it('utiliza un input de tipo date', () => {
    render(
      <DateInput
        label="Fecha"
        value=""
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText(
      /fecha/i,
    ) as HTMLInputElement;

    expect(input.type).toBe('date');
  });

  it('devuelve la fecha seleccionada sin transformarla', () => {
    const onValueChange = vi.fn();

    render(
      <DateInput
        label="Fecha"
        value=""
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/fecha/i),
      {
        target: {
          value: '2026-12-31',
        },
      },
    );

    expect(onValueChange).toHaveBeenCalledWith(
      '2026-12-31',
    );
  });

  it('permite devolver un valor vacío', () => {
    const onValueChange = vi.fn();

    render(
      <DateInput
        label="Fecha"
        value="2026-08-17"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/fecha/i),
      {
        target: {
          value: '',
        },
      },
    );

    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('respeta la fecha mínima', () => {
    render(
      <DateInput
        label="Fecha"
        value=""
        min="2026-08-17"
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText(
      /fecha/i,
    ) as HTMLInputElement;

    expect(input.min).toBe('2026-08-17');
  });

  it('respeta la fecha máxima', () => {
    render(
      <DateInput
        label="Fecha"
        value=""
        max="2027-08-17"
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText(
      /fecha/i,
    ) as HTMLInputElement;

    expect(input.max).toBe('2027-08-17');
  });

  it('respeta required y disabled heredados de Input', () => {
    render(
      <DateInput
        label="Fecha"
        value=""
        required
        disabled
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText(
      /fecha/i,
    ) as HTMLInputElement;

    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
  });

  it('muestra errores de forma accesible', () => {
    render(
      <DateInput
        label="Fecha"
        value=""
        error="Selecciona una fecha válida"
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText(/fecha/i);

    expect(
      input.getAttribute('aria-invalid'),
    ).toBe('true');

    expect(
      screen.getByRole('alert').textContent,
    ).toBe('Selecciona una fecha válida');
  });

  it('muestra el texto auxiliar', () => {
    render(
      <DateInput
        label="Fecha"
        value=""
        helperText="Utiliza la fecha indicada en el producto."
        onValueChange={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        'Utiliza la fecha indicada en el producto.',
      ),
    ).toBeDefined();
  });
});