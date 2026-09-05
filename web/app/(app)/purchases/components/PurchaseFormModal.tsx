import ProductSelector from '@/app/components/business/ProductSelector';
import SupplierSelector from '@/app/components/business/SupplierSelector';

import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';

import type {
  Product,
  PurchaseFormItem,
  Supplier,
} from '../types';

type PurchaseFormModalProps = {
  isOpen: boolean;
  editing: boolean;
  saving: boolean;

  suppliers: Supplier[];
  products: Product[];

  supplierId: string;
  selectedProductId: string;
  quantity: string;
  items: PurchaseFormItem[];

  supplierError: string;
  productError: string;
  quantityError: string;
  itemQuantityErrors: Record<string, string>;
  itemsError: string;

  subtotal: number;
  iva: number;
  total: number;

  formatMoney: (value: number) => string;

  onClose: () => void;
  onSubmit: () => void;
  onAddProduct: () => void;
  onRemoveItem: (productId: string) => void;

  onSupplierChange: (value: string) => void;
  onSelectedProductChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onItemQuantityChange: (
    productId: string,
    value: string,
  ) => void;
};

function getItemSubtotal(item: PurchaseFormItem): number {
  const parsedQuantity = Number(item.quantity);

  return Number.isFinite(parsedQuantity)
    ? parsedQuantity * item.unitCost
    : 0;
}

export default function PurchaseFormModal({
  isOpen,
  editing,
  saving,
  suppliers,
  products,
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
  formatMoney,
  onClose,
  onSubmit,
  onAddProduct,
  onRemoveItem,
  onSupplierChange,
  onSelectedProductChange,
  onQuantityChange,
  onItemQuantityChange,
}: PurchaseFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar compra' : 'Nueva compra'}
    >
      <div className="space-y-6 pb-2">
        <section
          aria-labelledby="purchase-form-details-heading"
          data-testid="purchase-form-details"
          className="space-y-4"
        >
          <h3
            id="purchase-form-details-heading"
            className="text-sm font-semibold uppercase tracking-wide text-gray-500"
          >
            Datos de la compra
          </h3>

          <SupplierSelector
            options={suppliers}
            value={supplierId}
            onChange={onSupplierChange}
            required
            error={supplierError}
            helperText="Proveedor que surtirá la orden de compra."
          />
        </section>

        <section
          aria-labelledby="purchase-form-add-item-heading"
          data-testid="purchase-form-add-item"
          className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 sm:p-5"
        >
          <div className="mb-4">
            <h3
              id="purchase-form-add-item-heading"
              className="font-semibold text-gray-900"
            >
              Agregar partida
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Selecciona un producto y define la cantidad inicial.
            </p>
          </div>

          <div className="space-y-4">
            <ProductSelector
              options={products}
              value={selectedProductId}
              excludedProductIds={items.map(
                (item) => item.productId,
              )}
              priceMode="cost"
              onChange={onSelectedProductChange}
              error={productError}
              helperText="Busca por nombre, SKU, código de barras, marca o categoría."
            />

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Input
                label="Cantidad"
                type="number"
                min={1}
                step={1}
                value={quantity}
                error={quantityError}
                onChange={(event) =>
                  onQuantityChange(event.target.value)
                }
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={onAddProduct}
              >
                Agregar producto
              </Button>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="purchase-form-items-heading"
          data-testid="purchase-form-items"
          className="space-y-3"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h3
              id="purchase-form-items-heading"
              className="font-semibold text-gray-900"
            >
              Partidas
            </h3>
            {items.length > 0 ? (
              <span className="text-sm text-gray-500">
                {items.length} {items.length === 1 ? 'partida' : 'partidas'}
              </span>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              Todavía no se han agregado productos. Selecciona un producto
              arriba y agrégalo para comenzar la compra.
            </div>
          ) : (
            <>
              <div
                data-testid="purchase-form-items-table"
                className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block"
              >
                <table className="min-w-full text-sm">
                  <caption className="sr-only">
                    Partidas de la compra
                  </caption>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left" scope="col">
                        Producto
                      </th>
                      <th className="w-32 px-3 py-2 text-left" scope="col">
                        Cantidad
                      </th>
                      <th className="px-3 py-2 text-right" scope="col">
                        Costo
                      </th>
                      <th className="px-3 py-2 text-right" scope="col">
                        Subtotal
                      </th>
                      <th className="w-24 px-3 py-2 text-right" scope="col">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.productId}
                        className="border-t border-gray-200 align-top"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {item.sku}
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          <Input
                            id={`purchase-item-quantity-${item.productId}-table`}
                            aria-label={`Cantidad de ${item.name}`}
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            error={itemQuantityErrors[item.productId]}
                            onChange={(event) =>
                              onItemQuantityChange(
                                item.productId,
                                event.target.value,
                              )
                            }
                          />
                        </td>

                        <td className="px-3 py-3 text-right text-gray-700">
                          {formatMoney(item.unitCost)}
                        </td>

                        <td className="px-3 py-3 text-right font-medium text-gray-900">
                          {formatMoney(getItemSubtotal(item))}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            aria-label={`Quitar ${item.name}`}
                            onClick={() =>
                              onRemoveItem(item.productId)
                            }
                          >
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                data-testid="purchase-form-mobile-items"
                className="space-y-3 md:hidden"
              >
                {items.map((item) => {
                  const itemHeadingId = `purchase-item-heading-${item.productId}`;

                  return (
                    <article
                      key={item.productId}
                      aria-labelledby={itemHeadingId}
                      data-testid={`purchase-form-mobile-item-${item.productId}`}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4
                            id={itemHeadingId}
                            className="font-medium text-gray-900"
                          >
                            {item.name}
                          </h4>
                          <p className="mt-1 text-xs text-gray-500">
                            SKU: {item.sku}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          aria-label={`Quitar ${item.name}`}
                          onClick={() =>
                            onRemoveItem(item.productId)
                          }
                        >
                          Quitar
                        </Button>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
                        <div>
                          <dt className="text-gray-500">Costo</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {formatMoney(item.unitCost)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Subtotal</dt>
                          <dd className="mt-1 font-medium text-gray-900">
                            {formatMoney(getItemSubtotal(item))}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4">
                        <Input
                          id={`purchase-item-quantity-${item.productId}-mobile`}
                          label={`Cantidad de ${item.name}`}
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          error={itemQuantityErrors[item.productId]}
                          onChange={(event) =>
                            onItemQuantityChange(
                              item.productId,
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section
          aria-labelledby="purchase-form-summary-heading"
          data-testid="purchase-form-financial-summary"
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5"
        >
          <h3
            id="purchase-form-summary-heading"
            className="mb-4 font-semibold text-gray-900"
          >
            Resumen financiero
          </h3>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(subtotal)}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">IVA (16%)</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(iva)}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-lg font-semibold text-gray-900 sm:text-xl">
              <dt>Total</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
          </dl>
        </section>

        <footer
          data-testid="purchase-form-footer"
          className="sticky bottom-0 z-10 -mx-6 mt-6 border-t border-gray-200 bg-white/95 px-6 pb-2 pt-4 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur"
        >
          {itemsError ? (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {itemsError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              loading={saving}
              loadingText={
                editing
                  ? 'Guardando cambios...'
                  : 'Guardando...'
              }
              disabled={
                saving ||
                !supplierId ||
                items.length === 0
              }
              className="w-full sm:min-w-40 sm:w-auto"
              onClick={onSubmit}
            >
              {editing ? 'Guardar cambios' : 'Crear compra'}
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
