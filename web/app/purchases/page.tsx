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

const [purchases, setPurchases] = useState<Purchase[]>([]);
const [suppliers, setSuppliers] = useState<Supplier[]>([]);
const [products, setProducts] = useState<Product[]>([]);

const [pageLoading, setPageLoading] = useState(true);
const [pageError, setPageError] = useState('');
const [openModal, setOpenModal] = useState(false);
const [saving, setSaving] = useState(false);
const [ purchaseToView, setPurchaseToView ] = useState<Purchase | null>(null);

const [supplierId, setSupplierId] = useState('');
const [selectedProductId, setSelectedProductId] = useState('');
const [quantity, setQuantity] = useState('1');
const [items, setItems] = useState<PurchaseFormItem[]>([]);

const [supplierError, setSupplierError] = useState('');
const [productError, setProductError] = useState('');
const [itemsError, setItemsError] = useState('');

const [purchaseToCancel, setPurchaseToCancel] =
  useState<Purchase | null>(null);

const [cancelling, setCancelling] = useState(false);

const [purchaseToApprove, setPurchaseToApprove] =
    useState<Purchase | null>(null);
const [approving, setApproving] = useState(false);
const [downloadingPurchaseId, setDownloadingPurchaseId] =
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
    setOpenModal(true);
  }

function closeCreateModal() {
    if (saving) {
      return;
    }

    setOpenModal(false);
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

      await api.post('/purchases', {
        supplierId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
      });

      await loadPurchases();

      setOpenModal(false);
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
            variant="outline"
            size="sm"
            onClick={() => setPurchaseToView(purchase)}
            >
              ver
            </Button>

          {purchase.status === 'DRAFT' ? (
            <>
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
            variant="outline"
            size="sm"
            loading={
              downloadingPurchaseId === purchase.id
            }
            loadingText="Descargando..."
            onClick={() => void handleDownloadPdf(purchase)}
          >
            PDF
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
        title="Nueva compra"
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
            loadingText="Guardando..."
            disabled={
              saving ||
              !supplierId ||
              items.length === 0
            }
            onClick={() => void handleCreatePurchase()}
          >
            Crear compra
          </Button>
          </div>
        </div>
        </Modal>
      
      {/* Ver detalles de compra */}
      <Modal
        isOpen={purchaseToView !== null}
        onClose={() => setPurchaseToView(null)}
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

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setPurchaseToView(null)}
              >
                Cerrar
              </Button>

              {purchaseToView.status === 'DRAFT' ? (
                <>
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

              <Button
                variant="outline"
                loading={
                  downloadingPurchaseId === purchaseToView.id
                }
                loadingText="Descargando..."
                onClick={() => void handleDownloadPdf(purchaseToView)}
              >
                PDF
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
            ? Esta acción incrementará el inventario.
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