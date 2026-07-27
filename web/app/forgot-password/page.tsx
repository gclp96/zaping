'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import Input from '@/app/components/ui/Input';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);

      await api.post('/auth/reset-password', {
        email,
        password,
      });

      alert('Si el correo existe, la contraseña fue actualizada.');
      router.push('/login');
    } catch (error) {
      console.error(error);
      alert('No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleResetPassword}
        className="w-full max-w-md p-8 border rounded-lg"
      >
        <h1 className="text-2xl font-bold mb-6">Restablecer contraseña</h1>

        <div className="space-y-4">
          <Input
            label="Correo"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Nueva contraseña"
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />

          <Input
            label="Confirmar contraseña"
            type="password"
            value={confirmPassword}
            required
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition disabled:bg-gray-400"
        >
          {loading ? 'Actualizando...' : 'Restablecer contraseña'}
        </button>

        <div className="mt-5 text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Volver al login
          </Link>
        </div>
      </form>
    </div>
  );
}
