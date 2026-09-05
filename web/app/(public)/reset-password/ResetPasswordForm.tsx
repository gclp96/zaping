'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type FormValues = {
  newPassword: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  newPassword: '',
  confirmPassword: '',
};

const invalidTokenMessage = 'El enlace no es válido o ha expirado.';
const genericResetError =
  'No fue posible restablecer la contraseña. Intenta de nuevo.';

function InvalidResetLink() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        <p role="alert" className="mt-6 text-sm leading-6 text-red-700">
          {invalidTokenMessage}
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          Solicitar un nuevo enlace
        </Link>
      </div>
    </main>
  );
}

function ResetSuccess() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        <div className="mt-6 space-y-5">
          <p role="status" className="text-sm leading-6 text-gray-700">
            Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.
          </p>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(() => {
    return searchParams.get('token') || null;
  });
  const capturedTokenRef = useRef(false);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (capturedTokenRef.current) {
      return;
    }

    capturedTokenRef.current = true;
    const queryToken = searchParams.get('token');

    if (!queryToken) {
      return;
    }

    router.replace('/reset-password');
  }, [router, searchParams]);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError('');
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!values.newPassword) {
      nextErrors.newPassword = 'La nueva contraseña es obligatoria.';
    } else if (values.newPassword.length < 8) {
      nextErrors.newPassword =
        'La nueva contraseña debe tener al menos 8 caracteres.';
    }

    if (!values.confirmPassword) {
      nextErrors.confirmPassword =
        'La confirmación de contraseña es obligatoria.';
    } else if (values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !token || !validateForm()) {
      return;
    }

    setSubmitting(true);
    setApiError('');

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: values.newPassword,
      });
      setSubmitted(true);
      setToken(null);
      setValues(initialValues);
      setErrors({});
    } catch (error) {
      const message = getApiErrorMessage(error, genericResetError);

      if (message.includes(invalidTokenMessage)) {
        setToken(null);
        setValues(initialValues);
        setErrors({});
        setApiError('');
      } else {
        setApiError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <ResetSuccess />;
  }

  if (!token) {
    return <InvalidResetLink />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>

        <form noValidate className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <p className="text-sm leading-6 text-gray-700">
            Define una nueva contraseña para tu cuenta.
          </p>

          <Input
            label="Nueva contraseña"
            type="password"
            value={values.newPassword}
            required
            minLength={8}
            autoComplete="new-password"
            error={errors.newPassword}
            disabled={submitting}
            onChange={(event) => updateValue('newPassword', event.target.value)}
          />

          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={values.confirmPassword}
            required
            autoComplete="new-password"
            error={errors.confirmPassword}
            disabled={submitting}
            onChange={(event) =>
              updateValue('confirmPassword', event.target.value)
            }
          />

          {apiError ? (
            <p role="alert" className="text-sm text-red-700">
              {apiError}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            loadingText="Restableciendo..."
          >
            Restablecer contraseña
          </Button>
        </form>

        <div className="mt-5 text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
