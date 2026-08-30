'use client';

import axios from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import Loading from '@/app/components/ui/Loading';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import PurchaseFormModal from '../components/PurchaseFormModal';
import PurchaseInventoryMovements from '../components/PurchaseInventoryMovements';
import PurchaseReceiptModal from '../components/PurchaseReceiptModal';
import PurchaseReceiptsHistory from '../components/PurchaseReceiptsHistory';
import { getPurchaseReceiptInventoryHref } from '../../purchase-receipts/receipt-navigation';
import { usePurchaseActions } from '../hooks/usePurchaseActions';
import { usePurchaseForm } from '../hooks/usePurchaseForm';
import { usePurchaseReceipts } from '../hooks/usePurchaseReceipts';
import {
  canRegisterPurchaseReceipt,
  getPurchaseStatusDescriptor,
} from '../purchase-status';
import type {
  InventoryMovement,
  Product,
  Purchase,
  PurchaseReceipt,
  Supplier,
} from '../types';

type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const backLink = (
  <Link
    href="/purchases"
    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100"
  >
    <ArrowLeft aria-hidden="true" size={18} />
    Volver a compras
  </Link>
);

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

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function buildReceivedByPurchaseItem(receipts: PurchaseReceipt[]) {
  const receivedByPurchaseItem = new Map<string, number>();

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const previousQuantity =
        receivedByPurchaseItem.get(item.purchaseItemId) ?? 0;

      receivedByPurchaseItem.set(
        item.purchaseItemId,
        previousQuantity + Math.max(item.quantityReceived, 0),
      );
    }
  }

  return receivedByPurchaseItem;
}

function usePurchase360(purchaseId: string) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseError, setBaseError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState('');
  const [receiptHistoryStatus, setReceiptHistoryStatus] =
    useState<ResourceStatus>('idle');

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState('');

  const requestVersion = useRef(0);

  const loadReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    setReceiptsError('');
    setReceiptHistoryStatus('loading');

    try {
      const response = await api.get<PurchaseReceipt[]>(
        `/purchase-receipts/purchase/${purchaseId}`,
      );
      setReceipts(response.data);
      setReceiptHistoryStatus('success');
    } catch (error: unknown) {
      console.error(error);
      setReceipts([]);
      setReceiptsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar las recepciones de la compra.',
        ),
      );
      setReceiptHistoryStatus('error');
    } finally {
      setReceiptsLoading(false);
    }
  }, [purchaseId]);

  const loadMovements = useCallback(async () => {
    setMovementsLoading(true);
    setMovementsError('');

    try {
      const response = await api.get<InventoryMovement[]>(
        `/purchases/${purchaseId}/inventory-movements`,
      );
      setMovements(response.data);
    } catch (error: unknown) {
      console.error(error);
      setMovements([]);
      setMovementsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar los movimientos de inventario.',
        ),
      );
    } finally {
      setMovementsLoading(false);
    }
  }, [purchaseId]);

  const loadRelatedResources = useCallback(async () => {
    await Promise.allSettled([loadReceipts(), loadMovements()]);
  }, [loadMovements, loadReceipts]);

  const loadPurchase = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;

    setBaseLoading(true);
    setBaseError('');
    setNotFound(false);
    setPurchase(null);
    setReceipts([]);
    setMovements([]);
    setReceiptsError('');
    setMovementsError('');
    setReceiptHistoryStatus('idle');

    try {
      const response = await api.get<Purchase>(`/purchases/${purchaseId}`);

      if (version !== requestVersion.current) {
        return;
      }

      setPurchase(response.data);
      setBaseLoading(false);
      await loadRelatedResources();
    } catch (error: unknown) {
      console.error(error);

      if (version !== requestVersion.current) {
        return;
      }

      setNotFound(isNotFoundError(error));
      setBaseError(
        isNotFoundError(error)
          ? 'Compra no encontrada'
          : getApiErrorMessage(error, 'No pudimos cargar la compra.'),
      );
      setBaseLoading(false);
    }
  }, [loadRelatedResources, purchaseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPurchase();
  }, [loadPurchase]);

  return {
    purchase,
    baseLoading,
    baseError,
    notFound,
    receipts,
    receiptsLoading,
    receiptsError,
    receiptHistoryStatus,
    movements,
    movementsLoading,
    movementsError,
    loadPurchase,
    loadReceipts,
    loadMovements,
    loadRelatedResources,
  };
}

