import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ForbiddenState from './ForbiddenState';

describe('ForbiddenState', () => {
  it('expone un estado claro y una CTA de teclado hacia Inicio', () => {
    render(<ForbiddenState />);

    expect(
      screen.getByRole('heading', { name: 'Sin permisos' }),
    ).toBeTruthy();
    expect(
      screen.getByText('No tienes permisos para acceder a esta sección.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Volver al inicio' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href'),
    ).toBe('/home');
  });
});
