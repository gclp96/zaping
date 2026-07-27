'use client';

import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-8">Zaping ERP</h1>

      <nav className="flex flex-col gap-5 mt-10 text-lg">
        
        <Link href="/dashboard" className="hover:text-blue-300 transition">
       Dashboard
        </Link>
        <Link href="/customers" className="hover:text-blue-300 transition">
       Clientes
        </Link>  
        <Link href="/suppliers" className="hover:text-blue-300 transition">
       Proveedores
        </Link>   
        <Link href="/products" className="hover:text-blue-300 transition">
       Productos
        </Link> 
        <Link href="/inventory" className="hover:text-blue-300 transition">
       Inventario
        </Link>
        <Link href="/quotes" className="hover:text-blue-300 transition">
       Cotizaciones
        </Link>
        <Link href="/purchases" className="hover:text-blue-300 transition">
       Compras
        </Link>
     <Link href="/sales" className="hover:text-blue-300 transition">
       Ventas
      </Link>
      </nav>
    </aside>
  );
}