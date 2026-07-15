'use client';

import type { ChangeEvent } from 'react';

import Select, {
  type SelectOption,
} from '../../ui/Select';

import type {
  ProductSelectorProps,
} from './ProductSelector.types';

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function ProductSelector({
  options,
  value,
  onChange,
  excludedProductIds = [],
  label = 'Producto',
  name = 'productId',
  placeholder = 'Selecciona un producto',
  loading = false,
  disabled = false,
  required = false,
  error,
  helperText,
}: ProductSelectorProps) {
  const excludedIds = new Set(excludedProductIds);

  const selectOptions: SelectOption[] = options.map(
    (product) => ({
      value: product.id,
      label: `${product.sku} — ${product.name} — ${formatMoney(
        product.cost,
      )}`,
      disabled: excludedIds.has(product.id),
    }),
  );

  const isEmpty = !loading && options.length === 0;
  const isDisabled = disabled || loading || isEmpty;

  function handleChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    onChange(event.target.value);
  }

  function getPlaceholder(): string {
    if (loading) {
      return 'Cargando productos...';
    }

    if (isEmpty) {
      return 'No hay productos disponibles';
    }

    return placeholder;
  }

  return (
    <Select
      label={label}
      name={name}
      value={value}
      options={selectOptions}
      placeholder={getPlaceholder()}
      required={required}
      disabled={isDisabled}
      error={error}
      helperText={helperText}
      aria-busy={loading}
      onChange={handleChange}
    />
  );
}