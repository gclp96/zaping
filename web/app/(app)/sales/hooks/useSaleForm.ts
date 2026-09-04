import { useMemo, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import { roundMoney } from '../sale-form.utils';

import type {
  CreateSalePayload,
  SaleFormItem,
  SaleProduct,
} from '../types';

type UseSaleFormParams = {
  products: SaleProduct[];
  onSaleSaved: () => Promise<void>;
};

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function useSaleForm({
  products,
  onSaleSaved,
}: UseSaleFormParams) {
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [items, setItems] = useState<SaleFormItem[]>([]);
  const [customerError, setCustomerError] = useState('');
  const [productError, setProductError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [formError, setFormError] = useState('');

  const subtotal = useMemo(
    () =>
      roundMoney(
        items.reduce(
          (accumulator, item) => accumulator + item.subtotal,
          0,
        ),
      ),
    [items],
  );

  const iva = roundMoney(subtotal * 0.16);
  const total = roundMoney(subtotal + iva);

  function resetForm() {
    setCustomerId('');
    setSelectedProductId('');
    setQuantity('1');
    setItems([]);
    setCustomerError('');
    setProductError('');
    setItemsError('');
    setFormError('');
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

  function handleCustomerChange(value: string) {
    setCustomerId(value);
    setCustomerError('');
    setFormError('');
  }

  function handleSelectedProductChange(value: string) {
    setSelectedProductId(value);
    setProductError('');
    setFormError('');
  }

  function handleFormQuantityChange(value: string) {
    setQuantity(value);
    setProductError('');
  }

  function handleAddProduct() {
    setProductError('');
    setItemsError('');
    setFormError('');

    if (!selectedProductId) {
      setProductError('Selecciona un producto.');
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!isPositiveInteger(parsedQuantity)) {
      setProductError(
        'La cantidad debe ser un número entero mayor a cero.',
      );
      return;
    }

    if (items.some((item) => item.productId === selectedProductId)) {
      setProductError('El producto ya fue agregado a la venta.');
      return;
    }

    const product = products.find(
      (currentProduct) => currentProduct.id === selectedProductId,
    );

    if (!product || product.isActive === false) {
      setProductError(
        'El producto seleccionado no existe o está inactivo.',
      );
      return;
    }

    setItems((currentItems) => [
      ...currentItems,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: parsedQuantity,
        price: product.price,
        stock: product.stock,
        subtotal: roundMoney(parsedQuantity * product.price),
      },
    ]);

    setSelectedProductId('');
    setQuantity('1');
  }

  function handleItemQuantityChange(productId: string, value: string) {
    const parsedQuantity = Number(value);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const normalizedQuantity = Number.isFinite(parsedQuantity)
          ? parsedQuantity
          : 0;

        return {
          ...item,
          quantity: normalizedQuantity,
          subtotal: roundMoney(normalizedQuantity * item.price),
        };
      }),
    );

    setItemsError('');
    setFormError('');
  }

  function handleRemoveItem(productId: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
    setItemsError('');
    setFormError('');
  }

  async function handleCreateSale() {
    if (saving) {
      return;
    }

    setCustomerError('');
    setItemsError('');
    setFormError('');

    let valid = true;

    if (!customerId) {
      setCustomerError('Selecciona un cliente.');
      valid = false;
    }

    if (items.length === 0) {
      setItemsError('Agrega al menos un producto.');
      valid = false;
    }

    if (
      items.some((item) => !isPositiveInteger(item.quantity))
    ) {
      setItemsError(
        'Todas las cantidades deben ser números enteros mayores a cero.',
      );
      valid = false;
    }

    const itemIds = new Set<string>();
    const hasDuplicates = items.some((item) => {
      if (itemIds.has(item.productId)) {
        return true;
      }

      itemIds.add(item.productId);
      return false;
    });

    if (hasDuplicates) {
      setItemsError('No repitas productos en la venta.');
      valid = false;
    }

    if (!valid) {
      return;
    }

    const payload: CreateSalePayload = {
      customerId,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    try {
      setSaving(true);

      await api.post('/sales', payload);
      await onSaleSaved();

      setOpenModal(false);
      resetForm();
    } catch (error: unknown) {
      setFormError(
        getApiErrorMessage(
          error,
          'No fue posible crear la venta.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    openModal,
    saving,
    customerId,
    selectedProductId,
    quantity,
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
    handleAddProduct,
    handleItemQuantityChange,
    handleRemoveItem,
    handleCreateSale,
  };
}
