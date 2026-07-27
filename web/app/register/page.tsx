'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import Input from '@/app/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [rfc, setRfc] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/auth/register', {
        companyName,
        tradeName,
        rfc,
        firstName,
        lastName,
        email,
        password,
      });

      localStorage.setItem('token', response.data.token);
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
      alert('No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-2xl p-8 border rounded-lg"
      >
        <h1 className="text-2xl font-bold mb-6">Crear cuenta</h1>

        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label="Empresa"
            value={companyName}
            required
            onChange={(e) => setCompanyName(e.target.value)}
          />

          <Input
            label="Nombre comercial"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
          />

          <Input
            label="RFC"
            value={rfc}
            required
            onChange={(e) => setRfc(e.target.value)}
          />

          <Input
            label="Nombre"
            value={firstName}
            required
            onChange={(e) => setFirstName(e.target.value)}
          />

          <Input
            label="Apellido"
            value={lastName}
            required
            onChange={(e) => setLastName(e.target.value)}
          />

          <Input
            label="Correo"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Contraseña"
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
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <div className="mt-5 text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Ya tengo cuenta
          </Link>
        </div>
      </form>
    </div>
  );
}
