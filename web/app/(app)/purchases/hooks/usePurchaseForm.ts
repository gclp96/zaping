import { useMemo, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  Product,
  Purchase,
  PurchaseFormItem,
} from '../types';

type UsePurchaseFormParams = {
  products: Product[];
  onPurchaseSaved: () => Promise<void>;
};

export function usePurchaseForm({
  products,
  onPurchaseSaved,
}: UsePurchaseFormParams) {
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [purchaseToEdit, setPurchaseToEdit] =
    useState<Purchase | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] =
    useState('');
  const [quantity, setQuantity] = useState('1');

  const [items, setItems] = useState<
    PurchaseFormItem[]
  >([]);

  const [supplierError, setSupplierError] =
    useState('');
  const [productError, setProductError] =
    useState('');
  const [quantityError, setQuantityError] =
    useState('');
  const [itemQuantityErrors, setItemQuantityErrors] =
    useState<Record<string, string>>({});
  const [itemsError, setItemsError] = useState('');

  const subtotal = useMemo(() => {
    return items.reduce((total, item) => {
      const parsedQuantity = Number(item.quantity);

      if (!Number.isFinite(parsedQuantity)) {
        return total;
      }

      return (
        total +
        parsedQuantity * item.unitCost
      );
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
    setQuantityError('');
    setItemQuantityErrors({});
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
    setQuantityError('');
    setItemQuantityErrors({});
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

  function handleSupplierChange(value: string) {
    setSupplierId(value);
    setSupplierError('');
  }

  function handleSelectedProductChange(
    value: string,
  ) {
    setSelectedProductId(value);
    setProductError('');
  }

  function handleFormQuantityChange(
    value: string,
  ) {
    setQuantity(value);
    setQuantityError('');
  }

  function handleAddProduct() {
    setProductError('');
    setQuantityError('');
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
      setQuantityError(
        'La cantidad debe ser un número entero mayor o igual a uno.',
      );
      return;
    }

    if (
      items.some(
        (item) =>
          item.productId === selectedProductId,
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
      setProductError(
        'El producto seleccionado no existe.',
      );
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

    setItemQuantityErrors((currentErrors) => {
      if (!currentErrors[product.id]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[product.id];
      return nextErrors;
    });

    setSelectedProductId('');
    setQuantity('1');
  }

  function handleItemQuantityChange(
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

    setItemsError('');
    setItemQuantityErrors((currentErrors) => {
      if (!currentErrors[productId]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[productId];
      return nextErrors;
    });
  }

  function handleRemoveItem(productId: string) {
    setItems((currentItems) =>
      currentItems.filter(
        (item) => item.productId !== productId,
      ),
    );

    setItemsError('');
    setItemQuantityErrors((currentErrors) => {
      if (!currentErrors[productId]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[productId];
      return nextErrors;
    });
  }

  async function handleCreatePurchase() {
    setSupplierError('');
    setQuantityError('');
    setItemQuantityErrors({});
    setItemsError('');

    let valid = true;

    if (!supplierId) {
      setSupplierError(
        'Selecciona un proveedor.',
      );
      valid = false;
    }

    if (items.length === 0) {
      setItemsError(
        'Agrega al menos un producto.',
      );
      valid = false;
    }

    const quantityErrors = items.reduce<Record<string, string>>(
      (errors, item) => {
        const parsedQuantity = Number(item.quantity);

        if (
          !Number.isInteger(parsedQuantity) ||
          parsedQuantity < 1
        ) {
          errors[item.productId] =
            'La cantidad debe ser un número entero mayor o igual a uno.';
        }

        return errors;
      },
      {},
    );

    if (Object.keys(quantityErrors).length > 0) {
      setItemQuantityErrors(quantityErrors);
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
        await api.post('/purchases', payload);
      }

      await onPurchaseSaved();

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

  return {
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
  };
}
