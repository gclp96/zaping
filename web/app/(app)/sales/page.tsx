'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuthenticatedSession } from '@/app/auth-session';
import { hasRole, COMMERCIAL_ROLES } from '@/app/erp-role-access';
import StatusBadge from '@/app/components/business/StatusBadge';
import { paginateRows, stableSort } from '@/app/client-table.utils';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
  type DataTableSelectFilter,
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

import SaleDetailModal from './components/SaleDetailModal';
import SaleFormModal from './components/SaleFormModal';
import { useSaleActions } from './hooks/useSaleActions';
import { useSaleDetail } from './hooks/useSaleDetail';
import { useSaleForm } from './hooks/useSaleForm';
import { getCompatibleSalesProducts } from './sale-form.utils';
import { getSaleStatusDescriptor } from './sale-status';

import type {
  Sale,
  SaleCustomer,
  SaleProduct,
  SaleStatus,
} from './types';

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

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const saleCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

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

function compareSales(
  first: Sale,
  second: Sale,
  columnId: string,
): number {
  if (columnId === 'date') {
    return (
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime()
    );
  }

  if (columnId === 'total') {
    return first.total - second.total;
  }

  if (columnId === 'folio') {
    return saleCollator.compare(first.folio, second.folio);
  }

  if (columnId === 'customer') {
    return saleCollator.compare(
      getCustomerName(first),
      getCustomerName(second),
    );
  }

  if (columnId === 'status') {
    return saleCollator.compare(
      getSaleStatusDescriptor(first.status).label,
      getSaleStatusDescriptor(second.status).label,
    );
  }

  return 0;
}

export default function SalesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <h1 className="sr-only">Ventas</h1>
          <Loading message="Cargando ventas..." />
        </PageContainer>
      }
    >
      <SalesPageContent />
    </Suspense>
  );
}

function SalesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionState = useAuthenticatedSession();
  const currentUserRole =
    sessionState.status === 'success'
      ? sessionState.user?.role ?? null
      : null;
  const canWrite = hasRole(currentUserRole, COMMERCIAL_ROLES);
  const sessionForbidsAccess = Boolean(
    sessionState.status === 'success' &&
      currentUserRole &&
      !hasRole(currentUserRole, COMMERCIAL_ROLES),
  );
  const saleId = searchParams.get('saleId')?.trim() || null;
  const openedSaleId = useRef<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<SaleCustomer[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');
  const [sorting, setSorting] = useState<SortState>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const compatibleProducts = useMemo(
    () => getCompatibleSalesProducts(products),
    [products],
  );

  async function loadSales() {
    const response = await api.get<Sale[]>('/sales');

    setSales(response.data);
    setPageIndex(0);
  }

  async function loadPageData() {
    try {
      setPageLoading(true);
      setPageError('');

      const [
        salesResponse,
        customersResponse,
        productsResponse,
      ] = await Promise.all([
        api.get<Sale[]>('/sales'),
        api.get<SaleCustomer[]>('/customers'),
        api.get<SaleProduct[]>('/products'),
      ]);

      setSales(salesResponse.data);
      setCustomers(customersResponse.data);
      setProducts(productsResponse.data);
      setPageIndex(0);
    } catch (error: unknown) {
      console.error(error);

      if (isForbiddenError(error)) {
        setForbidden(true);
        setSales([]);
        return;
      }

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
    if (sessionState.status === 'loading') {
      return;
    }

    if (
      sessionState.status === 'success' &&
      currentUserRole &&
      !hasRole(currentUserRole, COMMERCIAL_ROLES)
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPageData();
  }, [currentUserRole, sessionState.status]);

  const {
    saleIdToView,
    saleToView,
    detailLoading,
    detailError,
    openSaleDetail,
    openSaleDetailById,
    closeSaleDetail,
    loadSaleDetail,
    retrySaleDetail,
  } = useSaleDetail();

  useEffect(() => {
    if (!saleId) {
      openedSaleId.current = null;
      return;
    }

    if (openedSaleId.current === saleId) {
      return;
    }

    openedSaleId.current = saleId;
    void openSaleDetailById(saleId);
    // The sale-id guard makes this one-shot despite the local modal handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  function closeSaleDetailWithUrlCleanup() {
    closeSaleDetail();

    if (saleId) {
      router.replace('/sales');
    }
  }

  const {
    saleToApprove,
    saleToCancel,
    approving,
    cancelling,
    downloadingSaleId,
    actionError,
    clearActionError,
    openApproveDialog,
    closeApproveDialog,
    openCancelDialog,
    closeCancelDialog,
    handleApproveSale,
    handleCancelSale,
    handleDownloadPdf,
  } = useSaleActions({
    onSaleChanged: async (saleId: string) => {
      await Promise.all([
        loadSales(),
        loadSaleDetail(saleId),
      ]);
    },
  });

  const {
    openModal,
    saving,
    customerId,
    selectedProductId,
    quantity,
    items,
    customerError,
    productError,
    itemsError,
    formError,
    subtotal,
    iva,
    total,
    openCreateModal,
    closeCreateModal,
    handleCustomerChange,
    handleSelectedProductChange,
    handleFormQuantityChange,
    handleAddProduct,
    handleItemQuantityChange,
    handleRemoveItem,
    handleCreateSale,
  } = useSaleForm({
    products: compatibleProducts,
    onSaleSaved: loadSales,
  });

  const filteredSales = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sales.filter((sale) => {
      const statusMatches =
        statusFilter === 'ALL' || sale.status === statusFilter;

      return statusMatches && matchesSearch(sale, normalizedSearch);
    });
  }, [sales, search, statusFilter]);

  const sortedSales = useMemo(() => {
    if (!sorting) {
      return filteredSales;
    }

    return stableSort(
      filteredSales,
      (first, second) =>
        compareSales(first, second, sorting.columnId),
      sorting.direction,
    );
  }, [filteredSales, sorting]);

  const paginatedSales = useMemo(
    () => paginateRows(sortedSales, pageIndex, pageSize),
    [pageIndex, pageSize, sortedSales],
  );

  function clearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setPageIndex(0);
  }

  const salesTableFilters: DataTableSelectFilter[] = [
    {
      id: 'status',
      label: 'Estado',
      value: statusFilter === 'ALL' ? '' : statusFilter,
      options: statusFilterOptions.filter(
        (option) => option.value !== 'ALL',
      ),
      placeholder: 'Todas',
      onChange: (value) => {
        setStatusFilter(value ? (value as SaleStatus) : 'ALL');
        setPageIndex(0);
      },
    },
  ];

  const salesColumns: DataTableColumn<Sale>[] = [
    {
      id: 'folio',
      header: 'Folio',
      sortable: true,
      priority: 'primary',
      minWidth: 125,
      cell: (sale) => sale.folio,
    },
    {
      id: 'customer',
      header: 'Cliente',
      sortable: true,
      priority: 'primary',
      minWidth: 200,
      cell: (sale) => getCustomerName(sale),
    },
    {
      id: 'date',
      header: 'Fecha',
      sortable: true,
      priority: 'secondary',
      minWidth: 130,
      cell: (sale) => formatDate(sale.createdAt),
    },
    {
      id: 'items',
      header: 'Partidas',
      priority: 'tertiary',
      minWidth: 100,
      cell: (sale) => getItemCountLabel(sale.items.length),
    },
    {
      id: 'total',
      header: 'Total',
      sortable: true,
      priority: 'secondary',
      minWidth: 130,
      cell: (sale) => formatMoney(sale.total),
    },
    {
      id: 'status',
      header: 'Estado',
      sortable: true,
      priority: 'primary',
      minWidth: 130,
      cell: (sale) => {
        const statusDescriptor = getSaleStatusDescriptor(sale.status);

        return (
          <StatusBadge
            label={statusDescriptor.label}
            tone={statusDescriptor.tone}
            ariaLabel={`Estado de la venta: ${statusDescriptor.label}`}
          />
        );
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      priority: 'primary',
      minWidth: 100,
      cell: (sale) => (
        <Button
          variant="secondary"
          size="sm"
          className="min-w-20"
          aria-label={`Ver venta ${sale.folio}`}
          onClick={() => {
            clearActionError();
            void openSaleDetail(sale);
          }}
        >
          Ver
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Ventas"
          description="Consulta y da seguimiento a las ventas registradas."
          action={canWrite ? (
            <Button onClick={openCreateModal}>
              Nueva venta
            </Button>
          ) : undefined}
        />

        {forbidden || sessionForbidsAccess ? (
          <ForbiddenState />
        ) : pageLoading ? (
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
              onClick={() => void loadPageData()}
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
            <DataTable
              caption="Listado de ventas"
              rows={paginatedSales}
              columns={salesColumns}
              getRowId={(sale) => sale.id}
              sorting={{
                state: sorting,
                onChange: setSorting,
              }}
              toolbar={
                <DataTableToolbar
                  search={{
                    value: search,
                    label: 'Buscar',
                    placeholder: 'Buscar por folio o cliente',
                    onChange: (value) => {
                      setSearch(value);
                      setPageIndex(0);
                    },
                  }}
                  filters={salesTableFilters}
                  onReset={clearFilters}
                  resetDisabled={
                    !Boolean(search.trim() || statusFilter !== 'ALL')
                  }
                />
              }
              pagination={{
                pageIndex,
                pageSize,
                totalRows: sortedSales.length,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                onPageChange: setPageIndex,
                onPageSizeChange: (nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPageIndex(0);
                },
              }}
              emptyState={{
                title: 'No hay ventas registradas',
                description:
                  'Las ventas aparecerán aquí cuando existan registros.',
              }}
              filteredEmptyState={{
                title: 'No se encontraron ventas',
                description:
                  'No se encontraron ventas con los filtros seleccionados.',
              }}
              isFiltered={Boolean(
                search.trim() || statusFilter !== 'ALL',
              )}
            />
          </Section>
        )}
      </PageContainer>

      <SaleFormModal
        isOpen={openModal}
        saving={saving}
        customers={customers}
        products={compatibleProducts}
        customerId={customerId}
        selectedProductId={selectedProductId}
        quantity={quantity}
        items={items}
        customerError={customerError}
        productError={productError}
        itemsError={itemsError}
        formError={formError}
        subtotal={subtotal}
        iva={iva}
        total={total}
        formatMoney={formatMoney}
        onClose={closeCreateModal}
        onSubmit={() => void handleCreateSale()}
        onCustomerChange={handleCustomerChange}
        onSelectedProductChange={handleSelectedProductChange}
        onQuantityChange={handleFormQuantityChange}
        onAddProduct={handleAddProduct}
        onItemQuantityChange={handleItemQuantityChange}
        onRemoveItem={handleRemoveItem}
      />

      <SaleDetailModal
        isOpen={saleIdToView !== null}
        sale={saleToView}
        loading={detailLoading}
        error={detailError}
        actionError={actionError}
        downloading={
          saleToView !== null &&
          downloadingSaleId === saleToView.id
        }
        actionInProgress={approving || cancelling}
        formatDate={formatDate}
        formatMoney={formatMoney}
        onClose={closeSaleDetailWithUrlCleanup}
        onRetry={retrySaleDetail}
        onApprove={openApproveDialog}
        onCancel={openCancelDialog}
        onDownload={(sale) => {
          void handleDownloadPdf(sale);
        }}
      />

      <ConfirmDialog
        isOpen={saleToApprove !== null}
        title="Aprobar venta"
        message={
          <>
            ¿Seguro que deseas aprobar la venta{' '}
            <span className="font-semibold">
              {saleToApprove?.folio}
            </span>
            ? Al aprobar la venta se descontará el inventario correspondiente.
            Esta es una acción operativa.
          </>
        }
        confirmText="Aprobar"
        loadingText="Aprobando..."
        confirmVariant="success"
        loading={approving}
        onClose={closeApproveDialog}
        onConfirm={() => void handleApproveSale()}
      />

      <ConfirmDialog
        isOpen={saleToCancel !== null}
        title="Cancelar venta"
        message={
          <>
            ¿Seguro que deseas cancelar la venta{' '}
            <span className="font-semibold">
              {saleToCancel?.folio}
            </span>
            ? Esta venta en borrador será cancelada.
          </>
        }
        confirmText="Cancelar venta"
        loadingText="Cancelando..."
        confirmVariant="danger"
        loading={cancelling}
        onClose={closeCancelDialog}
        onConfirm={() => void handleCancelSale()}
      />
    </>
  );
}
