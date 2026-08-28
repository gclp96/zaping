'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

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
  const saleId = searchParams.get('saleId')?.trim() || null;
  const openedSaleId = useRef<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<SaleCustomer[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');

  const compatibleProducts = useMemo(
    () => getCompatibleSalesProducts(products),
    [products],
  );

  async function loadSales() {
    const response = await api.get<Sale[]>('/sales');

    setSales(response.data);
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
    void loadPageData();
  }, []);

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
      actions: (
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
    };
  });

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Ventas"
          description="Consulta y da seguimiento a las ventas registradas."
          action={
            <Button onClick={openCreateModal}>
              Nueva venta
            </Button>
          }
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
                  'Acciones',
                ]}
                data={tableData}
              />
            )}
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
