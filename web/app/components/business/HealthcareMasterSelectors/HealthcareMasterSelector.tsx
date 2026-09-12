'use client';

import { useEffect, useRef, useState } from 'react';

import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

export type HealthcareMasterOption = {
  id: string;
  isActive: boolean;
};

type PaginatedOptions<T> = {
  items: T[];
};

type HealthcareMasterSelectorProps<T extends HealthcareMasterOption> = {
  label: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  endpoint: string;
  value: string | null;
  currentValue?: T | null;
  disabled?: boolean;
  sessionKey: string;
  quickCreateLabel?: string;
  onQuickCreate?: () => void;
  formatOption: (option: T) => string;
  onChange: (id: string | null, option: T | null) => void;
};

const SEARCH_DELAY_MS = 300;

export default function HealthcareMasterSelector<
  T extends HealthcareMasterOption,
>({
  label,
  searchLabel,
  searchPlaceholder,
  emptyMessage,
  endpoint,
  value,
  currentValue = null,
  disabled = false,
  sessionKey,
  quickCreateLabel,
  onQuickCreate,
  formatOption,
  onChange,
}: HealthcareMasterSelectorProps<T>) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequestId = ++requestId.current;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');

      void api
        .get<PaginatedOptions<T>>(endpoint, {
          params: {
            page: 1,
            pageSize: 100,
            status: 'ACTIVE',
            ...(search.trim() ? { search: search.trim() } : {}),
          },
        })
        .then((response) => {
          if (currentRequestId !== requestId.current) {
            return;
          }

          setOptions(response.data.items.filter((option) => option.isActive));
        })
        .catch((requestError: unknown) => {
          if (currentRequestId !== requestId.current) {
            return;
          }

          setOptions([]);
          setError(
            getApiErrorMessage(
              requestError,
              `No fue posible cargar ${label.toLocaleLowerCase('es-MX')}.`,
            ),
          );
        })
        .finally(() => {
          if (currentRequestId === requestId.current) {
            setLoading(false);
          }
        });
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
      requestId.current += 1;
    };
  }, [endpoint, label, retryVersion, search, sessionKey]);

  const selectedOutsideResults =
    currentValue &&
    value === currentValue.id &&
    !options.some((option) => option.id === currentValue.id)
      ? currentValue
      : null;
  const availableOptions = selectedOutsideResults
    ? [selectedOutsideResults, ...options]
    : options;
  const selectedHistorical = Boolean(
    currentValue && value === currentValue.id && !currentValue.isActive,
  );

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          label={searchLabel}
          type="search"
          value={search}
          placeholder={searchPlaceholder}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            {label}
            <select
              aria-label={label}
              value={value ?? ''}
              disabled={disabled || loading || Boolean(error)}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              onChange={(event) => {
                const nextId = event.target.value || null;
                const selected =
                  availableOptions.find((option) => option.id === nextId) ??
                  null;
                onChange(nextId, selected);
              }}
            >
              <option value="">Sin selección</option>
              {availableOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={!option.isActive}
                >
                  {formatOption(option)}
                  {!option.isActive ? ' — Inactivo (histórico)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-gray-600">
          Cargando opciones...
        </p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryVersion((current) => current + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : options.length === 0 ? (
        <p className="text-sm text-gray-600">{emptyMessage}</p>
      ) : null}

      {selectedHistorical ? (
        <p role="status" className="text-sm text-amber-800">
          Esta relación histórica permanece visible, pero el registro inactivo
          no puede elegirse como una selección nueva.
        </p>
      ) : null}

      {!disabled && onQuickCreate && quickCreateLabel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onQuickCreate}
        >
          {quickCreateLabel}
        </Button>
      ) : null}
    </div>
  );
}
