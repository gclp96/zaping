import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';

import ResetPasswordForm from './ResetPasswordForm';

const navigationMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const searchParamsMock = vi.hoisted(() => ({
  token: 'reset-token',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock,
  useSearchParams: () =>
    new URLSearchParams(
      searchParamsMock.token ? { token: searchParamsMock.token } : {},
    ),
}));

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

function apiError(message: string, status = 400) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: {
        message,
      },
    },
  };
}

function getNewPasswordInput() {
  return screen.getByLabelText(/^Nueva contraseña/) as HTMLInputElement;
}

function getConfirmPasswordInput() {
  return screen.getByLabelText(/Confirmar nueva contraseña/) as HTMLInputElement;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(getNewPasswordInput(), 'new-secure-password');
  await user.type(getConfirmPasswordInput(), 'new-secure-password');
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsMock.token = 'reset-token';
  window.history.pushState(null, '', '/reset-password?token=reset-token');
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as never);
});

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

describe('ResetPasswordForm', () => {
  it('captures the query token and removes it from the route', async () => {
    render(<ResetPasswordForm />);

    expect(screen.getByRole('heading', { name: 'Restablecer contraseña' })).toBeTruthy();
    expect(getNewPasswordInput().type).toBe('password');
    expect(getConfirmPasswordInput().type).toBe('password');
    expect(getNewPasswordInput().autocomplete).toBe('new-password');
    expect(getConfirmPasswordInput().autocomplete).toBe('new-password');
    expect(screen.queryByText('reset-token')).toBeNull();

    await waitFor(() => {
      expect(navigationMock.replace).toHaveBeenCalledWith('/reset-password');
    });
  });

  it('shows an invalid-link state when the token is missing or lost on refresh', () => {
    searchParamsMock.token = '';
    window.history.pushState(null, '', '/reset-password');

    render(<ResetPasswordForm />);

    expect(screen.getByText('El enlace no es válido o ha expirado.')).toBeTruthy();
    expect(screen.queryByLabelText(/^Nueva contraseña/)).toBeNull();
    expect(navigationMock.replace).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('validates the password fields before submitting', async () => {
    const user = userEvent.setup();

    render(<ResetPasswordForm />);
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(screen.getByText('La nueva contraseña es obligatoria.')).toBeTruthy();
    expect(
      screen.getByText('La confirmación de contraseña es obligatoria.'),
    ).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits only the token and new password, then clears the form', async () => {
    const user = userEvent.setup();

    render(<ResetPasswordForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'reset-token',
        newPassword: 'new-secure-password',
      });
    });
    expect(Object.keys(vi.mocked(api.post).mock.calls[0][1] as object)).toEqual([
      'token',
      'newPassword',
    ]);
    expect(screen.queryByLabelText(/^Nueva contraseña/)).toBeNull();
    expect(screen.queryByLabelText(/Confirmar nueva contraseña/)).toBeNull();
    expect(
      screen.getByText(
        'Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href'),
    ).toBe('/login');
  });

  it('removes the token after an invalid or expired-token response', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(
      apiError('El enlace no es válido o ha expirado.'),
    );

    render(<ResetPasswordForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(
      await screen.findByText('El enlace no es válido o ha expirado.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/^Nueva contraseña/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restablecer contraseña' })).toBeNull();
  });

  it('keeps the token and form values after a same-password response for retry', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(
      apiError('La nueva contraseña debe ser diferente de la actual.'),
    );

    render(<ResetPasswordForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(
      await screen.findByText(
        'La nueva contraseña debe ser diferente de la actual.',
      ),
    ).toBeTruthy();
    expect(getNewPasswordInput().value).toBe('new-secure-password');
    expect(getConfirmPasswordInput().value).toBe('new-secure-password');

    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2);
    });
    expect(api.post).toHaveBeenLastCalledWith('/auth/reset-password', {
      token: 'reset-token',
      newPassword: 'new-secure-password',
    });
  });

  it.each([
    ['a network error', new Error('Network Error')],
    ['a server error', apiError('Servicio temporalmente no disponible.', 503)],
  ])('keeps the token and form values after %s for retry', async (_label, error) => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(error);

    render(<ResetPasswordForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(
      await screen.findByText(
        error instanceof Error
          ? 'Network Error'
          : 'Servicio temporalmente no disponible.',
      ),
    ).toBeTruthy();
    expect(getNewPasswordInput().value).toBe('new-secure-password');
    expect(getConfirmPasswordInput().value).toBe('new-secure-password');

    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByText(
        'Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.',
      ),
    ).toBeTruthy();
  });

  it('prevents double submission while the request is pending', async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: unknown) => void = () => undefined;
    vi.mocked(api.post).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    render(<ResetPasswordForm />);
    await fillValidForm(user);
    const submitButton = screen.getByRole('button', {
      name: 'Restablecer contraseña',
    });

    await user.click(submitButton);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(submitButton);
    expect(api.post).toHaveBeenCalledTimes(1);

    resolveRequest({ data: { success: true } });
    await screen.findByText(
      'Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.',
    );
  });
});
