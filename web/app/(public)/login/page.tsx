'use client';

import Input from '@/app/components/ui/Input';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import Button from '@/app/components/ui/Button';

export  default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();

        try {
            const response = await api.post('/auth/login', {
                email,
                password,
            });

            localStorage.setItem('token', response.data.token);

            router.push('/home');
        }   catch (error) {
            console.error(error);
            alert('Credenciales inválidas');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <form
             onSubmit={handleLogin}
             className="w-full max-w-md p-8 border rounded-lg"
             >
                <h1 className="text-2xl font-bold mb-6">Login</h1>

                  <div className="space-y-4">
                    <Input
                        label="Correo"
                        type="email"
                        placeholder="admin@insap.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <Input
                        label="Contraseña"
                        type="password"
                        placeholder="******"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    </div>

                    <Button type="submit" className="w-full p-3">
                        Iniciar sesión
                    </Button>

                    <div className="mt-5 flex items-center justify-between text-sm">
                        <Link
                            href="/forgot-password"
                            className="text-blue-600 hover:text-blue-800"
                        >
                            Olvidé mi contraseña
                        </Link>

                        <Link
                            href="/register"
                            className="font-medium text-blue-600 hover:text-blue-800"
                        >
                            Crear cuenta
                        </Link>
                    </div>
             </form>
        </div>
    );
}
