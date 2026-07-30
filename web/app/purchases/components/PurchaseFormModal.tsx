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
      <div className="space-y-6">
        <SupplierSelector
          options={suppliers}
          value={supplierId}
          onChange={onSupplierChange}
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
              onChange={onSelectedProductChange}
              error={productError}
            />

            <Input
              label="Cantidad"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) =>
                onQuantityChange(event.target.value)
              }
            />

            <Button
              variant="outline"
              fullWidth
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
                  const parsedQuantity = Number(
                    item.quantity,
                  );

                  const itemSubtotal = Number.isFinite(
                    parsedQuantity,
                  )
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
                            onItemQuantityChange(
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
                            onRemoveItem(item.productId)
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
          <p role="alert" className="text-sm text-red-600">
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
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
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
            onClick={onSubmit}
          >
            {editing
              ? 'Guardar cambios'
              : 'Crear compra'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}