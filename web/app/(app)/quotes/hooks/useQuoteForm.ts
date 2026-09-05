import { useMemo, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  CreateQuotePayload,
  Product,
  QuoteFormItem,
} from '../types';

type UseQuoteFormParams = {
  products: Product[];
  onQuoteSaved: () => Promise<void>;
};

function roundMoney(value: number): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function hasMaximumTwoDecimals(
  value: number,
): boolean {
  return (
    Math.abs(value * 100 - Math.round(value * 100)) <
    Number.EPSILON * 100
  );
}

export function useQuoteForm({
  products,
  onQuoteSaved,
}: UseQuoteFormParams) {
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState('');

  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');

  const [items, setItems] = useState<
    QuoteFormItem[]
  >([]);

  const [customerError, setCustomerError] =
    useState('');

  const [productError, setProductError] =
    useState('');

  const [itemsError, setItemsError] =
    useState('');

  const [formError, setFormError] = useState('');

  const subtotal = useMemo(() => {
    const value = items.reduce(
      (accumulator, item) =>
        accumulator +
        item.quantity * item.price,
      0,
    );

    return roundMoney(value);
  }, [items]);

  const iva = roundMoney(subtotal * 0.16);
  const total = roundMoney(subtotal + iva);

  function resetForm() {
    setCustomerId('');

    setSelectedProductId('');
    setQuantity('1');
    setPrice('');

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

  function handleSelectedProductChange(
    value: string,
  ) {
    setSelectedProductId(value);
    setProductError('');
    setFormError('');

    const product = products.find(
      (currentProduct) =>
        currentProduct.id === value,
    );

    setPrice(
      product ? String(product.price) : '',
    );
  }

  function handleFormQuantityChange(
    value: string,
  ) {
    setQuantity(value);
    setProductError('');
  }

  function handleFormPriceChange(value: string) {
    setPrice(value);
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

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1
    ) {
      setProductError(
        'La cantidad debe ser un número entero mayor o igual a uno.',
      );

      return;
    }

    const trimmedPrice = price.trim();
    const parsedPrice = Number(trimmedPrice);

    if (
      trimmedPrice === '' ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      !hasMaximumTwoDecimals(parsedPrice)
    ) {
      setProductError(
        'El precio debe ser un número válido, no negativo y con máximo dos decimales.',
      );

      return;
    }

    const duplicatedProduct = items.some(
      (item) =>
        item.productId === selectedProductId,
    );

    if (duplicatedProduct) {
      setProductError(
        'El producto ya fue agregado a la cotización.',
      );

      return;
    }

    const product = products.find(
      (currentProduct) =>
        currentProduct.id === selectedProductId,
    );

    if (!product || product.isActive === false) {
      setProductError(
        'El producto seleccionado no existe o está inactivo.',
      );

      return;
    }

    const normalizedPrice =
      roundMoney(parsedPrice);

    setItems((currentItems) => [
      ...currentItems,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: parsedQuantity,
        price: normalizedPrice,
        subtotal: roundMoney(
          parsedQuantity * normalizedPrice,
        ),
      },
    ]);

    setSelectedProductId('');
    setQuantity('1');
    setPrice('');
  }

  function handleItemQuantityChange(
    productId: string,
    value: string,
  ) {
    const parsedQuantity = Number(value);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const normalizedQuantity =
          Number.isFinite(parsedQuantity)
            ? parsedQuantity
            : 0;

        return {
          ...item,
          quantity: normalizedQuantity,
          subtotal: roundMoney(
            normalizedQuantity * item.price,
          ),
        };
      }),
    );

    setItemsError('');
    setFormError('');
  }

  function handleItemPriceChange(
    productId: string,
    value: string,
  ) {
    const parsedPrice = Number(value);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const normalizedPrice =
          Number.isFinite(parsedPrice)
            ? parsedPrice
            : 0;

        return {
          ...item,
          price: normalizedPrice,
          subtotal: roundMoney(
            item.quantity * normalizedPrice,
          ),
        };
      }),
    );

    setItemsError('');
    setFormError('');
  }

  function handleRemoveItem(productId: string) {
    setItems((currentItems) =>
      currentItems.filter(
        (item) => item.productId !== productId,
      ),
    );

    setItemsError('');
    setFormError('');
  }

  async function handleCreateQuote() {
    setCustomerError('');
    setItemsError('');
    setFormError('');

    let valid = true;

    if (!customerId) {
      setCustomerError(
        'Selecciona un cliente.',
      );

      valid = false;
    }

    if (items.length === 0) {
      setItemsError(
        'Agrega al menos un producto.',
      );

      valid = false;
    }

    const invalidQuantity = items.some(
      (item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1,
    );

    if (invalidQuantity) {
      setItemsError(
        'Todas las cantidades deben ser números enteros mayores o iguales a uno.',
      );

      valid = false;
    }

    const invalidPrice = items.some(
      (item) =>
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !hasMaximumTwoDecimals(item.price),
    );

    if (invalidPrice) {
      setItemsError(
        'Todos los precios deben ser válidos, no negativos y tener máximo dos decimales.',
      );

      valid = false;
    }

    if (!valid) {
      return;
    }

    const payload: CreateQuotePayload = {
      customerId,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: roundMoney(item.price),
      })),
    };

    try {
      setSaving(true);

      await api.post('/quotes', payload);

      await onQuoteSaved();

      setOpenModal(false);
      resetForm();
    } catch (error: unknown) {

      setFormError(
        getApiErrorMessage(
          error,
          'No fue posible crear la cotización.',
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
    price,
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
    handleFormPriceChange,

    handleAddProduct,
    handleItemQuantityChange,
    handleItemPriceChange,
    handleRemoveItem,
    handleCreateQuote,
  };
}
