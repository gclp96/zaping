'use client';

import { useEffect, useMemo, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import ProductSelector from '@/app/components/business/ProductSelector';
import StatusBadge, {
  type StatusTone,
} from '@/app/components/business/StatusBadge';
import SupplierSelector from '@/app/components/business/SupplierSelector';

import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';
import Table from '@/app/components/ui/Table';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

type Supplier = {
  id: string;
  name: string;
  email?: string | null;
  contactName?: string | null;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  cost: number;
  stock: number;
  minStock: number;
};

type PurchaseItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
  product: {
    id: string;
    sku: string;
    name: string;
  };
};

type InventoryMovement = {
  balance: number;
  id: string;
  productId: string;
  movementType: string;
  quantity: number;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
  };
};

type PurchaseReceiptItem = {
  id: string;
  purchaseItemId: string;
  productId: string;
  quantityReceived: number;
  lotNumber?: string | null;
  expirationDate?: string | null;
  unitCost: number;
  batchId?: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  batch?: {
    id: string;
    lotNumber: string;
    expirationDate?: string | null;
    initialQuantity: number;
    availableQuantity: number;
    unitCost: number;
  } | null;
};

type PurchaseReceipt = {
  id: string;
  purchaseId: string;
  folio: string;
  receivedAt: string;
  receivedBy?: string | null;
  notes?: string | null;
  items: PurchaseReceiptItem[];
  receivedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null
};

type PurchaseReceiptFormItem = {
  purchaseItemId: string;
  productId: string;
  sku: string;
  name: string;

  orderedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;

  quantityReceived: string;
  lotNumber: string;
  expirationDate: string;
};

type Purchase = {
  id: string;
  folio: string;
  status: string;
  subtotal: number;
  iva: number;
  total: number;
  createdAt: string;
  supplier: {
    id: string;
    name: string;
  };
  items: PurchaseItem[];
};

type PurchaseFormItem = {
  productId: string;
  sku: string;
  name: string;
  quantity: string;
  unitCost: number;
};

type PurchaseStatusDescriptor = {
  label: string;
  tone: StatusTone;
};

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

function getPurchaseStatusDescriptor(
  status: string,
): PurchaseStatusDescriptor {
    if (status === 'CONFIRMED') {
    return {
      label: 'Confirmada',
      tone: 'success',
    };
  }

  if (status === 'PARTIALLY_RECEIVED') {
    return {
      label: 'Parcialmente recibida',
      tone: 'warning',
    };
  }

  if (status === 'RECEIVED') {
    return {
      label: 'Recibida',
      tone: 'success'
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: 'Cancelada',
      tone: 'danger',
    };
  }

  if (status === 'DRAFT') {
    return {
      label: 'Borrador',
      tone: 'warning',
    };
  }

  return {
    label: status,
    tone: 'neutral',
  };
}

