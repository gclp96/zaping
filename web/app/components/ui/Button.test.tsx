import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import Button from './Button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('aplica ancho completo cuando fullWidth es true', () => {
    render(<Button fullWidth>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });

    expect(button.classList.contains('w-full')).toBe(true);
    expect(button.classList.contains('fullWidth')).toBe(false);
  });

  it('conserva el ancho por contenido de forma predeterminada', () => {
    render(<Button>Guardar</Button>);

    expect(
      screen.getByRole('button', { name: 'Guardar' }).classList.contains(
        'w-full',
      ),
    ).toBe(false);
  });

  it.each([
    ['primary', 'bg-blue-600'],
    ['secondary', 'bg-gray-600'],
    ['danger', 'bg-red-600'],
    ['success', 'bg-green-600'],
    ['outline', 'border-gray-300'],
  ] as const)(
    'conserva la variante %s',
    (variant, expectedClass) => {
      render(<Button variant={variant}>Acción {variant}</Button>);

      expect(
        screen.getByRole('button', {
          name: `Acción ${variant}`,
        }).classList.contains(expectedClass),
      ).toBe(true);
    },
  );

  it('conserva el estado de carga y deshabilita la acción', () => {
    render(
      <Button loading loadingText="Guardando...">
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button', {
      name: 'Guardando...',
    });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Guardar')).toBeNull();
  });
});
