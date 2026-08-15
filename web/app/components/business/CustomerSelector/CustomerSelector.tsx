import {
  useId,
  useMemo,
  useState,
} from 'react';

import type {
  CustomerOption,
  CustomerSelectorProps,
} from './CustomerSelector.types';

function normalizeSearchValue(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function CustomerSelector({
  options,
  value,
  onChange,
  onCreateNew,

  label = 'Cliente',
  name = 'customerId',
  placeholder =
    'Buscar por nombre, tipo, contacto, email o teléfono',

  loading = false,
  disabled = false,
  required = false,

  error,
  helperText,
}: CustomerSelectorProps) {
  const generatedId = useId();

  const inputId = `${generatedId}-search`;
  const listboxId = `${generatedId}-results`;

  const descriptionId =
    error || helperText
      ? `${generatedId}-description`
      : undefined;

  const [search, setSearch] =
    useState('');

  const [open, setOpen] =
    useState(false);

  const activeCustomers = useMemo(
    () =>
      options.filter(
        (customer) =>
          customer.isActive !== false,
      ),
    [options],
  );

  const selectedCustomer = useMemo(
    () =>
      options.find(
        (customer) =>
          customer.id === value,
      ) ?? null,
    [options, value],
  );

  const filteredCustomers = useMemo(() => {
    const normalizedSearch =
      normalizeSearchValue(search);

    return activeCustomers
      .filter((customer) => {
        if (!normalizedSearch) {
          return true;
        }

        const searchableValues = [
          customer.name,
          customer.type ?? '',
          customer.contactName ?? '',
          customer.email ?? '',
          customer.phone ?? '',
        ];

        return searchableValues.some(
          (item) =>
            normalizeSearchValue(
              item,
            ).includes(
              normalizedSearch,
            ),
        );
      })
      .slice(0, 50);
  }, [
    activeCustomers,
    search,
  ]);

  const isEmpty =
    !loading &&
    activeCustomers.length === 0;

  const isDisabled =
    disabled || loading;

  function handleSelectCustomer(
    customer: CustomerOption,
  ) {
    if (isDisabled) {
      return;
    }

    onChange(customer.id);

    setSearch('');
    setOpen(false);
  }

  function handleClearSelection() {
    if (isDisabled) {
      return;
    }

    onChange('');
    setSearch('');
    setOpen(true);
  }

  function handleCreateNew() {
    if (
      isDisabled ||
      !onCreateNew
    ) {
      return;
    }

    setOpen(false);

    onCreateNew();
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-gray-700"
      >
        {label}

        {required ? (
          <span
            aria-hidden="true"
            className="ml-1 text-red-500"
          >
            *
          </span>
        ) : null}
      </label>

      <input
        type="hidden"
        name={name}
        value={value}
      />

      {selectedCustomer ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">
                {selectedCustomer.name}
              </p>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                {selectedCustomer.type ? (
                  <span>
                    Tipo:{' '}
                    {selectedCustomer.type}
                  </span>
                ) : null}

                {selectedCustomer.contactName ? (
                  <span>
                    Contacto:{' '}
                    {
                      selectedCustomer
                        .contactName
                    }
                  </span>
                ) : null}

                {selectedCustomer.email ? (
                  <span>
                    {
                      selectedCustomer
                        .email
                    }
                  </span>
                ) : null}

                {selectedCustomer.phone ? (
                  <span>
                    {
                      selectedCustomer
                        .phone
                    }
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              disabled={isDisabled}
              className="shrink-0 text-sm font-medium text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={
                handleClearSelection
              }
            >
              Cambiar
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type="search"
          role="combobox"
          autoComplete="off"
          value={search}
          placeholder={
            loading
              ? 'Cargando clientes...'
              : placeholder
          }
          disabled={isDisabled}
          aria-expanded={
            open && !isDisabled
          }
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={
            error ? true : undefined
          }
          aria-describedby={
            descriptionId
          }
          aria-busy={loading}
          className={[
            'w-full rounded-lg border bg-white px-3 py-3 text-sm text-gray-900',
            'outline-none transition focus:ring-2',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100',
            isDisabled
              ? 'cursor-not-allowed bg-gray-100'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onFocus={() => {
            if (!isDisabled) {
              setOpen(true);
            }
          }}
          onChange={(event) => {
            setSearch(
              event.target.value,
            );

            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Escape'
            ) {
              setOpen(false);
            }
          }}
        />

        {open && !isDisabled ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Resultados de clientes"
            className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {filteredCustomers.length ===
            0 ? (
              <div className="p-4 text-sm text-gray-500">
                No se encontraron clientes.
              </div>
            ) : (
              filteredCustomers.map(
                (customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    role="option"
                    aria-selected={
                      customer.id ===
                      value
                    }
                    className="w-full border-b border-gray-100 p-3 text-left last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                    onMouseDown={(
                      event,
                    ) => {
                      event.preventDefault();
                    }}
                    onClick={() =>
                      handleSelectCustomer(
                        customer,
                      )
                    }
                  >
                    <p className="font-medium text-gray-900">
                      {customer.name}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      {customer.type ? (
                        <span>
                          Tipo:{' '}
                          {customer.type}
                        </span>
                      ) : null}

                      {customer.contactName ? (
                        <span>
                          Contacto:{' '}
                          {
                            customer
                              .contactName
                          }
                        </span>
                      ) : null}

                      {customer.email ? (
                        <span>
                          {customer.email}
                        </span>
                      ) : null}

                      {customer.phone ? (
                        <span>
                          {customer.phone}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ),
              )
            )}

            {onCreateNew ? (
              <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 p-2">
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                  onMouseDown={(
                    event,
                  ) => {
                    event.preventDefault();
                  }}
                  onClick={
                    handleCreateNew
                  }
                >
                  + Registrar nuevo cliente
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">
          Cargando clientes...
        </p>
      ) : isEmpty ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            No hay clientes registrados.
          </p>

          {onCreateNew ? (
            <button
              type="button"
              disabled={isDisabled}
              className="text-left text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
              onClick={
                handleCreateNew
              }
            >
              Registrar primer cliente
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <span
          id={descriptionId}
          role="alert"
          className="text-sm text-red-500"
        >
          {error}
        </span>
      ) : helperText ? (
        <span
          id={descriptionId}
          className="text-sm text-gray-500"
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
}