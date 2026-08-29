'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import StatusBadge from '@/app/components/business/StatusBadge';

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
import Modal from '@/app/components/ui/Modal';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import CustomerFormModal from '@/app/components/business/CustomerForm';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';
import { paginateRows, stableSort } from '@/app/client-table.utils';

import QuoteDetailModal from './components/QuoteDetailModal';
import QuoteFormModal from './components/QuoteFormModal';

import { useQuoteActions } from './hooks/useQuoteActions';
import { useQuoteForm } from './hooks/useQuoteForm';

import { getQuoteStatusDescriptor } from './quote-status';

import type {
  Customer,
  Product,
  Quote,
  QuoteStatus,
} from './types';

type StatusFilter = 'ALL' | QuoteStatus;

const statusFilterOptions: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'DRAFT', label: getQuoteStatusDescriptor('DRAFT').label },
  {
    value: 'CONFIRMED',
    label: getQuoteStatusDescriptor('CONFIRMED').label,
  },
  {
    value: 'CANCELLED',
    label: getQuoteStatusDescriptor('CANCELLED').label,
  },
];

const moneyFormatter = new Intl.NumberFormat(
  'es-MX',
  {
    style: 'currency',
    currency: 'MXN',
  },
);

const dateFormatter = new Intl.DateTimeFormat(
  'es-MX',
  {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  },
);

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const quoteCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function quoteMatchesSearch(quote: Quote, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-MX');

  if (!normalizedSearch) {
    return true;
  }

  const values = [
    quote.folio,
    quote.customer.name,
    quote.customer.email,
    ...quote.items.flatMap((item) => [item.product.sku, item.product.name]),
  ];

  return values.some((value) =>
    value?.toLocaleLowerCase('es-MX').includes(normalizedSearch),
  );
}