export default function PurchasesPage() {

const [ purchases, setPurchases ] = useState<Purchase[]>([]);
const [ suppliers, setSuppliers ] = useState<Supplier[]>([]);
const [ products, setProducts ] = useState<Product[]>([]);

const [ pageLoading, setPageLoading ] = useState(true);
const [ pageError, setPageError ] = useState('');
const [ openModal, setOpenModal ] = useState(false);
const [ saving, setSaving ] = useState(false);
const [ purchaseToEdit, setPurchaseToEdit ] = useState<Purchase | null>(null);
const [ purchaseToView, setPurchaseToView ] = useState<Purchase | null>(null);
const [ inventoryMovements, setInventoryMovements ] = useState<InventoryMovement[]>([]);
const [ purchaseReceipts, setPurchaseReceipts ] = useState<PurchaseReceipt[]>([]);
const [ purchaseToReceive, setPurchaseToReceive ] = useState<Purchase | null>(null);
const [ receiptFormItems, setReceiptFormItems ] = useState<PurchaseReceiptFormItem[]>([]);
const [ receiptNotes, setReceiptNotes ] = useState(' ');
const [ receiptSaving, setReceiptSaving ] = useState(false);
const [ receiptFormError, setReceiptFormError ] = useState('');
const [ receiptsLoading, setReceiptsLoading ] = useState(false);
const [ receiptsError, setReceiptsError ] = useState('');

const [ movementsLoading, setMovementsLoading ] = useState(false);
const [ movementsError, setMovementsError ] = useState('');

const [ supplierId, setSupplierId ] = useState('');
const [ selectedProductId, setSelectedProductId ] = useState('');
const [ quantity, setQuantity ] = useState('1');
const [ items, setItems ] = useState<PurchaseFormItem[]>([]);

const [ supplierError, setSupplierError ] = useState('');
const [ productError, setProductError ] = useState('');
const [ itemsError, setItemsError ] = useState('');

const [ purchaseToCancel, setPurchaseToCancel ] =
  useState<Purchase | null>(null);

const [ cancelling, setCancelling ] = useState(false);

const [ purchaseToApprove, setPurchaseToApprove ] =
    useState<Purchase | null>(null);
const [ approving, setApproving ] = useState(false);
const [ downloadingPurchaseId, setDownloadingPurchaseId ] =
    useState<string | null>(null);

async function loadPurchases() {
    const response = await api.get<Purchase[]>('/purchases');
    setPurchases(response.data);
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

const subtotal = useMemo(() => {
    return items.reduce((total, item) => {
      const parsedQuantity = Number(item.quantity);

      if (!Number.isFinite(parsedQuantity)) {
        return total;
      }

      return total + parsedQuantity * item.unitCost;
    }, 0);
  }, [items]);

const iva = subtotal * 0.16;
const total = subtotal + iva;

function resetForm() {
    setSupplierId('');
    setSelectedProductId('');
    setQuantity('1');
    setItems([]);

    setSupplierError('');
    setProductError('');
    setItemsError('');
  }

function openCreateModal() {
    resetForm();
    setPurchaseToEdit(null);
    setOpenModal(true);
  }

function openEditModal(purchase: Purchase) {
  if (purchase.status !== 'DRAFT') {
    return;
  }

  setPurchaseToEdit(purchase);

  setSupplierId(purchase.supplier.id);
  setSelectedProductId('');
  setQuantity('1');

  setItems(
    purchase.items.map((item) => ({
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      quantity: String(item.quantity),
      unitCost: item.price,
    })),
  );

  setSupplierError('');
  setProductError('');
  setItemsError('');

  setOpenModal(true);
}

function closeCreateModal() {
    if (saving) {
      return;
    }

    setOpenModal(false);
    setPurchaseToEdit(null);
    resetForm();
  }

function handleAddProduct() {
    setProductError('');
    setItemsError('');

    if (!selectedProductId) {
      setProductError('Selecciona un producto.');
      return;
    }

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1
    ) {
      setProductError(
        'La cantidad debe ser un número entero mayor o igual a uno.',
      );
      return;
    }

    if (
      items.some(
        (item) => item.productId === selectedProductId,
      )
    ) {
      setProductError(
        'El producto ya fue agregado a la compra.',
      );
      return;
    }

    const product = products.find(
      (currentProduct) =>
        currentProduct.id === selectedProductId,
    );

    if (!product) {
      setProductError('El producto seleccionado no existe.');
      return;
    }

    setItems((currentItems) => [
      ...currentItems,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: String(parsedQuantity),
        unitCost: product.cost,
      },
    ]);

    setSelectedProductId('');
    setQuantity('1');
  }

function handleQuantityChange(
    productId: string,
    value: string,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: value,
            }
          : item,
      ),
    );
  }

function handleRemoveItem(productId: string) {
    setItems((currentItems) =>
      currentItems.filter(
        (item) => item.productId !== productId,
      ),
    );
  }

