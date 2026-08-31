import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ForgotPasswordPage from './page';

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the temporary safe recovery state without password reset inputs', () => {
    render(<ForgotPasswordPage />);

    expect(
      screen.getByText(
        /Recuperación de contraseña no disponible temporalmente/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/Nueva contraseña/i)).toBeNull();
    expect(screen.queryByLabelText(/Confirmar contraseña/i)).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /Restablecer contraseña/i,
      }),
    ).toBeNull();
  });

  it('keeps a navigation path back to login', () => {
    render(<ForgotPasswordPage />);

    expect(
      screen
        .getByRole('link', {
          name: /Volver al login/i,
        })
        .getAttribute('href'),
    ).toBe('/login');
  });
});
