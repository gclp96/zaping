import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';

import type {
  Customer,
  Product,
  QuoteFormItem,
} from '../types';

type QuoteFormModalProps = {
  isOpen: boolean;
  saving: boolean;

  customers: Customer[];
  products: Product[];

  customerId: string;
  selectedProductId: string;
  quantity: string;
  price: string;
  items: QuoteFormItem[];

  customerError: string;
  productError: string;
  itemsError: string;
  formError: string;

  subtotal: number;
  iva: number;
  total: number;

  formatMoney: (value: number) => string;

  onClose: () => void;
  onSubmit: () => void;

  onCustomerChange: (value: string) => void;
  onSelectedProductChange: (
    value: string,
  ) => void;

  onQuantityChange: (value: string) => void;
  onPriceChange: (value: string) => void;

  onAddProduct: () => void;

  onItemQuantityChange: (
    productId: string,
    value: string,
  ) => void;

  onItemPriceChange: (
    productId: string,
    value: string,
  ) => void;

  onRemoveItem: (productId: string) => void;
};

export default function QuoteFormModal({
  isOpen,
  saving,

  customers,
  products,

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

  formatMoney,

  onClose,
  onSubmit,

  onCustomerChange,
  onSelectedProductChange,
  onQuantityChange,
  onPriceChange,

  onAddProduct,
  onItemQuantityChange,
  onItemPriceChange,
  onRemoveItem,
}: QuoteFormModalProps) {
  const excludedProductIds = new Set(
    items.map((item) => item.productId),
  );

  const availableProducts = products.filter(
    (product) =>
      product.isActive !== false &&
      !excludedProductIds.has(product.id),
  );

  const activeCustomers = customers.filter(
    (customer) => customer.isActive !== false,
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva cotización"
    >
      <div className="space-y-6">
        <div>
          <label
            htmlFor="quote-customer"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Cliente
            <span
              className="ml-1 text-red-600"
              aria-hidden="true"
            >
              *
            </span>
          </label>

          <select
            id="quote-customer"
            value={customerId}
            disabled={saving}
            aria-invalid={Boolean(customerError)}
            aria-describedby={
              customerError
                ? 'quote-customer-error'
                : 'quote-customer-helper'
            }
            className={[
              'w-full rounded-lg border bg-white px-3 py-2',
              'text-sm text-gray-900 outline-none',
              'transition focus:ring-2',
              customerError
                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100',
              saving
                ? 'cursor-not-allowed bg-gray-100 opacity-70'
                : '',
            ].join(' ')}
            onChange={(event) =>
              onCustomerChange(event.target.value)
            }
          >
            <option value="">
              Selecciona un cliente
            </option>

            {activeCustomers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.name}
              </option>
            ))}
          </select>

          {customerError ? (
            <p
              id="quote-customer-error"
              role="alert"
              className="mt-1 text-sm text-red-600"
            >
              {customerError}
            </p>
          ) : (
            <p
              id="quote-customer-helper"
              className="mt-1 text-sm text-gray-500"
            >
              Cliente al que se emitirá la cotización.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-4 font-semibold text-gray-900">
            Agregar producto
          </h3>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="quote-product"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Producto
              </label>

              <select
                id="quote-product"
                value={selectedProductId}
                disabled={saving}
                aria-invalid={Boolean(productError)}
                className={[
                  'w-full rounded-lg border bg-white px-3 py-2',
                  'text-sm text-gray-900 outline-none',
                  'transition focus:ring-2',
                  productError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100',
                  saving
                    ? 'cursor-not-allowed bg-gray-100 opacity-70'
                    : '',
                ].join(' ')}
                onChange={(event) =>
                  onSelectedProductChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Selecciona un producto
                </option>

                {availableProducts.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.sku} — {product.name} —
                    Stock: {product.stock}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Cantidad"
                type="number"
                min={1}
                step={1}
                value={quantity}
                disabled={saving}
                onChange={(event) =>
                  onQuantityChange(
                    event.target.value,
                  )
                }
              />

              <Input
                label="Precio unitario"
                type="number"
                min={0}
                step={0.01}
                value={price}
                disabled={saving}
                onChange={(event) =>
                  onPriceChange(event.target.value)
                }
              />
            </div>

            {productError ? (
              <p
                role="alert"
                className="text-sm text-red-600"
              >
                {productError}
              </p>
            ) : null}

            <Button
              variant="outline"
              fullWidth
              disabled={saving}
              onClick={onAddProduct}
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
            <table className="w-full min-w-190 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    Producto
                  </th>

                  <th className="px-3 py-2 text-left">
                    Cantidad
                  </th>

                  <th className="px-3 py-2 text-left">
                    Precio
                  </th>

                  <th className="px-3 py-2 text-right">
                    Subtotal
                  </th>

                  <th className="px-3 py-2">
                    <span className="sr-only">
                      Acciones
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-t border-gray-200"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">
                        {item.productName}
                      </p>

                      <p className="text-xs text-gray-500">
                        {item.productSku}
                      </p>
                    </td>

                    <td className="w-32 px-3 py-3">
                      <Input
                        aria-label={`Cantidad de ${item.productName}`}
                        type="number"
                        min={1}
                        step={1}
                        value={String(item.quantity)}
                        disabled={saving}
                        onChange={(event) =>
                          onItemQuantityChange(
                            item.productId,
                            event.target.value,
                          )
                        }
                      />
                    </td>

                    <td className="w-40 px-3 py-3">
                      <Input
                        aria-label={`Precio de ${item.productName}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={String(item.price)}
                        disabled={saving}
                        onChange={(event) =>
                          onItemPriceChange(
                            item.productId,
                            event.target.value,
                          )
                        }
                      />
                    </td>

                    <td className="px-3 py-3 text-right font-medium">
                      {formatMoney(item.subtotal)}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={saving}
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
          <div className="flex justify-between gap-4">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>

          <div className="flex justify-between gap-4">
            <span>IVA (16%)</span>
            <span>{formatMoney(iva)}</span>
          </div>

          <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 text-lg font-semibold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            loading={saving}
            loadingText="Creando..."
            disabled={
              saving ||
              !customerId ||
              items.length === 0
            }
            onClick={onSubmit}
          >
            Crear cotización
          </Button>
        </div>
      </div>
    </Modal>
  );
}