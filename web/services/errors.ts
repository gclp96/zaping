import axios from 'axios';

type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error',
) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join('\n');
    }

    if (message) {
      return message;
    }

    if (error.response?.data?.error) {
      return error.response.data.error;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
