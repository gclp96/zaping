'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type LowStockProduct = {
  id: string;
  name: string;
  stock: number;
  minStock: number;
};

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
  lowStock: LowStockProduct[];
};

type Sale = {
  id: string;
  folio: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | string;
  total: number;
  createdAt: string;
  customer?: {
    name?: string | null;
  } | null;
};

type SalesState = {
  loading: boolean;
  error: string;
  items: Sale[];
};

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const numberFormatter = new Intl.NumberFormat('es-MX');

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function getSaleStatusDescriptor(status: Sale['status']) {
  if (status === 'DRAFT') {
    return {
      label: 'Borrador',
      tone: 'neutral' as const,
    };
  }

  if (status === 'CONFIRMED') {
    return {
      label: 'Confirmada',
      tone: 'success' as const,
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: 'Cancelada',
      tone: 'danger' as const,
    };
  }

  return {
    label: status,
    tone: 'info' as const,
  };
}

function KpiCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <Card className="h-full transition hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salesState, setSalesState] = useState<SalesState>({
    loading: true,
    error: '',
    items: [],
  });

  const recentSales = useMemo(
    () => salesState.items.slice(0, 5),
    [salesState.items],
  );

  const loadSales = useCallback(async () => {
    setSalesState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    try {
      const response = await api.get<Sale[]>('/sales');

      setSalesState({
        loading: false,
        error: '',
        items: response.data,
      });
    } catch (loadError: unknown) {
      console.error(loadError);

      setSalesState({
        loading: false,
        error: getApiErrorMessage(
          loadError,
          'No fue posible cargar las ventas recientes.',
        ),
        items: [],
      });
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setSalesState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    const [dashboardResult, salesResult] = await Promise.allSettled([
      api.get<DashboardData>('/dashboard'),
      api.get<Sale[]>('/sales'),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      setData(dashboardResult.value.data);
      setError('');
    } else {
      console.error(dashboardResult.reason);
      setData(null);
      setError(
        getApiErrorMessage(
          dashboardResult.reason,
          'No fue posible cargar el dashboard.',
        ),
      );
    }

    if (salesResult.status === 'fulfilled') {
      setSalesState({
        loading: false,
        error: '',
        items: salesResult.value.data,
      });
    } else {
      console.error(salesResult.reason);
      setSalesState({
        loading: false,
        error: getApiErrorMessage(
          salesResult.reason,
          'No fue posible cargar las ventas recientes.',
        ),
        items: [],
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
  }, [loadDashboard]);

  if (loading) {
    return (
      <PageContainer>
        <h1 className="sr-only">Resumen operativo</h1>
        <Loading message="Cargando dashboard..." />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <h1 className="sr-only">Resumen operativo</h1>
        <Card className="border border-red-100">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                No fue posible cargar el dashboard
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {error || 'Intenta nuevamente.'}
              </p>
            </div>

            <Button type="button" onClick={() => void loadDashboard()}>
              Reintentar
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Resumen operativo"
        description="Estado actual de tu operación."
      />

      <section
        aria-label="Resumen operacional"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <KpiCard
          label="Valor de inventario"
          value={formatMoney(data.inventoryValue)}
          href="/inventory"
        />
        <KpiCard
          label="Stock bajo"
          value={formatNumber(data.lowStockProducts)}
          href="/inventory"
        />
        <KpiCard
          label="Ventas"
          value={formatNumber(data.totals.sales)}
        />
        <KpiCard
          label="Compras"
          value={formatNumber(data.totals.purchases)}
          href="/purchases"
        />
        <KpiCard
          label="Cotizaciones"
          value={formatNumber(data.totals.quotes)}
          href="/quotes"
        />
        <KpiCard
          label="Productos"
          value={formatNumber(data.totals.products)}
          href="/products"
        />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section
          title="Requiere atención"
          description="Productos que están en o por debajo del mínimo definido."
        >
          {data.lowStock.length === 0 ? (
            <EmptyState
              title="No hay productos con stock bajo"
              description="Todos los productos están por encima de su mínimo configurado."
            />
          ) : (
            <div className="space-y-3">
              {data.lowStock.map((product) => (
                <Card key={product.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Stock actual: {formatNumber(product.stock)}
                      </p>
                    </div>

                    <div className="text-sm font-medium text-slate-700">
                      Mínimo: {formatNumber(product.minStock)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Ventas recientes"
          description="Últimas ventas registradas en la operación."
        >
          {salesState.loading ? (
            <Loading message="Cargando ventas recientes..." />
          ) : salesState.error ? (
            <Card className="border border-yellow-100">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Ventas recientes no disponibles
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {salesState.error}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadSales()}
                >
                  Reintentar ventas
                </Button>
              </div>
            </Card>
          ) : recentSales.length === 0 ? (
            <EmptyState
              title="No hay ventas registradas"
              description="Cuando existan ventas, aparecerán aquí."
            />
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => {
                const status = getSaleStatusDescriptor(sale.status);

                return (
                  <Card key={sale.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {sale.folio}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {sale.customer?.name || 'Cliente no especificado'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(sale.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <StatusBadge
                          label={status.label}
                          tone={status.tone}
                          ariaLabel={`Estado de la venta: ${status.label}`}
                        />
                        <p className="font-semibold text-slate-900">
                          {formatMoney(sale.total)}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
