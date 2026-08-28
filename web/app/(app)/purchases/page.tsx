'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';
import { getPurchaseStatusDescriptor } from './purchase-status';

import StatusBadge from '@/app/components/business/StatusBadge';
import PurchaseReceiptModal from './components/PurchaseReceiptModal';
import PurchaseDetailModal from './components/PurchaseDetailModal';
import PurchaseFormModal from './components/PurchaseFormModal';
import { usePurchaseReceipts } from './hooks/usePurchaseReceipts';
import { usePurchaseForm } from './hooks/usePurchaseForm';
import { usePurchaseDetail } from './hooks/usePurchaseDetail';
import { usePurchaseActions } from './hooks/usePurchaseActions';

import type {
  Product,
  Purchase,
  PurchaseStatus,
  Supplier,
} from './types';

import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

type StatusFilter = 'ALL' | PurchaseStatus;

const statusFilterOptions: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'DRAFT', label: getPurchaseStatusDescriptor('DRAFT').label },
  {
    value: 'CONFIRMED',
    label: getPurchaseStatusDescriptor('CONFIRMED').label,
  },
  {
    value: 'PARTIALLY_RECEIVED',
    label: getPurchaseStatusDescriptor('PARTIALLY_RECEIVED').label,
  },
  {
    value: 'RECEIVED',
    label: getPurchaseStatusDescriptor('RECEIVED').label,
  },
  {
    value: 'CANCELLED',
    label: getPurchaseStatusDescriptor('CANCELLED').label,
  },
];

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

export default function PurchasesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <h1 className="sr-only">Compras</h1>
          <Loading message="Cargando compras..." />
        </PageContainer>
      }
    >
      <PurchasesPageContent />
    </Suspense>
  );
}

function purchaseMatchesSearch(
  purchase: Purchase,
  search: string,
): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-MX');

  if (!normalizedSearch) {
    return true;
  }

  const values = [
    purchase.folio,
    purchase.supplier.name,
    purchase.supplier.contactName,
    purchase.supplier.email,
    ...purchase.items.flatMap((item) => [
      item.product.sku,
      item.product.name,
    ]),
  ];

  return values.some((value) =>
    value?.toLocaleLowerCase('es-MX').includes(normalizedSearch),
  );
}

function PurchasesPageContent() {

const router = useRouter();
const searchParams = useSearchParams();
const purchaseId = searchParams.get('purchaseId')?.trim() || null;
const openedPurchaseId = useRef<string | null>(null);

const [ purchases, setPurchases ] = useState<Purchase[]>([]);
const [ suppliers, setSuppliers ] = useState<Supplier[]>([]);
const [ products, setProducts ] = useState<Product[]>([]);

const [ pageLoading, setPageLoading ] = useState(true);
const [ pageError, setPageError ] = useState('');
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] =
  useState<StatusFilter>('ALL');
const [supplierFilter, setSupplierFilter] = useState('ALL');

async function loadPurchases() {
    const response = await api.get<Purchase[]>('/purchases');
    setPurchases(response.data);
  }

const {
  purchaseToApprove,
  purchaseToCancel,

  approving,
  cancelling,
  downloadingPurchaseId,
  actionError,

  openApproveDialog,
  closeApproveDialog,

  openCancelDialog,
  closeCancelDialog,

  clearActionError,

  handleApprovePurchase,
  handleCancelPurchase,
  handleDownloadPdf,
} = usePurchaseActions({
  onPurchaseChanged: loadPurchases,
});

const supplierFilterOptions = useMemo(() => {
  const suppliersById = new Map(
    purchases.map((purchase) => [
      purchase.supplier.id,
      purchase.supplier,
    ]),
  );

  return [...suppliersById.values()].sort((first, second) =>
    first.name.localeCompare(second.name, 'es-MX'),
  );
}, [purchases]);

const filteredPurchases = useMemo(
  () =>
    purchases.filter(
      (purchase) =>
        (statusFilter === 'ALL' || purchase.status === statusFilter) &&
        (supplierFilter === 'ALL' ||
          purchase.supplier.id === supplierFilter) &&
        purchaseMatchesSearch(purchase, search),
    ),
  [purchases, search, statusFilter, supplierFilter],
);

const {
  purchaseToView,
  inventoryMovements,
  purchaseReceipts,
  receiptsLoading,
  receiptsError,
  movementsLoading,
  movementsError,

  openPurchaseDetail,
  closePurchaseDetail,
} = usePurchaseDetail();

  //propiedades del formulario
const {
  openModal,
  saving,
  purchaseToEdit,

  supplierId,
  selectedProductId,
  quantity,
  items,

  supplierError,
  productError,
  itemsError,

  subtotal,
  iva,
  total,

  openCreateModal,
  openEditModal,
  closeCreateModal,

  handleSupplierChange,
  handleSelectedProductChange,
  handleFormQuantityChange,

  handleAddProduct,
  handleItemQuantityChange,
  handleRemoveItem,
  handleCreatePurchase,
} = usePurchaseForm({
  products,
  onPurchaseSaved: loadPurchases,
});

  //propiedades de recepcion
