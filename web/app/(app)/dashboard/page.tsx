'use client';

import { useEffect, useState } from 'react';

import { api } from '@/services/api';

import Card from '@/app/components/ui/Card';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

type DashboardData = {
  totals: {
    customers: number;
    suppliers: number;
    products: number;
    quotes: number;
    purchases: number;
    sales: number;
  };
  inventoryValue: number;
  lowStockProducts: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const recentSales = [
    {
      folio: 'V-1001',
      customer: 'Hospital San José',
      total: '$12,500',
    },
    {
      folio: 'V-1002',
      customer: 'Clínica Norte',
      total: '$8,200',
    },
  ];

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await api.get('/dashboard');
        setData(response.data);
      } catch (error) {
        console.error(error);
      }
    }

    loadDashboard();
  }, []);

  if (!data) {
    return <Loading message="Cargando dashboard..." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Resumen general de la actividad de la empresa."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-muted-foreground">Clientes</p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.totals.customers.toLocaleString()}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">Proveedores</p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.totals.suppliers}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">Productos</p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.totals.products}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">Cotizaciones</p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.totals.quotes}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">Compras</p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.totals.purchases}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">Ventas</p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.totals.sales}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">
            Valor del inventario
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            ${data.inventoryValue.toLocaleString()}
          </h2>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">
            Stock bajo
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            {data.lowStockProducts}
          </h2>
        </Card>
      </div>

      <Section title="Ventas recientes">
        <Table
          headers={['Folio', 'Cliente', 'Total']}
          data={recentSales}
        />
      </Section>
    </PageContainer>
  );
}