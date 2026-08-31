'use client';

import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 border rounded-lg">
        <h1 className="text-2xl font-bold mb-6">Restablecer contraseña</h1>

        <p className="text-sm leading-6 text-gray-700">
          Recuperación de contraseña no disponible temporalmente. Contacta al
          administrador de tu organización.
        </p>

        <div className="mt-5 text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}
