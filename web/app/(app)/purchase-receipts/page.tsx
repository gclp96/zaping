'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import { hasRole, WAREHOUSE_ROLES } from '@/app/erp-role-access';
import { paginateRows, stableSort } from '@/app/client-table.utils';
import Button from '@/app/components/ui/Button';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
  type SortState,
} from '@/app/components/ui/DataTable';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
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
      console.error(requestError);
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
      minWidth: 150,
      cell: (receipt) => (
        <span className="font-semibold text-gray-900">
          {receipt.folio}
        </span>
      ),
    },
    {
      id: 'purchase',
      header: 'Compra',
      sortable: true,
      priority: 'primary',
      minWidth: 150,
      cell: (receipt) => receipt.purchase.folio,
    },
    {
      id: 'supplier',
      header: 'Proveedor',
      sortable: true,
      priority: 'primary',
      minWidth: 190,
      cell: (receipt) => receipt.purchase.supplier.name,
    },
    {
      id: 'receivedAt',
      header: 'Fecha de recepción',
      sortable: true,
      priority: 'secondary',
      minWidth: 170,
      cell: (receipt) => formatReceiptDate(receipt.receivedAt),
    },
    {
      id: 'responsible',
      header: 'Responsable',
      priority: 'secondary',
      minWidth: 170,
      cell: (receipt) =>
        getReceiptResponsibleLabel(receipt.receivedByUser),
    },
    {
      id: 'items',
      header: 'Partidas',
      priority: 'tertiary',
      minWidth: 100,
      cell: (receipt) => receipt.items.length,
    },
    {
      id: 'units',
      header: 'Unidades',
      priority: 'tertiary',
      minWidth: 105,
      cell: (receipt) =>
        receipt.items.reduce(
          (total, item) => total + item.quantityReceived,
          0,
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      priority: 'primary',
      minWidth: 110,
      cell: (receipt) => (
        <Link
          href={`/purchase-receipts/${receipt.id}`}
          aria-label={`Ver recepción ${receipt.folio}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          <Eye aria-hidden="true" size={16} />
          Ver
        </Link>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Recepciones"
        description="Consulta las entradas de mercancía y su trazabilidad operativa."
      />

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
              <DataTableToolbar
                search={{
                  value: search,
                  label: 'Buscar recepciones',
                  placeholder:
                    'Folio, compra, proveedor, responsable o producto',
                  onChange: (value) => {
                    setSearch(value);
                    setPageIndex(0);
                  },
                }}
                onReset={clearFilters}
                resetDisabled={!Boolean(search.trim())}
              />
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