async function handleCreatePurchase() {
    setSupplierError('');
    setItemsError('');

    let valid = true;

    if (!supplierId) {
      setSupplierError('Selecciona un proveedor.');
      valid = false;
    }

    if (items.length === 0) {
      setItemsError('Agrega al menos un producto.');
      valid = false;
    }

    const invalidQuantity = items.some((item) => {
      const parsedQuantity = Number(item.quantity);

      return (
        !Number.isInteger(parsedQuantity) ||
        parsedQuantity < 1
      );
    });

    if (invalidQuantity) {
      setItemsError(
        'Todas las cantidades deben ser enteros mayores o iguales a uno.',
      );
      valid = false;
    }

    if (!valid) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        supplierId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
      };

      if (purchaseToEdit) {
        await api.patch(
          `/purchases/${purchaseToEdit.id}`,
          payload,
        );
      } else {
        await api.post('/purchases', payload)
      }

      await loadPurchases();

      setOpenModal(false);
      setPurchaseToEdit(null);
      resetForm();
      
    } catch (error: unknown) {
      console.error(error);

      setItemsError(
        getApiErrorMessage(
          error,
          'No fue posible guardar la compra.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

async function handleApprovePurchase() {
    if (!purchaseToApprove) {
      return;
    }

    try {
      setApproving(true);

      await api.patch(
        `/purchases/${purchaseToApprove.id}/approve`,
      );

      await loadPurchases();

      setPurchaseToApprove(null);
    } catch (error: unknown) {
      console.error(error);

      alert(
        getApiErrorMessage(
          error,
          'No fue posible aprobar la compra.',
        ),
      );
    } finally {
      setApproving(false);
    }
  }

async function handleCancelPurchase() {
  if (!purchaseToCancel) {
    return;
  }

  try {
    setCancelling(true);

    await api.patch(
      `/purchases/${purchaseToCancel.id}/cancel`,
    );

    await loadPurchases();
    setPurchaseToCancel(null);
  } catch (error: unknown) {
    console.error(error);

    alert(
      getApiErrorMessage(
        error,
        'No fue posible cancelar la compra.',
      ),
    );
  } finally {
    setCancelling(false);
  }
}

async function handleDownloadPdf(purchase: Purchase) {
    try {
      setDownloadingPurchaseId(purchase.id);

      const response = await api.get(
        `/purchases/${purchase.id}/pdf`,
        {
          responseType: 'blob',
        },
      );

      const fileUrl = window.URL.createObjectURL(
        response.data as Blob,
      );

      const link = document.createElement('a');

      link.href = fileUrl;
      link.download = `compra-${purchase.folio}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(fileUrl);
    } catch (error: unknown) {
      console.error(error);

      alert(
        getApiErrorMessage(
          error,
          'No fue posible descargar el PDF.',
        ),
      );
    } finally {
      setDownloadingPurchaseId(null);
    }
  }

async function openPurchaseDetail(purchase: Purchase) {
  setPurchaseToView(purchase);

  setInventoryMovements([]);
  setMovementsError('');

  setPurchaseReceipts([]);
  setReceiptsError('');

  setMovementsLoading(true);
  setReceiptsError('');

  setMovementsLoading(true);
  setReceiptsLoading(true);

  const [movementsResult, receiptsResult] =
    await Promise.allSettled([
      api.get<InventoryMovement[]>(
        `/purchases/${purchase.id}/inventory-movements`,
      ),
      api.get<PurchaseReceipt[]>(
        `/purchase-receipts/purchase/${purchase.id}`,
      ),
    ]);

  if (movementsResult.status === 'fulfilled') {
    setInventoryMovements(movementsResult.value.data);
  } else {
    const error: unknown = movementsResult.reason;

    console.error(error);

    setMovementsError(
      getApiErrorMessage(
        error,
        'No fue posible cargar los movimientos de iinventario.',
      ),
    );
  }

  if (receiptsResult.status === 'fulfilled') {
    setPurchaseReceipts(receiptsResult.value.data);
  } else {
    const error: unknown = receiptsResult.reason;

    console.error(error);

    setReceiptsError(
      getApiErrorMessage(
        error,
        'No fue posible cargar las recepciones de la compra.',
      ),
    );
  }

  setMovementsLoading(false);
  setReceiptsLoading(false);
}

function openReceiptModal(purchase: Purchase) {
  const formItems = purchase.items
    .map((purchaseItem) => {
      const receivedQuantity = purchaseReceipts.reduce(
        (total, receipt) => {
          const receivedFromReceipt = receipt.items
            .filter(
              (receiptItem) =>
                receiptItem.purchaseItemId === purchaseItem.id,
            )
            .reduce(
              (receiptTotal, receiptItem) =>
                receiptTotal +
                receiptItem.quantityReceived,
              0,
            );

          return total + receivedFromReceipt;
        },
        0,
      );

      const pendingQuantity = Math.max(
        purchaseItem.quantity - receivedQuantity,
        0,
      );

      return {
        purchaseItemId: purchaseItem.id,
        productId: purchaseItem.productId,
        sku: purchaseItem.product.sku,
        name: purchaseItem.product.name,

        orderedQuantity: purchaseItem.quantity,
        receivedQuantity,
        pendingQuantity,

        quantityReceived: '',
        lotNumber: '',
        expirationDate: '',
      };
    })
    .filter((item) => item.pendingQuantity > 0);

  setPurchaseToReceive(purchase);
  setReceiptFormItems(formItems);
  setReceiptNotes('');
  setReceiptFormError('');

  setPurchaseToView(null);
}

function closeReceiptModal() {
  if (receiptSaving) {
    return;
  }

  setPurchaseToReceive(null);
  setReceiptFormItems([]);
  setReceiptNotes('');
  setReceiptFormError('');
}

function handleReceiptItemChange(
  purchaseItemId: string,
  field:
    | 'quantityReceived'
    | 'lotNumber'
    | 'expirationDate',
  value: string,
) {
  setReceiptFormItems((currentItems) =>
    currentItems.map((item) =>
      item.purchaseItemId === purchaseItemId
        ? {
            ...item,
            [field]: value,
          }
        : item,
      ),
    );

    setReceiptFormError('');
}

async function handleCreateReceipt() {
  if (!purchaseToReceive) {
    return;
  }

  setReceiptFormError('');

  const selectedItems = receiptFormItems.filter(
    (item) => item.quantityReceived.trim() !== '',
  );

  if (selectedItems.length === 0) {
    setReceiptFormError(
      'Captura la cantidad recibida de al menos un producto.',
    );
    return;
  }

  const invalidQuantityItem = selectedItems.find((item) => {
    const parsedQuantity = Number(item.quantityReceived);

    return (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > item.pendingQuantity
    );
  });

  if (invalidQuantityItem) {
    setReceiptFormError(
      `La cantidad de ${invalidQuantityItem.name} debe ser un entero entre 1 y ${invalidQuantityItem.pendingQuantity}.`,
    );
    return;
  }

  const expirationWithoutLot = selectedItems.find(
    (item) =>
      item.expirationDate.trim() !== '' &&
      item.lotNumber.trim() === '',
  );

  if (expirationWithoutLot) {
    setReceiptFormError(
      `Captura el número de lote de ${expirationWithoutLot.name} para registrar su caducidad.`,
    );
    return;
  }

  try {
    setReceiptSaving(true);

    await api.post('/purchase-receipts', {
      purchaseId: purchaseToReceive.id,
      notes: receiptNotes.trim() || undefined,
      items: selectedItems.map((item) => ({
        purchaseItemId: item.purchaseItemId,
        quantityReceived: Number(item.quantityReceived),
        lotNumber: item.lotNumber.trim() || undefined,
        expirationDate:
          item.expirationDate.trim() || undefined,
      })),
    });

    await loadPurchases();

    setPurchaseToReceive(null);
    setReceiptFormItems([]);
    setReceiptNotes('');
    setReceiptFormError('');
  } catch (error: unknown) {
    console.error(error);

    setReceiptFormError(
      getApiErrorMessage(
        error,
        'No fue posible registrar la recepción.',
      ),
    );
  } finally {
    setReceiptSaving(false);
  }
}

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
                onClick={() => setPurchaseToApprove(purchase)}
              >
                Aprobar
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => setPurchaseToCancel(purchase)}
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
      <Modal
        isOpen={openModal}
        onClose={closeCreateModal}
        title={purchaseToEdit ? 'Editar compra' : 'Nueva compra'}
      >
        <div className="space-y-6">
          <SupplierSelector
            options={suppliers}
            value={supplierId}
            onChange={(value) => {
              setSupplierId(value);
              setSupplierError('');
            }}
            required
            error={supplierError}
            helperText="Proveedor que surtirá la orden de compra."
          />

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-4 font-semibold">
              Agregar producto
            </h3>

            <div className="space-y-4">
              <ProductSelector
                options={products}
                value={selectedProductId}
                excludedProductIds={items.map(
                  (item) => item.productId,
                )}
                onChange={(value) => {
                  setSelectedProductId(value);
                  setProductError('');
                }}
                error={productError}
              />

              <Input
                label="Cantidad"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
              />

              <Button
                variant="outline"
                fullWidth
                onClick={handleAddProduct}
              >
                Agregar producto
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              Todavía no se han agregado productos.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-left">
                      Cantidad
                    </th>
                    <th className="px-3 py-2 text-right">
                      Costo
                    </th>
                    <th className="px-3 py-2 text-right">
                      Subtotal
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const parsedQuantity =
                      Number(item.quantity);

                    const itemSubtotal =
                      Number.isFinite(parsedQuantity)
                        ? parsedQuantity * item.unitCost
                        : 0;

                    return (
                      <tr
                        key={item.productId}
                        className="border-t border-gray-200"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.sku}
                          </p>
                        </td>

                        <td className="w-28 px-3 py-3">
                          <Input
                            aria-label={`Cantidad de ${item.name}`}
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            onChange={(event) =>
                              handleQuantityChange(
                                item.productId,
                                event.target.value,
                              )
                            }
                          />
                        </td>

                        <td className="px-3 py-3 text-right">
                          {formatMoney(item.unitCost)}
                        </td>

                        <td className="px-3 py-3 text-right font-medium">
                          {formatMoney(itemSubtotal)}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              handleRemoveItem(
                                item.productId,
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {itemsError ? (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {itemsError}
            </p>
          ) : null}

          <div className="space-y-2 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>

            <div className="flex justify-between">
              <span>IVA (16%)</span>
              <span>{formatMoney(iva)}</span>
            </div>

            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={saving}
            onClick={closeCreateModal}
          >
            Cancelar
          </Button>

          <Button
              loading={saving}
              loadingText={
                purchaseToEdit ? 'Guardando cambios...' : 'Guardando...'
              }
              disabled={
                saving ||
                !supplierId ||
                items.length === 0
              }
              onClick={() => void handleCreatePurchase()}
            >
              {purchaseToEdit ? 'Guardar cambios' : 'Crear compra'}
            </Button>
          </div>
        </div>
        </Modal>
      
      {/* Ver detalles de compra */}
      <Modal
        isOpen={purchaseToView !== null}
        onClose={() => {
          setPurchaseToView(null);

          setInventoryMovements([]);
          setMovementsError('');

          setPurchaseReceipts([]);
          setReceiptsError('');
        }}
        title="Detalle de compra"
      >
        {purchaseToView ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm text-gray-500">Folio</p>
                <p className="text-lg font-semibold">
                  {purchaseToView.folio}
                </p>

                <p className="mt-3 text-sm text-gray-500">
                  Fecha
                </p>
                <p className="font-medium">
                  {formatDate(purchaseToView.createdAt)}
                </p>
              </div>

              <div className="md:text-right">
                {(() => {
                  const statusDescriptor =
                    getPurchaseStatusDescriptor(
                      purchaseToView.status,
                    );

                  return (
                    <StatusBadge
                      label={statusDescriptor.label}
                      tone={statusDescriptor.tone}
                      ariaLabel={`Estado de la compra: ${statusDescriptor.label}`}
                    />
                  );
                })()}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 font-semibold">Proveedor</h3>

              <p className="font-medium">
                {purchaseToView.supplier.name}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right">
                      Cantidad
                    </th>
                    <th className="px-3 py-2 text-right">
                      Costo
                    </th>
                    <th className="px-3 py-2 text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseToView.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-200"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.product.sku}
                        </p>
                      </td>

                      <td className="px-3 py-3 text-right">
                        {item.quantity}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {formatMoney(item.price)}
                      </td>

                      <td className="px-3 py-3 text-right font-medium">
                        {formatMoney(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 font-semibold">
                Recepciones de mercancía
              </h3>

              {receiptsLoading ? (
                <p className="text-sm text-gray-500">
                  Cargando recepciones...
                </p>
              ) : receiptsError ? (
                <p
                  role="alert"
                  className="text-sm text-red-600"
                >
                  {receiptsError}
                </p>
              ) : purchaseReceipts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Esta compra todavía no tiene recepciones registradas.
                </p>
              ) : (
                <div className="space-y-4">
                  {purchaseReceipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="rounded-lg border border-gray-200"
                    >
                      <div className="flex flex-col gap-3 bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold">
                            {receipt.folio}
                          </p>

                          <p className="text-sm text-gray-500">
                            Recibida el {formatDate(receipt.receivedAt)}
                          </p>

                          {receipt.notes ? (
                            <p className="mt-2 text-sm text-gray-600">
                              {receipt.notes}
                            </p>
                          ) : null}
                        </div>

                        <div className="text-sm md:text-right">
                          <p className="text-gray-500">
                            Usuario responsable
                          </p>

                          <p>
                            {receipt.receivedByUser ? (
                              <>
                                <p>
                                  {receipt.receivedByUser.firstName}{' '}
                                  {receipt.receivedByUser.lastName}
                                </p>

                                <p className="text-xs text-gray-500">
                                  {receipt.receivedByUser.email}
                                </p>
                              </>
                            ) : (
                              <p className="font-medium">
                                No disponible
                              </p>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-t border-gray-200 bg-white">
                              <th className="px-3 py-2 text-left">
                                Producto
                              </th>

                              <th className="px-3 py-2 text-right">
                                Recibido
                              </th>

                              <th className="px-3 py-2 text-left">
                                Lote
                              </th>

                              <th className="px-3 py-2 text-left">
                                Caducidad
                              </th>

                              <th className="px-3 py-2 text-right">
                                Costo
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {receipt.items.map((receiptItem) => (
                              <tr
                                key={receiptItem.id}
                                className="border-t border-gray-200"
                              >
                                <td className="px-3 py-3">
                                  <p className="font-medium">
                                    {receiptItem.product.name}
                                  </p>

                                  <p className="text-xs text-gray-500">
                                    {receiptItem.product.sku}
                                  </p>
                                </td>

                                <td className="px-3 py-3 text-right font-medium">
                                  {receiptItem.quantityReceived}
                                </td>

                                <td className="px-3 py-3">
                                  {receiptItem.lotNumber ??
                                    receiptItem.batch?.lotNumber ??
                                    '—'}
                                </td>

                                <td className="px-3 py-3">
                                  {receiptItem.expirationDate
                                    ? formatDate(
                                        receiptItem.expirationDate,
                                      )
                                    : '—'}
                                </td>

                                <td className="px-3 py-3 text-right">
                                  {formatMoney(receiptItem.unitCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 font-semibold">
                Movimientos de inventario
              </h3>

              {movementsLoading ? (
                <p className="text-sm text-gray-500">
                  Cargando movimientos...
                </p>
              ) : movementsError ? (
                <p role="alert" className="text-sm text-red-600">
                  {movementsError}
                </p>
              ) : inventoryMovements.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Esta compra no tiene movimientos de inventario asociados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          Producto
                        </th>
                        <th className="px-3 py-2 text-left">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-right">
                          Cantidad
                        </th>
                        <th className="px-3 py-2 text-right">
                          Balance
                        </th>
                        <th className="px-3 py-2 text-right">
                          Costo
                        </th>
                        <th className="px-3 py-2 text-left">
                          Fecha
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {inventoryMovements.map((movement) => (
                        <tr
                          key={movement.id}
                          className="border-t border-gray-200"
                          >
                            <td className="px-3 py-3">
                              <p className="font-medium">
                                {movement.product.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {movement.product.sku}
                              </p>
                            </td>

                            <td className="px-3 py-3">
                              {movement.movementType}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {movement.quantity}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {movement.balance}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {movement.unitCost != null
                                ? formatMoney(movement.unitCost)
                                : '—'}
                            </td>

                            <td className="px-3 py-3">
                              {formatDate(movement.createdAt)}
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(purchaseToView.subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>IVA (16%)</span>
                <span>{formatMoney(purchaseToView.iva)}</span>
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
                <span>Total</span>
                <span>{formatMoney(purchaseToView.total)}</span>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-3 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
              {purchaseToView.status === 'DRAFT' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      openEditModal(purchaseToView);
                      setPurchaseToView(null);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => {
                      setPurchaseToApprove(purchaseToView);
                      setPurchaseToView(null);
                    }}
                  >
                    Aprobar
                  </Button>

                  <Button
                    variant="danger"
                    onClick={() => {
                      setPurchaseToCancel(purchaseToView);
                      setPurchaseToView(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : null}

              {purchaseToView.status === 'CONFIRMED' ||
              purchaseToView.status === 'PARTIALLY_RECEIVED' ? (
                <Button
                variant="success"
                className="min-w-44"
                onClick={() => openReceiptModal(purchaseToView)}
                >
                  Registrar recepcion
                </Button>
              ) : null}

              <Button
                variant="secondary"
                className="min-w-28"
                onClick={() => {
                  setPurchaseToView(null);
                  setInventoryMovements([]);
                  setMovementsError('');
                  setPurchaseReceipts([]);
                  setReceiptsError('');
                            }}
              >
                Cerrar
              </Button>

              <Button
                variant="primary"
                className="min-w-36"
                loading={downloadingPurchaseId === purchaseToView.id}
                loadingText="Descargando..."
                onClick={() => void handleDownloadPdf(purchaseToView)}
              >
                Descargar PDF
              </Button>
            </div>
          </div>
        ) : null}
        </Modal>

        {/* Registrar recepción */}
      <Modal
        isOpen={purchaseToReceive !== null}
        onClose={closeReceiptModal}
        title={
          purchaseToReceive
            ? `Registrar recepción · ${purchaseToReceive.folio}`
            : 'Registrar recepción'
        }
      >
        {purchaseToReceive ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                Proveedor
              </p>

              <p className="font-semibold">
                {purchaseToReceive.supplier.name}
              </p>
            </div>

            {receiptFormItems.length === 0 ? (
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">
                  Esta compra ya fue recibida completamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-237.5 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left">
                        Producto
                      </th>
                      <th className="px-3 py-3 text-right">
                        Comprado
                      </th>
                      <th className="px-3 py-3 text-right">
                        Recibido
                      </th>
                      <th className="px-3 py-3 text-right">
                        Pendiente
                      </th>
                      <th className="px-3 py-3 text-left">
                        Recibir ahora
                      </th>
                      <th className="px-3 py-3 text-left">
                        Lote
                      </th>
                      <th className="px-3 py-3 text-left">
                        Caducidad
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {receiptFormItems.map((item) => (
                      <tr
                        key={item.purchaseItemId}
                        className="border-t border-gray-200 align-top"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium">
                            {item.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {item.sku}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-right">
                          {item.orderedQuantity}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {item.receivedQuantity}
                        </td>

                        <td className="px-3 py-3 text-right font-semibold">
                          {item.pendingQuantity}
                        </td>

                        <td className="w-36 px-3 py-3">
                          <Input
                            aria-label={`Cantidad recibida de ${item.name}`}
                            type="number"
                            min={1}
                            max={item.pendingQuantity}
                            step={1}
                            value={item.quantityReceived}
                            onChange={(event) =>
                              handleReceiptItemChange(
                                item.purchaseItemId,
                                'quantityReceived',
                                event.target.value,
                              )
                            }
                          />
                        </td>

                        <td className="w-48 px-3 py-3">
                          <Input
                            aria-label={`Lote de ${item.name}`}
                            placeholder="Ej. LOTE-001"
                            value={item.lotNumber}
                            onChange={(event) =>
                              handleReceiptItemChange(
                                item.purchaseItemId,
                                'lotNumber',
                                event.target.value,
                              )
                            }
                          />
                        </td>

                        <td className="w-44 px-3 py-3">
                          <Input
                            aria-label={`Caducidad de ${item.name}`}
                            type="date"
                            value={item.expirationDate}
                            onChange={(event) =>
                              handleReceiptItemChange(
                                item.purchaseItemId,
                                'expirationDate',
                                event.target.value,
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <label
                htmlFor="receipt-notes"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Notas
              </label>

              <textarea
                id="receipt-notes"
                rows={3}
                maxLength={1000}
                value={receiptNotes}
                placeholder="Observaciones de la recepción..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  setReceiptNotes(event.target.value);
                  setReceiptFormError('');
                }}
              />
            </div>

            {receiptFormError ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {receiptFormError}
              </p>
            ) : null}

            <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <Button
                variant="secondary"
                disabled={receiptSaving}
                onClick={closeReceiptModal}
              >
                Cancelar
              </Button>

              <Button
                variant="success"
                loading={receiptSaving}
                loadingText="Registrando..."
                disabled={
                  receiptSaving || receiptFormItems.length === 0
                }
                onClick={() => void handleCreateReceipt()}
              >
                Registrar recepción
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={purchaseToApprove !== null}
        title="Aprobar compra"
        message={
          <>
            ¿Seguro que deseas aprobar la compra{' '}
            <span className="font-semibold">
              {purchaseToApprove?.folio}
            </span>
            ? La compra quedará confirmada y podrá recibir mercancía.
            El inventario no cambiará hasta registrar una recepcion.
          </>
        }
        confirmText="Aprobar"
        loadingText="Aprobando..."
        confirmVariant="success"
        loading={approving}
        onClose={() => {
          if (!approving) {
            setPurchaseToApprove(null);
          }
        }}
        onConfirm={() => void handleApprovePurchase()}
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
              ? La compra permanecerá registrada, pero ya no podrá aprobarse.
            </>
          }
          confirmText="Cancelar compra"
          loadingText="Cancelando..."
          confirmVariant="danger"
          loading={cancelling}
          onClose={() => {
            if (!cancelling) {
              setPurchaseToCancel(null);
            }
          }}
          onConfirm={() => void handleCancelPurchase()}
        />
    </>
  );
}
