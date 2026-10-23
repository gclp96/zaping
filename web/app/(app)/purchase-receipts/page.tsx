'use client';

import Link from 'next/link';
import { Eye, RotateCcw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import { hasRole, WAREHOUSE_ROLES } from '@/app/erp-role-access';
import { paginateRows, stableSort } from '@/app/client-table.utils';
import Button from '@/app/components/ui/Button';
import DataTable, {
  type DataTableColumn,
  type SortState,
} from '@/app/components/ui/DataTable';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
import Input from '@/app/components/ui/Input';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';

import {
  formatReceiptDate,
  getReceiptResponsibleLabel,
  receiptMatchesSearch,
} from './receipt-display';
import type { PurchaseReceiptListItem } from './types';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const receiptCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

function compareReceipts(
  first: PurchaseReceiptListItem,
  second: PurchaseReceiptListItem,
  columnId: string,
): number {
  if (columnId === 'receivedAt') {
    return (
      new Date(first.receivedAt).getTime() -
      new Date(second.receivedAt).getTime()
    );
  }

  if (columnId === 'folio') {
    return receiptCollator.compare(first.folio, second.folio);
  }

  if (columnId === 'purchase') {
    return receiptCollator.compare(
      first.purchase.folio,
      second.purchase.folio,
    );
  }

  if (columnId === 'supplier') {
    return receiptCollator.compare(
      first.purchase.supplier.name,
      second.purchase.supplier.name,
    );
  }

  return 0;
}

export default function PurchaseReceiptsPage() {
  const sessionState = useAuthenticatedSession();
  const currentUserRole =
    sessionState.status === 'success'
      ? sessionState.user?.role ?? null
      : null;
  const sessionForbidsAccess = Boolean(
    sessionState.status === 'success' &&
      currentUserRole &&
      !hasRole(currentUserRole, WAREHOUSE_ROLES),
  );
  const [receipts, setReceipts] = useState<PurchaseReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortState>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filteredReceipts = useMemo(
    () => receipts.filter((receipt) => receiptMatchesSearch(receipt, search)),
    [receipts, search],
  );

  const sortedReceipts = useMemo(() => {
    if (!sorting) {
      return filteredReceipts;
    }

    return stableSort(
      filteredReceipts,
      (first, second) =>
        compareReceipts(first, second, sorting.columnId),
      sorting.direction,
    );
  }, [filteredReceipts, sorting]);

  const paginatedReceipts = useMemo(
    () => paginateRows(sortedReceipts, pageIndex, pageSize),
    [pageIndex, pageSize, sortedReceipts],
  );

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get<PurchaseReceiptListItem[]>(
        '/purchase-receipts',
      );

      setReceipts(response.data);
      setPageIndex(0);
    } catch (requestError: unknown) {
      if (isForbiddenError(requestError)) {
        setForbidden(true);
        setReceipts([]);
        return;
      }
      setError(
        getApiErrorMessage(
          requestError,
          'No fue posible cargar las recepciones.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionState.status === 'loading') {
      return;
    }

    if (
      sessionState.status === 'success' &&
      currentUserRole &&
      !hasRole(currentUserRole, WAREHOUSE_ROLES)
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReceipts();
  }, [currentUserRole, loadReceipts, sessionState.status]);

  function clearFilters() {
    setSearch('');
    setPageIndex(0);
  }

  const receiptColumns: DataTableColumn<PurchaseReceiptListItem>[] = [
    {
      id: 'folio',
      header: 'Folio',
      sortable: true,
      priority: 'primary',
      minWidth: 130,
      cell: (receipt) => (
        <Link
          href={`/purchase-receipts/${receipt.id}`}
          className="inline-block rounded-sm font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          {receipt.folio}
        </Link>
      ),
    },
    {
      id: 'purchase',
      header: 'Compra',
      sortable: true,
      priority: 'primary',
      minWidth: 120,
      cell: (receipt) => (
        <span className="font-medium text-text-secondary">
          {receipt.purchase.folio}
        </span>
      ),
    },
    {
      id: 'supplier',
      header: 'Proveedor',
      sortable: true,
      priority: 'primary',
      minWidth: 150,
      cell: (receipt) => (
        <span className="block max-w-56 break-words font-medium text-text">
          {receipt.purchase.supplier.name}
        </span>
      ),
    },
    {
      id: 'receivedAt',
      header: 'Fecha de recepción',
      sortable: true,
      priority: 'secondary',
      minWidth: 160,
      cell: (receipt) => formatReceiptDate(receipt.receivedAt),
    },
    {
      id: 'responsible',
      header: 'Responsable',
      priority: 'secondary',
      minWidth: 140,
      cell: (receipt) =>
        getReceiptResponsibleLabel(receipt.receivedByUser),
    },
    {
      id: 'items',
      header: 'Partidas',
      align: 'end',
      priority: 'tertiary',
      minWidth: 85,
      cell: (receipt) => (
        <span className="tabular-nums">{receipt.items.length}</span>
      ),
    },
    {
      id: 'units',
      header: 'Unidades',
      align: 'end',
      priority: 'tertiary',
      minWidth: 90,
      cell: (receipt) => (
        <span className="font-semibold tabular-nums">
          {receipt.items.reduce(
            (total, item) => total + item.quantityReceived,
            0,
          )}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      align: 'end',
      priority: 'primary',
      minWidth: 100,
      cell: (receipt) => (
        <Link
          href={`/purchase-receipts/${receipt.id}`}
          aria-label={`Ver recepción ${receipt.folio}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <Eye aria-hidden="true" size={16} />
          Ver
        </Link>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="rounded-xl border border-border border-t-4 border-t-blue-600 bg-surface p-5 sm:p-6 [&>div]:mb-0">
        <PageHeader
          title="Recepciones"
          description="Consulta las entradas de mercancía y su trazabilidad operativa."
        />
      </div>

      {forbidden || sessionForbidsAccess ? (
        <ForbiddenState />
      ) : loading ? (
        <Loading message="Cargando recepciones..." />
      ) : error ? (
        <Section>
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadReceipts()}
            >
              Reintentar
            </Button>
          </div>
        </Section>
      ) : receipts.length === 0 ? (
        <EmptyState
          title="Sin recepciones registradas"
          description="Todavía no existen entradas de mercancía registradas."
        />
      ) : (
        <Section
          title="Historial de recepciones"
          description="Recepciones registradas para las compras de la compañía."
        >
          <p className="text-sm text-text-muted sm:hidden">
            Desliza la tabla para consultar todos los datos y acciones.
          </p>
          <DataTable
            caption="Listado de recepciones"
            rows={paginatedReceipts}
            columns={receiptColumns}
            getRowId={(receipt) => receipt.id}
            sorting={{
              state: sorting,
              onChange: setSorting,
            }}
            toolbar={
              <div role="group" aria-label="Controles de tabla" className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <Input
                  label="Buscar recepciones"
                  type="search"
                  value={search}
                  placeholder="Folio de recepción, OC o proveedor"
                  helperText="También puedes buscar por responsable, producto o SKU."
                  startAdornment={<Search aria-hidden="true" size={17} />}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPageIndex(0);
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p role="status" className="text-sm text-text-muted">
                    {filteredReceipts.length} de {receipts.length} recepciones
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={clearFilters} disabled={!Boolean(search.trim())}>
                    <RotateCcw aria-hidden="true" size={16} />
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            }
            pagination={{
              pageIndex,
              pageSize,
              totalRows: sortedReceipts.length,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              onPageChange: setPageIndex,
              onPageSizeChange: (nextPageSize) => {
                setPageSize(nextPageSize);
                setPageIndex(0);
              },
            }}
            emptyState={{
              title: 'Sin recepciones registradas',
              description:
                'Todavía no existen entradas de mercancía registradas.',
            }}
            filteredEmptyState={{
              title: 'Sin recepciones coincidentes',
              description:
                'Ninguna recepción coincide con la búsqueda actual.',
            }}
            isFiltered={Boolean(search.trim())}
          />
        </Section>
      )}
    </PageContainer>
  );
}
