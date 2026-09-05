import { ReactNode } from 'react';

type PageContainerSize = 'default' | 'wide' | 'narrow';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  size?: PageContainerSize;
};

const sizeClasses: Record<PageContainerSize, string> = {
  default: '',
  wide: 'max-w-none',
  narrow: 'max-w-3xl',
};

export default function PageContainer({
  children,
  className = '',
  size = 'default',
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${sizeClasses[size]} ${className}`}
    >
      {children}
    </div>
  );
}