export default function Purchase360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    purchase,
    baseLoading,
    baseError,
    notFound,
    receipts,
    receiptsLoading,
    receiptsError,
    receiptHistoryStatus,
    movements,
    movementsLoading,
    movementsError,
    loadPurchase,
    loadReceipts,
    loadMovements,
  } = usePurchase360(id);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  const receivedByPurchaseItem = useMemo(
    () =>
      receiptHistoryStatus === 'success'
        ? buildReceivedByPurchaseItem(receipts)
        : new Map<string, number>(),
    [receiptHistoryStatus, receipts],
  );

  const reloadPurchase360 = useCallback(async () => {
    await loadPurchase();
  }, [loadPurchase]);

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
    onPurchaseChanged: reloadPurchase360,
  });

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
    quantityError,
    itemQuantityErrors,
    itemsError,
    subtotal,
    iva,
    total,
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
    onPurchaseSaved: reloadPurchase360,
  });

  const {
    purchaseToReceive,
    receiptFormItems,
    receiptNotes,
    receiptSaving,
    receiptFormError,
    receiptFieldErrors,
    createdReceipt,
    openReceiptModal,
    closeReceiptModal,
    handleReceiptItemChange,
    handleReceiptNotesChange,
    handleCreateReceipt,
  } = usePurchaseReceipts({
    purchaseReceipts: receipts,
    receiptHistoryReady: receiptHistoryStatus === 'success',
    onReceiptCreated: reloadPurchase360,
  });

  async function ensureCatalogsLoaded() {
    if (suppliers.length > 0 && products.length > 0) {
      return true;
    }

    try {
      setCatalogLoading(true);
      setCatalogError('');

      const [suppliersResponse, productsResponse] = await Promise.all([
        api.get<Supplier[]>('/suppliers'),
        api.get<Product[]>('/products'),
      ]);

      setSuppliers(suppliersResponse.data);
      setProducts(productsResponse.data);
      return true;
    } catch (error: unknown) {
      console.error(error);
      setCatalogError(
        getApiErrorMessage(
          error,
          'No fue posible preparar la edición de la compra.',
        ),
      );
      return false;
    } finally {
      setCatalogLoading(false);
    }
  }

  async function handleEditPurchase(currentPurchase: Purchase) {
    const catalogsReady = await ensureCatalogsLoaded();

    if (catalogsReady) {
      openEditModal(currentPurchase);
    }
  }

  function handleReceivePurchase(currentPurchase: Purchase) {
    if (receiptHistoryStatus !== 'success') {
      return;
    }

    openReceiptModal(currentPurchase);
  }

  function handleViewCreatedReceipt(receiptId: string) {
    closeReceiptModal();
    router.push(`/purchase-receipts/${encodeURIComponent(receiptId)}`);
  }

  function handleViewCreatedReceiptInventory(
    receiptId: string,
    receiptFolio: string,
  ) {
    closeReceiptModal();
    router.push(getPurchaseReceiptInventoryHref(receiptId, receiptFolio));
  }

  if (baseLoading) {
    return (
      <PageContainer size="wide">
        <PageHeader title="Compra" action={backLink} />
        <Loading message="Cargando compra..." />
      </PageContainer>
    );
  }

  if (baseError || !purchase) {
    return (
      <PageContainer size="wide">
        <PageHeader title="Compra" action={backLink} />
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {notFound ? 'Compra no encontrada' : baseError}
          </span>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!notFound ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadPurchase()}
              >
                Reintentar
              </Button>
            ) : null}

            {backLink}
          </div>
        </div>
      </PageContainer>
    );
  }

  const statusDescriptor = getPurchaseStatusDescriptor(purchase.status);
  const canReceive =
    canRegisterPurchaseReceipt(purchase.status) &&
    receiptHistoryStatus === 'success';
  const receiveBlocked =
    canRegisterPurchaseReceipt(purchase.status) &&
    receiptHistoryStatus !== 'success';

  return (
    <>
      <PageContainer size="wide">
        <PageHeader
          title={`Compra ${purchase.folio}`}
          description={`Proveedor: ${purchase.supplier.name}`}
          action={
            <>
              {purchase.status === 'DRAFT' ? (
                <>
                  <Button
                    variant="success"
                    onClick={() => openApproveDialog(purchase)}
                  >
                    Aprobar
                  </Button>

                  <Button
                    variant="outline"
                    loading={catalogLoading}
                    loadingText="Preparando..."
                    onClick={() => void handleEditPurchase(purchase)}
                  >
                    Editar
                  </Button>

                  <Button
                    variant="danger"
                    onClick={() => openCancelDialog(purchase)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : null}

              {canRegisterPurchaseReceipt(purchase.status) ? (
                <Button
                  variant="success"
                  disabled={!canReceive}
                  onClick={() => handleReceivePurchase(purchase)}
                >
                  Registrar recepción
                </Button>
              ) : null}

              <Button
                variant="outline"
                loading={downloadingPurchaseId === purchase.id}
                loadingText="Descargando..."
                onClick={() => void handleDownloadPdf(purchase)}
              >
                Descargar PDF
              </Button>

              {backLink}
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            label={statusDescriptor.label}
            tone={statusDescriptor.tone}
            ariaLabel={`Estado de la compra: ${statusDescriptor.label}`}
          />

          {receiveBlocked ? (
            <span className="text-sm text-gray-500">
              Verifica las recepciones antes de registrar una nueva.
            </span>
          ) : null}
        </div>

        {actionError || catalogError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{actionError || catalogError}</span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  clearActionError();
                  setCatalogError('');
                }}
              >
                Cerrar mensaje
              </Button>
            </div>
          </div>
        ) : null}

        <Section title="Resumen">
          <dl className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-sm text-gray-500">Proveedor</dt>
              <dd className="mt-1 font-medium text-gray-900">
                {purchase.supplier.name}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Fecha</dt>
              <dd className="mt-1 font-medium text-gray-900">
                {formatDate(purchase.createdAt)}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Recepción</dt>
              <dd className="mt-1 font-medium text-gray-900">
                {purchase.status === 'DRAFT'
                  ? 'Pendiente de aprobación'
                  : purchase.status === 'CANCELLED'
                    ? 'No aplica'
                    : `${purchase.receiptProgress.completedLines} / ${purchase.receiptProgress.orderedLines} partidas`}
              </dd>
              {purchase.status !== 'DRAFT' &&
              purchase.status !== 'CANCELLED' ? (
                <dd className="mt-1 text-sm text-gray-600">
                  {purchase.receiptProgress.receivedUnits} /{' '}
                  {purchase.receiptProgress.orderedUnits} uds. ·{' '}
                  {purchase.receiptProgress.pendingUnits} pendientes
                </dd>
              ) : null}
            </div>

            <div>
              <dt className="text-sm text-gray-500">Total</dt>
              <dd className="mt-1 text-xl font-semibold text-gray-900">
                {formatMoney(purchase.total)}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Partidas">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">
                Partidas de la compra {purchase.folio}
              </caption>
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">
                    SKU
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Producto
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Pedido
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Recibido
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Pendiente
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Costo
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>

              <tbody>
                {purchase.items.map((item) => {
                  const receivedQuantity =
                    receivedByPurchaseItem.get(item.id) ?? 0;
                  const pendingQuantity = Math.max(
                    item.quantity - receivedQuantity,
                    0,
                  );
                  const progressAvailable =
                    receiptHistoryStatus === 'success';

                  return (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-3 py-3">{item.product.sku}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {progressAvailable ? receivedQuantity : '—'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {progressAvailable ? pendingQuantity : '—'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatMoney(item.price)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatMoney(item.subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Resumen financiero">
          <dl className="max-w-xl space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(purchase.subtotal)}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">IVA (16%)</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(purchase.iva)}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-lg font-semibold text-gray-900">
              <dt>Total</dt>
              <dd>{formatMoney(purchase.total)}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Recepciones">
          <PurchaseReceiptsHistory
            receipts={receipts}
            loading={receiptsLoading}
            error={receiptsError}
            onRetry={() => void loadReceipts()}
            formatDate={formatDate}
            formatMoney={formatMoney}
          />
        </Section>

        <Section title="Trazabilidad">
          <PurchaseInventoryMovements
            movements={movements}
            loading={movementsLoading}
            error={movementsError}
            onRetry={() => void loadMovements()}
            formatDate={formatDate}
            formatMoney={formatMoney}
          />
        </Section>
      </PageContainer>

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
        quantityError={quantityError}
        itemQuantityErrors={itemQuantityErrors}
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
        onSelectedProductChange={handleSelectedProductChange}
        onQuantityChange={handleFormQuantityChange}
        onItemQuantityChange={handleItemQuantityChange}
      />

      <PurchaseReceiptModal
        isOpen={purchaseToReceive !== null || createdReceipt !== null}
        purchase={purchaseToReceive}
        items={receiptFormItems}
        notes={receiptNotes}
        saving={receiptSaving}
        error={receiptFormError}
        fieldErrors={receiptFieldErrors}
        createdReceipt={createdReceipt}
        onClose={closeReceiptModal}
        onItemChange={handleReceiptItemChange}
        onNotesChange={handleReceiptNotesChange}
        onSubmit={() => void handleCreateReceipt()}
        onViewReceipt={handleViewCreatedReceipt}
        onViewInventory={handleViewCreatedReceiptInventory}
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
              ? La compra quedará confirmada y podrá recibir mercancía.
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
        onConfirm={() => void handleApprovePurchase()}
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
              ? La compra permanecerá registrada, pero ya no podrá aprobarse.
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
        onConfirm={() => void handleCancelPurchase()}
      />
    </>
  );
}
