import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage from './page';
import { api } from '@/services/api';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the recovery request form without password reset inputs', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeTruthy();
    expect(screen.getByLabelText(/Correo electrónico/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar instrucciones' })).toBeTruthy();
    expect(screen.queryByLabelText(/Nueva contraseña/i)).toBeNull();
    expect(screen.queryByLabelText(/Confirmar contraseña/i)).toBeNull();
  });

  it('validates the email before submitting', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));

    expect(screen.getByText('El correo electrónico es obligatorio.')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits the email and shows a generic success message', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/Correo electrónico/), ' user@example.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'user@example.com',
      });
    });
    expect(
      await screen.findByText(
        'Si la cuenta existe, recibirás instrucciones para restablecer tu contraseña.',
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('link', { name: 'Volver a iniciar sesión' }),
    ).toHaveLength(1);
  });

  it('keeps a navigation path back to login', () => {
    render(<ForgotPasswordPage />);

    expect(
      screen
        .getAllByRole('link', {
          name: /Volver a iniciar sesión/i,
        })
        .every((link) => link.getAttribute('href') === '/login'),
    ).toBe(true);
  });
});
