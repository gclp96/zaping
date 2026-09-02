import { Suspense } from 'react';
import type { Metadata } from 'next';

import ResetPasswordForm from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  referrer: 'no-referrer',
};

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        <p className="mt-6 text-sm leading-6 text-gray-700">Cargando...</p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
