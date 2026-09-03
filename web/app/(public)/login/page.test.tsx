import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';

import LoginPage from './page';

const navigationMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock,
}));

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('stores the token and navigates successful login to home', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { token: 'session-token' },
    } as never);

    render(<LoginPage />);
    await user.type(screen.getByLabelText('Correo'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secure-password');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'user@example.com',
        password: 'secure-password',
      });
      expect(localStorage.getItem('token')).toBe('session-token');
      expect(navigationMock.push).toHaveBeenCalledWith('/home');
    });
    expect(navigationMock.push).not.toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect when credentials are invalid', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);
    await user.type(screen.getByLabelText('Correo'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Credenciales inválidas');
    });
    expect(navigationMock.push).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('does not redirect when the login API fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Service unavailable'));

    render(<LoginPage />);
    await user.type(screen.getByLabelText('Correo'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secure-password');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Credenciales inválidas');
    });
    expect(navigationMock.push).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
