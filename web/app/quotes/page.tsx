'use client';

import { useEffect, useState } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';

import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import CustomerFormModal from '@/app/components/business/CustomerForm';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import QuoteDetailModal from './components/QuoteDetailModal';
import QuoteFormModal from './components/QuoteFormModal';

import { useQuoteActions } from './hooks/useQuoteActions';
import { useQuoteForm } from './hooks/useQuoteForm';

import { getQuoteStatusDescriptor } from './quote-status';

import type {
  Customer,
  Product,
  Quote,
} from './types';

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

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export default function QuotesPage() {
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

  async function loadQuotes() {
    const response =
      await api.get<Quote[]>('/quotes');

    setQuotes(response.data);
  }

  const {
  quoteToApprove,
  quoteToCancel,
  quoteToConvert,

  approving,
  cancelling,
  converting,
  downloadingQuoteId,

  openApproveDialog,
  closeApproveDialog,

  openCancelDialog,
  closeCancelDialog,

  openConvertDialog,
  closeConvertDialog,

  handleApproveQuote,
  handleCancelQuote,
  handleConvertToSale,
  handleDownloadPdf,
} = useQuoteActions({
  onQuoteChanged: loadQuotes,
});

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

  const tableData = quotes.map((quote) => {
    const statusDescriptor =
      getQuoteStatusDescriptor(quote.status);

    return {
      folio: quote.folio,

      customer: quote.customer.name,

      date: formatDate(quote.createdAt),

      items: quote.items.length,

      total: formatMoney(quote.total),

      status: (
        <StatusBadge
          label={statusDescriptor.label}
          tone={statusDescriptor.tone}
          ariaLabel={`Estado de la cotización: ${statusDescriptor.label}`}
        />
      ),

      actions: (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="min-w-24"
            onClick={() => setQuoteToView(quote)}
          >
            Ver detalle
          </Button>

          {quote.status === 'DRAFT' ? (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() =>
                  openApproveDialog(quote)
                }
              >
                Aprobar
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  openCancelDialog(quote)
                }
              >
                Cancelar
              </Button>
            </>
          ) : null}

          <Button
            variant="primary"
            size="sm"
            className="min-w-24"
            loading={
              downloadingQuoteId === quote.id
            }
            loadingText="Descargando..."
            onClick={() =>
              void handleDownloadPdf(quote)
            }
          >
            Descargar PDF
          </Button>
        </div>
      ),
    };
  });

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
          />
        ) : (
          <Section>
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
        formatDate={formatDate}
        formatMoney={formatMoney}
        onClose={() => setQuoteToView(null)}
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
          <>
            ¿Seguro que deseas aprobar la
            cotización{' '}
            <span className="font-semibold">
              {quoteToApprove?.folio}
            </span>
            ? La cotización quedará confirmada.
            Esta acción no modificará el
            inventario.
          </>
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
          <>
            ¿Seguro que deseas cancelar la
            cotización{' '}
            <span className="font-semibold">
              {quoteToCancel?.folio}
            </span>
            ? Permanecerá registrada, pero ya no
            podrá aprobarse.
          </>
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
      
    </>
  );
}