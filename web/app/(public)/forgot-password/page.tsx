'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

const successMessage =
  'Si la cuenta existe, recibirás instrucciones para restablecer tu contraseña.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateEmail(value: string) {
    setEmail(value);
    setEmailError('');
    setApiError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setEmailError('El correo electrónico es obligatorio.');
      return;
    }

    setSubmitting(true);
    setApiError('');

    try {
      await api.post('/auth/forgot-password', {
        email: normalizedEmail,
      });
      setSubmitted(true);
    } catch (error) {
      setApiError(
        getApiErrorMessage(
          error,
          'No fue posible enviar la solicitud. Intenta de nuevo.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Recuperar contraseña</h1>

        {submitted ? (
          <div className="mt-6 space-y-5">
            <p role="status" className="text-sm leading-6 text-gray-700">
              {successMessage}
            </p>

            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form noValidate className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <p className="text-sm leading-6 text-gray-700">
              Ingresa el correo asociado a tu cuenta.
            </p>

            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              required
              autoComplete="email"
              error={emailError}
              disabled={submitting}
              onChange={(event) => updateEmail(event.target.value)}
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
              loadingText="Enviando..."
            >
              Enviar instrucciones
            </Button>
          </form>
        )}

        {!submitted ? (
          <div className="mt-5 text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:text-blue-800">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
