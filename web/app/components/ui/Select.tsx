'use client';

import {
  useId,
  type ChangeEventHandler,
  type ComponentPropsWithoutRef,
} from 'react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<
  ComponentPropsWithoutRef<'select'>,
  'value' | 'onChange' | 'children'
> & {
  label?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
};

export default function Select({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccione una opción',
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  containerClassName = '',
  'aria-describedby': externalAriaDescribedBy,
  'aria-invalid': externalAriaInvalid,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const descriptionId =
    error || helperText ? `${selectId}-description` : undefined;

  
  const ariaDescribedBy =
    [externalAriaDescribedBy, descriptionId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div
      className={[
        'flex w-full flex-col gap-2',
        containerClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label ? (
        <label
          htmlFor={selectId}
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
            ):  null}
          </label>
      ) : null}
      
      <select
        {...props}
        id={selectId}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : externalAriaInvalid}
        aria-describedby={ariaDescribedBy}
        className={[
            'w-full rounded-lg border bg-white px-3 py-3',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500',
          disabled
            ? 'cursor-not-allowed bg-gray-100'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <option value="">
          {placeholder}
        </option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

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
