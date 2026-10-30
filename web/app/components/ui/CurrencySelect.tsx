"use client";

import { useId } from "react";

export const SUPPORTED_CURRENCIES = ["MXN", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.some((currency) => currency === value);
}

type CurrencySelectProps = {
  label: string;
  value: string;
  onChange: (currency: string) => void;
  required?: boolean;
  disabled?: boolean;
};

export default function CurrencySelect({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}: CurrencySelectProps) {
  const id = useId();

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block font-medium text-gray-700">
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
      </label>
      <select
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      >
        {!isSupportedCurrency(value) && (
          <option value={value} disabled>
            {value ? value + " (fuera del catálogo)" : "Selecciona una moneda"}
          </option>
        )}
        <option value="MXN">MXN — Peso mexicano</option>
        <option value="USD">USD — Dólar estadounidense</option>
      </select>
    </div>
  );
}
