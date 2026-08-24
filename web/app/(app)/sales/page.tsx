'use client';

import { useEffect, useMemo, useState } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import { getSaleStatusDescriptor } from './sale-status';

import type { Sale, SaleStatus } from './types';

type StatusFilter = 'ALL' | SaleStatus;

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const statusFilterOptions: Array<{
  value: StatusFilter;
  label: string;
}> = [
  {
    value: 'ALL',
    label: 'Todas',
  },
  {
    value: 'DRAFT',
    label: 'Borrador',
  },
  {
    value: 'CONFIRMED',
    label: 'Confirmada',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelada',
  },
];

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function getCustomerName(sale: Sale): string {
  return sale.customer?.name ?? 'Cliente no disponible';
}

function getItemCountLabel(count: number): string {
  return count === 1 ? '1 partida' : `${count} partidas`;
}

function matchesSearch(sale: Sale, normalizedSearch: string): boolean {
  if (!normalizedSearch) {
    return true;
  }

  return (
    sale.folio.toLowerCase().includes(normalizedSearch) ||
    getCustomerName(sale).toLowerCase().includes(normalizedSearch)
  );
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');

  async function loadSales() {
    try {
      setPageLoading(true);
      setPageError('');

      const response = await api.get<Sale[]>('/sales');

      setSales(response.data);
    } catch (error: unknown) {
      console.error(error);

      setPageError(
        getApiErrorMessage(
          error,
          'No fue posible cargar la información de ventas.',
        ),
      );
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSales();
  }, []);

  const filteredSales = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sales.filter((sale) => {
      const statusMatches =
        statusFilter === 'ALL' || sale.status === statusFilter;

      return statusMatches && matchesSearch(sale, normalizedSearch);
    });
  }, [sales, search, statusFilter]);

  const tableData = filteredSales.map((sale) => {
    const statusDescriptor = getSaleStatusDescriptor(sale.status);

    return {
      folio: sale.folio,
      customer: getCustomerName(sale),
      date: formatDate(sale.createdAt),
      items: getItemCountLabel(sale.items.length),
      total: formatMoney(sale.total),
      status: (
        <StatusBadge
          label={statusDescriptor.label}
          tone={statusDescriptor.tone}
          ariaLabel={`Estado de la venta: ${statusDescriptor.label}`}
        />
      ),
    };
  });

  return (
    <PageContainer>
      <PageHeader
        title="Ventas"
        description="Consulta y da seguimiento a las ventas registradas."
      />

      {pageLoading ? (
        <Loading message="Cargando ventas..." />
      ) : pageError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          <p>{pageError}</p>

          <button
            type="button"
            className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
            onClick={() => void loadSales()}
          >
            Reintentar
          </button>
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          title="No hay ventas registradas"
          description="Las ventas aparecerán aquí cuando existan registros."
        />
      ) : (
        <Section>
          <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <Input
              label="Buscar"
              type="search"
              value={search}
              placeholder="Buscar por folio o cliente"
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="flex w-full flex-col gap-2">
              <label
                htmlFor="sales-status-filter"
                className="text-sm font-medium text-gray-700"
              >
                Estado
              </label>

              <select
                id="sales-status-filter"
                value={statusFilter}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <EmptyState
              title="No se encontraron ventas"
              description="No se encontraron ventas con los filtros seleccionados."
            />
          ) : (
            <Table
              headers={[
                'Folio',
                'Cliente',
                'Fecha',
                'Partidas',
                'Total',
                'Estado',
              ]}
              data={tableData}
            />
          )}
        </Section>
      )}
    </PageContainer>
  );
}
