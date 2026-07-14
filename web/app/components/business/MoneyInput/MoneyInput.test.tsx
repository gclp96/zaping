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

import MoneyInput from './MoneyInput';

afterEach(() => {
  cleanup();
});

describe('MoneyInput', () => {
  it('muestra el símbolo y la moneda', () => {
    render(
      <MoneyInput
        label="Precio"
        value=""
        onValueChange={() => undefined}
      />,
    );

    expect(screen.getByText('$')).toBeDefined();
    expect(screen.getByText('MXN')).toBeDefined();
  });

  it('utiliza inputMode decimal', () => {
    render(
      <MoneyInput
        label="Precio"
        value=""
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText('Precio');

    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.getAttribute('type')).toBe('text');
  });

  it('normaliza coma a punto', () => {
    const onValueChange = vi.fn();

    render(
      <MoneyInput
        label="Precio"
        value=""
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Precio'), {
      target: {
        value: '100,50',
      },
    });

    expect(onValueChange).toHaveBeenCalledWith('100.50');
  });

  it('ignora una entrada inválida', () => {
    const onValueChange = vi.fn();

    render(
      <MoneyInput
        label="Precio"
        value=""
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Precio'), {
      target: {
        value: 'abc',
      },
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('expone el estado de error de forma accesible', () => {
    render(
      <MoneyInput
        label="Precio"
        value=""
        error="El precio es obligatorio"
        onValueChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText('Precio');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('El precio es obligatorio'),
    ).toBeDefined();
  });
});