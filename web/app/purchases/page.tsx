'use client';

import { useEffect, useState } from 'react';

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
  Supplier,
} from './types';

import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

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

const [ purchases, setPurchases ] = useState<Purchase[]>([]);
const [ suppliers, setSuppliers ] = useState<Supplier[]>([]);
const [ products, setProducts ] = useState<Product[]>([]);

const [ pageLoading, setPageLoading ] = useState(true);
const [ pageError, setPageError ] = useState('');

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

  openApproveDialog,
  closeApproveDialog,

  openCancelDialog,
  closeCancelDialog,

  handleApprovePurchase,
  handleCancelPurchase,
  handleDownloadPdf,
} = usePurchaseActions({
  onPurchaseChanged: loadPurchases,
});

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
  openReceiptModal,
  closeReceiptModal,
  handleReceiptItemChange,
  handleReceiptNotesChange,
  handleCreateReceipt,
  } = usePurchaseReceipts({
    purchaseReceipts,
    onReceiptCreated: loadPurchases,
  });

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

const tableData = purchases.map((purchase) => {
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
            onClick={() => void openPurchaseDetail(purchase)}
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
          />
        ) : (
          <Section>
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
          formatDate={formatDate}
          formatMoney={formatMoney}
          onClose={closePurchaseDetail}
          onEdit={(purchase) => {
            openEditModal(purchase);
            closePurchaseDetail();
          }}
          onApprove={(purchase) => {
            openApproveDialog(purchase);
            closePurchaseDetail();
          }}
          onCancel={(purchase) => {
            openCancelDialog(purchase);
            closePurchaseDetail();
          }}
          onReceive={(purchase) => {
            openReceiptModal(purchase);
            closePurchaseDetail();
          }}
          onDownload={(purchase) => {
            void handleDownloadPdf(purchase);
          }}
        />

      <PurchaseReceiptModal
        isOpen={purchaseToReceive !== null}
        purchase={purchaseToReceive}
        items={receiptFormItems}
        notes={receiptNotes}
        saving={receiptSaving}
        error={receiptFormError}
        onClose={closeReceiptModal}
        onItemChange={handleReceiptItemChange}
        onNotesChange={handleReceiptNotesChange}
        onSubmit={() => void handleCreateReceipt()}
      />

      <ConfirmDialog
          isOpen={purchaseToApprove !== null}
          title="Aprobar compra"
          message={
            <>
              ¿Seguro que deseas aprobar la compra{' '}
              <span className="font-semibold">
                {purchaseToApprove?.folio}
              </span>
              ? La compra quedará confirmada y podrá
              recibir mercancía. El inventario no
              cambiará hasta registrar una recepción.
            </>
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
          <>
            ¿Seguro que deseas cancelar la compra{' '}
            <span className="font-semibold">
              {purchaseToCancel?.folio}
            </span>
            ? La compra permanecerá registrada, pero
            ya no podrá aprobarse.
          </>
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
