'use client';

import {
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';

export type InputProps = ComponentPropsWithoutRef<'input'> & {
  label?: string;
  error?: string;
  helperText?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  containerClassName?: string;
};

export default function Input({
  id,
  label,
  error,
  helperText,
  startAdornment,
  endAdornment,
  containerClassName = '',
  className = '',
  required = false,
  disabled = false,
  'aria-describedby': externalAriaDescribedBy,
  'aria-invalid': externalAriaInvalid,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const descriptionId =
    error || helperText ? `${inputId}-description` : undefined;

  const ariaDescribedBy = [
    externalAriaDescribedBy,
    descriptionId,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={['w-full', containerClassName].filter(Boolean).join(' ')}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-2 block font-medium text-gray-700"
        >
          {label}

          {required ? (
            <span
              aria-hidden="true"
              className="ml-1 text-red-600"
            >
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="relative">
        {startAdornment ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
          >
            {startAdornment}
          </span>
        ) : null}

        <input
          {...props}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : externalAriaInvalid}
          aria-describedby={ariaDescribedBy}
          className={[
            'w-full rounded-lg border p-3',
            'focus:outline-none focus:ring-2',
            'disabled:cursor-not-allowed disabled:bg-gray-100',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500',
            startAdornment ? 'pl-9' : '',
            endAdornment ? 'pr-14' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {endAdornment ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-gray-500"
          >
            {endAdornment}
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          id={descriptionId}
          role="alert"
          className="mt-1 text-sm text-red-600"
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          id={descriptionId}
          className="mt-1 text-sm text-gray-500"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}