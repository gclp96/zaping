'use client';

import type { ChangeEvent } from 'react';

import Input from '../../ui/Input';

import type { MoneyInputProps } from './MoneyInput.types';
import { normalizeMoneyInputValue } from './money-input.utils';

export default function MoneyInput({
  value,
  onValueChange,
  allowNegative = false,
  maxDecimals = 2,
  placeholder = '0.00',
  ...inputProps
}: MoneyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const normalizedValue = normalizeMoneyInputValue(
      event.target.value,
      {
        allowNegative,
        maxDecimals,
      },
    );

    if (normalizedValue !== null) {
      onValueChange(normalizedValue);
    }
  }

  return (
    <Input
      {...inputProps}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      startAdornment="$"
      endAdornment="MXN"
    />
  );
}