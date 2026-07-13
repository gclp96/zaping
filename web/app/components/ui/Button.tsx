import { ButtonHTMLAttributes, ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'outline';

type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
};

const variants = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white',

  secondary:
    'bg-gray-600 hover:bg-gray-700 text-white',

  danger:
    'bg-red-600 hover:bg-red-700 text-white',

    success:
    'bg-green-600 hover:bg-green-700 text-white',

  outline:
    'border border-gray-300 bg-white hover:bg-gray-100 text-gray-700',
  };

const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-5 py-3 text-lg',
  };

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Procesando...',
  fullWidth = false,
  className = '',
  disabled,
  ...props
 }: ButtonProps) {

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'fullWidth' : ''}
        rounded-lg
        font-medium
        transition-colors
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? (
        <>
          <LoadingSpinner size={size} />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}