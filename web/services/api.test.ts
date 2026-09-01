import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from './api';

type AxiosRejectedHandler = (error: unknown) => Promise<never>;

function getResponseRejectedHandler() {
  const interceptors = api.interceptors.response as unknown as {
    handlers: Array<{
      rejected?: AxiosRejectedHandler;
    }>;
  };

  const rejected = interceptors.handlers[0]?.rejected;

  if (!rejected) {
    throw new Error('Missing response rejected interceptor');
  }

  return rejected;
}

function axiosError(status: number) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: {
        message: 'Error',
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.pushState(null, '', '/');
});

describe('api response interceptor', () => {
  it('does not clear the current session for form-level 400 errors', async () => {
    const rejected = getResponseRejectedHandler();
    localStorage.setItem('token', 'valid-token');
    window.history.pushState(null, '', '/change-password');

    await expect(rejected(axiosError(400))).rejects.toMatchObject({
      response: {
        status: 400,
      },
    });

    expect(localStorage.getItem('token')).toBe('valid-token');
    expect(window.location.pathname).toBe('/change-password');
  });

  it('clears the current session for 401 authentication errors', async () => {
    const rejected = getResponseRejectedHandler();
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    localStorage.setItem('token', 'expired-token');
    window.history.pushState(null, '', '/login');

    await expect(rejected(axiosError(401))).rejects.toMatchObject({
      response: {
        status: 401,
      },
    });

    expect(removeItemSpy).toHaveBeenCalledWith('token');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