const {
  purchaseToReceive,
  receiptFormItems,
  receiptNotes,
  receiptSaving,
  receiptFormError,
  createdReceipt,
  openReceiptModal,
  closeReceiptModal,
  handleReceiptItemChange,
  handleReceiptNotesChange,
  handleCreateReceipt,
  } = usePurchaseReceipts({
    purchaseReceipts,
    onReceiptCreated: loadPurchases,
  });

function handleViewCreatedReceipt(receiptId: string) {
  closeReceiptModal();
  router.push(`/purchase-receipts/${receiptId}`);
}

async function loadPageData() {
    try {
      setPageLoading(true);
      setPageError('');

      const [
        purchasesResponse,
        suppliersResponse,
        productsResponse,
      ] = await Promise.all([
        api.get<Purchase[]>('/purchases'),
        api.get<Supplier[]>('/suppliers'),
        api.get<Product[]>('/products'),
      ]);

      setPurchases(purchasesResponse.data);
      setSuppliers(suppliersResponse.data);
      setProducts(productsResponse.data);
    } catch (error: unknown) {
      console.error(error);

      setPageError(
        getApiErrorMessage(
          error,
          'No fue posible cargar la información de compras.',
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

  useEffect(() => {
    if (!purchaseId) {
      openedPurchaseId.current = null;
      return;
    }

    if (
      pageLoading ||
      pageError ||
      openedPurchaseId.current === purchaseId
    ) {
      return;
    }

    const purchase = purchases.find((item) => item.id === purchaseId);
    openedPurchaseId.current = purchaseId;

    if (purchase) {
      void openPurchaseDetail(purchase);
    }
  }, [openPurchaseDetail, pageError, pageLoading, purchaseId, purchases]);

  const purchaseDeepLinkMissing = Boolean(
    purchaseId &&
    !pageLoading &&
    !pageError &&
    !purchases.some((purchase) => purchase.id === purchaseId),
  );

  function closePurchaseDetailWithUrlCleanup() {
    closePurchaseDetail();
    clearActionError();

    if (purchaseId) {
      router.replace('/purchases');
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setSupplierFilter('ALL');
  }

  const actionErrorHasModal = Boolean(
    purchaseToView || purchaseToApprove || purchaseToCancel,
  );

const tableData = filteredPurchases.map((purchase) => {
    const statusDescriptor =
      getPurchaseStatusDescriptor(purchase.status);

    return {
      folio: purchase.folio,
      supplier: purchase.supplier.name,
      date: formatDate(purchase.createdAt),
      items: purchase.items.length,
      total: formatMoney(purchase.total),
      status: (
        <StatusBadge
          label={statusDescriptor.label}
          tone={statusDescriptor.tone}
          ariaLabel={`Estado de la compra: ${statusDescriptor.label}`}
        />
      ),

      actions: (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="min-w-24"
            onClick={() => {
              clearActionError();
              void openPurchaseDetail(purchase);
            }}
            >
              Ver detalle
            </Button>

          {purchase.status === 'DRAFT' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditModal(purchase)}
              >
                Editar
              </Button>

              <Button
                variant="success"
                size="sm"
                onClick={() =>
                  openApproveDialog(purchase)
                }
              >
                Aprobar
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  openCancelDialog(purchase)
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
            loading={downloadingPurchaseId === purchase.id}
            loadingText="Descargando..."
            onClick={() => void handleDownloadPdf(purchase)}
          >
            Descargar PDF
          </Button>
        </div>
      ),
    };
  });

  return (
    <>
      {/* Página de compras */}
      <PageContainer>
        <PageHeader
          title="Compras"
          description="Administra las órdenes de compra registradas."
          action={
            <Button onClick={openCreateModal}>
              Nueva compra
            </Button>
          }
        />

        {purchaseDeepLinkMissing ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>No se encontró la compra solicitada.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closePurchaseDetailWithUrlCleanup}
            >
              Volver a compras
            </Button>
          </div>
        ) : null}

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
          <Loading message="Cargando compras..." />
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
        ) : purchases.length === 0 ? (
          <EmptyState
            title="No hay compras registradas"
            description="Comienza creando tu primera orden de compra."
            action={
              <Button type="button" onClick={openCreateModal}>
                Nueva compra
              </Button>
            }
          />
        ) : (
          <Section>
            <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_260px]">
              <Input
                label="Buscar compras"
                type="search"
                value={search}
                placeholder="Folio, proveedor, email, SKU o producto"
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="flex w-full flex-col gap-2">
                <label
                  htmlFor="purchases-status-filter"
                  className="text-sm font-medium text-gray-700"
                >
                  Estado
                </label>
                <select
                  id="purchases-status-filter"
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

              <div className="flex w-full flex-col gap-2">
                <label
                  htmlFor="purchases-supplier-filter"
                  className="text-sm font-medium text-gray-700"
                >
                  Proveedor
                </label>
                <select
                  id="purchases-supplier-filter"
                  value={supplierFilter}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(event) => setSupplierFilter(event.target.value)}
                >
                  <option value="ALL">Todos los proveedores</option>
                  {supplierFilterOptions.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <EmptyState
                title="No se encontraron compras"
                description="No hay compras que coincidan con la búsqueda y los filtros seleccionados."
                action={
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                }
              />
            ) : (
              <Table
                headers={[
                  'Folio',
                  'Proveedor',
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

      {/* Crear compra */}
      <PurchaseFormModal
        isOpen={openModal}
        editing={purchaseToEdit !== null}
        saving={saving}
        suppliers={suppliers}
        products={products}
        supplierId={supplierId}
        selectedProductId={selectedProductId}
        quantity={quantity}
        items={items}
        supplierError={supplierError}
        productError={productError}
        itemsError={itemsError}
        subtotal={subtotal}
        iva={iva}
        total={total}
        formatMoney={formatMoney}
        onClose={closeCreateModal}
        onSubmit={() => void handleCreatePurchase()}
        onAddProduct={handleAddProduct}
        onRemoveItem={handleRemoveItem}
        onSupplierChange={handleSupplierChange}
        onSelectedProductChange={
          handleSelectedProductChange
        }
        onQuantityChange={handleFormQuantityChange}
        onItemQuantityChange={
          handleItemQuantityChange
        }
        />
      
      {/* Ver detalles de compra */}
      <PurchaseDetailModal
          purchase={purchaseToView}
          receipts={purchaseReceipts}
          receiptsLoading={receiptsLoading}
          receiptsError={receiptsError}
          movements={inventoryMovements}
          movementsLoading={movementsLoading}
          movementsError={movementsError}
          downloading={
            purchaseToView !== null &&
            downloadingPurchaseId === purchaseToView.id
          }
          actionError={actionError}
          formatDate={formatDate}
          formatMoney={formatMoney}
          onClose={closePurchaseDetailWithUrlCleanup}
          onEdit={(purchase) => {
            openEditModal(purchase);
            closePurchaseDetailWithUrlCleanup();
          }}
          onApprove={(purchase) => {
            openApproveDialog(purchase);
            closePurchaseDetailWithUrlCleanup();
          }}
          onCancel={(purchase) => {
            openCancelDialog(purchase);
            closePurchaseDetailWithUrlCleanup();
          }}
          onReceive={(purchase) => {
            openReceiptModal(purchase);
            closePurchaseDetailWithUrlCleanup();
          }}
          onDownload={(purchase) => {
            void handleDownloadPdf(purchase);
          }}
        />

      <PurchaseReceiptModal
        isOpen={purchaseToReceive !== null || createdReceipt !== null}
        purchase={purchaseToReceive}
        items={receiptFormItems}
        notes={receiptNotes}
        saving={receiptSaving}
        error={receiptFormError}
        createdReceipt={createdReceipt}
        onClose={closeReceiptModal}
        onItemChange={handleReceiptItemChange}
        onNotesChange={handleReceiptNotesChange}
        onSubmit={() => void handleCreateReceipt()}
        onViewReceipt={handleViewCreatedReceipt}
      />

      <ConfirmDialog
          isOpen={purchaseToApprove !== null}
          title="Aprobar compra"
          message={
            <div className="space-y-3">
              <p>
                ¿Seguro que deseas aprobar la compra{' '}
                <span className="font-semibold">
                  {purchaseToApprove?.folio}
                </span>
                ? La compra quedará confirmada y podrá
                recibir mercancía. El inventario no
                cambiará hasta registrar una recepción.
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
            void handleApprovePurchase()
          }
        />
      <ConfirmDialog
        isOpen={purchaseToCancel !== null}
        title="Cancelar compra"
        message={
          <div className="space-y-3">
            <p>
              ¿Seguro que deseas cancelar la compra{' '}
              <span className="font-semibold">
                {purchaseToCancel?.folio}
              </span>
              ? La compra permanecerá registrada, pero
              ya no podrá aprobarse.
            </p>
            {actionError ? (
              <p role="alert" className="text-sm text-red-700">
                {actionError}
              </p>
            ) : null}
          </div>
        }
        confirmText="Cancelar compra"
        loadingText="Cancelando..."
        confirmVariant="danger"
        loading={cancelling}
        onClose={closeCancelDialog}
        onConfirm={() =>
          void handleCancelPurchase()
        }
      />
    </>
  );
}