function compareQuotes(
  first: Quote,
  second: Quote,
  columnId: string,
) {
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
    return quoteCollator.compare(first.folio, second.folio);
  }

  if (columnId === 'customer') {
    return quoteCollator.compare(
      first.customer.name,
      second.customer.name,
    );
  }

  if (columnId === 'status') {
    return quoteCollator.compare(
      getQuoteStatusDescriptor(first.status).label,
      getQuoteStatusDescriptor(second.status).label,
    );
  }

  return 0;
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>(
    [],
  );

  const [customers, setCustomers] = useState<
    Customer[]
  >([]);

  const [products, setProducts] = useState<
    Product[]
  >([]);

  const [quoteToView, setQuoteToView] =
    useState<Quote | null>(null);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [customerFormOpen, setCustomerFormOpen] =
    useState(false);

  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');
  const [sorting, setSorting] = useState<SortState>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  async function loadQuotes() {
    const response =
      await api.get<Quote[]>('/quotes');

    setQuotes(response.data);
    setPageIndex(0);
  }

  const {
    quoteToApprove,
    quoteToCancel,
    quoteToConvert,

    approving,
    cancelling,
    converting,
    downloadingQuoteId,
    actionError,
    createdSale,

    openApproveDialog,
    closeApproveDialog,

    openCancelDialog,
    closeCancelDialog,

    openConvertDialog,
    closeConvertDialog,

    clearActionError,
    closeCreatedSale,

    handleApproveQuote,
    handleCancelQuote,
    handleConvertToSale,
    handleDownloadPdf,
  } = useQuoteActions({
    onQuoteChanged: loadQuotes,
  });

  const filteredQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) =>
          (statusFilter === 'ALL' || quote.status === statusFilter) &&
          quoteMatchesSearch(quote, search),
      ),
    [quotes, search, statusFilter],
  );

  const sortedQuotes = useMemo(() => {
    if (!sorting) {
      return filteredQuotes;
    }

    return stableSort(
      filteredQuotes,
      (first, second) => compareQuotes(first, second, sorting.columnId),
      sorting.direction,
    );
  }, [filteredQuotes, sorting]);

  const paginatedQuotes = useMemo(() => {
    return paginateRows(sortedQuotes, pageIndex, pageSize);
  }, [pageIndex, pageSize, sortedQuotes]);

  const {
    openModal,
    saving,

    customerId,
    selectedProductId,
    quantity,
    price,
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
    handleFormPriceChange,

    handleAddProduct,
    handleItemQuantityChange,
    handleItemPriceChange,
    handleRemoveItem,
    handleCreateQuote,
  } = useQuoteForm({
    products,
    onQuoteSaved: loadQuotes,
  });

  async function loadPageData() {
    try {
      setPageLoading(true);
      setPageError('');

      const [
        quotesResponse,
        customersResponse,
        productsResponse,
      ] = await Promise.all([
        api.get<Quote[]>('/quotes'),
        api.get<Customer[]>('/customers'),
        api.get<Product[]>('/products'),
      ]);

      setQuotes(quotesResponse.data);
      setCustomers(customersResponse.data);
      setProducts(productsResponse.data);
      setPageIndex(0);
    } catch (error: unknown) {
      console.error(error);

      setPageError(
        getApiErrorMessage(
          error,
          'No fue posible cargar la información de cotizaciones.',
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

  function closeQuoteDetail() {
    setQuoteToView(null);
    clearActionError();
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setPageIndex(0);
  }

  const actionErrorHasModal = Boolean(
    quoteToView ||
      quoteToApprove ||
      quoteToCancel ||
      quoteToConvert ||
      createdSale,
  );

  function renderQuoteActions(quote: Quote) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-w-24"
          onClick={() => {
            clearActionError();
            setQuoteToView(quote);
          }}
        >
          Ver detalle
        </Button>

        {quote.status === 'DRAFT' ? (
          <>
            <Button
              variant="success"
              size="sm"
              onClick={() => openApproveDialog(quote)}
            >
              Aprobar
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => openCancelDialog(quote)}
            >
              Cancelar
            </Button>
          </>
        ) : null}

        <Button
          variant="primary"
          size="sm"
          className="min-w-24"
          loading={downloadingQuoteId === quote.id}
          loadingText="Descargando..."
          onClick={() => void handleDownloadPdf(quote)}
        >
          Descargar PDF
        </Button>
      </div>
    );
  }

  const quoteTableFilters: DataTableSelectFilter[] = [
    {
      id: 'status',
      label: 'Estado',
      value: statusFilter === 'ALL' ? '' : statusFilter,
      options: statusFilterOptions.filter((option) => option.value !== 'ALL'),
      placeholder: 'Todos',
      onChange: (value) => {
        setStatusFilter(value ? (value as QuoteStatus) : 'ALL');
        setPageIndex(0);
      },
    },
  ];

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Cotizaciones"
          description="Administra las cotizaciones comerciales registradas."
          action={
            <Button onClick={openCreateModal}>
              Nueva cotización
            </Button>
          }
        />

        {actionError && !actionErrorHasModal ? (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{actionError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearActionError}
            >
              Cerrar mensaje
            </Button>
          </div>
        ) : null}

        {pageLoading ? (
          <Loading message="Cargando cotizaciones..." />
        ) : pageError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          >
            <p>{pageError}</p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadPageData()}
            >
              Reintentar
            </Button>
          </div>
        ) : quotes.length === 0 ? (
          <EmptyState
            title="No hay cotizaciones registradas"
            description="Comienza creando tu primera cotización."
            action={
              <Button type="button" onClick={openCreateModal}>
                Nueva cotización
              </Button>
            }
          />
        ) : (
          <Section>
            <DataTable
              caption="Listado de cotizaciones"
              rows={paginatedQuotes}
              columns={[
                {
                  id: 'folio',
                  header: 'Folio',
                  cell: (quote) => (
                    <span className="font-semibold text-gray-900">
                      {quote.folio}
                    </span>
                  ),
                  sortable: true,
                  priority: 'primary',
                  minWidth: 125,
                },
                {
                  id: 'customer',
                  header: 'Cliente',
                  cell: (quote) => quote.customer.name,
                  sortable: true,
                  priority: 'primary',
                  minWidth: 200,
                },
                {
                  id: 'date',
                  header: 'Fecha',
                  cell: (quote) => formatDate(quote.createdAt),
                  sortable: true,
                  priority: 'secondary',
                  minWidth: 130,
                },
                {
                  id: 'items',
                  header: 'Partidas',
                  cell: (quote) => quote.items.length,
                  priority: 'tertiary',
                  minWidth: 100,
                },
                {
                  id: 'total',
                  header: 'Total',
                  cell: (quote) => formatMoney(quote.total),
                  sortable: true,
                  priority: 'secondary',
                  minWidth: 130,
                },
                {
                  id: 'status',
                  header: 'Estado',
                  cell: (quote) => {
                    const statusDescriptor =
                      getQuoteStatusDescriptor(quote.status);

                    return (
                      <StatusBadge
                        label={statusDescriptor.label}
                        tone={statusDescriptor.tone}
                        ariaLabel={`Estado de la cotización: ${statusDescriptor.label}`}
                      />
                    );
                  },
                  sortable: true,
                  priority: 'primary',
                  minWidth: 125,
                },
                {
                  id: 'actions',
                  header: 'Acciones',
                  cell: renderQuoteActions,
                  priority: 'primary',
                  minWidth: 330,
                },
              ] satisfies DataTableColumn<Quote>[]}
              getRowId={(quote) => quote.id}
              sorting={{
                state: sorting,
                onChange: setSorting,
              }}
              toolbar={
                <DataTableToolbar
                  search={{
                    value: search,
                    label: 'Buscar cotizaciones',
                    placeholder: 'Folio, cliente, email, SKU o producto',
                    onChange: (value) => {
                      setSearch(value);
                      setPageIndex(0);
                    },
                  }}
                  filters={quoteTableFilters}
                  onReset={clearFilters}
                  resetDisabled={
                    !Boolean(search.trim() || statusFilter !== 'ALL')
                  }
                />
              }
              pagination={{
                pageIndex,
                pageSize,
                totalRows: sortedQuotes.length,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                onPageChange: setPageIndex,
                onPageSizeChange: (nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPageIndex(0);
                },
              }}
              emptyState={{
                title: 'No hay cotizaciones registradas',
                description: 'Comienza creando tu primera cotización.',
              }}
              filteredEmptyState={{
                title: 'No se encontraron cotizaciones',
                description:
                  'No hay cotizaciones que coincidan con la búsqueda y el estado seleccionados.',
              }}
              isFiltered={Boolean(
                search.trim() || statusFilter !== 'ALL',
              )}
            />
          </Section>
        )}
      </PageContainer>

      <QuoteFormModal
        isOpen={openModal}
        saving={saving}
        customers={customers}
        products={products}
        customerId={customerId}
        selectedProductId={selectedProductId}
        quantity={quantity}
        price={price}
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
        onSubmit={() =>
          void handleCreateQuote()
        }
        onCustomerChange={handleCustomerChange}
        onCreateCustomer={() =>
          setCustomerFormOpen(true)
        }
        onSelectedProductChange={
          handleSelectedProductChange
        }
        onQuantityChange={
          handleFormQuantityChange
        }
        onPriceChange={handleFormPriceChange}
        onAddProduct={handleAddProduct}
        onItemQuantityChange={
          handleItemQuantityChange
        }
        onItemPriceChange={
          handleItemPriceChange
        }
        onRemoveItem={handleRemoveItem}
      />

      <CustomerFormModal
        isOpen={customerFormOpen}
        customer={null}
        onClose={() =>
          setCustomerFormOpen(false)
        }
        onSaved={(customer) => {
          setCustomers((current) => [
            customer,
            ...current.filter(
              (item) =>
                item.id !== customer.id,
            ),
          ]);

          handleCustomerChange(
            customer.id,
          );
        }}
      />

      <QuoteDetailModal
        quote={quoteToView}
        downloading={
          quoteToView !== null &&
          downloadingQuoteId === quoteToView.id
        }
        converting={converting}
        actionError={actionError}
        formatDate={formatDate}
        formatMoney={formatMoney}
        onClose={closeQuoteDetail}
        onApprove={(quote) => {
          setQuoteToView(null);
          openApproveDialog(quote);
        }}
        onCancel={(quote) => {
          setQuoteToView(null);
          openCancelDialog(quote);
        }}
        onConvert={(quote) => {
          setQuoteToView(null);
          openConvertDialog(quote);
        }}
        onDownload={(quote) => {
          void handleDownloadPdf(quote);
        }}
      />

      <ConfirmDialog
        isOpen={quoteToApprove !== null}
        title="Aprobar cotización"
        message={
          <div className="space-y-3">
            <p>
              ¿Seguro que deseas aprobar la
              cotización{' '}
              <span className="font-semibold">
                {quoteToApprove?.folio}
              </span>
              ? La cotización quedará confirmada.
              Esta acción no modificará el
              inventario.
            </p>
            {actionError ? (
              <p role="alert" className="text-sm text-red-700">
                {actionError}
              </p>
            ) : null}
          </div>
        }
        confirmText="Aprobar"
        loadingText="Aprobando..."
        confirmVariant="success"
        loading={approving}
        onClose={closeApproveDialog}
        onConfirm={() =>
          void handleApproveQuote()
        }
      />

      <ConfirmDialog
        isOpen={quoteToCancel !== null}
        title="Cancelar cotización"
        message={
          <div className="space-y-3">
            <p>
              ¿Seguro que deseas cancelar la
              cotización{' '}
              <span className="font-semibold">
                {quoteToCancel?.folio}
              </span>
              ? Permanecerá registrada, pero ya no
              podrá aprobarse.
            </p>
            {actionError ? (
              <p role="alert" className="text-sm text-red-700">
                {actionError}
              </p>
            ) : null}
          </div>
        }
        confirmText="Cancelar cotización"
        loadingText="Cancelando..."
        confirmVariant="danger"
        loading={cancelling}
        onClose={closeCancelDialog}
        onConfirm={() =>
          void handleCancelQuote()
        }
      />

      <ConfirmDialog
        isOpen={quoteToConvert !== null}
        title="Convertir cotización a venta"
        message={
          <>
            ¿Seguro que deseas convertir la cotización{' '}
            <span className="font-semibold">
              {quoteToConvert?.folio}
            </span>{' '}
            en venta?
            <div className="mt-3 space-y-1 text-sm">
              <p>Esta operación:</p>
              <p>• Creará una venta confirmada.</p>
              <p>• Descontará las existencias del inventario.</p>
              <p>• Generará movimientos de inventario OUT.</p>
              <p>
                • La venta no podrá cancelarse directamente
                después de confirmarse.
              </p>
            </div>
            {actionError ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {actionError}
              </p>
            ) : null}
          </>
        }
        confirmText="Convertir a venta"
        loadingText="Convirtiendo..."
        confirmVariant="success"
        loading={converting}
        onClose={closeConvertDialog}
        onConfirm={() =>
          void handleConvertToSale()
        }
      />

      <Modal
        isOpen={createdSale !== null}
        title="Venta creada correctamente"
        onClose={closeCreatedSale}
      >
        <div className="space-y-6">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
            <p className="text-sm">Venta generada</p>
            <p className="mt-1 text-xl font-semibold">{createdSale?.folio}</p>
            <p className="mt-2 text-sm">
              La cotización fue convertida en una venta.
            </p>
          </div>

          {actionError ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              {actionError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeCreatedSale}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (createdSale) {
                  const createdSaleId = createdSale.id;
                  closeCreatedSale();
                  router.push(
                    `/sales?saleId=${encodeURIComponent(createdSaleId)}`,
                  );
                }
              }}
            >
              Ver venta
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
